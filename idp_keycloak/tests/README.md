# Keycloak Integration Tests

This directory contains comprehensive integration tests for the Keycloak Identity Provider implementation.

## Test Suites

### 1. Authentication Flow Tests (`auth.test.js`)
Tests the complete authentication flow including:
- Successful login with valid credentials for all user roles
- Failed login attempts with invalid credentials
- MFA flow verification for privileged roles
- Public role users bypassing MFA

**Requirements Covered**: 6.1, 6.2, 6.3, 6.4, 6.6

### 2. Token Validation Tests (`token.test.js`)
Tests JWT token structure and validation:
- Role inclusion in JWT tokens
- Custom attributes (iup_number, company_name, nip, institution_id)
- Token expiration (15 minutes)
- Refresh token functionality
- Token structure compliance with OIDC standards

**Requirements Covered**: 3.6, 4.3, 4.4, 5.3, 5.4, 7.1, 7.4

### 3. Brute Force Protection Tests (`brute-force.test.js`)
Tests security features:
- Account lockout after 5 failed attempts
- Account unlock after 15 minutes (documented, skipped in automated tests)
- Failed login attempt logging
- Protection applies to all user types

**Requirements Covered**: 8.1, 8.2, 8.3, 8.4

### 4. JWKS Endpoint Tests (`jwks.test.js`)
Tests the JSON Web Key Set endpoint:
- Public accessibility without authentication
- Response time under 2 seconds
- Public key retrieval and format validation
- JWT signature verification using JWKS
- Caching and performance

**Requirements Covered**: 9.1, 9.2, 9.3, 9.4

## Prerequisites

### 1. Keycloak Running
Ensure Keycloak is running on port 8041:

```bash
./start-keycloak.sh
```

### 2. Realm Imported
Import the SeedCertificationRealm configuration:

```bash
./import-realm.sh
```

### 3. Test Users Created
The tests expect the following users to exist in Keycloak:

| Username | Password | Role | Custom Attributes |
|----------|----------|------|-------------------|
| `producer_test` | `Test123!` | `role_producer` | iup_number: IUP-2024-001, company_name: PT Benih Sejahtera |
| `pbt_field_test` | `Test123!` | `role_pbt_field` | nip: 198501012010011001, institution_id: BPSBP-JABAR |
| `lsm_head_test` | `Test123!` | `role_lsm_head` | nip: 198601012011011002, institution_id: LSM-PUSAT |
| `public_test` | `Test123!` | `role_public` | - |

### 4. Install Dependencies

```bash
npm install
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm run test:auth          # Authentication flow tests
npm run test:token         # Token validation tests
npm run test:brute-force   # Brute force protection tests
npm run test:jwks          # JWKS endpoint tests
```

### Run Individual Test File
```bash
npx jest tests/auth.test.js --runInBand
```

## Test Configuration

Test configuration is located in `tests/config.js`. You can modify:

- Keycloak URL (default: `http://localhost:8041`)
- Realm name (default: `SeedCertificationRealm`)
- Client ID (default: `seed-cert-frontend`)
- Test user credentials
- Token lifespan expectations
- Brute force protection settings

## Important Notes

### Test Execution Order
Tests are run sequentially (`--runInBand`) to avoid race conditions, especially for brute force protection tests.

### Brute Force Tests
Some brute force tests may affect test users. The tests use dynamically generated usernames where possible to avoid conflicts.

### Long-Running Tests
The test for "account unlock after 15 minutes" is skipped by default (`test.skip`) because it would take 15+ minutes to complete. This test should be run manually or in a CI environment with time manipulation capabilities.

### MFA Tests
The MFA tests verify that the authentication flow is configured correctly but do not test actual OTP validation, as that requires interactive setup with an authenticator app. Manual testing is required for complete MFA validation.

## Test Coverage

The test suite covers:
- ✅ Authentication flows (successful and failed)
- ✅ Token structure and claims
- ✅ Custom user attributes in tokens
- ✅ Token expiration and refresh
- ✅ Brute force protection mechanisms
- ✅ JWKS endpoint accessibility and performance
- ✅ JWT signature verification
- ⚠️ MFA flow (configuration verified, OTP validation requires manual testing)
- ⚠️ Account unlock timing (documented, requires long-running test)

## Troubleshooting

### Keycloak Not Ready
If tests fail with connection errors:
```bash
# Check if Keycloak is running
docker ps | grep keycloak

# Check Keycloak logs
docker logs keycloak-dev

# Restart Keycloak
./stop-keycloak.sh
./start-keycloak.sh
```

### Test Users Not Found
If tests fail with "invalid_grant" errors:
1. Verify realm is imported: `./import-realm.sh`
2. Check users exist in Keycloak Admin Console
3. Verify user credentials match `tests/config.js`

### Port Conflicts
If Keycloak is running on a different port:
1. Update `keycloakUrl` in `tests/config.js`
2. Ensure port matches `docker-compose.yml`

### Test Timeouts
Some tests may timeout on slower systems. Increase timeout in `jest.config.js`:
```javascript
testTimeout: 60000 // 60 seconds
```

## CI/CD Integration

For continuous integration:

```yaml
# Example GitHub Actions workflow
- name: Start Keycloak
  run: ./start-keycloak.sh

- name: Import Realm
  run: ./import-realm.sh

- name: Install Dependencies
  run: npm install

- name: Run Tests
  run: npm test
```

## Contributing

When adding new tests:
1. Follow existing test structure and naming conventions
2. Use descriptive test names that explain what is being tested
3. Add appropriate comments for complex test logic
4. Update this README with new test coverage
5. Ensure tests are idempotent and can run multiple times

## References

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [JSON Web Token (JWT)](https://jwt.io/)
- [JSON Web Key Set (JWKS)](https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets)
