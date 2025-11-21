const logger = require('../utils/logger');

/**
 * Zero Trust Architecture Policy Engine
 * 
 * Implements attribute-based access control (ABAC) with:
 * - Role-based permissions
 * - Time-based access control
 * - Resource-level authorization
 * - Default deny approach
 */

class PolicyEngine {
    constructor() {
        // Default deny - all access denied unless explicitly allowed
        this.defaultPolicy = 'deny';

        // Time restrictions (24-hour format)
        this.restrictedHours = {
            start: 22, // 10:00 PM
            end: 6     // 06:00 AM
        };

        // Policy rules: resource -> action -> allowed roles
        this.policies = {
            'seed_batch': {
                'create': ['role_producer'],
                'read': ['role_producer', 'role_pbt_field', 'role_pbt_chief', 'role_lsm_head'],
                'update': ['role_producer'],
                'delete': ['role_producer']
            },
            'certification_request': {
                'submit': ['role_producer'],
                'read': ['role_producer', 'role_pbt_field', 'role_pbt_chief', 'role_lsm_head']
            },
            'inspection': {
                'create': ['role_pbt_field'],
                'read': ['role_pbt_field', 'role_pbt_chief', 'role_lsm_head'],
                'update': ['role_pbt_field']
            },
            'evaluation': {
                'create': ['role_pbt_chief'],
                'read': ['role_pbt_chief', 'role_lsm_head'],
                'approve': ['role_pbt_chief'],
                'reject': ['role_pbt_chief']
            },
            'certificate': {
                'issue': ['role_lsm_head'],
                'read': ['role_producer', 'role_pbt_field', 'role_pbt_chief', 'role_lsm_head'],
                'revoke': ['role_lsm_head']
            },
            'distribution': {
                'create': ['role_producer'],
                'read': ['role_producer', 'role_lsm_head']
            }
        };
    }

    /**
     * Evaluate access request using Zero Trust principles
     * 
     * @param {Object} user - User object from Keycloak token
     * @param {string} user.id - User UUID
     * @param {string} user.username - Username
     * @param {Array<string>} user.roles - User roles
     * @param {string} resource - Resource name (e.g., 'seed_batch', 'inspection')
     * @param {string} action - Action to perform (e.g., 'create', 'read', 'update')
     * @param {Object} context - Additional context (optional)
     * @returns {Object} Decision object with allow/deny and reason
     */
    evaluate(user, resource, action, context = {}) {
        const decision = {
            allow: false,
            reason: '',
            user: user?.username || 'unknown',
            resource,
            action,
            timestamp: new Date().toISOString()
        };

        try {
            // Step 1: Validate input
            if (!user || !user.roles || !Array.isArray(user.roles)) {
                decision.reason = 'Invalid user object or missing roles';
                this._logDecision(decision, 'INVALID_USER');
                return decision;
            }

            if (!resource || !action) {
                decision.reason = 'Resource and action are required';
                this._logDecision(decision, 'INVALID_REQUEST');
                return decision;
            }

            // Step 2: Time-based access control
            const timeCheck = this._checkTimeRestriction();
            if (!timeCheck.allowed) {
                decision.reason = timeCheck.reason;
                this._logDecision(decision, 'TIME_RESTRICTION');
                return decision;
            }

            // Step 3: Check resource existence
            if (!this.policies[resource]) {
                decision.reason = `Unknown resource: ${resource}`;
                this._logDecision(decision, 'UNKNOWN_RESOURCE');
                return decision;
            }

            // Step 4: Check action existence for resource
            if (!this.policies[resource][action]) {
                decision.reason = `Action '${action}' not allowed on resource '${resource}'`;
                this._logDecision(decision, 'UNKNOWN_ACTION');
                return decision;
            }

            // Step 5: Check role-based permission
            const allowedRoles = this.policies[resource][action];
            const hasRequiredRole = user.roles.some(role => allowedRoles.includes(role));

            if (!hasRequiredRole) {
                decision.reason = `User lacks required role. Required: [${allowedRoles.join(', ')}], User has: [${user.roles.join(', ')}]`;
                this._logDecision(decision, 'INSUFFICIENT_PERMISSIONS');
                return decision;
            }

            // Step 6: Additional context-based checks (if provided)
            if (context.ownerOnly && context.ownerId !== user.id) {
                decision.reason = 'User is not the owner of this resource';
                this._logDecision(decision, 'OWNERSHIP_VIOLATION');
                return decision;
            }

            // All checks passed - ALLOW
            decision.allow = true;
            decision.reason = 'Access granted';
            decision.matchedRole = user.roles.find(role => allowedRoles.includes(role));

            this._logDecision(decision, 'ACCESS_GRANTED');
            return decision;

        } catch (error) {
            decision.reason = `Policy evaluation error: ${error.message}`;
            this._logDecision(decision, 'EVALUATION_ERROR');
            logger.error('[PolicyEngine] Evaluation error', {
                error: error.message,
                stack: error.stack,
                user: user?.username,
                resource,
                action
            });
            return decision;
        }
    }

