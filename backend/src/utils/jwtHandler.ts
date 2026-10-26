import { jwtVerify } from 'jose';
import { SignJWT } from 'jose';

// Initialize the secret once, not on every request
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

export const verifyToken = async (token: string) => {
    const { payload } = await jwtVerify(token, secret);
    return payload;
};

export const generateToken = async (payload: { id: string }, expiresIn: string | number) => {
    const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);

    return token;
};