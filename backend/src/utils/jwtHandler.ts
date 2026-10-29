import { jwtVerify, SignJWT } from 'jose';

function signingKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET must be configured before using authentication.');
    return new TextEncoder().encode(secret);
}
export async function verifyToken(token: string) {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ['HS256'] });
    return payload;
}
export async function generateToken(payload: { id: string }, expiresIn: string | number) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(signingKey());
}
