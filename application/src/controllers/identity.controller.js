/**
 * Identity Controller
 * 
 * Handles user identity registration and management
 * Integrates Keycloak authentication with Fabric CA enrollment
 */

const identityService = require('../services/identity.service');
const keycloakService = require('../services/keycloak.service');
const logger = require('../utils/logger');

/**
 * Register a new user in Keycloak (public endpoint)
 * This creates the user in Keycloak IDP
 * 
 * POST /api/v1/identity/register
 * 
 * Body:
 * - username: string (required)
 * - password: string (required, min 8 chars)
 * - email: string (optional)
 * - firstName: string (optional)
 * - lastName: string (optional)
 * - role: string (required) - producer, pbt_field, pbt_chief, lsm_head
 * - organization: string (optional)
 * - phone: string (optional)
 * - address: string (optional)
 */
const registerUser = async (req, res) => {
    try {
        const {
            username,
            password,
            email,
            firstName,
            lastName,
            role,
            organization,
            phone,
            address
        } = req.body;

        // Validate required fields
        if (!username || !password || !role) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Username, password, and role are required'
            });
        }

        // Validate username format
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Username must be 3-30 characters, alphanumeric and underscore only'
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Password must be at least 8 characters long'
            });
        }

        // Validate role
        const validRoles = ['role_producer', 'role_pbt_field', 'role_pbt_chief', 'role_lsm_head'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            });
        }

        logger.info('[Identity Controller] Registering new user', {
            username,
            role
        });

        // Register user in Keycloak
        const result = await keycloakService.registerUser({
            username,
            password,
            email,
            firstName,
            lastName,
            role,
            attributes: {
                organization,
                phone,
                address
            }
        });

        logger.audit('USER_REGISTERED', {
            userId: result.userId,
            username: result.username,
            role: result.role
        });

        return res.status(201).json({
            success: true,
            message: 'User registered successfully. Please login to get access token, then call /enroll to create blockchain identity.',
            data: {
                userId: result.userId,
                username: result.username,
                email: result.email,
                role: result.role,
                createdAt: result.createdAt,
                nextStep: 'POST /api/v1/identity/enroll (with Bearer token)'
            }
        });

    } catch (error) {
        logger.error('[Identity Controller] Registration failed', {
            username: req.body?.username,
            error: error.message
        });

        // Handle specific errors
        if (error.message.includes('already exists')) {
            return res.status(409).json({
                success: false,
                error: 'Conflict',
                message: 'Username or email already exists'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Registration Failed',
            message: error.message
        });
    }
};

/**
 * Register user and automatically enroll in Fabric CA
 * Combined endpoint for full registration flow
 * 
 * POST /api/v1/identity/register-and-enroll
 */
const registerAndEnroll = async (req, res) => {
    try {
        const {
            username,
            password,
            email,
            firstName,
            lastName,
            role,
            organization,
            phone,
            address
        } = req.body;

        // Validate required fields
        if (!username || !password || !role) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Username, password, and role are required'
            });
        }

        // Validate role
        const validRoles = ['role_producer', 'role_pbt_field', 'role_pbt_chief', 'role_lsm_head'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            });
        }

        logger.info('[Identity Controller] Register and enroll user', {
            username,
            role
        });

        // Step 1: Register in Keycloak
        const keycloakResult = await keycloakService.registerUser({
            username,
            password,
            email,
            firstName,
            lastName,
            role,
            attributes: { organization, phone, address }
        });

        // Step 2: Enroll in Fabric CA
        const fabricResult = await identityService.registerAndEnrollUser({
            userId: keycloakResult.userId,
            username: keycloakResult.username,
            role: role,
            attributes: {
                email: keycloakResult.email,
                name: `${firstName || ''} ${lastName || ''}`.trim() || username
            }
        });

        logger.audit('USER_REGISTERED_AND_ENROLLED', {
            userId: keycloakResult.userId,
            username: keycloakResult.username,
            role: role
        });

        return res.status(201).json({
            success: true,
            message: 'User registered and enrolled successfully',
            data: {
                keycloak: {
                    userId: keycloakResult.userId,
                    username: keycloakResult.username,
                    email: keycloakResult.email,
                    role: keycloakResult.role
                },
                fabric: {
                    userId: fabricResult.userId,
                    mspId: fabricResult.mspId,
                    enrolledAt: fabricResult.enrolledAt
                }
            }
        });

    } catch (error) {
        logger.error('[Identity Controller] Register and enroll failed', {
            username: req.body?.username,
            error: error.message
        });

        if (error.message.includes('already exists')) {
            return res.status(409).json({
                success: false,
                error: 'Conflict',
                message: 'Username or email already exists'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Registration Failed',
            message: error.message
        });
    }
};

/**
 * Login and get access token
 * 
 * POST /api/v1/identity/login
 */
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Username and password are required'
            });
        }

        const tokenResult = await keycloakService.getUserToken(username, password);

        logger.audit('USER_LOGIN', {
            username
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken: tokenResult.accessToken,
                refreshToken: tokenResult.refreshToken,
                expiresIn: tokenResult.expiresIn,
                tokenType: tokenResult.tokenType
            }
        });

    } catch (error) {
        logger.warn('[Identity Controller] Login failed', {
            username: req.body?.username,
            error: error.message
        });

        if (error.message.includes('Invalid username or password')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Invalid username or password'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Login Failed',
            message: error.message
        });
    }
};

/**
 * Register/Enroll user identity after Keycloak registration
 * This endpoint should be called after user successfully registers in Keycloak
 * 
 * POST /api/v1/identity/enroll
 */
