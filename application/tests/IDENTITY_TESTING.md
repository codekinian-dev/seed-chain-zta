# Pengujian Per-User Identity Mechanism

Dokumentasi ini menjelaskan cara menjalankan pengujian untuk mekanisme identitas per-user yang terintegrasi dengan Keycloak.

## Struktur File Pengujian

```
application/
├── tests/
│   ├── identity-flow.test.js      # Integration tests - alur lengkap
│   └── identity.service.test.js   # Unit tests - identity service
├── scripts/
│   └── test-identity-flow.sh      # Manual test script

blockchain/chaincode/
└── test/
    └── seedBatchContractZTA.test.js  # Chaincode unit tests
```

## Prasyarat

### 1. Services yang Harus Running

```bash
# Keycloak IDP
cd idp_keycloak
docker-compose up -d

# Fabric Network
cd blockchain
./fabric.sh up

# IPFS Cluster
cd ipfs_cluster
docker-compose up -d

# Application
cd application
npm start
```

### 2. Dependencies

```bash
# Application tests
cd application
npm install --save-dev jest supertest axios form-data

# Chaincode tests
cd blockchain/chaincode
npm install --save-dev jest fabric-contract-api fabric-shim
```

## Menjalankan Pengujian

### 1. Unit Tests - Identity Service

```bash
cd application
npm test -- tests/identity.service.test.js
```

Output yang diharapkan:

```
 PASS  tests/identity.service.test.js
  Identity Service
    Role Mapping
      ✓ should map producer role correctly
      ✓ should map pbt_field role correctly
      ...
    UUID Validation
      ✓ should validate correct UUID v4 format
      ✓ should reject invalid UUID formats
      ...
```

### 2. Unit Tests - Chaincode

```bash
cd blockchain/chaincode
npm test -- test/seedBatchContractZTA.test.js
```

Output yang diharapkan:

```
 PASS  test/seedBatchContractZTA.test.js
  Chaincode Per-User Identity Tests
    Identity Extraction
      ✓ should extract keycloak_id from certificate attributes
      ✓ should extract username from certificate attributes
      ...
    UUID Verification
      ✓ should pass when UUID matches keycloak_id
      ✓ should throw error when UUID does not match
      ...
```

### 3. Integration Tests

```bash
cd application
npm test -- tests/identity-flow.test.js
```

### 4. Manual Test Script (End-to-End)

```bash
cd application
chmod +x scripts/test-identity-flow.sh
./scripts/test-identity-flow.sh
```

Atau dengan custom environment:

```bash
KEYCLOAK_URL=http://your-keycloak:6080 \
API_URL=http://your-api:3000 \
./scripts/test-identity-flow.sh
```

## Test Scenarios

### Scenario 1: User Enrollment Flow

1. Create user in Keycloak
2. Get access token
3. Call `/api/v1/identity/enroll`
4. Verify wallet created
5. Check identity status

### Scenario 2: Seed Batch Workflow

1. Producer creates seed batch
2. Producer submits certification
3. PBT Field records inspection
4. PBT Chief evaluates inspection
5. LSM Head issues certificate
6. Producer distributes seed

### Scenario 3: Authorization Tests

1. Non-owner tries to submit certification → REJECTED
2. Producer tries to record inspection → REJECTED (wrong role)
3. Self-evaluation attempt → REJECTED
4. Query other producer's batches → REJECTED

## Expected Results

### Successful Enrollment Response

```json
{
  "success": true,
  "message": "User enrolled successfully",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "enrolled": true,
    "role": "producer"
  }
}
```

### Seed Batch with Keycloak Tracking

```json
{
  "id": "BATCH-1704891234567-abc123",
  "docType": "SeedBatch",
  "producer_keycloak_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_by_keycloak": "550e8400-e29b-41d4-a716-446655440000",
  "created_by_username": "test_producer",
  "inspector_field_keycloak_id": "inspector-uuid",
  "inspector_chief_keycloak_id": "chief-uuid",
  "issuer_keycloak_id": "lsm-uuid",
  ...
}
```

### Authorization Error Response

```json
{
  "success": false,
  "error": "Akses ditolak. Anda bukan pemilik resource ini."
}
```

## Troubleshooting

### 1. Keycloak Connection Failed

```
Error: Failed to get admin token
```

**Solution:** Pastikan Keycloak running dan accessible di URL yang dikonfigurasi.

### 2. Fabric CA Enrollment Failed

```
Error: Failed to enroll user
```

**Solution:**

- Pastikan Fabric network running
- Verifikasi CA TLS certificate tersedia
- Check admin identity sudah ter-enroll

### 3. User Not Found in Wallet

```
Error: User identity not found
```

**Solution:** User harus memanggil `/api/v1/identity/enroll` terlebih dahulu.

### 4. UUID Mismatch

```
Error: UUID yang diberikan tidak cocok dengan identitas Anda
```

**Solution:** UUID yang dikirim dalam request harus sama dengan Keycloak user ID (sub claim dari token).

## Code Coverage

Untuk generate coverage report:

```bash
cd application
npm test -- --coverage tests/identity.service.test.js

# Output
---------------------------|---------|----------|---------|---------|
File                       | % Stmts | % Branch | % Funcs | % Lines |
---------------------------|---------|----------|---------|---------|
All files                  |   XX.XX |    XX.XX |   XX.XX |   XX.XX |
 identity.service.js       |   XX.XX |    XX.XX |   XX.XX |   XX.XX |
---------------------------|---------|----------|---------|---------|
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Identity Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      keycloak:
        image: quay.io/keycloak/keycloak:23.0
        ports:
          - 6080:8080
        env:
          KEYCLOAK_ADMIN: admin
          KEYCLOAK_ADMIN_PASSWORD: admin

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: |
          cd application
          npm ci

      - name: Run unit tests
        run: |
          cd application
          npm test -- tests/identity.service.test.js

      - name: Run chaincode tests
        run: |
          cd blockchain/chaincode
          npm ci
          npm test
```

## Checklist Pengujian

- [ ] Keycloak users can be created with correct roles
- [ ] Users can obtain access tokens
- [ ] Users can enroll and get Fabric identity
- [ ] Producer can create seed batch
- [ ] Producer can submit certification (owner only)
- [ ] PBT Field can record inspection
- [ ] PBT Chief can evaluate (not self-evaluation)
- [ ] LSM Head can issue certificate
- [ ] Producer can distribute (owner only)
- [ ] Non-owner access is rejected
- [ ] Wrong role access is rejected
- [ ] Keycloak IDs are tracked in blockchain
- [ ] Audit logs include keycloak info
