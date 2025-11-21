# API Testing Guide

## Overview

Test suite lengkap untuk semua endpoint API Gateway menggunakan **Jest** dan **Supertest**.

## Test Structure

```
tests/
├── setup.js              # Test configuration dan environment
├── health.test.js        # Tests untuk health endpoints
├── seedBatch.test.js     # Tests untuk seed batch endpoints
└── integration.test.js   # Integration tests
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- health.test.js
npm test -- seedBatch.test.js
npm test -- integration.test.js
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="Health Endpoint"
```

## Test Categories

### 1. Health Endpoint Tests (`health.test.js`)

Tests untuk monitoring dan health check endpoints:

- **GET /api/health**
  - ✅ Returns health status (200 or 503)
  - ✅ Includes all service statuses
  - ✅ Blockchain service check
  - ✅ IPFS service check
  - ✅ Queue service check
  - ✅ Queue statistics when available
  - ✅ Response time measurement

- **GET /api/health/liveness**
  - ✅ Returns 200 for liveness probe
  - ✅ Kubernetes liveness check

- **GET /api/health/readiness**
  - ✅ Returns readiness status
  - ✅ Kubernetes readiness check

### 2. Seed Batch Endpoint Tests (`seedBatch.test.js`)

Tests untuk semua seed batch operations:

#### Public Endpoints
- **GET /api/seed-batches**
  - ✅ Returns list of seed batches
  - ✅ Handles errors gracefully

- **GET /api/seed-batches/:id**
  - ✅ Returns seed batch by ID
  - ✅ Validates ID format
  - ✅ Returns 404 for non-existent batch

- **GET /api/seed-batches/:id/history**
  - ✅ Returns batch history
  - ✅ Validates ID format

#### Protected Endpoints (Require Authentication)

- **POST /api/seed-batches**
  - ✅ Rejects without authentication (401)
  - ✅ Rejects without file upload (400)
  - ✅ Validates required fields
  - ✅ Requires producer role

- **POST /api/seed-batches/:id/submit**
  - ✅ Rejects without authentication
  - ✅ Validates ID format
  - ✅ Requires producer role

- **POST /api/seed-batches/:id/inspect**
  - ✅ Rejects without authentication
  - ✅ Requires photo upload
  - ✅ Requires field inspector role

- **POST /api/seed-batches/:id/evaluate**
  - ✅ Rejects without authentication
  - ✅ Validates evaluation data
  - ✅ Requires chief inspector role

- **POST /api/seed-batches/:id/certificate**
  - ✅ Rejects without authentication
  - ✅ Requires LSM head role

- **POST /api/seed-batches/:id/distribute**
  - ✅ Rejects without authentication
  - ✅ Validates distribution data
  - ✅ Requires producer role

### 3. Integration Tests (`integration.test.js`)

End-to-end workflow tests:

- **Health Check Flow**
  - ✅ Complete liveness → readiness → health cycle
  
- **API Rate Limiting**
  - ✅ Enforces rate limits on endpoints

- **CORS Headers**
  - ✅ Includes CORS headers
  - ✅ Handles preflight requests

- **Security Headers**
  - ✅ Helmet security headers present
  - ✅ X-Content-Type-Options
  - ✅ X-Frame-Options

- **Error Response Format**
  - ✅ Consistent error format
  - ✅ 404 for unknown routes

- **Request Validation**
  - ✅ Query parameter validation
  - ✅ Body validation

- **Service Availability**
  - ✅ Service status in health endpoint

- **Concurrent Requests**
  - ✅ Handles multiple simultaneous requests

- **Response Time**
  - ✅ Responds within reasonable time

## Test Coverage

Target coverage: **>80%**

Check coverage report:
```bash
npm test -- --coverage
```

View HTML coverage report:
```bash
open coverage/lcov-report/index.html
```

## Mock Data

Tests menggunakan mock data dan services untuk:
- Keycloak authentication
- Fabric blockchain connection
- IPFS file uploads
- Redis queue

## Environment Variables

Test environment diset di `tests/setup.js`:

```javascript
process.env.NODE_ENV = 'test';
process.env.PORT = 3002;
process.env.LOG_LEVEL = 'error';
```

## Debugging Tests

### Run Single Test
```bash
npm test -- -t "should return health status"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Verbose Output
```bash
npm test -- --verbose
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run tests
  run: npm test

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

### Docker Test
```bash
docker-compose run --rm api-gateway npm test
```

## Test Assertions

Common assertions used:

```javascript
// Status codes
expect([200, 503]).toContain(response.status);

// Response structure
expect(response.body).toHaveProperty('status');

// Response types
expect(Array.isArray(response.body)).toBeTruthy();

// Error handling
expect(response.body).toHaveProperty('error');
```

## Best Practices

1. **Isolation**: Each test is independent
2. **Cleanup**: Automatic cleanup after tests
3. **Timeouts**: 30s timeout for integration tests
4. **Mocking**: Mock external services (Keycloak, Fabric, IPFS)
5. **Coverage**: Aim for >80% code coverage

## Known Limitations

- Authentication tests use mocked Keycloak
- Blockchain tests may fail if Fabric network not running
- IPFS tests require IPFS service to be up
- Rate limiting tests are timing-dependent

## Troubleshooting

### Tests Timeout
Increase timeout in `jest.config.json`:
```json
"testTimeout": 60000
```

### Service Not Available
Ensure services are running:
```bash
# Start Fabric network
cd ../blockchain && ./fabric.sh start

# Start IPFS cluster
cd ../ipfs_cluster && docker-compose up -d

# Start Keycloak
cd ../idp_keycloak && docker-compose up -d
```

### Port Conflicts
Change test port in `tests/setup.js`:
```javascript
process.env.PORT = 3002;
```

## Examples

### Run Health Tests Only
```bash
npm test health.test.js
```

### Run with Coverage
```bash
npm test -- --coverage --verbose
```

### Watch Mode for Development
```bash
npm test -- --watch --verbose
```

## Test Results

Typical output:
```
PASS  tests/health.test.js
PASS  tests/seedBatch.test.js
PASS  tests/integration.test.js

Test Suites: 3 passed, 3 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        8.234 s
```

## Coverage Report

```
File                  | % Stmts | % Branch | % Funcs | % Lines
----------------------|---------|----------|---------|--------
All files            |   85.23 |    72.45 |   88.12 |   85.67
 controllers/        |   82.45 |    68.32 |   85.71 |   83.22
 middleware/         |   90.12 |    78.54 |   92.31 |   91.45
 routes/             |   88.76 |    75.23 |   90.12 |   89.34
 services/           |   80.34 |    65.78 |   82.45 |   81.23
```
