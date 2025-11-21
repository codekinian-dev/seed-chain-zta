const axios = require('axios');
const config = require('./config');

/**
 * Get access token using Direct Access Grant (Resource Owner Password Credentials)
 */
async function getAccessToken(username, password) {
  const tokenUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`;

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', config.clientId);
  params.append('username', username);
  params.append('password', password);
  // Note: Removed scope parameter as the client doesn't have openid/profile/email/offline_access scopes configured

  const response = await axios.post(tokenUrl, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data;
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(refreshToken) {
  const tokenUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`;

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', config.clientId);
  params.append('refresh_token', refreshToken);

  const response = await axios.post(tokenUrl, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data;
}

/**
 * Decode JWT token payload (without verification)
 */
function decodeToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT token format');
  }

  const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
  return JSON.parse(payload);
}

/**
 * Get user info from Keycloak
 */
async function getUserInfo(accessToken) {
  const userInfoUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/userinfo`;

  const response = await axios.get(userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  return response.data;
}

/**
 * Wait for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if Keycloak is ready
 */
async function waitForKeycloak(maxAttempts = 10, delayMs = 2000) {
  // Try to access the realm's well-known configuration endpoint
  const wellKnownUrl = `${config.keycloakUrl}/realms/${config.realm}/.well-known/openid-configuration`;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(wellKnownUrl);
      if (response.status === 200 && response.data.issuer) {
        return true;
      }
    } catch (error) {
      if (i < maxAttempts - 1) {
        await sleep(delayMs);
      }
    }
  }

  throw new Error('Keycloak is not ready');
}

module.exports = {
  getAccessToken,
  refreshAccessToken,
  decodeToken,
  getUserInfo,
  sleep,
  waitForKeycloak
};
