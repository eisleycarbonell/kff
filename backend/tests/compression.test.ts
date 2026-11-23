import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import http from 'node:http';
import { test } from 'node:test';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createCompressionMiddleware } from '../src/middleware/compression.ts';

async function withServer(run: (origin: string) => Promise<void>) {
    const app = express();
    app.use(createCompressionMiddleware(1024));
    app.get('/small', (_req, res) => {
        res.json({ ok: true, message: 'small' });
    });
    app.get('/large', (_req, res) => {
        res.json({
            ok: true,
            items: Array.from({ length: 80 }, (_, index) => ({
                id: index + 1,
                sku: `SPICE-${String(index + 1).padStart(4, '0')}`,
                description: 'Ground black pepper packed in airtight pouch',
            })),
        });
    });

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
        await run(`http://127.0.0.1:${address.port}`);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}

function rawGet(
    url: string,
    acceptEncoding?: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
    return new Promise((resolve, reject) => {
        const req = http.get(
            url,
            {
                headers: acceptEncoding ? { 'Accept-Encoding': acceptEncoding } : {},
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                res.on('end', () =>
                    resolve({
                        status: res.statusCode ?? 0,
                        headers: res.headers,
                        body: Buffer.concat(chunks),
                    }),
                );
            },
        );
        req.on('error', reject);
    });
}

test('compression skips payloads under threshold and compresses larger JSON payloads with br or gzip', async () => {
    await withServer(async (origin) => {
        const small = await rawGet(`${origin}/small`, 'br, gzip');
        assert.equal(small.status, 200);
        assert.equal(small.headers['content-encoding'], undefined);
        assert.deepEqual(JSON.parse(small.body.toString('utf8')), { ok: true, message: 'small' });

        const plain = await rawGet(`${origin}/large`, 'identity');
        assert.equal(plain.status, 200);
        assert.equal(plain.headers['content-encoding'], undefined);
        const expected = JSON.parse(plain.body.toString('utf8'));

        const br = await rawGet(`${origin}/large`, 'gzip, br');
        assert.equal(br.status, 200);
        assert.equal(br.headers['content-encoding'], 'br');
        assert.match(String(br.headers['vary'] ?? ''), /accept-encoding/i);
        assert.ok(br.body.length < plain.body.length);
        assert.deepEqual(JSON.parse(brotliDecompressSync(br.body).toString('utf8')), expected);

        const gz = await rawGet(`${origin}/large`, 'gzip, br;q=0');
        assert.equal(gz.status, 200);
        assert.equal(gz.headers['content-encoding'], 'gzip');
        assert.ok(gz.body.length < plain.body.length);
        assert.deepEqual(JSON.parse(gunzipSync(gz.body).toString('utf8')), expected);

        const none = await rawGet(`${origin}/large`);
        assert.equal(none.status, 200);
        assert.equal(none.headers['content-encoding'], undefined);
        assert.deepEqual(JSON.parse(none.body.toString('utf8')), expected);
    });
});
