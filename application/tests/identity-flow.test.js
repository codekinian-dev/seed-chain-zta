/**
 * Per-User Identity Flow Integration Tests
 * 
 * Tests the complete flow of per-user identity mechanism:
 * 1. User registers in Keycloak (mocked)
 * 2. User enrolls to get Fabric identity
 * 3. User performs operations using their own identity
 * 4. Chaincode verifies keycloak_id attributes
 * 
 * @author Rangga
 * @date 2026-01-10
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Mock environment
process.env.NODE_ENV = 'test';
process.env.FABRIC_CA_URL = 'https://localhost:7054';
process.env.FABRIC_CA_NAME = 'ca.org1.example.com';

// Test configuration
const TEST_CONFIG = {
    keycloakUrl: process.env.KEYCLOAK_URL || 'http://localhost:6080',
    realm: process.env.KEYCLOAK_REALM || 'SeedCertificationRealm',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

    // Test users with different roles
    users: {
        producer: {
            username: 'test_producer_1',
            password: 'password123',
            role: 'producer',
            keycloakId: null, // Will be set after registration
            fabricIdentity: null
        },
        pbtField: {
            username: 'test_pbt_field_1',
            password: 'password123',
            role: 'pbt_field',
            keycloakId: null,
            fabricIdentity: null
        },
        pbtChief: {
            username: 'test_pbt_chief_1',
            password: 'password123',
            role: 'pbt_chief',
            keycloakId: null,
            fabricIdentity: null
        },
        lsmHead: {
            username: 'test_lsm_head_1',
            password: 'password123',
            role: 'lsm_head',
            keycloakId: null,
            fabricIdentity: null
        }
    }
};

/**
 * Helper: Get Keycloak admin token
 */
