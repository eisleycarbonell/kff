import type { RequestHandler } from 'express';
import { promisify } from 'node:util';
import { brotliCompress, constants as zlibConstants, gzip } from 'node:zlib';

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const COMPRESSIBLE_CONTENT_TYPE =
    /^(?:application\/json|text\/(?!event-stream)|application\/javascript|image\/svg\+xml)/i;

type SupportedEncoding = 'br' | 'gzip';

function parseQValue(rawParams: string[]): number {
    for (const param of rawParams) {
        const trimmed = param.trim().toLowerCase();
        if (trimmed.startsWith('q=')) {
            const parsed = Number(trimmed.slice(2));
            return Number.isFinite(parsed) ? parsed : 0;
        }
    }
    return 1;
}

export function negotiateEncoding(
    acceptEncodingHeader?: string | string[],
): SupportedEncoding | null {
    if (!acceptEncodingHeader) return null;
    const raw = Array.isArray(acceptEncodingHeader)
        ? acceptEncodingHeader.join(',')
        : acceptEncodingHeader;
    if (!raw.trim()) return null;

    let brQ = -1;
    let gzipQ = -1;
    let wildcardQ = -1;

    for (const part of raw.split(',')) {
        const [codingRaw, ...params] = part.split(';');
        const coding = (codingRaw ?? '').trim().toLowerCase();
        if (!coding) continue;
        const q = parseQValue(params);
        if (coding === 'br') brQ = Math.max(brQ, q);
        else if (coding === 'gzip') gzipQ = Math.max(gzipQ, q);
        else if (coding === '*') wildcardQ = Math.max(wildcardQ, q);
    }

    const effectiveBr = brQ >= 0 ? brQ : wildcardQ;
    const effectiveGzip = gzipQ >= 0 ? gzipQ : wildcardQ;

    if (effectiveBr <= 0 && effectiveGzip <= 0) return null;
    if (effectiveBr > 0 && effectiveBr >= effectiveGzip) return 'br';
    if (effectiveGzip > 0) return 'gzip';
    return null;
}

function toBuffer(chunk: unknown, encoding?: BufferEncoding): Buffer | null {
    if (chunk === undefined || chunk === null) return null;
    if (Buffer.isBuffer(chunk)) return chunk;
    if (typeof chunk === 'string') return Buffer.from(chunk, encoding ?? 'utf8');
    if (chunk instanceof Uint8Array) {
        return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    }
    return Buffer.from(String(chunk), encoding ?? 'utf8');
}

export function createCompressionMiddleware(thresholdBytes = 1024): RequestHandler {
    return (req, res, next) => {
        if (req.method === 'HEAD') {
            next();
            return;
        }

        const encoding = negotiateEncoding(req.headers['accept-encoding']);
        if (!encoding) {
            next();
            return;
        }

        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);
        const chunks: Buffer[] = [];
        let bypass = false;
        let ended = false;

        const isCacheNoTransform = () =>
            String(res.getHeader('cache-control') ?? '')
                .toLowerCase()
                .includes('no-transform');

        const shouldBypassState = () =>
            res.headersSent ||
            res.statusCode === 204 ||
            res.statusCode === 304 ||
            Boolean(res.getHeader('content-encoding')) ||
            isCacheNoTransform();

        const isCompressible = () => {
            const contentType = String(res.getHeader('content-type') ?? '').trim();
            return COMPRESSIBLE_CONTENT_TYPE.test(contentType);
        };

        const flushUncompressedBuffered = () => {
            while (chunks.length > 0) {
                const nextChunk = chunks.shift()!;
                origWrite(nextChunk);
            }
        };

        res.write = ((
            chunk: unknown,
            encodingOrCb?: BufferEncoding | ((error?: Error | null) => void),
            cb?: (error?: Error | null) => void,
        ) => {
            const chunkEncoding = typeof encodingOrCb === 'string' ? encodingOrCb : undefined;
            const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;

            if (
                !bypass &&
                (shouldBypassState() || (res.getHeader('content-type') && !isCompressible()))
            ) {
                bypass = true;
                flushUncompressedBuffered();
            }

            if (bypass) {
                if (chunkEncoding) {
                    return origWrite(chunk, chunkEncoding, callback);
                }
                return origWrite(chunk, callback);
            }

            const buf = toBuffer(chunk, chunkEncoding);
            if (buf && buf.length > 0) chunks.push(buf);
            if (callback) callback();
            return true;
        }) as typeof res.write;

        res.end = ((
            chunkOrCb?: unknown,
            encodingOrCb?: BufferEncoding | (() => void),
            cb?: () => void,
        ) => {
            if (ended) return res;
            ended = true;

            let chunk: unknown = undefined;
            let chunkEncoding: BufferEncoding | undefined = undefined;
            let callback: (() => void) | undefined = undefined;

            if (typeof chunkOrCb === 'function') {
                callback = chunkOrCb as () => void;
            } else {
                chunk = chunkOrCb;
                if (typeof encodingOrCb === 'function') {
                    callback = encodingOrCb;
                } else {
                    chunkEncoding = encodingOrCb;
                    callback = cb;
                }
            }

            const buf = toBuffer(chunk, chunkEncoding);
            if (buf && buf.length > 0) chunks.push(buf);

            if (bypass || shouldBypassState() || !isCompressible()) {
                const body = chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks);
                return origEnd(body, callback);
            }

            res.vary('Accept-Encoding');
            const body = chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks);

            if (body.length < thresholdBytes) {
                return origEnd(body, callback);
            }

            const compressPromise =
                encoding === 'br'
                    ? brotliCompressAsync(body, {
                          params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
                      })
                    : gzipAsync(body, { level: 6 });

            void compressPromise
                .then((compressed) => {
                    if (res.headersSent || res.destroyed) {
                        callback?.();
                        return;
                    }
                    res.removeHeader('Content-Length');
                    res.setHeader('Content-Encoding', encoding);
                    res.setHeader('Content-Length', compressed.length);
                    origEnd(compressed, callback);
                })
                .catch(() => {
                    if (!res.headersSent && !res.destroyed) {
                        origEnd(body, callback);
                    } else {
                        callback?.();
                    }
                });

            return res;
        }) as typeof res.end;

        next();
    };
}
