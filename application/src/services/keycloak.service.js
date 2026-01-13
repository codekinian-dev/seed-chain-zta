/**
 * Keycloak Service
 * 
 * Handles user registration and management in Keycloak
 * Provides admin operations for user management
 * 
 * @author Rangga
 * @date 2026-01-11
 */

const axios = require('axios');
const logger = require('../utils/logger');

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:6080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'SeedCertificationRealm';
const KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'seed-certification-client';

// Cache admin token
let adminToken = null;
let tokenExpiry = null;

/**
 * Get Keycloak admin access token
 * @returns {Promise<string>} Admin access token
 */
async function getAdminToken() {
    // Return cached token if still valid (with 60s buffer)
    if (adminToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
        return adminToken;
    }

    try {
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'password',
                client_id: 'admin-cli',
                username: KEYCLOAK_ADMIN_USER,
                password: KEYCLOAK_ADMIN_PASSWORD
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        adminToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000);

        logger.debug('[Keycloak Service] Admin token obtained');
        return adminToken;

    } catch (error) {
        logger.error('[Keycloak Service] Failed to get admin token', {
            error: error.message
        });
        throw new Error('Failed to authenticate with Keycloak admin');
    }
}

/**
 * Register a new user in Keycloak
 * @param {Object} userData - User registration data
 * @param {string} userData.username - Username
 * @param {string} userData.password - Password
 * @param {string} userData.email - Email address
 * @param {string} userData.firstName - First name
 * @param {string} userData.lastName - Last name
 * @param {string} userData.role - Role to assign (producer, pbt_field, pbt_chief, lsm_head)
 * @param {Object} userData.attributes - Additional attributes
 * @returns {Promise<Object>} Created user info
 */