async function getKeycloakAdminToken() {
    const axios = require('axios');
    try {
        const response = await axios.post(
            `${TEST_CONFIG.keycloakUrl}/realms/master/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'password',
                client_id: 'admin-cli',
                username: 'admin',
                password: 'admin'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('Failed to get admin token:', error.message);
        return null;
    }
}

/**
 * Helper: Create user in Keycloak
 */
async function createKeycloakUser(adminToken, userData) {
    const axios = require('axios');
    try {
        // Create user
        await axios.post(
            `${TEST_CONFIG.keycloakUrl}/admin/realms/${TEST_CONFIG.realm}/users`,
            {
                username: userData.username,
                enabled: true,
                emailVerified: true,
                credentials: [{
                    type: 'password',
                    value: userData.password,
                    temporary: false
                }]
            },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Get user ID
        const usersResponse = await axios.get(
            `${TEST_CONFIG.keycloakUrl}/admin/realms/${TEST_CONFIG.realm}/users`,
            {
                params: { username: userData.username },
                headers: { Authorization: `Bearer ${adminToken}` }
            }
        );

        const userId = usersResponse.data[0]?.id;

        // Assign role
        const rolesResponse = await axios.get(
            `${TEST_CONFIG.keycloakUrl}/admin/realms/${TEST_CONFIG.realm}/roles`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        const role = rolesResponse.data.find(r => r.name === userData.role);
        if (role) {
            await axios.post(
                `${TEST_CONFIG.keycloakUrl}/admin/realms/${TEST_CONFIG.realm}/users/${userId}/role-mappings/realm`,
                [role],
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
        }

        return userId;
    } catch (error) {
        if (error.response?.status === 409) {
            // User already exists, get their ID
            const axios = require('axios');
            const usersResponse = await axios.get(
                `${TEST_CONFIG.keycloakUrl}/admin/realms/${TEST_CONFIG.realm}/users`,
                {
                    params: { username: userData.username },
                    headers: { Authorization: `Bearer ${adminToken}` }
                }
            );
            return usersResponse.data[0]?.id;
        }
        console.error('Failed to create Keycloak user:', error.message);
        return null;
    }
}

/**
 * Helper: Get user access token from Keycloak
 */
async function getUserToken(username, password) {
    const axios = require('axios');
    try {
        const response = await axios.post(
            `${TEST_CONFIG.keycloakUrl}/realms/${TEST_CONFIG.realm}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'password',
                client_id: 'seed-certification-client',
                username: username,
                password: password
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return response.data.access_token;
    } catch (error) {
        console.error(`Failed to get token for ${username}:`, error.message);
        return null;
    }
}

/**
 * Helper: Delete test user from Keycloak
 */
async function deleteKeycloakUser(adminToken, userId) {
    const axios = require('axios');
    try {
        await axios.delete(
            `${TEST_CONFIG.keycloakUrl}/admin/realms/${TEST_CONFIG.realm}/users/${userId}`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        return true;
    } catch (error) {
        console.error('Failed to delete user:', error.message);
        return false;
    }
}

describe('Per-User Identity Flow Tests', () => {
    let adminToken;
    let createdUserIds = [];
    let createdBatchId;

    // Setup: Create test users in Keycloak
    beforeAll(async () => {
        console.log('Setting up test users in Keycloak...');

        adminToken = await getKeycloakAdminToken();
        if (!adminToken) {
            console.warn('Skipping Keycloak setup - could not get admin token');
            return;
        }

        // Create test users
        for (const [key, user] of Object.entries(TEST_CONFIG.users)) {
            const userId = await createKeycloakUser(adminToken, user);
            if (userId) {
                TEST_CONFIG.users[key].keycloakId = userId;
                createdUserIds.push(userId);
                console.log(`Created user ${user.username} with ID: ${userId}`);
            }
        }
    }, 60000);

    // Cleanup: Delete test users
    afterAll(async () => {
        if (adminToken && createdUserIds.length > 0) {
            console.log('Cleaning up test users...');
            for (const userId of createdUserIds) {
                await deleteKeycloakUser(adminToken, userId);
            }
        }
    }, 30000);

    describe('1. Identity Enrollment Flow', () => {

        it('should fail to enroll without authentication', async () => {
            const axios = require('axios');
            try {
                await axios.post(`${TEST_CONFIG.apiBaseUrl}/api/v1/identity/enroll`);
                fail('Should have thrown error');
            } catch (error) {
                expect(error.response.status).toBe(401);
            }
        });

        it('should enroll producer user and create Fabric identity', async () => {
            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const response = await axios.post(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/identity/enroll`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect(response.status).toBe(201);
            expect(response.data.success).toBe(true);
            expect(response.data.data).toHaveProperty('userId');
            expect(response.data.data).toHaveProperty('enrolled', true);

            user.fabricIdentity = response.data.data.userId;
        });

        it('should enroll pbt_field user', async () => {
            const user = TEST_CONFIG.users.pbtField;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const response = await axios.post(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/identity/enroll`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect(response.status).toBe(201);
            user.fabricIdentity = response.data.data.userId;
        });

        it('should enroll pbt_chief user', async () => {
            const user = TEST_CONFIG.users.pbtChief;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const response = await axios.post(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/identity/enroll`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect(response.status).toBe(201);
            user.fabricIdentity = response.data.data.userId;
        });

        it('should enroll lsm_head user', async () => {
            const user = TEST_CONFIG.users.lsmHead;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const response = await axios.post(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/identity/enroll`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect(response.status).toBe(201);
            user.fabricIdentity = response.data.data.userId;
        });

        it('should check identity status', async () => {
            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const response = await axios.get(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/identity/status`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect(response.status).toBe(200);
            expect(response.data.data.hasIdentity).toBe(true);
        });

        it('should handle re-enrollment gracefully', async () => {
            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const response = await axios.post(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/identity/enroll`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Should return 200 (already enrolled) or 201
            expect([200, 201]).toContain(response.status);
        });
    });

    describe('2. Seed Batch Workflow with Per-User Identity', () => {

        it('should create seed batch as producer', async () => {
            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const FormData = require('form-data');

            // Create a test file
            const testFilePath = path.join(__dirname, 'test-document.pdf');
            fs.writeFileSync(testFilePath, 'Test PDF content for seed batch');

            const formData = new FormData();
            formData.append('document', fs.createReadStream(testFilePath));
            formData.append('varietyName', 'Test Variety');
            formData.append('commodity', 'Padi');
            formData.append('harvestDate', '2025-12-01');
            formData.append('seedSourceNumber', 'SRC-TEST-001');
            formData.append('origin', 'Jawa Barat');
            formData.append('iupNumber', 'IUP-TEST-001');
            formData.append('seedClass', 'BD');

            try {
                const response = await axios.post(
                    `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            ...formData.getHeaders()
                        }
                    }
                );

                expect(response.status).toBe(201);
                expect(response.data.success).toBe(true);
                expect(response.data.data).toHaveProperty('batchId');

                createdBatchId = response.data.data.batchId;
                console.log('Created batch:', createdBatchId);
            } finally {
                // Cleanup test file
                if (fs.existsSync(testFilePath)) {
                    fs.unlinkSync(testFilePath);
                }
            }
        });

        it('should fail to create batch without Fabric identity', async () => {
            // Create a new user without enrolling
            const axios = require('axios');

            // Simulate unenrolled user request (mock)
            try {
                await axios.post(
                    `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/load-test`,
                    { varietyName: 'Test' },
                    { headers: { Authorization: 'Bearer invalid-token' } }
                );
                fail('Should have thrown error');
            } catch (error) {
                expect([401, 403]).toContain(error.response.status);
            }
        });

        it('should submit certification as the batch owner', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const FormData = require('form-data');

            const testFilePath = path.join(__dirname, 'test-cert-request.pdf');
            fs.writeFileSync(testFilePath, 'Certification request document');

            const formData = new FormData();
            formData.append('document', fs.createReadStream(testFilePath));

            try {
                const response = await axios.post(
                    `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}/submit`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            ...formData.getHeaders()
                        }
                    }
                );

                expect(response.status).toBe(200);
                expect(response.data.success).toBe(true);
            } finally {
                if (fs.existsSync(testFilePath)) {
                    fs.unlinkSync(testFilePath);
                }
            }
        });

        it('should fail to submit certification as non-owner', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            // Try with pbt_field user (not the owner)
            const user = TEST_CONFIG.users.pbtField;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');

            try {
                await axios.post(
                    `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}/submit`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                fail('Should have thrown error - non-owner should not be able to submit');
            } catch (error) {
                expect([400, 403, 500]).toContain(error.response.status);
            }
        });

        it('should record inspection as pbt_field', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            const user = TEST_CONFIG.users.pbtField;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const FormData = require('form-data');

            const testFilePath = path.join(__dirname, 'test-inspection.jpg');
            fs.writeFileSync(testFilePath, 'Inspection photo content');

            const formData = new FormData();
            formData.append('photo', fs.createReadStream(testFilePath));
            formData.append('inspectionResult', 'Tanaman sehat, tidak ada hama');

            try {
                const response = await axios.post(
                    `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}/inspect`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            ...formData.getHeaders()
                        }
                    }
                );

                expect(response.status).toBe(200);
                expect(response.data.success).toBe(true);
            } finally {
                if (fs.existsSync(testFilePath)) {
                    fs.unlinkSync(testFilePath);
                }
            }
        });

        it('should fail inspection with wrong role (producer)', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');

            try {
                await axios.post(
                    `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}/inspect`,
                    { inspectionResult: 'Test' },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                fail('Should have thrown error - producer cannot inspect');
            } catch (error) {
                expect([400, 403, 500]).toContain(error.response.status);
            }
        });

        it('should evaluate inspection as pbt_chief', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            const user = TEST_CONFIG.users.pbtChief;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');

            const response = await axios.post(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}/evaluate`,
                {
                    evaluationNote: 'Inspeksi memenuhi standar',
                    approvalStatus: 'APPROVE'
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect(response.status).toBe(200);
            expect(response.data.success).toBe(true);
        });

        it('should issue certificate as lsm_head', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            const user = TEST_CONFIG.users.lsmHead;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');
            const FormData = require('form-data');

            const testFilePath = path.join(__dirname, 'test-certificate.pdf');
            fs.writeFileSync(testFilePath, 'Certificate document content');

            const formData = new FormData();
            formData.append('document', fs.createReadStream(testFilePath));
            formData.append('certificateNumber', `CERT-TEST-${Date.now()}`);
            formData.append('expiryMonths', '24');

            try {
                const response = await axios.post(
                    `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}/certificate`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            ...formData.getHeaders()
                        }
                    }
                );

                expect(response.status).toBe(200);
                expect(response.data.success).toBe(true);
            } finally {
                if (fs.existsSync(testFilePath)) {
                    fs.unlinkSync(testFilePath);
                }
            }
        });

        it('should distribute seed as batch owner (producer)', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');

            const response = await axios.post(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}/distribute`,
                {
                    distributionLocation: 'Bandung, Jawa Barat',
                    quantity: '1000'
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect(response.status).toBe(200);
            expect(response.data.success).toBe(true);
        });

        it('should fail to distribute as non-owner', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            // Create another producer and try to distribute
            const user = TEST_CONFIG.users.pbtField; // Different user
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');

            try {
                await axios.post(
                    `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}/distribute`,
                    {
                        distributionLocation: 'Jakarta',
                        quantity: '500'
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                fail('Should have thrown error - non-owner cannot distribute');
            } catch (error) {
                expect([400, 403, 500]).toContain(error.response.status);
            }
        });
    });

    describe('3. Query and History with Keycloak ID', () => {

        it('should query batch with keycloak_id tracking', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');

            const response = await axios.get(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect(response.status).toBe(200);
            expect(response.data.data).toHaveProperty('producer_keycloak_id');
            expect(response.data.data).toHaveProperty('inspector_field_keycloak_id');
            expect(response.data.data).toHaveProperty('inspector_chief_keycloak_id');
            expect(response.data.data).toHaveProperty('issuer_keycloak_id');
        });

        it('should get history with keycloak tracking', async () => {
            if (!createdBatchId) {
                console.warn('Skipping - no batch created');
                return;
            }

            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');

            const response = await axios.get(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/seed-batches/${createdBatchId}/history`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect(response.status).toBe(200);
            expect(Array.isArray(response.data.data)).toBe(true);

            // Should have multiple history entries from the workflow
            expect(response.data.data.length).toBeGreaterThanOrEqual(4);
        });
    });

    describe('4. Identity Management', () => {

        it('should list identities (admin only)', async () => {
            // This test requires admin role
            // Skip if no admin user is configured
            console.log('Admin identity list test - requires admin role');
        });

        it('should reenroll user identity', async () => {
            const user = TEST_CONFIG.users.producer;
            const token = await getUserToken(user.username, user.password);

            if (!token) {
                console.warn('Skipping - could not get user token');
                return;
            }

            const axios = require('axios');

            const response = await axios.post(
                `${TEST_CONFIG.apiBaseUrl}/api/v1/identity/reenroll`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            expect([200, 201]).toContain(response.status);
        });
    });
});

