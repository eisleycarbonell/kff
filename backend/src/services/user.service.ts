export const listUsers = async () => {
    return [
        {
            userId: 1,
            firstName: "John",
            lastName: "Doe",
            email: "[EMAIL_ADDRESS]",
            mobileNumber: "1234567890",
            address: "123 Main St",
            dateOfBirth: "1990-01-01",
            roleId: 1,
            isEmailVerified: true,
            lastLoginAt: "2022-01-01T00:00:00.000Z",
            deletedAt: null,
            createdBy: 1,
            createdAt: "2022-01-01T00:00:00.000Z",
            updatedBy: 1,
            updatedAt: "2022-01-01T00:00:00.000Z",
        },
    ];
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
