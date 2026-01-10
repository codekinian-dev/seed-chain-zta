/**
 * Identity Controller
 * 
 * Handles user identity registration and management
 * Integrates Keycloak authentication with Fabric CA enrollment
 */

const identityService = require('../services/identity.service');
const logger = require('../utils/logger');

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
        const roles = token.realm_access?.roles || [];
        if (!roles.includes('admin')) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Admin role required to list identities'
            });
        }

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
        'producer',
        'pbt_field',
        'pbt_field_inspector',
        'pbt_chief',
        'pbt_chief_inspector',
        'lsm_head',
        'lsm_issuer'
    ];

    for (const role of rolePriority) {
        if (roles.includes(role)) {
            return role;
        }
    }

    return null;
}

module.exports = {
    enrollUser,
    checkIdentityStatus,
    reenrollUser,
    revokeUser,
    listIdentities
};
