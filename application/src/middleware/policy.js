const policyEngine = require('../policies/policyEngine');
const logger = require('../utils/logger');

/**
 * Middleware to enforce Zero Trust policies
 * 
 * Usage:
 * router.post('/endpoint', 
 *   keycloak.protect(),
 *   enforcePolicy('seed_batch', 'create'),
 *   controller
 * )
 * 
 * @param {string} resource - Resource name
 * @param {string} action - Action to perform
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
const enforcePolicy = (resource, action, options = {}) => {
    return (req, res, next) => {
        try {
            // Extract user from Keycloak token
            if (!req.kauth || !req.kauth.grant) {
                logger.warn('[Policy] No authentication found', {
                    path: req.path,
                    resource,
                    action
                });

                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Authentication required for policy evaluation'
                });
            }

            const token = req.kauth.grant.access_token;
            const user = {
                id: token.content.sub,
                username: token.content.preferred_username,
                roles: token.content.realm_access?.roles || [],
                email: token.content.email,
                fullName: token.content.name
            };

            // Build context
            const context = {
                ...options,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                method: req.method,
                path: req.path
            };

            // If ownerOnly is enabled, extract owner from params or body
            if (options.ownerOnly) {
                context.ownerId = req.params.userId || req.body.userId;
            }

            // Evaluate policy
            const decision = policyEngine.evaluate(user, resource, action, context);

            if (!decision.allow) {
                logger.security('POLICY_VIOLATION', user.id, req.path, {
                    username: user.username,
                    resource,
                    action,
                    reason: decision.reason,
                    roles: user.roles
                });

                return res.status(403).json({
                    error: 'Forbidden',
                    message: decision.reason,
                    resource,
                    action
                });
            }

            // Attach decision to request for logging
            req.policyDecision = decision;

            logger.audit('POLICY_GRANTED', user.id, req.path, {
                username: user.username,
                resource,
                action,
                matchedRole: decision.matchedRole
            });

            next();

        } catch (error) {
            logger.error('[Policy] Middleware error', {
                error: error.message,
                stack: error.stack,
                resource,
                action,
                path: req.path
            });

            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Policy evaluation failed'
            });
        }
    };
};

/**
 * Middleware to check time restrictions only
 * Useful for public endpoints that need time-based access control
 */
const enforceTimeRestriction = () => {
    return (req, res, next) => {
        const now = new Date();
        const currentHour = now.getHours();

        // Check restricted hours (22:00 - 06:00)
        const isRestricted = currentHour >= 22 || currentHour < 22;

        if (isRestricted) {
            logger.warn('[Policy] Time restriction enforced', {
                path: req.path,
                currentHour,
                timestamp: now.toISOString()
            });

            return res.status(403).json({
                error: 'Forbidden',
                message: `System access is restricted between 22:00 and 06:00. Current time: ${now.toTimeString()}`
            });
        }

        next();
    };
};

/**
 * Helper to check if user has specific role
 * Can be used in controllers for fine-grained checks
 */
const checkRole = (user, requiredRoles) => {
    if (!user || !user.roles) {
        return false;
    }

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return policyEngine.hasAnyRole(user, roles);
};

module.exports = {
    enforcePolicy,
    enforceTimeRestriction,
    checkRole,
    policyEngine // Export for direct access if needed
};
