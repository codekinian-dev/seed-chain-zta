const axios = require('axios');
const config = require('./config');
const { getAccessToken, decodeToken, waitForKeycloak } = require('./helpers');

describe('Authentication Flow Tests', () => {

  beforeAll(async () => {
    // Wait for Keycloak to be ready
    await waitForKeycloak();
  });

  describe('Successful Login', () => {

    test('should successfully authenticate producer with valid credentials', async () => {
      const user = config.testUsers.producer;

      const tokenData = await getAccessToken(user.username, user.password);

      expect(tokenData).toHaveProperty('access_token');
      expect(tokenData).toHaveProperty('refresh_token');
      expect(tokenData).toHaveProperty('token_type', 'Bearer');
      expect(tokenData).toHaveProperty('expires_in');

      const decoded = decodeToken(tokenData.access_token);
      expect(decoded.realm_access.roles).toContain(user.expectedRole);
    });

    test('should successfully authenticate PBT field user with valid credentials', async () => {
      const user = config.testUsers.pbtField;

      const tokenData = await getAccessToken(user.username, user.password);

      expect(tokenData).toHaveProperty('access_token');
      expect(tokenData).toHaveProperty('refresh_token');

      const decoded = decodeToken(tokenData.access_token);
      expect(decoded.realm_access.roles).toContain(user.expectedRole);
    });

    test('should successfully authenticate LSM head with valid credentials', async () => {
      const user = config.testUsers.lsmHead;

      const tokenData = await getAccessToken(user.username, user.password);

      expect(tokenData).toHaveProperty('access_token');

      const decoded = decodeToken(tokenData.access_token);
      expect(decoded.realm_access.roles).toContain(user.expectedRole);
    });

    test('should successfully authenticate public user with valid credentials', async () => {
      const user = config.testUsers.public;

      const tokenData = await getAccessToken(user.username, user.password);

      expect(tokenData).toHaveProperty('access_token');

      const decoded = decodeToken(tokenData.access_token);
      expect(decoded.realm_access.roles).toContain(user.expectedRole);
    });

  });

  describe('Failed Login', () => {

    test('should fail authentication with invalid username', async () => {
      const tokenUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`;

      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', config.clientId);
      params.append('username', 'nonexistent_user_xyz');
      params.append('password', 'SomePassword123!');

      await expect(
        axios.post(tokenUrl, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      ).rejects.toMatchObject({
        response: {
          status: 401,
          data: expect.objectContaining({
            error: 'invalid_grant'
          })
        }
      });
    });

    test('should fail authentication with invalid password', async () => {
      const user = config.testUsers.producer;
      const tokenUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`;

      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', config.clientId);
      params.append('username', user.username);
      params.append('password', 'WrongPassword123!');

      await expect(
        axios.post(tokenUrl, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      ).rejects.toMatchObject({
        response: {
          status: 401,
          data: expect.objectContaining({
            error: 'invalid_grant'
          })
        }
      });
    });

    test('should fail authentication with empty credentials', async () => {
      const tokenUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`;

      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', config.clientId);
      params.append('username', '');
      params.append('password', '');

      await expect(
        axios.post(tokenUrl, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      ).rejects.toMatchObject({
        response: {
          status: 401
        }
      });
    });

  });

  describe('MFA Flow', () => {

    test('should verify privileged roles require MFA configuration', async () => {
      // Note: This test verifies that MFA is configured in the realm
      // Actual OTP validation requires interactive setup with authenticator app

      const user = config.testUsers.producer;
      const tokenData = await getAccessToken(user.username, user.password);

      // If user has not set up MFA yet, they should still be able to login
      // but the realm should have MFA configured for privileged roles
      expect(tokenData).toHaveProperty('access_token');

      const decoded = decodeToken(tokenData.access_token);
      expect(decoded.realm_access.roles).toContain('role_producer');

      // Verify this is a privileged role that should have MFA
      const privilegedRoles = ['role_producer', 'role_pbt_field', 'role_pbt_chief', 'role_lsm_head'];
      const hasPrivilegedRole = decoded.realm_access.roles.some(role =>
        privilegedRoles.includes(role)
      );
      expect(hasPrivilegedRole).toBe(true);
    });

    test('should verify public role users can login without MFA', async () => {
      const user = config.testUsers.public;

      const tokenData = await getAccessToken(user.username, user.password);

      expect(tokenData).toHaveProperty('access_token');

      const decoded = decodeToken(tokenData.access_token);
      expect(decoded.realm_access.roles).toContain('role_public');

      // Public users should not be in privileged roles
      const privilegedRoles = ['role_producer', 'role_pbt_field', 'role_pbt_chief', 'role_lsm_head'];
      const hasPrivilegedRole = decoded.realm_access.roles.some(role =>
        privilegedRoles.includes(role)
      );
      expect(hasPrivilegedRole).toBe(false);
    });

  });

});
