/**
 * Health Endpoint Tests
 * Tests for /api/health endpoint
 */

const request = require('supertest');
const app = require('../src/app.test');

describe('Health Endpoint', () => {
    describe('GET /api/health', () => {
        it('should return health status with 200 or 503', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect('Content-Type', /json/);

            expect([200, 503]).toContain(response.status);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('responseTime');
            expect(response.body).toHaveProperty('services');
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('environment');
        });

        it('should return correct status values', async () => {
            const response = await request(app).get('/api/health');

            expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
        });

        it('should check blockchain service', async () => {
            const response = await request(app).get('/api/health');

            expect(response.body.services).toHaveProperty('blockchain');
            expect(response.body.services.blockchain).toHaveProperty('status');
            expect(response.body.services.blockchain).toHaveProperty('message');
            expect(['up', 'down']).toContain(response.body.services.blockchain.status);
        });

        it('should check IPFS service', async () => {
            const response = await request(app).get('/api/health');

            expect(response.body.services).toHaveProperty('ipfs');
            expect(response.body.services.ipfs).toHaveProperty('status');
            expect(response.body.services.ipfs).toHaveProperty('message');
            expect(['up', 'down']).toContain(response.body.services.ipfs.status);
        });

        it('should check queue service', async () => {
            const response = await request(app).get('/api/health');

            expect(response.body.services).toHaveProperty('queue');
            expect(response.body.services.queue).toHaveProperty('status');
            expect(response.body.services.queue).toHaveProperty('message');
            expect(['up', 'down']).toContain(response.body.services.queue.status);
        });

        it('should include queue stats when queue is up', async () => {
            const response = await request(app).get('/api/health');

            if (response.body.services.queue.status === 'up') {
                expect(response.body.services.queue).toHaveProperty('stats');
                expect(response.body.services.queue.stats).toHaveProperty('waiting');
                expect(response.body.services.queue.stats).toHaveProperty('active');
                expect(response.body.services.queue.stats).toHaveProperty('completed');
                expect(response.body.services.queue.stats).toHaveProperty('failed');
            }
        });

        it('should return response time', async () => {
            const response = await request(app).get('/api/health');

            expect(response.body.responseTime).toMatch(/^\d+ms$/);
        });
    });

    describe('GET /api/health/liveness', () => {
        it('should return 200 for liveness probe', async () => {
            const response = await request(app)
                .get('/api/health/liveness')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('alive', true);
        });
    });

    describe('GET /api/health/readiness', () => {
        it('should return readiness status', async () => {
            const response = await request(app)
                .get('/api/health/readiness')
                .expect('Content-Type', /json/);

            expect([200, 503]).toContain(response.status);
            expect(response.body).toHaveProperty('ready');
            expect(typeof response.body.ready).toBe('boolean');
        });
    });
});
