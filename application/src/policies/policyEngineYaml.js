const logger = require('../utils/logger');
const policyLoader = require('./policyLoader');
const path = require('path');

/**
 * Zero Trust Architecture Policy Engine (YAML-Based)
 * 
 * Implements attribute-based access control (ABAC) with:
 * - Dynamic YAML-based policy configuration
 * - Role-based permissions
 * - Time-based access control
 * - Resource-level authorization
 * - Conditional access (owner_only, status checks)
 * - Hot reload support
 * - Default deny approach
 */

class PolicyEngine {
    constructor() {
        this.initialized = false;
        this.defaultPolicy = 'deny';
    }

    /**
     * Initialize the policy engine with YAML configuration
     * 
     * @param {Object} options - Initialization options
     * @param {string} options.policyFile - Path to policies YAML file
     * @param {boolean} options.watchForChanges - Enable hot reload
     * @returns {Promise<void>}
     */
    async initialize(options = {}) {
        const policyFile = options.policyFile ||
            path.join(__dirname, '../../config/policies.yaml');

        try {
            await policyLoader.initialize(policyFile, {
                watchForChanges: options.watchForChanges !== false
            });

            // Listen for policy updates
            policyLoader.addListener((event, policies) => {
                if (event === 'load') {
                    this._onPolicyUpdate(policies);
                }
            });

            this.initialized = true;
            this.defaultPolicy = policyLoader.getSettings().default_policy || 'deny';

            logger.info('[PolicyEngine] Initialized with YAML-based policies', {
                policyFile,
                defaultPolicy: this.defaultPolicy
            });
        } catch (error) {
            logger.error('[PolicyEngine] Failed to initialize', {
                error: error.message
            });
            // Fall back to basic deny-all mode
            this.initialized = false;
            throw error;
        }
    }

    /**
     * Handle policy updates (hot reload callback)
     * 
     * @param {Object} policies - Updated policies
     */
    _onPolicyUpdate(policies) {
        this.defaultPolicy = policies.settings?.default_policy || 'deny';
        logger.info('[PolicyEngine] Policies updated via hot reload', {
            version: policies.metadata?.version
        });
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
            timestamp: new Date().toISOString(),
            policyVersion: policyLoader.getPolicies()?.metadata?.version
        };

