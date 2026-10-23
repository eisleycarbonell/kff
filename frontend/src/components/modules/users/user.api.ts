import {
    USER_ROLES,
    validateUser,
    type User,
    type UserFormValues,
} from "@/components/modules/users/user.schema"

const STORAGE_KEY = "kff.users.v1"

// This adapter deliberately stores demo records in this browser. Replace it
// with the backend contract once user CRUD endpoints are available.
const DEMO_USERS: User[] = [
    {
        userId: 1,
        firstName: "System",
        lastName: "Administrator",
        email: "admin@spice.local",
        mobileNumber: "+63 917 100 2001",
        roleId: 1,
        isEmailVerified: true,
        createdAt: "2026-01-05T08:00:00.000Z",
        lastLoginAt: "2026-10-22T01:15:00.000Z",
    },
    {
        userId: 2,
        firstName: "Maria",
        lastName: "Santos",
        email: "warehouse@spice.local",
        mobileNumber: "+63 917 100 2002",
        roleId: 2,
        isEmailVerified: true,
        createdAt: "2026-01-08T08:00:00.000Z",
        lastLoginAt: "2026-10-22T02:30:00.000Z",
    },
    {
        userId: 3,
        firstName: "Carlo",
        lastName: "Reyes",
        email: "purchasing@spice.local",
        mobileNumber: "+63 917 100 2003",
        roleId: 3,
        isEmailVerified: true,
        createdAt: "2026-01-12T08:00:00.000Z",
        lastLoginAt: "2026-10-21T04:45:00.000Z",
    },
    {
        userId: 4,
        firstName: "Andrea",
        lastName: "Cruz",
        email: "andrea.cruz@spice.local",
        mobileNumber: "+63 917 100 2004",
        roleId: 1,
        isEmailVerified: true,
        createdAt: "2026-02-03T08:00:00.000Z",
        lastLoginAt: "2026-10-21T06:20:00.000Z",
    },
    {
        userId: 5,
        firstName: "Miguel",
        lastName: "Garcia",
        email: "miguel.garcia@spice.local",
        mobileNumber: "+63 917 100 2005",
        roleId: 2,
        isEmailVerified: true,
        createdAt: "2026-02-17T08:00:00.000Z",
        lastLoginAt: "2026-10-20T00:10:00.000Z",
    },
    {
        userId: 6,
        firstName: "Isabella",
        lastName: "Ramos",
        email: "isabella.ramos@spice.local",
        mobileNumber: "+63 917 100 2006",
        roleId: 3,
        isEmailVerified: true,
        createdAt: "2026-03-02T08:00:00.000Z",
        lastLoginAt: "2026-10-20T03:25:00.000Z",
    },
    {
        userId: 7,
        firstName: "Paolo",
        lastName: "Bautista",
        email: "paolo.bautista@spice.local",
        mobileNumber: "+63 917 100 2007",
        roleId: 2,
        isEmailVerified: true,
        createdAt: "2026-03-16T08:00:00.000Z",
        lastLoginAt: "2026-10-19T07:40:00.000Z",
    },
    {
        userId: 8,
        firstName: "Camille",
        lastName: "Mendoza",
        email: "camille.mendoza@spice.local",
        mobileNumber: "+63 917 100 2008",
        roleId: 3,
        isEmailVerified: false,
        createdAt: "2026-04-07T08:00:00.000Z",
        lastLoginAt: null,
    },
    {
        userId: 9,
        firstName: "Gabriel",
        lastName: "Dela Cruz",
        email: "gabriel.delacruz@spice.local",
        mobileNumber: "+63 917 100 2009",
        roleId: 2,
        isEmailVerified: true,
        createdAt: "2026-04-21T08:00:00.000Z",
        lastLoginAt: "2026-10-18T05:50:00.000Z",
    },
    {
        userId: 10,
        firstName: "Sofia",
        lastName: "Aquino",
        email: "sofia.aquino@spice.local",
        mobileNumber: "+63 917 100 2010",
        roleId: 3,
        isEmailVerified: true,
        createdAt: "2026-05-11T08:00:00.000Z",
        lastLoginAt: "2026-10-17T01:35:00.000Z",
    },
    {
        userId: 11,
        firstName: "Rafael",
        lastName: "Navarro",
        email: "rafael.navarro@spice.local",
        mobileNumber: "+63 917 100 2011",
        roleId: 2,
        isEmailVerified: false,
        createdAt: "2026-06-09T08:00:00.000Z",
        lastLoginAt: null,
    },
    {
        userId: 12,
        firstName: "Beatriz",
        lastName: "Villanueva",
        email: "beatriz.villanueva@spice.local",
        mobileNumber: "",
        roleId: 3,
        isEmailVerified: true,
        createdAt: "2026-07-14T08:00:00.000Z",
        lastLoginAt: "2026-10-16T02:15:00.000Z",
    },
    {
        userId: 13,
        firstName: "Luis",
        lastName: "Castillo",
        email: "luis.castillo@spice.local",
        mobileNumber: "+63 917 100 2013",
        roleId: 2,
        isEmailVerified: true,
        createdAt: "2026-08-18T08:00:00.000Z",
        lastLoginAt: "2026-10-15T06:10:00.000Z",
    },
    {
        userId: 14,
        firstName: "Patricia",
        lastName: "Fernandez",
        email: "patricia.fernandez@spice.local",
        mobileNumber: "",
        roleId: 3,
        isEmailVerified: false,
        createdAt: "2026-10-20T08:00:00.000Z",
        lastLoginAt: null,
    },
]

