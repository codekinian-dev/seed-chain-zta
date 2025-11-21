/**
 * Unit Tests for Zero Trust Policy Engine
 * 
 * Run with: npm test
 */

const policyEngine = require('../src/policies/policyEngine');

// Mock user objects
const producerUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'producer_test',
    roles: ['role_producer'],
    email: 'producer@example.com'
};

const inspectorUser = {
    id: '223e4567-e89b-12d3-a456-426614174001',
    username: 'inspector_field',
    roles: ['role_pbt_field'],
    email: 'inspector@example.com'
};

const chiefUser = {
    id: '323e4567-e89b-12d3-a456-426614174002',
    username: 'inspector_chief',
    roles: ['role_pbt_chief'],
    email: 'chief@example.com'
};

const lsmUser = {
    id: '423e4567-e89b-12d3-a456-426614174003',
    username: 'lsm_head',
    roles: ['role_lsm_head'],
    email: 'lsm@example.com'
};

const unauthorizedUser = {
    id: '523e4567-e89b-12d3-a456-426614174004',
    username: 'unauthorized',
    roles: ['role_unknown'],
    email: 'unauthorized@example.com'
};

console.log('=== Zero Trust Policy Engine Tests ===\n');

// Test 1: Producer can create seed_batch
console.log('Test 1: Producer creates seed_batch');
let decision = policyEngine.evaluate(producerUser, 'seed_batch', 'create');
console.log(`Result: ${decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 2: Inspector cannot create seed_batch
console.log('Test 2: Inspector tries to create seed_batch (should fail)');
decision = policyEngine.evaluate(inspectorUser, 'seed_batch', 'create');
console.log(`Result: ${!decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 3: Inspector can create inspection
console.log('Test 3: Field Inspector creates inspection');
decision = policyEngine.evaluate(inspectorUser, 'inspection', 'create');
console.log(`Result: ${decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 4: Producer cannot create inspection
console.log('Test 4: Producer tries to create inspection (should fail)');
decision = policyEngine.evaluate(producerUser, 'inspection', 'create');
console.log(`Result: ${!decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 5: LSM Head can issue certificate
console.log('Test 5: LSM Head issues certificate');
decision = policyEngine.evaluate(lsmUser, 'certificate', 'issue');
console.log(`Result: ${decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 6: Producer cannot issue certificate
console.log('Test 6: Producer tries to issue certificate (should fail)');
decision = policyEngine.evaluate(producerUser, 'certificate', 'issue');
console.log(`Result: ${!decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 7: Chief can approve evaluation
console.log('Test 7: Chief approves evaluation');
decision = policyEngine.evaluate(chiefUser, 'evaluation', 'approve');
console.log(`Result: ${decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 8: Unknown resource
console.log('Test 8: Access unknown resource (should fail)');
decision = policyEngine.evaluate(producerUser, 'unknown_resource', 'create');
console.log(`Result: ${!decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 9: Unknown action
console.log('Test 9: Unknown action on valid resource (should fail)');
decision = policyEngine.evaluate(producerUser, 'seed_batch', 'unknown_action');
console.log(`Result: ${!decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 10: Unauthorized user
console.log('Test 10: User with no valid role (should fail)');
decision = policyEngine.evaluate(unauthorizedUser, 'seed_batch', 'create');
console.log(`Result: ${!decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 11: Invalid user object
console.log('Test 11: Invalid user object (should fail)');
decision = policyEngine.evaluate(null, 'seed_batch', 'create');
console.log(`Result: ${!decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 12: Missing resource/action
console.log('Test 12: Missing resource parameter (should fail)');
decision = policyEngine.evaluate(producerUser, '', 'create');
console.log(`Result: ${!decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 13: Ownership check
console.log('Test 13: Ownership validation (owner access)');
decision = policyEngine.evaluate(producerUser, 'seed_batch', 'update', {
    ownerOnly: true,
    ownerId: producerUser.id
});
console.log(`Result: ${decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 14: Ownership violation
console.log('Test 14: Ownership validation (non-owner, should fail)');
decision = policyEngine.evaluate(producerUser, 'seed_batch', 'update', {
    ownerOnly: true,
    ownerId: 'different-user-id'
});
console.log(`Result: ${!decision.allow ? 'PASS' : 'FAIL'}`);
console.log(`Reason: ${decision.reason}\n`);

// Test 15: Bulk evaluation
console.log('Test 15: Bulk policy evaluation');
const requests = [
    { resource: 'seed_batch', action: 'create' },
    { resource: 'inspection', action: 'create' },
    { resource: 'certificate', action: 'issue' }
];
const bulkDecisions = policyEngine.evaluateBulk(producerUser, requests);
console.log(`Results: ${bulkDecisions[0].allow ? 'PASS' : 'FAIL'}, ${bulkDecisions[1].allow ? 'FAIL (expected)' : 'PASS'}, ${bulkDecisions[2].allow ? 'FAIL (expected)' : 'PASS'}`);
console.log(`Decisions: ${bulkDecisions.map(d => d.allow).join(', ')}\n`);

// Test 16: Role helper - hasAnyRole
console.log('Test 16: hasAnyRole helper');
const hasRole = policyEngine.hasAnyRole(producerUser, ['role_producer', 'role_lsm_head']);
console.log(`Result: ${hasRole ? 'PASS' : 'FAIL'}`);
console.log(`Has any role: ${hasRole}\n`);

// Test 17: Role helper - hasAllRoles
console.log('Test 17: hasAllRoles helper');
const hasAllRoles = policyEngine.hasAllRoles(producerUser, ['role_producer']);
console.log(`Result: ${hasAllRoles ? 'PASS' : 'FAIL'}`);
console.log(`Has all roles: ${hasAllRoles}\n`);

console.log('=== Time Restriction Test ===');
console.log('NOTE: Time restriction test depends on current system time');
console.log('Restricted hours: 22:00 - 06:00');
const now = new Date();
console.log(`Current time: ${now.toTimeString()}`);
console.log(`Current hour: ${now.getHours()}\n`);

console.log('=== All Tests Completed ===');
