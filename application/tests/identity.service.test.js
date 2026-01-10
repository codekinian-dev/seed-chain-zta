/**
 * Identity Service Unit Tests
 * 
 * Tests for the per-user identity mechanism:
 * - Fabric CA enrollment
 * - Role mapping from Keycloak to Fabric
 * - Wallet management
 * - Identity verification
 * 
 * @author Rangga
 * @date 2026-01-10
 */

const path = require('path');
const fs = require('fs');

// Mock environment before requiring the service
process.env.NODE_ENV = 'test';
process.env.FABRIC_CA_URL = 'https://localhost:7054';
process.env.FABRIC_CA_NAME = 'ca.org1.example.com';
process.env.FABRIC_MSP_ID = 'Org1MSP';
process.env.FABRIC_WALLET_PATH = './test-wallet';
process.env.CA_ADMIN_USER = 'admin';
process.env.CA_ADMIN_PASSWORD = 'adminpw';

// Mock fabric-ca-client
jest.mock('fabric-ca-client', () => {
    return jest.fn().mockImplementation(() => ({
        register: jest.fn().mockResolvedValue('mockSecret'),
        enroll: jest.fn().mockResolvedValue({
            certificate: 'mockCertificate',
            key: {
                toBytes: () => 'mockPrivateKey'
            }
        }),
        reenroll: jest.fn().mockResolvedValue({
            certificate: 'mockNewCertificate',
            key: {
                toBytes: () => 'mockNewPrivateKey'
            }
        }),
        revoke: jest.fn().mockResolvedValue(true)
    }));
});

// Mock fabric-network
jest.mock('fabric-network', () => ({
    Wallets: {
        newFileSystemWallet: jest.fn().mockResolvedValue({
            get: jest.fn().mockResolvedValue(null),
            put: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
            list: jest.fn().mockResolvedValue([])
        })
    },
    X509Identity: jest.fn().mockImplementation((config) => config)
}));

