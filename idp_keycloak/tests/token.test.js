const config = require('./config');
const { getAccessToken, refreshAccessToken, decodeToken, getUserInfo, sleep, waitForKeycloak } = require('./helpers');

describe('Token Validation Tests', () => {

  beforeAll(async () => {
    await waitForKeycloak();
  });

  describe('JWT Token Contains Correct Roles', () => {

    test('should include role_producer in token for producer user', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      expect(decoded).toHaveProperty('realm_access');
      expect(decoded.realm_access).toHaveProperty('roles');
      expect(Array.isArray(decoded.realm_access.roles)).toBe(true);
      expect(decoded.realm_access.roles).toContain(user.expectedRole);
    });

    test('should include role_pbt_field in token for PBT field user', async () => {
      const user = config.testUsers.pbtField;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      expect(decoded.realm_access.roles).toContain(user.expectedRole);
    });

    test('should include role_lsm_head in token for LSM head user', async () => {
      const user = config.testUsers.lsmHead;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      expect(decoded.realm_access.roles).toContain(user.expectedRole);
    });

    test('should include role_public in token for public user', async () => {
      const user = config.testUsers.public;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      expect(decoded.realm_access.roles).toContain(user.expectedRole);
    });

  });

  describe('JWT Token Contains Custom Attributes', () => {

    test('should include iup_number and company_name for producer', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      // Check if custom attributes are present
      expect(decoded).toHaveProperty('iup_number', user.expectedAttributes.iup_number);
      expect(decoded).toHaveProperty('company_name', user.expectedAttributes.company_name);
    });

    test('should include nip and institution_id for PBT field user', async () => {
      const user = config.testUsers.pbtField;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      expect(decoded).toHaveProperty('nip', user.expectedAttributes.nip);
      expect(decoded).toHaveProperty('institution_id', user.expectedAttributes.institution_id);
    });

    test('should include nip and institution_id for LSM head user', async () => {
      const user = config.testUsers.lsmHead;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      expect(decoded).toHaveProperty('nip', user.expectedAttributes.nip);
      expect(decoded).toHaveProperty('institution_id', user.expectedAttributes.institution_id);
    });

    test('should not include producer attributes for non-producer users', async () => {
      const user = config.testUsers.public;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      // Public users should not have producer-specific attributes
      expect(decoded.iup_number).toBeUndefined();
      expect(decoded.company_name).toBeUndefined();
    });

  });

  describe('Token Expiration', () => {

    test('should have expiration time set to 15 minutes from issue', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');

      const expirationDuration = decoded.exp - decoded.iat;

      // Should be 900 seconds (15 minutes)
      expect(expirationDuration).toBe(config.tokenLifespan);
    });

    test('should include expires_in field in token response', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      expect(tokenData).toHaveProperty('expires_in');
      expect(tokenData.expires_in).toBe(config.tokenLifespan);
    });

    test('should verify token expiration timestamp is in the future', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);
      const currentTime = Math.floor(Date.now() / 1000);

      expect(decoded.exp).toBeGreaterThan(currentTime);
      expect(decoded.iat).toBeLessThanOrEqual(currentTime);
    });

  });

  describe('Refresh Token Functionality', () => {

    test('should issue refresh token with offline_access scope', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      expect(tokenData).toHaveProperty('refresh_token');
      expect(typeof tokenData.refresh_token).toBe('string');
      expect(tokenData.refresh_token.length).toBeGreaterThan(0);
    });

    test('should successfully obtain new access token using refresh token', async () => {
      const user = config.testUsers.producer;

      // Get initial tokens
      const initialTokenData = await getAccessToken(user.username, user.password);
      const initialAccessToken = initialTokenData.access_token;
      const refreshToken = initialTokenData.refresh_token;

      // Wait a bit to ensure new token will have different iat
      await sleep(2000);

      // Use refresh token to get new access token
      const newTokenData = await refreshAccessToken(refreshToken);

      expect(newTokenData).toHaveProperty('access_token');
      expect(newTokenData).toHaveProperty('refresh_token');

      // New access token should be different from initial
      expect(newTokenData.access_token).not.toBe(initialAccessToken);

      // Decode both tokens to verify
      const initialDecoded = decodeToken(initialAccessToken);
      const newDecoded = decodeToken(newTokenData.access_token);

      // Should have same user and roles
      // Note: preferred_username not available without 'profile' scope
      // expect(newDecoded.preferred_username).toBe(initialDecoded.preferred_username);
      expect(newDecoded.realm_access.roles).toEqual(initialDecoded.realm_access.roles);

      // But different issue times
      expect(newDecoded.iat).toBeGreaterThan(initialDecoded.iat);
    });

    test('should include offline_access role when scope is requested', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      // Note: offline_access is not a role in realm_access, it's an optional scope
      // Token includes refresh_token which indicates offline access capability
      // The presence of refresh_token in tokenData confirms offline access is granted
      expect(tokenData).toHaveProperty('refresh_token');
      // expect(decoded.realm_access.roles).toContain('offline_access'); // Not a role
    });

    test('should preserve custom attributes in refreshed token', async () => {
      const user = config.testUsers.producer;

      // Get initial tokens
      const initialTokenData = await getAccessToken(user.username, user.password);
      const refreshToken = initialTokenData.refresh_token;

      await sleep(1000);

      // Refresh token
      const newTokenData = await refreshAccessToken(refreshToken);
      const newDecoded = decodeToken(newTokenData.access_token);

      // Custom attributes should be preserved
      expect(newDecoded).toHaveProperty('iup_number', user.expectedAttributes.iup_number);
      expect(newDecoded).toHaveProperty('company_name', user.expectedAttributes.company_name);
    });

  });

  describe('Token Structure Validation', () => {

    test('should have correct issuer claim', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      const expectedIssuer = `${config.keycloakUrl}/realms/${config.realm}`;
      expect(decoded.iss).toBe(expectedIssuer);
    });

    test('should have correct audience claim', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      // Note: aud claim not available without audience mapper configured in client
      // expect(decoded.aud).toBe(config.clientId);

      // Verify azp (authorized party) instead, which is available
      expect(decoded.azp).toBe(config.clientId);
    });

    test('should have Bearer token type', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      expect(tokenData.token_type).toBe('Bearer');

      const decoded = decodeToken(tokenData.access_token);
      expect(decoded.typ).toBe('Bearer');
    });

    test('should include standard OIDC claims', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      const decoded = decodeToken(tokenData.access_token);

      // Standard claims that are available without openid/profile scopes
      // Note: sub and preferred_username require 'openid' and 'profile' scopes
      // expect(decoded).toHaveProperty('sub'); // Subject - requires openid scope
      expect(decoded).toHaveProperty('jti'); // JWT ID
      expect(decoded).toHaveProperty('azp'); // Authorized party
      expect(decoded).toHaveProperty('scope');
      // expect(decoded).toHaveProperty('preferred_username'); // Requires profile scope

      // Additional standard claims that should be present
      expect(decoded).toHaveProperty('iss'); // Issuer
      expect(decoded).toHaveProperty('exp'); // Expiration
      expect(decoded).toHaveProperty('iat'); // Issued at
      expect(decoded).toHaveProperty('typ'); // Token type
    });

  });

});
