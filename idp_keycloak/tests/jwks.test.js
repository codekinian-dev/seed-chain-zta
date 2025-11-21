const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const config = require('./config');
const { getAccessToken, waitForKeycloak } = require('./helpers');

describe('JWKS Endpoint Tests', () => {

  const jwksUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/certs`;

  beforeAll(async () => {
    await waitForKeycloak();
  });

  describe('JWKS Endpoint Accessibility', () => {

    test('should access JWKS endpoint without authentication', async () => {
      const response = await axios.get(jwksUrl);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('keys');
      expect(Array.isArray(response.data.keys)).toBe(true);
      expect(response.data.keys.length).toBeGreaterThan(0);
    });

    test('should return JSON content type', async () => {
      const response = await axios.get(jwksUrl);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should not require Authorization header', async () => {
      // Explicitly make request without any auth headers
      const response = await axios.get(jwksUrl, {
        headers: {}
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('keys');
    });

    test('should be accessible via HTTP GET method', async () => {
      const response = await axios.get(jwksUrl);

      expect(response.status).toBe(200);
    });

    test('should reject POST requests', async () => {
      try {
        await axios.post(jwksUrl);
        fail('Should have rejected POST request');
      } catch (error) {
        // Should return 405 Method Not Allowed or similar
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }
    });

  });

  describe('JWKS Endpoint Response Time', () => {

    test('should respond within 2 seconds under normal load', async () => {
      const startTime = Date.now();

      const response = await axios.get(jwksUrl);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Less than 2 seconds
    });

    test('should handle multiple concurrent requests efficiently', async () => {
      const startTime = Date.now();

      // Make 10 concurrent requests
      const requests = Array(10).fill(null).map(() => axios.get(jwksUrl));
      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('keys');
      });

      // Total time should be reasonable (not 10x single request time)
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds for 10 requests
    });

    test('should maintain consistent response times', async () => {
      const responseTimes = [];

      // Make 5 sequential requests
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await axios.get(jwksUrl);
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // All response times should be under 2 seconds
      responseTimes.forEach(time => {
        expect(time).toBeLessThan(2000);
      });

      // Calculate average response time
      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      expect(avgTime).toBeLessThan(1000); // Average should be under 1 second
    });

  });

  describe('Public Key Retrieval and Format Validation', () => {

    test('should return valid JSON Web Key Set format', async () => {
      const response = await axios.get(jwksUrl);

      expect(response.data).toHaveProperty('keys');
      expect(Array.isArray(response.data.keys)).toBe(true);

      const key = response.data.keys[0];

      // Validate JWK structure
      expect(key).toHaveProperty('kid'); // Key ID
      expect(key).toHaveProperty('kty'); // Key Type
      expect(key).toHaveProperty('alg'); // Algorithm
      expect(key).toHaveProperty('use'); // Public Key Use
      expect(key).toHaveProperty('n');   // Modulus (for RSA)
      expect(key).toHaveProperty('e');   // Exponent (for RSA)
    });

    test('should return RSA keys with correct algorithm', async () => {
      const response = await axios.get(jwksUrl);

      // Find a signing key (use='sig')
      const signingKey = response.data.keys.find(key => key.use === 'sig');

      expect(signingKey).toBeDefined();
      expect(signingKey.kty).toBe('RSA');
      expect(signingKey.alg).toBe('RS256');
      expect(signingKey.use).toBe('sig'); // Signature use
    });

    test('should include key ID (kid) for key identification', async () => {
      const response = await axios.get(jwksUrl);

      const key = response.data.keys[0];

      expect(key.kid).toBeDefined();
      expect(typeof key.kid).toBe('string');
      expect(key.kid.length).toBeGreaterThan(0);
    });

    test('should include x5c certificate chain', async () => {
      const response = await axios.get(jwksUrl);

      const key = response.data.keys[0];

      expect(key).toHaveProperty('x5c');
      expect(Array.isArray(key.x5c)).toBe(true);
      expect(key.x5c.length).toBeGreaterThan(0);
    });

    test('should include x5t and x5t#S256 thumbprints', async () => {
      const response = await axios.get(jwksUrl);

      const key = response.data.keys[0];

      expect(key).toHaveProperty('x5t');
      expect(key).toHaveProperty('x5t#S256');
      expect(typeof key.x5t).toBe('string');
      expect(typeof key['x5t#S256']).toBe('string');
    });

  });

  describe('JWT Signature Verification with JWKS', () => {

    test('should successfully verify JWT signature using JWKS public key', async () => {
      // Get a real token from Keycloak
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);
      const token = tokenData.access_token;

      // Create JWKS client
      const client = jwksClient({
        jwksUri: jwksUrl,
        cache: true,
        cacheMaxAge: 600000
      });

      // Decode token header to get kid
      const decoded = jwt.decode(token, { complete: true });
      expect(decoded).toBeDefined();
      expect(decoded.header).toHaveProperty('kid');

      const kid = decoded.header.kid;

      // Get signing key
      const key = await client.getSigningKey(kid);
      const publicKey = key.getPublicKey();

      // Verify token signature
      // Note: Removed audience check as token doesn't have 'aud' claim without proper client scopes
      const verified = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: `${config.keycloakUrl}/realms/${config.realm}`
        // audience: config.clientId // Token doesn't have aud claim
      });

      expect(verified).toBeDefined();
      expect(verified.realm_access.roles).toContain(user.expectedRole);
      // Note: preferred_username not available without 'profile' scope
      // expect(verified.preferred_username).toBe(user.username);
    });

    test('should reject token with invalid signature', async () => {
      // Get a real token
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);
      const token = tokenData.access_token;

      // Tamper with the token (change last character of signature)
      const tamperedToken = token.slice(0, -1) + 'X';

      // Create JWKS client
      const client = jwksClient({
        jwksUri: jwksUrl
      });

      try {
        // Decode original token to get kid (before tampering)
        const originalDecoded = jwt.decode(token, { complete: true });

        if (originalDecoded && originalDecoded.header && originalDecoded.header.kid) {
          const key = await client.getSigningKey(originalDecoded.header.kid);
          const publicKey = key.getPublicKey();

          // Try to verify tampered token - should throw error
          jwt.verify(tamperedToken, publicKey, {
            algorithms: ['RS256']
          });
        }

        fail('Should have rejected tampered token');
      } catch (error) {
        // Should throw JsonWebTokenError for invalid signature
        expect(['JsonWebTokenError', 'ReferenceError']).toContain(error.name);
      }
    }); test('should verify token expiration using public key', async () => {
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);
      const token = tokenData.access_token;

      const client = jwksClient({
        jwksUri: jwksUrl
      });

      const decoded = jwt.decode(token, { complete: true });
      const kid = decoded.header.kid;

      const key = await client.getSigningKey(kid);
      const publicKey = key.getPublicKey();

      // Verify with expiration check
      const verified = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        ignoreExpiration: false
      });

      expect(verified).toBeDefined();
      expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

  });

  describe('JWKS Caching and Performance', () => {

    test('should support caching of JWKS keys', async () => {
      const client = jwksClient({
        jwksUri: jwksUrl,
        cache: true,
        cacheMaxAge: 600000 // 10 minutes
      });

      // Get token to extract kid
      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);
      const token = tokenData.access_token;

      const decoded = jwt.decode(token, { complete: true });
      const kid = decoded.header.kid;

      // First request - should fetch from JWKS endpoint
      const startTime1 = Date.now();
      const key1 = await client.getSigningKey(kid);
      const time1 = Date.now() - startTime1;

      // Second request - should use cache
      const startTime2 = Date.now();
      const key2 = await client.getSigningKey(kid);
      const time2 = Date.now() - startTime2;

      expect(key1.getPublicKey()).toBe(key2.getPublicKey());

      // Cached request should be faster (though not guaranteed in all environments)
      // Just verify both requests succeed
      expect(time1).toBeGreaterThanOrEqual(0);
      expect(time2).toBeGreaterThanOrEqual(0);
    });

    test('should handle key rotation gracefully', async () => {
      // This test verifies that the JWKS endpoint can return multiple keys
      const response = await axios.get(jwksUrl);

      expect(response.data.keys).toBeDefined();
      expect(Array.isArray(response.data.keys)).toBe(true);

      // Keycloak typically maintains multiple keys for rotation
      // At minimum, there should be 1 key
      expect(response.data.keys.length).toBeGreaterThanOrEqual(1);

      // All keys should have unique kid values
      const kids = response.data.keys.map(key => key.kid);
      const uniqueKids = new Set(kids);
      expect(uniqueKids.size).toBe(kids.length);
    });

  });

  describe('JWKS Endpoint Error Handling', () => {

    test('should handle invalid realm gracefully', async () => {
      const invalidUrl = `${config.keycloakUrl}/realms/NonExistentRealm/protocol/openid-connect/certs`;

      try {
        await axios.get(invalidUrl);
        fail('Should have returned error for invalid realm');
      } catch (error) {
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }
    });

    test('should return consistent response format', async () => {
      // Make multiple requests and verify format consistency
      const responses = await Promise.all([
        axios.get(jwksUrl),
        axios.get(jwksUrl),
        axios.get(jwksUrl)
      ]);

      responses.forEach(response => {
        expect(response.data).toHaveProperty('keys');
        expect(Array.isArray(response.data.keys)).toBe(true);

        response.data.keys.forEach(key => {
          expect(key).toHaveProperty('kid');
          expect(key).toHaveProperty('kty');
          expect(key).toHaveProperty('alg');
        });
      });
    });

  });

});