    /**
     * Check time-based restrictions
     * Zero Trust: Deny access during restricted hours (22:00 - 06:00)
     * 
     * @returns {Object} Result with allowed flag and reason
     */
    _checkTimeRestriction() {
        const now = new Date();
        const currentHour = now.getHours();

        // Check if current time is in restricted period
        // Restricted period: 22:00 (10 PM) to 06:00 (6 AM)
        const isRestricted = currentHour >= this.restrictedHours.start ||
            currentHour < this.restrictedHours.end;

        if (isRestricted) {
            return {
                allowed: false,
                reason: `Access denied: System access is restricted between ${this.restrictedHours.start}:00 and ${this.restrictedHours.end}:00. Current time: ${now.toTimeString()}`
            };
        }

        return {
            allowed: true,
            reason: 'Time check passed'
        };
    }

    /**
     * Log policy decision for audit trail
     * 
     * @param {Object} decision - Policy decision
     * @param {string} eventType - Event type for logging
     */
    _logDecision(decision, eventType) {
        const logLevel = decision.allow ? 'info' : 'warn';

        logger[logLevel](`[PolicyEngine] ${eventType}`, {
            allow: decision.allow,
            user: decision.user,
            resource: decision.resource,
            action: decision.action,
            reason: decision.reason,
            matchedRole: decision.matchedRole,
            timestamp: decision.timestamp
        });
    }

    /**
     * Add or update a policy rule
     * 
     * @param {string} resource - Resource name
     * @param {string} action - Action name
     * @param {Array<string>} roles - Allowed roles
     */
    addPolicy(resource, action, roles) {
        if (!this.policies[resource]) {
            this.policies[resource] = {};
        }
        this.policies[resource][action] = roles;

        logger.info('[PolicyEngine] Policy added', {
            resource,
            action,
            roles
        });
    }

    /**
     * Remove a policy rule
     * 
     * @param {string} resource - Resource name
     * @param {string} action - Action name
     */
    removePolicy(resource, action) {
        if (this.policies[resource] && this.policies[resource][action]) {
            delete this.policies[resource][action];

            logger.info('[PolicyEngine] Policy removed', {
                resource,
                action
            });
        }
    }

    /**
     * Get all policies for a resource
     * 
     * @param {string} resource - Resource name
     * @returns {Object} Policies for the resource
     */
    getPolicies(resource) {
        return this.policies[resource] || {};
    }

    /**
     * Check if user has any of the specified roles
     * 
     * @param {Object} user - User object
     * @param {Array<string>} roles - Roles to check
     * @returns {boolean} True if user has any of the roles
     */
    hasAnyRole(user, roles) {
        if (!user || !user.roles || !Array.isArray(user.roles)) {
            return false;
        }
        return user.roles.some(role => roles.includes(role));
    }

    /**
     * Check if user has all of the specified roles
     * 
     * @param {Object} user - User object
     * @param {Array<string>} roles - Roles to check
     * @returns {boolean} True if user has all of the roles
     */
    hasAllRoles(user, roles) {
        if (!user || !user.roles || !Array.isArray(user.roles)) {
            return false;
        }
        return roles.every(role => user.roles.includes(role));
    }

    /**
     * Evaluate bulk access requests (performance optimization)
     * 
     * @param {Object} user - User object
     * @param {Array<Object>} requests - Array of {resource, action} objects
     * @returns {Array<Object>} Array of decisions
     */
    evaluateBulk(user, requests) {
        return requests.map(req =>
            this.evaluate(user, req.resource, req.action, req.context)
        );
    }
}

// Export singleton instance
module.exports = new PolicyEngine();
