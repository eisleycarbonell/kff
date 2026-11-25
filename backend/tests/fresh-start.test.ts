import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    FRESH_ADMIN_PERMISSIONS,
    parseFreshStartArgs,
    requireFreshRebuildOptIn,
    validateAdminInput,
} from '../src/db/fresh-start.ts';
import { TestDatabaseError } from '../src/db/test-database.ts';

test('fresh start administrator role includes all six management permissions', () => {
    assert.deepEqual(FRESH_ADMIN_PERMISSIONS, {
        canManageInventory: true,
        canManagePurchasing: true,
        canManagePacking: true,
        canManageTransfers: true,
        canManageUsers: true,
        canManageAccounting: true,
    });
});

test('fresh rebuild requires explicit opt-in environment flag', () => {
    assert.throws(() => requireFreshRebuildOptIn({}), TestDatabaseError);
    assert.throws(
        () => requireFreshRebuildOptIn({ KFF_ALLOW_FRESH_REBUILD: 'false' }),
        TestDatabaseError,
    );
    assert.doesNotThrow(() => requireFreshRebuildOptIn({ KFF_ALLOW_FRESH_REBUILD: 'true' }));
    assert.doesNotThrow(() => requireFreshRebuildOptIn({ KFF_ALLOW_TEST_DATA: 'true' }));
});

test('fresh start CLI flags parse --help, --yes, --no-admin, and --no-start', () => {
    assert.deepEqual(parseFreshStartArgs([]), {
        help: false,
        yes: false,
        noAdmin: false,
        noStart: false,
    });
    assert.deepEqual(parseFreshStartArgs(['--yes', '--no-admin', '--no-start']), {
        help: false,
        yes: true,
        noAdmin: true,
        noStart: true,
    });
    assert.equal(parseFreshStartArgs(['-h']).help, true);
    assert.equal(parseFreshStartArgs(['--help']).help, true);
});

test('admin input validation normalizes fields and rejects invalid email or short password', () => {
    const valid = validateAdminInput({
        firstName: '  System ',
        lastName: ' Admin ',
        email: '  ADMIN@KFF.LOCAL ',
        password: 'StrongPassword123!',
    });
    assert.deepEqual(valid, {
        firstName: 'System',
        lastName: 'Admin',
        email: 'admin@kff.local',
        password: 'StrongPassword123!',
    });

    assert.throws(
        () =>
            validateAdminInput({
                firstName: 'System',
                lastName: 'Admin',
                email: 'not-an-email',
                password: 'StrongPassword123!',
            }),
        TestDatabaseError,
    );
    assert.throws(
        () =>
            validateAdminInput({
                firstName: 'System',
                lastName: 'Admin',
                email: 'admin@kff.local',
                password: 'short',
            }),
        TestDatabaseError,
    );
});