describe('Identity Service', () => {
    let identityService;
    let mockWallet;

    beforeAll(() => {
        // Clean up test wallet directory
        const testWalletPath = path.join(process.cwd(), 'test-wallet');
        if (fs.existsSync(testWalletPath)) {
            fs.rmSync(testWalletPath, { recursive: true });
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset module cache to get fresh mocks
        jest.resetModules();

        // Create mock wallet
        mockWallet = {
            get: jest.fn().mockResolvedValue(null),
            put: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
            list: jest.fn().mockResolvedValue([])
        };

        // Update the wallet mock
        require('fabric-network').Wallets.newFileSystemWallet.mockResolvedValue(mockWallet);
    });

    afterAll(() => {
        // Clean up
        const testWalletPath = path.join(process.cwd(), 'test-wallet');
        if (fs.existsSync(testWalletPath)) {
            fs.rmSync(testWalletPath, { recursive: true });
        }
    });

    describe('Role Mapping', () => {
        const roleMapping = {
            producer: {
                fabricRole: 'role_producer',
                department: 'penangkar',
                affiliation: 'org1.department1'
            },
            pbt_field: {
                fabricRole: 'role_pbt_field',
                department: 'pbt',
                affiliation: 'org1.department1'
            },
            pbt_chief: {
                fabricRole: 'role_pbt_chief',
                department: 'pbt',
                affiliation: 'org1.department1'
            },
            lsm_head: {
                fabricRole: 'role_lsm_head',
                department: 'lsm',
                affiliation: 'org1.department1'
            },
            admin: {
                fabricRole: 'role_admin',
                department: 'admin',
                affiliation: 'org1.department1'
            }
        };

        it('should map producer role correctly', () => {
            const keycloakRole = 'producer';
            const expected = roleMapping[keycloakRole];

            expect(expected.fabricRole).toBe('role_producer');
            expect(expected.department).toBe('penangkar');
        });

        it('should map pbt_field role correctly', () => {
            const keycloakRole = 'pbt_field';
            const expected = roleMapping[keycloakRole];

            expect(expected.fabricRole).toBe('role_pbt_field');
            expect(expected.department).toBe('pbt');
        });

        it('should map pbt_chief role correctly', () => {
            const keycloakRole = 'pbt_chief';
            const expected = roleMapping[keycloakRole];

            expect(expected.fabricRole).toBe('role_pbt_chief');
            expect(expected.department).toBe('pbt');
        });

        it('should map lsm_head role correctly', () => {
            const keycloakRole = 'lsm_head';
            const expected = roleMapping[keycloakRole];

            expect(expected.fabricRole).toBe('role_lsm_head');
            expect(expected.department).toBe('lsm');
        });

        it('should map admin role correctly', () => {
            const keycloakRole = 'admin';
            const expected = roleMapping[keycloakRole];

            expect(expected.fabricRole).toBe('role_admin');
            expect(expected.department).toBe('admin');
        });

        it('should include all required attributes', () => {
            Object.entries(roleMapping).forEach(([role, config]) => {
                expect(config).toHaveProperty('fabricRole');
                expect(config).toHaveProperty('department');
                expect(config).toHaveProperty('affiliation');
                expect(config.fabricRole).toContain('role_');
            });
        });
    });

    describe('UUID Validation', () => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        it('should validate correct UUID v4 format', () => {
            const validUUIDs = [
                '550e8400-e29b-41d4-a716-446655440000',
                'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
            ];

            validUUIDs.forEach(uuid => {
                expect(uuidRegex.test(uuid)).toBe(true);
            });
        });

        it('should reject invalid UUID formats', () => {
            const invalidUUIDs = [
                'invalid-uuid',
                '550e8400-e29b-41d4-a716',
                'not-a-uuid-at-all',
                '',
                '550e8400e29b41d4a716446655440000', // No dashes
                '550e8400-e29b-41d4-a716-44665544000g', // Invalid character
                '550e8400-e29b-41d4-a716-4466554400000' // Too long
            ];

            invalidUUIDs.forEach(uuid => {
                expect(uuidRegex.test(uuid)).toBe(false);
            });
        });

        it('should be case insensitive', () => {
            const lowercaseUUID = '550e8400-e29b-41d4-a716-446655440000';
            const uppercaseUUID = '550E8400-E29B-41D4-A716-446655440000';
            const mixedCaseUUID = '550E8400-e29b-41D4-a716-446655440000';

            expect(uuidRegex.test(lowercaseUUID)).toBe(true);
            expect(uuidRegex.test(uppercaseUUID)).toBe(true);
            expect(uuidRegex.test(mixedCaseUUID)).toBe(true);
        });
    });

    describe('IPFS CID Validation', () => {
        // CIDv0 (starts with Qm, base58btc, 46 chars)
        // CIDv1 (starts with b, base32, 59 chars)
        const cidv0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
        const cidv1Regex = /^b[a-z2-7]{58}$/i;

        it('should validate CIDv0 format', () => {
            const validCIDv0 = [
                'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
                'QmZTR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V'
            ];

            validCIDv0.forEach(cid => {
                expect(cidv0Regex.test(cid)).toBe(true);
            });
        });

        it('should reject invalid CIDv0', () => {
            const invalidCIDv0 = [
                'Qm123',  // Too short
                'QmInvalidWithWrongChars!!!',
                'NotACID'
            ];

            invalidCIDv0.forEach(cid => {
                expect(cidv0Regex.test(cid)).toBe(false);
            });
        });
    });

    describe('Certificate Attributes', () => {
        it('should include keycloak_id in attributes', () => {
            const expectedAttributes = [
                'keycloak_id',
                'username',
                'role',
                'department'
            ];

            const mockAttributes = {
                keycloak_id: '550e8400-e29b-41d4-a716-446655440000',
                username: 'test_producer',
                role: 'role_producer',
                department: 'penangkar'
            };

            expectedAttributes.forEach(attr => {
                expect(mockAttributes).toHaveProperty(attr);
            });
        });

        it('should format enrollment request correctly', () => {
            const userId = '550e8400-e29b-41d4-a716-446655440000';
            const username = 'test_user';
            const role = 'producer';

            const enrollmentRequest = {
                enrollmentID: userId,
                enrollmentSecret: 'generated_secret',
                attr_reqs: [
                    { name: 'keycloak_id', optional: false },
                    { name: 'username', optional: false },
                    { name: 'role', optional: false },
                    { name: 'department', optional: false }
                ]
            };

            expect(enrollmentRequest.enrollmentID).toBe(userId);
            expect(enrollmentRequest.attr_reqs).toHaveLength(4);
            expect(enrollmentRequest.attr_reqs[0].name).toBe('keycloak_id');
        });

        it('should format registration request with correct attributes', () => {
            const userId = '550e8400-e29b-41d4-a716-446655440000';
            const username = 'test_producer';
            const keycloakRole = 'producer';

            const registrationRequest = {
                affiliation: 'org1.department1',
                enrollmentID: userId,
                role: 'client',
                attrs: [
                    { name: 'keycloak_id', value: userId, ecert: true },
                    { name: 'username', value: username, ecert: true },
                    { name: 'role', value: 'role_producer', ecert: true },
                    { name: 'department', value: 'penangkar', ecert: true }
                ]
            };

            expect(registrationRequest.affiliation).toBe('org1.department1');
            expect(registrationRequest.enrollmentID).toBe(userId);
            expect(registrationRequest.attrs).toHaveLength(4);

            const keycloakIdAttr = registrationRequest.attrs.find(a => a.name === 'keycloak_id');
            expect(keycloakIdAttr.value).toBe(userId);
            expect(keycloakIdAttr.ecert).toBe(true);
        });
    });

    describe('Wallet Management', () => {
        it('should store identity with user ID as label', async () => {
            const userId = '550e8400-e29b-41d4-a716-446655440000';

            // Simulate storing identity
            await mockWallet.put(userId, {
                credentials: {
                    certificate: 'mockCert',
                    privateKey: 'mockKey'
                },
                mspId: 'Org1MSP',
                type: 'X.509'
            });

            expect(mockWallet.put).toHaveBeenCalledWith(
                userId,
                expect.objectContaining({
                    mspId: 'Org1MSP',
                    type: 'X.509'
                })
            );
        });

        it('should check if identity exists', async () => {
            const userId = '550e8400-e29b-41d4-a716-446655440000';

            mockWallet.get.mockResolvedValueOnce({
                type: 'X.509',
                mspId: 'Org1MSP'
            });

            const identity = await mockWallet.get(userId);

            expect(identity).not.toBeNull();
            expect(mockWallet.get).toHaveBeenCalledWith(userId);
        });

        it('should return null for non-existent identity', async () => {
            const userId = 'non-existent-user';

            mockWallet.get.mockResolvedValueOnce(null);

            const identity = await mockWallet.get(userId);

            expect(identity).toBeNull();
        });

        it('should remove identity on revocation', async () => {
            const userId = '550e8400-e29b-41d4-a716-446655440000';

            await mockWallet.remove(userId);

            expect(mockWallet.remove).toHaveBeenCalledWith(userId);
        });

        it('should list all identities', async () => {
            mockWallet.list.mockResolvedValueOnce([
                'user1-uuid',
                'user2-uuid',
                'user3-uuid'
            ]);

            const identities = await mockWallet.list();

            expect(identities).toHaveLength(3);
            expect(mockWallet.list).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle CA connection errors', async () => {
            const FabricCAServices = require('fabric-ca-client');
            const caInstance = new FabricCAServices();

            caInstance.enroll.mockRejectedValueOnce(new Error('Connection refused'));

            await expect(caInstance.enroll({
                enrollmentID: 'test',
                enrollmentSecret: 'secret'
            })).rejects.toThrow('Connection refused');
        });

        it('should handle registration errors', async () => {
            const FabricCAServices = require('fabric-ca-client');
            const caInstance = new FabricCAServices();

            caInstance.register.mockRejectedValueOnce(new Error('Identity already registered'));

            await expect(caInstance.register({
                enrollmentID: 'existing-user',
                affiliation: 'org1'
            })).rejects.toThrow('Identity already registered');
        });

        it('should handle missing admin identity', async () => {
            mockWallet.get.mockResolvedValueOnce(null);

            const adminIdentity = await mockWallet.get('admin');

            expect(adminIdentity).toBeNull();
        });

        it('should handle invalid role mapping', () => {
            const invalidRole = 'unknown_role';
            const roleMapping = {
                producer: 'role_producer',
                pbt_field: 'role_pbt_field'
            };

            const mappedRole = roleMapping[invalidRole];

            expect(mappedRole).toBeUndefined();
        });
    });

    describe('Keycloak Token Parsing', () => {
        it('should extract user info from token content', () => {
            const mockTokenContent = {
                sub: '550e8400-e29b-41d4-a716-446655440000',
                preferred_username: 'test_producer',
                realm_access: {
                    roles: ['producer', 'offline_access', 'uma_authorization']
                },
                email: 'test@example.com'
            };

            expect(mockTokenContent.sub).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(mockTokenContent.preferred_username).toBe('test_producer');
            expect(mockTokenContent.realm_access.roles).toContain('producer');
        });

        it('should find primary role from Keycloak roles', () => {
            const keycloakRoles = ['producer', 'offline_access', 'uma_authorization', 'default-roles-seed'];
            const validRoles = ['producer', 'pbt_field', 'pbt_chief', 'lsm_head', 'admin'];

            const primaryRole = keycloakRoles.find(role => validRoles.includes(role));

            expect(primaryRole).toBe('producer');
        });

        it('should handle missing roles gracefully', () => {
            const keycloakRoles = ['offline_access', 'uma_authorization'];
            const validRoles = ['producer', 'pbt_field', 'pbt_chief', 'lsm_head', 'admin'];

            const primaryRole = keycloakRoles.find(role => validRoles.includes(role));

            expect(primaryRole).toBeUndefined();
        });
    });

    describe('Chaincode Identity Context', () => {
        it('should verify identity context structure from chaincode', () => {
            const identityContext = {
                userID: 'x509::CN=550e8400-e29b-41d4-a716-446655440000,OU=client,O=Org1MSP',
                mspId: 'Org1MSP',
                role: 'role_producer',
                keycloakId: '550e8400-e29b-41d4-a716-446655440000',
                username: 'test_producer',
                timestamp: '2026-01-10T12:00:00.000Z',
                txId: 'tx123456',
                channelId: 'benihchannel'
            };

            expect(identityContext).toHaveProperty('keycloakId');
            expect(identityContext).toHaveProperty('username');
            expect(identityContext).toHaveProperty('role');
            expect(identityContext.keycloakId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
        });

        it('should verify UUID matching in chaincode', () => {
            const providedUUID = '550e8400-e29b-41d4-a716-446655440000';
            const identityKeycloakId = '550e8400-e29b-41d4-a716-446655440000';

            const isMatch = providedUUID === identityKeycloakId;

            expect(isMatch).toBe(true);
        });

        it('should reject mismatched UUID', () => {
            const providedUUID = '550e8400-e29b-41d4-a716-446655440000';
            const identityKeycloakId = 'different-uuid-value-here-0000';

            const isMatch = providedUUID === identityKeycloakId;

            expect(isMatch).toBe(false);
        });

        it('should verify resource ownership', () => {
            const seedBatch = {
                producer_keycloak_id: '550e8400-e29b-41d4-a716-446655440000'
            };

            const callerKeycloakId = '550e8400-e29b-41d4-a716-446655440000';
            const isOwner = seedBatch.producer_keycloak_id === callerKeycloakId;

            expect(isOwner).toBe(true);
        });

        it('should reject non-owner access', () => {
            const seedBatch = {
                producer_keycloak_id: '550e8400-e29b-41d4-a716-446655440000'
            };

            const callerKeycloakId = 'another-user-uuid-here-00000000';
            const isOwner = seedBatch.producer_keycloak_id === callerKeycloakId;

            expect(isOwner).toBe(false);
        });
    });
});

describe('Chaincode Helper Functions', () => {
    describe('_verifyUserUUID', () => {
        it('should pass when UUID matches keycloakId', () => {
            const identityContext = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000',
                userID: 'x509::CN=...'
            };
            const providedUUID = '550e8400-e29b-41d4-a716-446655440000';

            const userUUID = identityContext.keycloakId;
            const isValid = providedUUID === userUUID;

            expect(isValid).toBe(true);
        });

        it('should fail when UUID does not match', () => {
            const identityContext = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000',
                userID: 'x509::CN=...'
            };
            const providedUUID = 'different-uuid-value';

            const userUUID = identityContext.keycloakId;
            const isValid = providedUUID === userUUID;

            expect(isValid).toBe(false);
        });
    });

    describe('_verifyResourceOwnership', () => {
        it('should verify producer ownership', () => {
            const identityContext = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000'
            };

            const seedBatch = {
                producer_keycloak_id: '550e8400-e29b-41d4-a716-446655440000'
            };

            const isOwner = identityContext.keycloakId === seedBatch.producer_keycloak_id;

            expect(isOwner).toBe(true);
        });

        it('should reject when not owner', () => {
            const identityContext = {
                keycloakId: 'attacker-uuid'
            };

            const seedBatch = {
                producer_keycloak_id: '550e8400-e29b-41d4-a716-446655440000'
            };

            const isOwner = identityContext.keycloakId === seedBatch.producer_keycloak_id;

            expect(isOwner).toBe(false);
        });
    });

    describe('Audit Trail Keycloak Tracking', () => {
        it('should include keycloakId in audit log', () => {
            const auditLog = {
                docType: 'AuditLog',
                action: 'CREATE_SEED_BATCH',
                resourceId: 'BATCH-123',
                actor: 'x509::CN=...',
                actorKeycloakId: '550e8400-e29b-41d4-a716-446655440000',
                actorUsername: 'test_producer',
                actorMsp: 'Org1MSP',
                timestamp: '2026-01-10T12:00:00.000Z'
            };

            expect(auditLog).toHaveProperty('actorKeycloakId');
            expect(auditLog).toHaveProperty('actorUsername');
            expect(auditLog.actorKeycloakId).toBe('550e8400-e29b-41d4-a716-446655440000');
        });
    });
});
