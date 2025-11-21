/**
 * Jest Test Setup
 * Configure environment and mocks before running tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = 3002;
process.env.LOG_LEVEL = 'error';

// Mock environment variables for services
process.env.KEYCLOAK_URL = 'http://localhost:8080';
process.env.KEYCLOAK_REALM = 'disbun';
process.env.KEYCLOAK_CLIENT_ID = 'seed-certification-api';
process.env.KEYCLOAK_CLIENT_SECRET = 'test-secret';
process.env.SESSION_SECRET = 'test-session-secret';

process.env.FABRIC_CHANNEL = 'benihchannel';
process.env.FABRIC_CONTRACT = 'benih-certification';
process.env.FABRIC_WALLET_PATH = './wallet';
process.env.FABRIC_USER_ID = 'appUser';

process.env.IPFS_HOST = 'localhost';
process.env.IPFS_PORT = '9094';
process.env.IPFS_PROTOCOL = 'http';

process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
    // Allow time for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
});