        try {
            // Step 0: Check if policy engine is initialized
            if (!this.initialized) {
                // Attempt lazy initialization
                if (!policyLoader.getPolicies()) {
                    decision.reason = 'Policy engine not initialized';
                    this._logDecision(decision, 'NOT_INITIALIZED');
                    return decision;
                }
            }

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
            const settings = policyLoader.getSettings();
            if (settings.time_restriction_enabled) {
                const timeCheck = this._checkTimeRestriction(settings);
                if (!timeCheck.allowed) {
                    decision.reason = timeCheck.reason;
                    this._logDecision(decision, 'TIME_RESTRICTION');
                    return decision;
                }
            }

            // Step 3: Check resource existence
            const resources = policyLoader.getResources();
            if (!resources[resource]) {
                decision.reason = `Unknown resource: ${resource}`;
                this._logDecision(decision, 'UNKNOWN_RESOURCE');
                return decision;
            }

            // Step 4: Check action existence for resource
            if (!policyLoader.actionExists(resource, action)) {
                decision.reason = `Action '${action}' not allowed on resource '${resource}'`;
                this._logDecision(decision, 'UNKNOWN_ACTION');
                return decision;
            }

            // Step 5: Check role-based permission
            const allowedRoles = policyLoader.getAllowedRoles(resource, action);
            const hasRequiredRole = user.roles.some(role => allowedRoles.includes(role));

            if (!hasRequiredRole) {
                decision.reason = `User lacks required role. Required: [${allowedRoles.join(', ')}], User has: [${user.roles.join(', ')}]`;
                this._logDecision(decision, 'INSUFFICIENT_PERMISSIONS');
                return decision;
            }

            // Step 6: Check conditions from YAML
            const conditions = policyLoader.getConditions(resource, action);
            const conditionCheck = this._evaluateConditions(conditions, user, context);
            if (!conditionCheck.passed) {
                decision.reason = conditionCheck.reason;
                this._logDecision(decision, 'CONDITION_FAILED');
                return decision;
            }

            // Step 7: Check custom rules
            const customRulesCheck = this._evaluateCustomRules(user, resource, action, context);
            if (!customRulesCheck.passed) {
                decision.reason = customRulesCheck.reason;
                this._logDecision(decision, 'CUSTOM_RULE_VIOLATION');
                return decision;
            }

            // All checks passed - ALLOW
            decision.allow = true;
            decision.reason = 'Access granted';
            decision.matchedRole = user.roles.find(role => allowedRoles.includes(role));
            decision.appliedConditions = conditions;

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
     * Check time-based restrictions from YAML settings
     * 
     * @param {Object} settings - Policy settings
     * @returns {Object} Result with allowed flag and reason
     */
    _checkTimeRestriction(settings) {
        const now = new Date();
        const currentHour = now.getHours();

        const restrictedHours = settings.restricted_hours || { start: 22, end: 6 };

        // Check if current time is in restricted period
        const isRestricted = currentHour >= restrictedHours.start ||
            currentHour < restrictedHours.end;

        if (isRestricted) {
            return {
                allowed: false,
                reason: `Access denied: System access is restricted between ${restrictedHours.start}:00 and ${restrictedHours.end}:00. Current time: ${now.toTimeString()}`
            };
        }

        return {
            allowed: true,
            reason: 'Time check passed'
        };
    }

    /**
     * Evaluate conditions defined in YAML
     * 
     * @param {Object} conditions - Conditions from policy
     * @param {Object} user - User object
     * @param {Object} context - Request context
     * @returns {Object} Result with passed flag and reason
     */
    _evaluateConditions(conditions, user, context) {
        // Check owner_only condition
        if (conditions.owner_only && context.ownerId) {
            if (context.ownerId !== user.id) {
                return {
                    passed: false,
                    reason: 'User is not the owner of this resource'
                };
            }
        }

        // Check status_must_be condition
        if (conditions.status_must_be && context.status) {
            const allowedStatuses = conditions.status_must_be;
            if (!allowedStatuses.includes(context.status)) {
                return {
                    passed: false,
                    reason: `Action not allowed for status '${context.status}'. Allowed statuses: [${allowedStatuses.join(', ')}]`
                };
            }
        }

        return {
            passed: true,
            reason: 'All conditions met'
        };
    }

    /**
     * Evaluate custom rules from YAML
     * 
     * @param {Object} user - User object
     * @param {string} resource - Resource name
     * @param {string} action - Action name
     * @param {Object} context - Request context
     * @returns {Object} Result with passed flag and reason
     */
    _evaluateCustomRules(user, resource, action, context) {
        const customRules = policyLoader.getCustomRules();

        for (const rule of customRules) {
            // Check if rule applies
            const appliesTo = rule.applies_to || {};
            const roleMatches = !appliesTo.roles ||
                user.roles.some(r => appliesTo.roles.includes(r));
            const resourceMatches = !appliesTo.resources ||
                appliesTo.resources.includes(resource);

            if (roleMatches && resourceMatches) {
                // Apply the condition
                if (rule.condition === 'owner_only' && context.ownerId) {
                    if (context.ownerId !== user.id) {
                        return {
                            passed: false,
                            reason: `Custom rule '${rule.name}': ${rule.description}`
                        };
                    }
                }

                if (rule.condition === 'assigned_only' && context.assignedTo) {
                    if (context.assignedTo !== user.id) {
                        return {
                            passed: false,
                            reason: `Custom rule '${rule.name}': ${rule.description}`
                        };
                    }
                }
            }
        }

        return {
            passed: true,
            reason: 'All custom rules passed'
        };
    }

    /**
     * Log policy decision for audit trail
     * 
     * @param {Object} decision - Policy decision
     * @param {string} eventType - Event type for logging
     */
    _logDecision(decision, eventType) {
        const settings = policyLoader.getSettings();
        if (!settings.audit_logging) {
            return;
        }

        const logLevel = decision.allow ? 'info' : 'warn';

        logger[logLevel](`[PolicyEngine] ${eventType}`, {
            allow: decision.allow,
            user: decision.user,
            resource: decision.resource,
            action: decision.action,
            reason: decision.reason,
            matchedRole: decision.matchedRole,
            timestamp: decision.timestamp,
            policyVersion: decision.policyVersion
        });
    }

    /**
     * Add or update a policy rule dynamically (also updates YAML file)
     * 
     * @param {string} resource - Resource name
     * @param {string} action - Action name
     * @param {Array<string>} roles - Allowed roles
     * @param {Object} options - Additional options
     */
    async addPolicy(resource, action, roles, options = {}) {
        const policies = policyLoader.getPolicies();

        if (!policies.resources[resource]) {
            policies.resources[resource] = {
                description: options.resourceDescription || '',
                actions: {}
            };
        }

        policies.resources[resource].actions[action] = {
            roles: roles,
            description: options.actionDescription || '',
            conditions: options.conditions || {}
        };

        // Update permission map
        const key = `${resource}:${action}`;
        policies.permissionMap[key] = roles;

        logger.info('[PolicyEngine] Policy added dynamically', {
            resource,
            action,
            roles
        });

        // Optionally save back to YAML file
        if (options.persist) {
            await this._persistPolicies();
        }
    }

    /**
     * Remove a policy rule
     * 
     * @param {string} resource - Resource name
     * @param {string} action - Action name
     * @param {Object} options - Additional options
     */
    async removePolicy(resource, action, options = {}) {
        const policies = policyLoader.getPolicies();

        if (policies.resources[resource]?.actions?.[action]) {
            delete policies.resources[resource].actions[action];
            delete policies.permissionMap[`${resource}:${action}`];

            logger.info('[PolicyEngine] Policy removed', {
                resource,
                action
            });

            if (options.persist) {
                await this._persistPolicies();
            }
        }
    }

    /**
     * Persist current policies back to YAML file
     * 
     * @private
     */
    async _persistPolicies() {
        const yaml = require('js-yaml');
        const fs = require('fs').promises;

        try {
            const policies = policyLoader.getPolicies();

            // Convert back to YAML format
            const yamlContent = this._convertToYamlFormat(policies);
            const yamlString = yaml.dump(yamlContent, {
                indent: 2,
                lineWidth: 120,
                noRefs: true
            });

            const filePath = policyLoader.getStatus().policyFile;
            await fs.writeFile(filePath, yamlString, 'utf8');

            logger.info('[PolicyEngine] Policies persisted to YAML file');
        } catch (error) {
            logger.error('[PolicyEngine] Failed to persist policies', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Convert internal format back to YAML format
     * 
     * @param {Object} policies - Internal policies
     * @returns {Object} YAML-ready format
     */
    _convertToYamlFormat(policies) {
        const yamlFormat = {
            metadata: policies.metadata,
            settings: policies.settings,
            roles: policies.roles,
            resources: {},
            custom_rules: policies.customRules,
            ip_whitelist: policies.ipWhitelist,
            rate_limits: policies.rateLimits
        };

        // Convert resources
        for (const [resourceId, resourceConfig] of Object.entries(policies.resources)) {
            yamlFormat.resources[resourceId] = {
                description: resourceConfig.description,
                actions: {}
            };

            for (const [actionId, actionConfig] of Object.entries(resourceConfig.actions)) {
                yamlFormat.resources[resourceId].actions[actionId] = {
                    roles: actionConfig.roles,
                    description: actionConfig.description
                };

                if (Object.keys(actionConfig.conditions || {}).length > 0) {
                    yamlFormat.resources[resourceId].actions[actionId].conditions =
                        actionConfig.conditions;
                }
            }
        }

        return yamlFormat;
    }

    /**
     * Get all policies for a resource
     * 
     * @param {string} resource - Resource name
     * @returns {Object} Policies for the resource
     */
    getPolicies(resource) {
        const resources = policyLoader.getResources();
        if (resource) {
            return resources[resource]?.actions || {};
        }
        return resources;
    }

    /**
     * Get all defined roles
     * 
     * @returns {Object} Role definitions
     */
    getRoles() {
        return policyLoader.getRoles();
    }

    /**
     * Get policy settings
     * 
     * @returns {Object} Settings
     */
    getSettings() {
        return policyLoader.getSettings();
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

    /**
     * Get rate limits for a specific role
     * 
     * @param {string} role - Role name
     * @returns {Object} Rate limit configuration
     */
    getRateLimits(role) {
        return policyLoader.getRateLimits(role);
    }

    /**
     * Get policy engine status
     * 
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.initialized,
            defaultPolicy: this.defaultPolicy,
            ...policyLoader.getStatus()
        };
    }

    /**
     * Reload policies from YAML file
     * 
     * @returns {Promise<Object>} Reloaded policies
     */
    async reload() {
        const policies = await policyLoader.reload();
        this.defaultPolicy = policies.settings?.default_policy || 'deny';
        return policies;
    }
}

// Export singleton instance
module.exports = new PolicyEngine();
