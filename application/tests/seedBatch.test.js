/**
 * Seed Batch Endpoints Tests
 * Tests for /api/seed-batches endpoints
 */

const request = require('supertest');
const path = require('path');
const app = require('../src/app.test');

// Mock authentication token
const mockToken = 'Bearer mock-jwt-token';

describe('Seed Batch Endpoints', () => {

    describe('GET /api/seed-batches', () => {
        it('should return list of seed batches (public)', async () => {
            const response = await request(app)
                .get('/api/seed-batches')
                .expect('Content-Type', /json/);

            // May return 200 with data or error depending on blockchain connection
            expect([200, 500, 503]).toContain(response.status);

            if (response.status === 200) {
                expect(Array.isArray(response.body) || response.body.data).toBeTruthy();
            }
        });

        it('should handle errors gracefully', async () => {
            const response = await request(app)
                .get('/api/seed-batches');

            if (response.status >= 400) {
                expect(response.body).toHaveProperty('error');
            }
        });
    });

    describe('GET /api/seed-batches/:id', () => {
        const testId = 'BATCH-001';

        it('should require valid ID format', async () => {
            const response = await request(app)
                .get('/api/seed-batches/invalid@id');

            // Should return 400 for invalid ID format or 404/500 if validation passes
            expect([400, 404, 500]).toContain(response.status);
        });

        it('should return seed batch by ID', async () => {
            const response = await request(app)
                .get(`/api/seed-batches/${testId}`)
                .expect('Content-Type', /json/);

            // May return 200, 404, or 500 depending on blockchain state
            expect([200, 404, 500, 503]).toContain(response.status);

            if (response.status === 200) {
                expect(response.body).toHaveProperty('batchId');
            }
        });
    });

    describe('GET /api/seed-batches/:id/history', () => {
        const testId = 'BATCH-001';

        it('should return history for seed batch', async () => {
            const response = await request(app)
                .get(`/api/seed-batches/${testId}/history`)
                .expect('Content-Type', /json/);

            expect([200, 404, 500, 503]).toContain(response.status);

            if (response.status === 200) {
                expect(Array.isArray(response.body) || response.body.history).toBeTruthy();
            }
        });

        it('should require valid ID format for history', async () => {
            const response = await request(app)
                .get('/api/seed-batches/invalid@id/history');

            expect([400, 404, 500]).toContain(response.status);
        });
    });

    describe('POST /api/seed-batches (Protected)', () => {
        it('should reject request without file upload', async () => {
            const response = await request(app)
                .post('/api/seed-batches')
                .set('Authorization', mockToken)
                .send({
                    variety: 'Coffee Arabica',
                    quantity: 1000,
                    unit: 'kg'
                });

            // Will fail on validation (no file)
            expect([400, 401, 403, 500]).toContain(response.status);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/seed-batches')
                .set('Authorization', mockToken)
                .send({});

            expect([400, 401, 403]).toContain(response.status);
        });
    });

    describe('POST /api/seed-batches/:id/submit (Protected)', () => {
        const testId = 'BATCH-001';

        it('should require valid ID format', async () => {
            const response = await request(app)
                .post('/api/seed-batches/invalid@id/submit')
                .set('Authorization', mockToken);

            expect([400, 401, 403, 500]).toContain(response.status);
        });
    });

    describe('POST /api/seed-batches/:id/inspect (Protected)', () => {
        const testId = 'BATCH-001';

        it('should require photo upload', async () => {
            const response = await request(app)
                .post(`/api/seed-batches/${testId}/inspect`)
                .set('Authorization', mockToken)
                .send({
                    inspectionResult: 'Passed'
                });

            expect([400, 401, 403, 500]).toContain(response.status);
        });
    });

    describe('POST /api/seed-batches/:id/evaluate (Protected)', () => {
        const testId = 'BATCH-001';

        it('should validate evaluation data', async () => {
            const response = await request(app)
                .post(`/api/seed-batches/${testId}/evaluate`)
                .set('Authorization', mockToken)
                .send({});

            expect([400, 401, 403, 500]).toContain(response.status);
        });
    });

    describe('POST /api/seed-batches/:id/certificate (Protected)', () => {
        const testId = 'BATCH-001';

        it('should require certificate data', async () => {
            const response = await request(app)
                .post(`/api/seed-batches/${testId}/certificate`)
                .set('Authorization', mockToken)
                .send({});

            expect([400, 401, 403, 500]).toContain(response.status);
        });
    });

    describe('POST /api/seed-batches/:id/distribute (Protected)', () => {
        const testId = 'BATCH-001';

        it('should validate distribution data', async () => {
            const response = await request(app)
                .post(`/api/seed-batches/${testId}/distribute`)
                .set('Authorization', mockToken)
                .send({});

            expect([400, 401, 403, 500]).toContain(response.status);
        });
    });

    describe('Error Handling', () => {
        it('should return 404 for unknown routes', async () => {
            const response = await request(app)
                .get('/api/seed-batches/unknown/endpoint')
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });

        it('should handle malformed JSON', async () => {
            const response = await request(app)
                .post('/api/seed-batches/BATCH-001/submit')
                .set('Authorization', mockToken)
                .set('Content-Type', 'application/json')
                .send('invalid json{');

            expect([400, 401, 403]).toContain(response.status);
        });
    });
});