let lastCreatedId = 0

function getStorage(): Storage {
    if (typeof window === "undefined") {
        throw new Error("User data is available only in a browser.")
    }

    try {
        return window.localStorage
    } catch {
        throw new Error("Browser storage is unavailable. Allow site storage and try again.")
    }
}

function isTimestamp(value: unknown): value is string {
    if (typeof value !== "string") return false
    const date = new Date(value)
    return Number.isFinite(date.getTime()) && date.toISOString() === value
}

function assertUsers(value: unknown): asserts value is User[] {
    if (!Array.isArray(value)) {
        throw new Error(
            "Saved user data is invalid: expected a list of users. Your saved data has been kept.",
        )
    }

    const ids = new Set<number>()
    const emails = new Set<string>()

    for (const [index, record] of value.entries()) {
        const invalid = () =>
            new Error(
                `Saved user data is invalid at record ${index + 1}. Your saved data has been kept.`,
            )

        if (typeof record !== "object" || record === null || Array.isArray(record)) {
            throw invalid()
        }

        const user = record as Record<string, unknown>
        if (
            !Number.isSafeInteger(user.userId) ||
            (user.userId as number) <= 0 ||
            ids.has(user.userId as number) ||
            typeof user.firstName !== "string" ||
            typeof user.lastName !== "string" ||
            typeof user.email !== "string" ||
            typeof user.mobileNumber !== "string" ||
            typeof user.roleId !== "number" ||
            !USER_ROLES.some((role) => role.id === user.roleId) ||
            typeof user.isEmailVerified !== "boolean" ||
            !isTimestamp(user.createdAt) ||
            (user.lastLoginAt !== null && !isTimestamp(user.lastLoginAt))
        ) {
            throw invalid()
        }

        const typedUser = record as User
        const email = typedUser.email.trim().toLowerCase()
        if (emails.has(email) || Object.keys(validateUser(typedUser, [])).length > 0) {
            throw invalid()
        }

        ids.add(typedUser.userId)
        emails.add(email)
    }
}

export function readUsers(): User[] {
    const storage = getStorage()
    let stored: string | null

    try {
        stored = storage.getItem(STORAGE_KEY)
    } catch {
        throw new Error("User data could not be loaded. Allow site storage and try again.")
    }

    if (stored === null) {
        const users = DEMO_USERS.map((user) => ({ ...user }))
        saveUsers(users)
        return users
    }

    let users: unknown
    try {
        users = JSON.parse(stored)
    } catch {
        throw new Error("Saved user data is not valid JSON. Your saved data has been kept.")
    }

    assertUsers(users)
    lastCreatedId = users.reduce((latest, user) => Math.max(latest, user.userId), lastCreatedId)
    return users
}

export function saveUsers(users: User[]): void {
    assertUsers(users)

    try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(users))
    } catch {
        throw new Error(
            "Changes could not be saved to this browser. Check site storage permissions and available space, then try again.",
        )
    }
}

export function createUser(values: UserFormValues): User {
    const errors = validateUser(values, [])
    if (Object.keys(errors).length > 0) {
        throw new Error("Enter valid user details before saving.")
    }

    const userId = Math.max(Date.now(), lastCreatedId + 1)
    if (!Number.isSafeInteger(userId)) {
        throw new Error("A new user ID could not be generated.")
    }

    lastCreatedId = userId
    return {
        ...values,
        userId,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        mobileNumber: values.mobileNumber.trim(),
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
    }
}
