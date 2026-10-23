import * as argon2 from 'argon2';

/**
 * Hashes a plain text password using Argon2id
 * @param plaintextPassword - The raw password to hash
 * @returns The hashed password string
 */
export const hashPassword = async (plaintextPassword: string): Promise<string> => {
    return await argon2.hash(plaintextPassword);
};

/**
 * Compares a plain text password with an Argon2 hash
 * @param plaintextPassword - The raw password entered by the user
 * @param hashedPassword - The hashed password stored in the database
 * @returns A boolean indicating if the passwords match
 */
export const comparePasswords = async (plaintextPassword: string, hashedPassword: string): Promise<boolean> => {
    try {
        return await argon2.verify(hashedPassword, plaintextPassword);
    } catch (error) {
        return false;
    }
};