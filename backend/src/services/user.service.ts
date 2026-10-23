export const listUsers = async () => {
    return 'listUsers called';
};

export const getUserByID = async (id: string) => {
    return { id, roleId: 1, username: 'testuser' };
};

export const getUserByUsername = async (username: string) => {
    // Mock user implementation
    return {
        id: '1',
        roleId: 1,
        username,
        email: 'test@example.com',
        fullName: 'Test User',
        password: '$argon2id$v=19$m=65536,t=3,p=4$somehash$somehash' // Mock hashed password
    };
};