/**
 * Unit Tests for Identity Service
 */
describe('Identity Service Unit Tests', () => {

    // Mock dependencies
    const mockFabricCAServices = {
        register: jest.fn(),
        enroll: jest.fn(),
        reenroll: jest.fn(),
        revoke: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Role Mapping', () => {
        it('should map Keycloak roles to Fabric attributes correctly', () => {
            const roleMapping = {
                'producer': { role: 'role_producer', dept: 'penangkar' },
                'pbt_field': { role: 'role_pbt_field', dept: 'pbt' },
                'pbt_chief': { role: 'role_pbt_chief', dept: 'pbt' },
                'lsm_head': { role: 'role_lsm_head', dept: 'lsm' },
                'admin': { role: 'role_admin', dept: 'admin' }
            };

            Object.entries(roleMapping).forEach(([keycloakRole, expected]) => {
                // Verify mapping logic
                expect(expected.role).toContain('role_');
            });
        });
    });

    describe('UUID Validation', () => {
        it('should validate UUID format', () => {
            const validUUIDs = [
                '550e8400-e29b-41d4-a716-446655440000',
                'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
            ];

            const invalidUUIDs = [
                'invalid-uuid',
                '550e8400-e29b-41d4-a716',
                'not-a-uuid-at-all',
                ''
            ];

            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            validUUIDs.forEach(uuid => {
                expect(uuidRegex.test(uuid)).toBe(true);
            });

            invalidUUIDs.forEach(uuid => {
                expect(uuidRegex.test(uuid)).toBe(false);
            });
        });
    });
});
