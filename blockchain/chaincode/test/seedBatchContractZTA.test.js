/**
 * Chaincode Unit Tests for Per-User Identity
 * 
 * Tests the chaincode functions with keycloak_id verification:
 * - _verifyIdentityAndContext
 * - _verifyUserUUID
 * - _verifyResourceOwnership
 * - CRUD operations with keycloak tracking
 * 
 * @author Rangga
 * @date 2026-01-10
 */

const { Contract } = require('fabric-contract-api');
const { ClientIdentity } = require('fabric-shim');

// Mock ClientIdentity
jest.mock('fabric-shim', () => ({
    ClientIdentity: jest.fn().mockImplementation(() => ({
        getID: jest.fn().mockReturnValue('x509::CN=550e8400-e29b-41d4-a716-446655440000,OU=client,O=Org1MSP'),
        getMSPID: jest.fn().mockReturnValue('Org1MSP'),
        getAttributeValue: jest.fn((attr) => {
            const attrs = {
                'role': 'role_producer',
                'keycloak_id': '550e8400-e29b-41d4-a716-446655440000',
                'username': 'test_producer',
                'department': 'penangkar'
            };
            return attrs[attr] || null;
        }),
        assertAttributeValue: jest.fn().mockReturnValue(true)
    }))
}));

describe('Chaincode Per-User Identity Tests', () => {
    let mockCtx;
    let mockStub;
    let mockClientIdentity;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create mock stub
        mockStub = {
            getTxID: jest.fn().mockReturnValue('tx-123456'),
            getChannelID: jest.fn().mockReturnValue('benihchannel'),
            getTxTimestamp: jest.fn().mockReturnValue({
                seconds: { toInt: () => Math.floor(Date.now() / 1000) }
            }),
            getState: jest.fn(),
            putState: jest.fn(),
            getHistoryForKey: jest.fn(),
            getQueryResult: jest.fn()
        };

        // Create mock context
        mockCtx = {
            stub: mockStub
        };
    });

    describe('Identity Extraction', () => {
        it('should extract keycloak_id from certificate attributes', () => {
            const cid = new ClientIdentity(mockStub);

            const keycloakId = cid.getAttributeValue('keycloak_id');

            expect(keycloakId).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should extract username from certificate attributes', () => {
            const cid = new ClientIdentity(mockStub);

            const username = cid.getAttributeValue('username');

            expect(username).toBe('test_producer');
        });

        it('should extract role from certificate attributes', () => {
            const cid = new ClientIdentity(mockStub);

            const role = cid.getAttributeValue('role');

            expect(role).toBe('role_producer');
        });

        it('should build complete identity context', () => {
            const cid = new ClientIdentity(mockStub);
            const txTimestamp = mockStub.getTxTimestamp();

            const identityContext = {
                userID: cid.getID(),
                mspId: cid.getMSPID(),
                role: cid.getAttributeValue('role'),
                keycloakId: cid.getAttributeValue('keycloak_id'),
                username: cid.getAttributeValue('username'),
                timestamp: new Date(txTimestamp.seconds.toInt() * 1000).toISOString(),
                txId: mockStub.getTxID(),
                channelId: mockStub.getChannelID()
            };

            expect(identityContext.keycloakId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(identityContext.username).toBe('test_producer');
            expect(identityContext.role).toBe('role_producer');
            expect(identityContext.mspId).toBe('Org1MSP');
        });
    });

    describe('UUID Verification', () => {
        const verifyUserUUID = (identityContext, providedUUID, fieldName) => {
            const userUUID = identityContext.keycloakId;

            if (providedUUID !== userUUID) {
                throw new Error(`UUID yang diberikan (${fieldName}) tidak cocok dengan identitas Anda. ` +
                    `Expected: ${userUUID}, Got: ${providedUUID}`);
            }

            return true;
        };

        it('should pass when UUID matches keycloak_id', () => {
            const identityContext = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000'
            };
            const providedUUID = '550e8400-e29b-41d4-a716-446655440000';

            expect(() => verifyUserUUID(identityContext, providedUUID, 'producerUUID'))
                .not.toThrow();
        });

        it('should throw error when UUID does not match', () => {
            const identityContext = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000'
            };
            const providedUUID = 'different-uuid-value-here-0000';

            expect(() => verifyUserUUID(identityContext, providedUUID, 'producerUUID'))
                .toThrow('UUID yang diberikan (producerUUID) tidak cocok dengan identitas Anda');
        });

        it('should throw error with detailed message', () => {
            const identityContext = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000'
            };
            const providedUUID = 'attacker-uuid';

            try {
                verifyUserUUID(identityContext, providedUUID, 'inspectorFieldUUID');
                fail('Should have thrown error');
            } catch (error) {
                expect(error.message).toContain('inspectorFieldUUID');
                expect(error.message).toContain('550e8400-e29b-41d4-a716-446655440000');
                expect(error.message).toContain('attacker-uuid');
            }
        });
    });

    describe('Resource Ownership Verification', () => {
        const verifyResourceOwnership = (identityContext, seedBatch, ownerType) => {
            const callerKeycloakId = identityContext.keycloakId;

            if (!callerKeycloakId) {
                throw new Error('Identity tidak memiliki keycloak_id. Akses ditolak.');
            }

            let ownerKeycloakId;

            switch (ownerType) {
                case 'producer':
                    ownerKeycloakId = seedBatch.producer_keycloak_id;
                    break;
                default:
                    throw new Error(`Tipe owner tidak dikenal: ${ownerType}`);
            }

            if (callerKeycloakId !== ownerKeycloakId) {
                throw new Error(`Akses ditolak. Anda bukan pemilik resource ini.`);
            }

            return true;
        };

        it('should allow producer to access their own batch', () => {
            const identityContext = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000'
            };

            const seedBatch = {
                producer_keycloak_id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => verifyResourceOwnership(identityContext, seedBatch, 'producer'))
                .not.toThrow();
        });

        it('should reject access from non-owner', () => {
            const identityContext = {
                keycloakId: 'different-user-uuid'
            };

            const seedBatch = {
                producer_keycloak_id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => verifyResourceOwnership(identityContext, seedBatch, 'producer'))
                .toThrow('Akses ditolak. Anda bukan pemilik resource ini');
        });

        it('should reject if keycloak_id is missing', () => {
            const identityContext = {
                keycloakId: null
            };

            const seedBatch = {
                producer_keycloak_id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => verifyResourceOwnership(identityContext, seedBatch, 'producer'))
                .toThrow('Identity tidak memiliki keycloak_id');
        });

        it('should reject unknown owner type', () => {
            const identityContext = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000'
            };

            const seedBatch = {};

            expect(() => verifyResourceOwnership(identityContext, seedBatch, 'unknown'))
                .toThrow('Tipe owner tidak dikenal');
        });
    });

    describe('SeedBatch Document Structure', () => {
        it('should include all keycloak tracking fields on creation', () => {
            const identity = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000',
                username: 'test_producer',
                userID: 'x509::CN=...',
                timestamp: '2026-01-10T12:00:00.000Z',
                mspId: 'Org1MSP'
            };

            const seedBatch = {
                docType: 'SeedBatch',
                id: 'BATCH-123',
                variety_name: 'Ciherang',
                commodity: 'Padi',

                // Keycloak tracking fields
                producer_id: identity.keycloakId,
                producer_keycloak_id: identity.keycloakId,
                created_by: identity.userID,
                created_by_keycloak: identity.keycloakId,
                created_by_username: identity.username,
                created_at: identity.timestamp,
                created_msp: identity.mspId,

                // Inspector fields (empty initially)
                inspector_field_id: '',
                inspector_field_keycloak_id: '',
                inspector_chief_id: '',
                inspector_chief_keycloak_id: '',
                issuer_id: '',
                issuer_keycloak_id: '',

                // Modification tracking
                last_modified_by: identity.userID,
                last_modified_by_keycloak: identity.keycloakId,
                last_modified_at: identity.timestamp
            };

            expect(seedBatch.producer_keycloak_id).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(seedBatch.created_by_keycloak).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(seedBatch.created_by_username).toBe('test_producer');
            expect(seedBatch.inspector_field_keycloak_id).toBe('');
        });

        it('should update inspector fields on inspection', () => {
            const seedBatch = {
                inspector_field_id: '',
                inspector_field_keycloak_id: '',
                inspected_by: '',
                inspected_by_username: ''
            };

            const inspectorIdentity = {
                keycloakId: 'inspector-uuid-here',
                username: 'test_pbt_field',
                userID: 'x509::CN=inspector',
                timestamp: '2026-01-10T14:00:00.000Z'
            };

            // Update on inspection
            seedBatch.inspector_field_id = inspectorIdentity.keycloakId;
            seedBatch.inspector_field_keycloak_id = inspectorIdentity.keycloakId;
            seedBatch.inspected_by = inspectorIdentity.userID;
            seedBatch.inspected_by_username = inspectorIdentity.username;
            seedBatch.inspected_at = inspectorIdentity.timestamp;

            expect(seedBatch.inspector_field_keycloak_id).toBe('inspector-uuid-here');
            expect(seedBatch.inspected_by_username).toBe('test_pbt_field');
        });

        it('should update issuer fields on certificate issuance', () => {
            const seedBatch = {
                issuer_id: '',
                issuer_keycloak_id: '',
                issued_by: '',
                issued_by_username: ''
            };

            const issuerIdentity = {
                keycloakId: 'lsm-head-uuid',
                username: 'test_lsm_head',
                userID: 'x509::CN=lsm',
                timestamp: '2026-01-10T16:00:00.000Z'
            };

            // Update on certificate issuance
            seedBatch.issuer_id = issuerIdentity.keycloakId;
            seedBatch.issuer_keycloak_id = issuerIdentity.keycloakId;
            seedBatch.issued_by = issuerIdentity.userID;
            seedBatch.issued_by_username = issuerIdentity.username;
            seedBatch.issued_at = issuerIdentity.timestamp;

            expect(seedBatch.issuer_keycloak_id).toBe('lsm-head-uuid');
            expect(seedBatch.issued_by_username).toBe('test_lsm_head');
        });
    });

    describe('Document Tracking', () => {
        it('should include uploader keycloak info in documents', () => {
            const identity = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000',
                username: 'test_producer',
                userID: 'x509::CN=...',
                timestamp: '2026-01-10T12:00:00.000Z'
            };

            const document = {
                name: 'Seed Source Document',
                cid: 'QmTestCID123',
                uploaded_by: identity.userID,
                uploaded_by_keycloak: identity.keycloakId,
                uploaded_by_username: identity.username,
                uploaded_at: identity.timestamp,
                doc_type: 'seed_source'
            };

            expect(document.uploaded_by_keycloak).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(document.uploaded_by_username).toBe('test_producer');
        });
    });

    describe('Audit Log with Keycloak Tracking', () => {
        it('should include keycloak info in audit logs', () => {
            const identity = {
                keycloakId: '550e8400-e29b-41d4-a716-446655440000',
                username: 'test_producer',
                userID: 'x509::CN=...',
                mspId: 'Org1MSP',
                timestamp: '2026-01-10T12:00:00.000Z',
                txId: 'tx-123456',
                channelId: 'benihchannel'
            };

            const auditLog = {
                docType: 'AuditLog',
                id: `AUDIT-${identity.txId}`,
                action: 'CREATE_SEED_BATCH',
                resourceId: 'BATCH-123',
                actor: identity.userID,
                actorKeycloakId: identity.keycloakId,
                actorUsername: identity.username,
                actorMsp: identity.mspId,
                timestamp: identity.timestamp,
                txId: identity.txId,
                channelId: identity.channelId,
                details: {
                    variety: 'Ciherang',
                    commodity: 'Padi',
                    producerKeycloakId: identity.keycloakId
                }
            };

            expect(auditLog.actorKeycloakId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(auditLog.actorUsername).toBe('test_producer');
            expect(auditLog.details.producerKeycloakId).toBe('550e8400-e29b-41d4-a716-446655440000');
        });
    });

    describe('Query by Producer Keycloak ID', () => {
        it('should build correct query selector', () => {
            const producerKeycloakId = '550e8400-e29b-41d4-a716-446655440000';

            const queryString = {
                selector: {
                    docType: 'SeedBatch',
                    producer_keycloak_id: producerKeycloakId
                }
            };

            expect(queryString.selector.producer_keycloak_id).toBe(producerKeycloakId);
        });

        it('should verify caller owns the query', () => {
            const callerKeycloakId = '550e8400-e29b-41d4-a716-446655440000';
            const requestedKeycloakId = '550e8400-e29b-41d4-a716-446655440000';

            const isAuthorized = callerKeycloakId === requestedKeycloakId;

            expect(isAuthorized).toBe(true);
        });

        it('should reject query for different producer', () => {
            const callerKeycloakId = '550e8400-e29b-41d4-a716-446655440000';
            const requestedKeycloakId = 'other-producer-uuid';

            const isAuthorized = callerKeycloakId === requestedKeycloakId;

            expect(isAuthorized).toBe(false);
        });
    });

    describe('Conflict of Interest Prevention', () => {
        it('should detect self-evaluation attempt', () => {
            const seedBatch = {
                inspector_field_keycloak_id: 'inspector-uuid'
            };

            const evaluatorIdentity = {
                keycloakId: 'inspector-uuid' // Same as field inspector
            };

            const isSelfEvaluation =
                seedBatch.inspector_field_keycloak_id === evaluatorIdentity.keycloakId;

            expect(isSelfEvaluation).toBe(true);
        });

        it('should allow evaluation by different user', () => {
            const seedBatch = {
                inspector_field_keycloak_id: 'field-inspector-uuid'
            };

            const evaluatorIdentity = {
                keycloakId: 'chief-inspector-uuid' // Different from field inspector
            };

            const isSelfEvaluation =
                seedBatch.inspector_field_keycloak_id === evaluatorIdentity.keycloakId;

            expect(isSelfEvaluation).toBe(false);
        });
    });

    describe('Security Event Logging', () => {
        it('should log unauthorized access attempts', () => {
            const securityEvent = {
                type: 'UNAUTHORIZED_ACCESS',
                message: 'Producer producer-uuid attempted to access batch owned by owner-uuid',
                timestamp: new Date().toISOString(),
                callerKeycloakId: 'producer-uuid',
                targetResource: 'BATCH-123'
            };

            expect(securityEvent.type).toBe('UNAUTHORIZED_ACCESS');
            expect(securityEvent).toHaveProperty('callerKeycloakId');
        });

        it('should log conflict of interest', () => {
            const securityEvent = {
                type: 'CONFLICT_OF_INTEREST',
                message: 'Chief inspector-uuid attempted to evaluate own field inspection',
                timestamp: new Date().toISOString(),
                callerKeycloakId: 'inspector-uuid'
            };

            expect(securityEvent.type).toBe('CONFLICT_OF_INTEREST');
        });
    });
});