async function registerUser(userData) {
    const token = await getAdminToken();

    // Validate required fields
    if (!userData.username || !userData.password || !userData.role) {
        throw new Error('Username, password, and role are required');
    }

    // Validate role
    const validRoles = ['role_producer', 'role_pbt_field', 'role_pbt_chief', 'role_lsm_head', 'role_admin'];
    if (!validRoles.includes(userData.role)) {
        throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Validate password strength
    if (userData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }

    try {
        // Step 1: Create user in Keycloak
        logger.info('[Keycloak Service] Creating user', { username: userData.username });

        const createUserPayload = {
            username: userData.username,
            email: userData.email || `${userData.username}@example.com`,
            firstName: userData.firstName || userData.username,
            lastName: userData.lastName || '',
            enabled: true,
            emailVerified: true,
            credentials: [{
                type: 'password',
                value: userData.password,
                temporary: false
            }],
            attributes: {
                organization: userData.attributes?.organization || '',
                phone: userData.attributes?.phone || '',
                address: userData.attributes?.address || ''
            }
        };

        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
            createUserPayload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Step 2: Get created user ID
        const usersResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
            {
                params: { username: userData.username, exact: true },
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        if (!usersResponse.data || usersResponse.data.length === 0) {
            throw new Error('User created but could not be retrieved');
        }

        const userId = usersResponse.data[0].id;

        // Step 3: Assign role to user
        await assignRoleToUser(token, userId, userData.role);

        logger.info('[Keycloak Service] User registered successfully', {
            userId,
            username: userData.username,
            role: userData.role
        });

        return {
            userId,
            username: userData.username,
            email: createUserPayload.email,
            role: userData.role,
            createdAt: new Date().toISOString()
        };

    } catch (error) {
        if (error.response?.status === 409) {
            throw new Error('Username or email already exists');
        }

        logger.error('[Keycloak Service] User registration failed', {
            username: userData.username,
            error: error.message,
            status: error.response?.status
        });

        throw new Error(error.response?.data?.errorMessage || error.message);
    }
}

/**
 * Assign a role to a user
 * @param {string} token - Admin token
 * @param {string} userId - Keycloak user ID
 * @param {string} roleName - Role name to assign
 */
async function assignRoleToUser(token, userId, roleName) {
    try {
        // Get available realm roles
        const rolesResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/roles`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        const role = rolesResponse.data.find(r => r.name === roleName);

        if (!role) {
            logger.warn('[Keycloak Service] Role not found, skipping assignment', { roleName });
            return;
        }

        // Assign role to user
        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
            [{ id: role.id, name: role.name }],
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        logger.debug('[Keycloak Service] Role assigned', { userId, roleName });

    } catch (error) {
        logger.error('[Keycloak Service] Failed to assign role', {
            userId,
            roleName,
            error: error.message
        });
        // Don't throw - user is created, role assignment is secondary
    }
}

/**
 * Get user by ID from Keycloak
 * @param {string} userId - Keycloak user ID
 * @returns {Promise<Object>} User info
 */
async function getUserById(userId) {
    const token = await getAdminToken();

    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        return response.data;

    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
}

/**
 * Get user by username from Keycloak
 * @param {string} username - Username to search
 * @returns {Promise<Object|null>} User info or null
 */
async function getUserByUsername(username) {
    const token = await getAdminToken();

    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
            {
                params: { username, exact: true },
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        return response.data.length > 0 ? response.data[0] : null;

    } catch (error) {
        logger.error('[Keycloak Service] Failed to get user by username', {
            username,
            error: error.message
        });
        throw error;
    }
}

/**
 * Get user's roles from Keycloak
 * @param {string} userId - Keycloak user ID
 * @returns {Promise<Array>} User roles
 */
async function getUserRoles(userId) {
    const token = await getAdminToken();

    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        return response.data.map(r => r.name);

    } catch (error) {
        logger.error('[Keycloak Service] Failed to get user roles', {
            userId,
            error: error.message
        });
        return [];
    }
}

/**
 * Update user in Keycloak
 * @param {string} userId - Keycloak user ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated user info
 */
async function updateUser(userId, updateData) {
    const token = await getAdminToken();

    try {
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}`,
            updateData,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return await getUserById(userId);

    } catch (error) {
        logger.error('[Keycloak Service] Failed to update user', {
            userId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Delete user from Keycloak
 * @param {string} userId - Keycloak user ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteUser(userId) {
    const token = await getAdminToken();

    try {
        await axios.delete(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        logger.info('[Keycloak Service] User deleted', { userId });
        return true;

    } catch (error) {
        logger.error('[Keycloak Service] Failed to delete user', {
            userId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Check if a username exists
 * @param {string} username - Username to check
 * @returns {Promise<boolean>} True if exists
 */
async function usernameExists(username) {
    const user = await getUserByUsername(username);
    return user !== null;
}

/**
 * Get user access token (for testing/login)
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} Token response
 */
async function getUserToken(username, password) {
    try {
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'password',
                client_id: KEYCLOAK_CLIENT_ID,
                username,
                password
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        return {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            expiresIn: response.data.expires_in,
            tokenType: response.data.token_type
        };

    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('Invalid username or password');
        }
        throw new Error('Authentication failed');
    }
}

/**
 * List all users in the realm
 * @param {Object} options - Query options
 * @param {number} options.first - Start index
 * @param {number} options.max - Max results
 * @returns {Promise<Array>} List of users
 */
async function listUsers(options = {}) {
    const token = await getAdminToken();
    const { first = 0, max = 100 } = options;

    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
            {
                params: { first, max },
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        return response.data;

    } catch (error) {
        logger.error('[Keycloak Service] Failed to list users', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Reset user password
 * @param {string} userId - Keycloak user ID
 * @param {string} newPassword - New password
 * @param {boolean} temporary - Whether password is temporary
 * @returns {Promise<boolean>} Success status
 */
async function resetPassword(userId, newPassword, temporary = false) {
    const token = await getAdminToken();

    try {
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/reset-password`,
            {
                type: 'password',
                value: newPassword,
                temporary
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        logger.info('[Keycloak Service] Password reset', { userId });
        return true;

    } catch (error) {
        logger.error('[Keycloak Service] Failed to reset password', {
            userId,
            error: error.message
        });
        throw error;
    }
}

module.exports = {
    registerUser,
    getUserById,
    getUserByUsername,
    getUserRoles,
    updateUser,
    deleteUser,
    usernameExists,
    getUserToken,
    listUsers,
    resetPassword,
    getAdminToken
};