const enrollUser = async (req, res) => {
    try {
        // Get user info from Keycloak token
        const token = req.kauth?.grant?.access_token?.content;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Valid authentication token required'
            });
        }

        // Extract user data from token
        const userData = {
            userId: token.sub,  // Keycloak user UUID
            username: token.preferred_username || token.name,
            role: _extractPrimaryRole(token.realm_access?.roles || []),
            attributes: {
                email: token.email,
                name: token.name || token.preferred_username
            }
        };

        if (!userData.role) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'User must have a valid role assigned in Keycloak'
            });
        }

        logger.info('[Identity Controller] Enrolling user from Keycloak', {
            userId: userData.userId,
            username: userData.username,
            role: userData.role
        });

        // Register and enroll user
        const result = await identityService.registerAndEnrollUser(userData);

        logger.audit('USER_IDENTITY_ENROLLED', {
            userId: userData.userId,
            username: userData.username,
            role: userData.role,
            alreadyExists: result.alreadyExists
        });

        return res.status(result.alreadyExists ? 200 : 201).json({
            success: true,
            message: result.message,
            data: {
                userId: result.userId,
                username: result.username,
                role: result.role,
                mspId: result.mspId,
                enrolledAt: result.enrolledAt
            }
        });

    } catch (error) {
        logger.error('[Identity Controller] Enrollment failed', {
            error: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            success: false,
            error: 'Enrollment Failed',
            message: error.message
        });
    }
};

/**
 * Check if current user has Fabric identity
 * 
 * GET /api/v1/identity/status
 */
const checkIdentityStatus = async (req, res) => {
    try {
        const token = req.kauth?.grant?.access_token?.content;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Valid authentication token required'
            });
        }

        const userId = token.sub;
        const hasIdentity = await identityService.hasIdentity(userId);

        let identityInfo = null;
        if (hasIdentity) {
            const identity = await identityService.getIdentity(userId);
            identityInfo = {
                userId: userId,
                mspId: identity.mspId,
                type: identity.type,
                metadata: identity.metadata
            };
        }

        return res.status(200).json({
            success: true,
            data: {
                hasIdentity: hasIdentity,
                identity: identityInfo
            }
        });

    } catch (error) {
        logger.error('[Identity Controller] Status check failed', {
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: 'Status Check Failed',
            message: error.message
        });
    }
};

/**
 * Re-enroll user (refresh certificate)
 * 
 * POST /api/v1/identity/reenroll
 */
const reenrollUser = async (req, res) => {
    try {
        const token = req.kauth?.grant?.access_token?.content;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Valid authentication token required'
            });
        }

        const userId = token.sub;

        logger.info('[Identity Controller] Re-enrolling user', { userId });

        const result = await identityService.reenrollUser(userId);

        logger.audit('USER_IDENTITY_REENROLLED', { userId });

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                userId: result.userId,
                reenrolledAt: result.reenrolledAt
            }
        });

    } catch (error) {
        logger.error('[Identity Controller] Re-enrollment failed', {
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: 'Re-enrollment Failed',
            message: error.message
        });
    }
};

/**
 * Revoke user identity (admin only)
 * 
 * DELETE /api/v1/identity/:userId
 */
const revokeUser = async (req, res) => {
    try {
        const token = req.kauth?.grant?.access_token?.content;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Valid authentication token required'
            });
        }

        // Check if user has admin role
        const roles = token.realm_access?.roles || [];
        if (!roles.includes('admin')) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Admin role required to revoke identities'
            });
        }

        const { userId } = req.params;
        const { reason } = req.body || {};

        logger.info('[Identity Controller] Revoking user identity', {
            targetUserId: userId,
            revokedBy: token.sub,
            reason: reason
        });

        const result = await identityService.revokeUser(userId, reason || 'Admin revocation');

        logger.audit('USER_IDENTITY_REVOKED', {
            targetUserId: userId,
            revokedBy: token.sub,
            reason: reason
        });

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                userId: result.userId,
                reason: result.reason,
                revokedAt: result.revokedAt
            }
        });

    } catch (error) {
        logger.error('[Identity Controller] Revocation failed', {
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: 'Revocation Failed',
            message: error.message
        });
    }
};

/**
 * List all identities (admin only)
 * 
 * GET /api/v1/identity/list
 */
const listIdentities = async (req, res) => {
    try {
        const token = req.kauth?.grant?.access_token?.content;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Valid authentication token required'
            });
        }

        // Check if user has admin role
        // const roles = token.realm_access?.roles || [];
        // if (!roles.includes('admin')) {
        //     return res.status(403).json({
        //         success: false,
        //         error: 'Forbidden',
        //         message: 'Admin role required to list identities'
        //     });
        // }

        const identities = await identityService.listIdentities();

        return res.status(200).json({
            success: true,
            data: {
                count: identities.length,
                identities: identities
            }
        });

    } catch (error) {
        logger.error('[Identity Controller] List failed', {
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: 'List Failed',
            message: error.message
        });
    }
};

/**
 * Extract primary role from Keycloak roles
 * @param {Array} roles - Keycloak realm roles
 * @returns {string|null} Primary role for Fabric
 */
function _extractPrimaryRole(roles) {
    // Priority order for roles
    const rolePriority = [
        'role_producer',
        'role_pbt_field',
        'role_pbt_field_inspector',
        'role_pbt_chief',
        'role_pbt_chief_inspector',
        'role_lsm_head',
        'role_lsm_issuer'
    ];

    for (const role of rolePriority) {
        if (roles.includes(role)) {
            return role;
        }
    }

    return null;
}

module.exports = {
    registerUser,
    registerAndEnroll,
    login,
    enrollUser,
    checkIdentityStatus,
    reenrollUser,
    revokeUser,
    listIdentities
};
