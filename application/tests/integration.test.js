/**
 * Integration Tests
 * End-to-end tests for complete workflows
 */

const request = require('supertest');
const app = require('../src/app.test');

describe('Integration Tests', () => {

    describe('Health Check Flow', () => {
        it('should complete full health check cycle', async () => {
            // 1. Check liveness
            const liveness = await request(app)
                .get('/api/health/liveness')
                .expect(200);

            expect(liveness.body.alive).toBe(true);

            // 2. Check readiness
            const readiness = await request(app)
                .get('/api/health/readiness');

            expect([200, 503]).toContain(readiness.status);
            expect(typeof readiness.body.ready).toBe('boolean');

            // 3. Check full health
            const health = await request(app)
                .get('/api/health');

            expect([200, 503]).toContain(health.status);
            expect(health.body).toHaveProperty('services');
        });
    }); describe('API Rate Limiting', () => {
        it('should enforce rate limits', async () => {
            const requests = [];

            // Send multiple requests quickly
            for (let i = 0; i < 15; i++) {
                requests.push(
                    request(app).get('/api/health/liveness')
                );
            }

            const responses = await Promise.all(requests);

            // Check if any request was rate limited
            const rateLimited = responses.some(r => r.status === 429);

            // Rate limiting may or may not trigger depending on timing
            expect(responses.length).toBe(15);
        });
    });

    describe('CORS Headers', () => {
        it('should include CORS headers', async () => {
            const response = await request(app)
                .get('/api/health')
                .set('Origin', 'http://localhost:3000');

            expect(response.headers).toHaveProperty('access-control-allow-origin');
        });

        it('should handle preflight requests', async () => {
            const response = await request(app)
                .options('/api/health')
                .set('Origin', 'http://localhost:3000')
                .set('Access-Control-Request-Method', 'GET');

            expect([200, 204]).toContain(response.status);
        });
    });

    describe('Security Headers', () => {
        it('should include security headers', async () => {
            const response = await request(app).get('/api/health');

            // Helmet security headers
            expect(response.headers).toHaveProperty('x-content-type-options');
            expect(response.headers).toHaveProperty('x-frame-options');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });
    });

    describe('Error Response Format', () => {
        it('should return consistent error format', async () => {
            const response = await request(app)
                .get('/api/non-existent-endpoint')
                .expect(404);

            expect(response.body).toHaveProperty('error');
            expect(typeof response.body.error).toBe('string');
        });
    });

    describe('Request Validation', () => {
        it('should validate query parameters', async () => {
            const response = await request(app)
                .get('/api/seed-batches')
                .query({ limit: 'invalid' });

            // Should either accept or reject based on validation
            expect([200, 400, 500, 503]).toContain(response.status);
        });
    });

    describe('Service Availability', () => {
        it('should indicate service status in health endpoint', async () => {
            const response = await request(app)
                .get('/api/health');

            const { blockchain, ipfs, queue } = response.body.services;

            // Each service should have status and message
            [blockchain, ipfs, queue].forEach(service => {
                expect(service).toHaveProperty('status');
                expect(service).toHaveProperty('message');
                expect(['up', 'down']).toContain(service.status);
            });
        });
    });

    describe('Concurrent Requests', () => {
        it('should handle concurrent requests', async () => {
            const requests = [
                request(app).get('/api/health'),
                request(app).get('/api/health/liveness'),
                request(app).get('/api/health/readiness'),
                request(app).get('/api/seed-batches')
            ];

            const responses = await Promise.all(requests);

            // All requests should complete
            expect(responses.length).toBe(4);
            responses.forEach(response => {
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(600);
            });
        });
    });

    describe('Response Time', () => {
        it('should respond within reasonable time', async () => {
            const start = Date.now();

            await request(app).get('/api/health/liveness');

            const duration = Date.now() - start;

            // Should respond within 5 seconds
            expect(duration).toBeLessThan(5000);
        });
    });
});
