import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"

registerHooks({
    resolve(specifier, context, nextResolve) {
        const resolved = specifier.startsWith("@/")
            ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href
            : specifier
        return nextResolve(resolved, context)
    },
})

const originalFetch = globalThis.fetch
let importCount = 0

async function importApi(baseUrl) {
    const previous = process.env.NEXT_PUBLIC_API_BASE_URL
    if (baseUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL
    else process.env.NEXT_PUBLIC_API_BASE_URL = baseUrl

    try {
        return await import(`../src/hooks/modules/users/use-users.ts?test=${++importCount}`)
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL
        else process.env.NEXT_PUBLIC_API_BASE_URL = previous
    }
}

const api = await importApi()
const user = {
    userId: 42,
    firstName: "Maria",
    middleName: null,
    lastName: "Santos",
    dateOfBirth: null,
    avatarUrl: null,
    mobileNumber: null,
    address: null,
    email: "maria@example.test",
    roleId: 2,
    isEmailVerified: false,
    lastLoginAt: null,
    deletedAt: null,
    createdBy: null,
    createdAt: "2026-10-26T00:00:00.000Z",
    updatedBy: null,
    updatedAt: "2026-10-26T00:00:00.000Z",
}

afterEach(() => {
    globalThis.fetch = originalFetch
})

test("GET uses the default endpoint, credentials and signal and preserves nullable user fields", async () => {
    const controller = new AbortController()
    let requests = 0
    globalThis.fetch = async (url, options) => {
        requests++
        assert.equal(url, "http://localhost:3001/api/user")
        assert.equal(options.method, "GET")
        assert.equal(options.credentials, "include")
        assert.equal(options.signal, controller.signal)
        assert.equal(new Headers(options.headers).get("Accept"), "application/json")
        assert.equal(options.body, undefined)
        return Response.json({ success: true, data: [user] })
    }

    assert.equal(api.USERS_ENDPOINT, "http://localhost:3001/api/user")
    const users = await api.getUsers(controller.signal)
    assert.deepEqual(users, [user])
    assert.equal("passwordHash" in users[0], false)
    assert.equal(requests, 1)
})

test("GET accepts an empty user list", async () => {
    globalThis.fetch = async () => Response.json({ success: true, data: [] })
    assert.deepEqual(await api.getUsers(), [])
})

test("POST sends create fields and a plain password and returns the server user", async () => {
    const input = {
        firstName: "Maria",
        lastName: "Santos",
        email: "maria@example.test",
        mobileNumber: null,
        roleId: 2,
        isEmailVerified: false,
        middleName: null,
        dateOfBirth: "1990-05-04",
        avatarUrl: null,
        address: "Manila",
        password: "Create-password-123!",
    }
    globalThis.fetch = async (url, options) => {
        assert.equal(url, api.USERS_ENDPOINT)
        assert.equal(options.method, "POST")
        assert.equal(options.credentials, "include")
        assert.equal(new Headers(options.headers).get("Content-Type"), "application/json")
        const body = JSON.parse(options.body)
        assert.deepEqual(body, input)
        assert.equal(body.password, input.password)
        assert.equal("passwordHash" in body, false)
        assert.equal("userId" in body, false)
        return Response.json({ success: true, data: user }, { status: 201 })
    }

    assert.deepEqual(await api.createUser(input), user)
})

test("PATCH sends only changed fields without a password", async () => {
    const input = { firstName: "Marie", middleName: null, mobileNumber: null }
    const updated = { ...user, ...input, updatedBy: 1 }
    globalThis.fetch = async (url, options) => {
        assert.equal(url, `${api.USERS_ENDPOINT}/42`)
        assert.equal(options.method, "PATCH")
        assert.equal(options.credentials, "include")
        assert.equal(new Headers(options.headers).get("Content-Type"), "application/json")
        const body = JSON.parse(options.body)
        assert.deepEqual(body, input)
        assert.equal("password" in body, false)
        assert.equal("passwordHash" in body, false)
        assert.equal("createdAt" in body, false)
        return Response.json({ success: true, data: updated })
    }

    assert.deepEqual(await api.updateUser(42, input), updated)
})

for (const [name, response] of [
    ["204", () => new Response(null, { status: 204 })],
    [
        "a success envelope without data",
        () => Response.json({ success: true, message: "Deleted." }),
    ],
]) {
    test(`DELETE accepts ${name}`, async () => {
        globalThis.fetch = async (url, options) => {
            assert.equal(url, `${api.USERS_ENDPOINT}/42`)
            assert.equal(options.method, "DELETE")
            assert.equal(options.credentials, "include")
            assert.equal(options.body, undefined)
            return response()
        }

        assert.equal(await api.deleteUser(42), undefined)
    })
}

for (const status of [200, 409]) {
    test(`backend errors preserve their message for HTTP ${status}`, async () => {
        globalThis.fetch = async () =>
            Response.json(
                { success: false, error: { message: "  This email is already registered.  " } },
                { status },
            )
        await assert.rejects(api.getUsers(), {
            message: "This email is already registered.",
        })
    })
}

test("non-JSON HTTP failures report the response status", async () => {
    globalThis.fetch = async () => new Response("Service unavailable", { status: 503 })
    await assert.rejects(api.getUsers(), /HTTP 503/)
})

test("an HTTP error cannot be masked by a success envelope", async () => {
    globalThis.fetch = async () => Response.json({ success: true, data: [user] }, { status: 500 })
    await assert.rejects(api.getUsers(), /HTTP 500/)
})

test("successful responses with invalid JSON fail clearly", async () => {
    globalThis.fetch = async () => new Response("{broken JSON", { status: 200 })
    await assert.rejects(api.getUsers(), /invalid JSON/)
})

for (const [name, payload, expected] of [
    ["the backend string mock", { success: true, data: "mock users" }, /expected a list of users/],
    ["missing data", { success: true }, /user data is missing/],
    ["a missing success flag", { data: [user] }, /invalid response/],
    ["a non-boolean success flag", { success: "true", data: [user] }, /invalid response/],
    ["a null envelope", null, /invalid response/],
    ["invalid list records", { success: true, data: [null] }, /invalid user record/],
]) {
    test(`GET rejects ${name}`, async () => {
        globalThis.fetch = async () => Response.json(payload)
        await assert.rejects(api.getUsers(), expected)
    })
}

test("mutations reject a malformed returned user", async () => {
    globalThis.fetch = async () => Response.json({ success: true, data: "updated" })
    await assert.rejects(api.updateUser(42, { firstName: "Marie" }), /invalid user record/)
})

test("GET rejects records missing any public field before they can reach the UI", async () => {
    for (const field of Object.keys(user)) {
        const incomplete = { ...user }
        delete incomplete[field]
        globalThis.fetch = async () => Response.json({ success: true, data: [incomplete] })
        await assert.rejects(api.getUsers(), /invalid user record/, `missing ${field}`)
    }
})

test("GET rejects invalid field types and IDs", async () => {
    for (const [field, value] of [
        ["userId", 0],
        ["userId", 1.5],
        ["userId", Number.MAX_SAFE_INTEGER + 1],
        ["roleId", -1],
        ["roleId", "2"],
        ["roleId", 1.5],
        ["firstName", null],
        ["lastName", 3],
        ["email", null],
        ["middleName", 7],
        ["avatarUrl", {}],
        ["mobileNumber", 9171234567],
        ["address", []],
        ["isEmailVerified", "false"],
        ["createdBy", "1"],
        ["createdBy", 0],
        ["updatedBy", -1],
        ["updatedBy", 1.5],
    ]) {
        globalThis.fetch = async () =>
            Response.json({
                success: true,
                data: [{ ...user, [field]: value }],
            })
        await assert.rejects(api.getUsers(), /invalid user record/, `invalid ${field}`)
    }
})

test("GET rejects unusable timestamps and non-calendar dates", async () => {
    for (const field of ["createdAt", "updatedAt", "lastLoginAt", "deletedAt"]) {
        for (const value of [
            "not-a-date",
            "2026-10-26",
            "2026-02-30T00:00:00.000Z",
            "2026-10-26T24:00:00.000Z",
            "2026-10-26T00:00:00",
            1792972800000,
        ]) {
            globalThis.fetch = async () =>
                Response.json({
                    success: true,
                    data: [{ ...user, [field]: value }],
                })
            await assert.rejects(api.getUsers(), /invalid user record/, `invalid ${field}`)
        }
    }
    for (const [field, value] of [
        ["createdAt", null],
        ["updatedAt", null],
        ["dateOfBirth", "2026-02-30"],
        ["dateOfBirth", "2026-2-03"],
        ["dateOfBirth", "2026-10-26T00:00:00.000Z"],
        ["dateOfBirth", 20261026],
    ]) {
        globalThis.fetch = async () =>
            Response.json({
                success: true,
                data: [{ ...user, [field]: value }],
            })
        await assert.rejects(api.getUsers(), /invalid user record/, `invalid ${field}`)
    }
})

test("GET accepts populated nullable fields, ISO offsets, leap dates and unknown positive roles", async () => {
    const populated = {
        ...user,
        middleName: "Dela Cruz",
        dateOfBirth: "2000-02-29",
        avatarUrl: "https://images.example.test/maria.png",
        mobileNumber: "+63 917 100 2002",
        address: "Manila",
        roleId: 17,
        lastLoginAt: "2026-10-26T08:00:00+08:00",
        deletedAt: "2026-10-26T01:30:00.123456Z",
        createdBy: 1,
        createdAt: "2026-10-26T00:00:00Z",
        updatedBy: 2,
        updatedAt: "2026-10-26T08:00:00.123+08:00",
    }
    globalThis.fetch = async () => Response.json({ success: true, data: [populated] })
    assert.deepEqual(await api.getUsers(), [populated])
})

for (const [method, invoke] of [
    ["GET", () => api.getUsers()],
    [
        "POST",
        () =>
            api.createUser({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                mobileNumber: null,
                roleId: user.roleId,
                isEmailVerified: false,
                password: "Create-password-123!",
            }),
    ],
    ["PATCH", () => api.updateUser(42, { firstName: user.firstName })],
]) {
    test(`${method} returns only public user fields and strips extra server secrets`, async () => {
        const serverUser = {
            ...user,
            passwordHash: "must-never-enter-the-query-cache",
            password: "must-also-be-stripped",
            internalToken: "another-private-server-field",
        }
        globalThis.fetch = async () =>
            Response.json({
                success: true,
                data: method === "GET" ? [serverUser] : serverUser,
            })
        assert.deepEqual(await invoke(), method === "GET" ? [user] : user)
    })
}

test("network failures produce a usable connection error", async () => {
    globalThis.fetch = async () => {
        throw new TypeError("fetch failed")
    }
    await assert.rejects(api.getUsers(), /Unable to reach the user API/)
})

test("fetch AbortError is preserved for cancellation handling", async () => {
    const aborted = new DOMException("The operation was aborted.", "AbortError")
    globalThis.fetch = async () => {
        throw aborted
    }
    await assert.rejects(api.getUsers(), (error) => error === aborted)
})

test("an aborted signal preserves its rejection reason", async () => {
    const controller = new AbortController()
    const reason = new Error("Navigation cancelled the request")
    controller.abort(reason)
    globalThis.fetch = async (_url, options) => {
        assert.equal(options.signal, controller.signal)
        throw options.signal.reason
    }
    await assert.rejects(api.getUsers(controller.signal), (error) => error === reason)
})

test("AbortError during JSON reading is preserved", async () => {
    const aborted = new DOMException("Body reading was aborted.", "AbortError")
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw aborted
        },
    })
    await assert.rejects(api.getUsers(), (error) => error === aborted)
})

test("the configured base URL has trailing slashes removed", async () => {
    const configured = await importApi("https://users.example.test/api///")
    assert.equal(configured.USERS_ENDPOINT, "https://users.example.test/api/user")
    globalThis.fetch = async (url) => {
        assert.equal(url, configured.USERS_ENDPOINT)
        return Response.json({ success: true, data: [] })
    }
    assert.deepEqual(await configured.getUsers(), [])
})
