const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chokidar = require('chokidar');
const logger = require('../utils/logger');

/**
 * Policy Loader - Loads and manages YAML-based policies
 * 
 * Features:
 * - Load policies from YAML file
 * - Hot reload on file changes
 * - Validation of policy structure
 * - Cache management
 */
class PolicyLoader {
    constructor() {
        this.policies = null;
        this.policyFilePath = null;
        this.watcher = null;
        this.lastLoadTime = null;
        this.loadError = null;
        this.listeners = [];
    }

    /**
     * Initialize the policy loader with a YAML file path
     * 
     * @param {string} filePath - Path to the policies YAML file
     * @param {Object} options - Options for the loader
     * @param {boolean} options.watchForChanges - Enable hot reload (default: true)
     * @returns {Object} Loaded policies
     */
    async initialize(filePath, options = {}) {
        const { watchForChanges = true } = options;

        this.policyFilePath = filePath || path.join(__dirname, '../../config/policies.yaml');

        // Load initial policies
        await this.loadPolicies();

        // Set up file watcher for hot reload
        if (watchForChanges) {
            this.setupWatcher();
        }

        logger.info('[PolicyLoader] Initialized', {
            policyFile: this.policyFilePath,
            watchEnabled: watchForChanges,
            version: this.policies?.metadata?.version
        });

        return this.policies;
    }

    /**
     * Load policies from YAML file
     * 
     * @returns {Object} Loaded policies
     */
    async loadPolicies() {
        try {
            if (!fs.existsSync(this.policyFilePath)) {
                throw new Error(`Policy file not found: ${this.policyFilePath}`);
            }

            const fileContent = fs.readFileSync(this.policyFilePath, 'utf8');
            const loadedPolicies = yaml.load(fileContent);

            // Validate policy structure
            this.validatePolicyStructure(loadedPolicies);

            // Transform to optimized internal format
            this.policies = this.transformPolicies(loadedPolicies);
            this.lastLoadTime = new Date();
            this.loadError = null;

            logger.info('[PolicyLoader] Policies loaded successfully', {
                version: this.policies.metadata?.version,
                resourceCount: Object.keys(this.policies.resources || {}).length,
                roleCount: Object.keys(this.policies.roles || {}).length
            });

            // Notify listeners
            this.notifyListeners('load', this.policies);

            return this.policies;
        } catch (error) {
            this.loadError = error;
            logger.error('[PolicyLoader] Failed to load policies', {
                error: error.message,
                file: this.policyFilePath
            });
            throw error;
        }
    }

    /**
     * Validate the structure of loaded policies
     * 
     * @param {Object} policies - Policies to validate
     */
    validatePolicyStructure(policies) {
        if (!policies) {
            throw new Error('Policy file is empty');
        }

        // Check required sections
        const requiredSections = ['settings', 'roles', 'resources'];
        for (const section of requiredSections) {
            if (!policies[section]) {
                throw new Error(`Missing required section: ${section}`);
            }
        }

        // Validate settings
        if (typeof policies.settings.default_policy !== 'string') {
            throw new Error('settings.default_policy must be a string (allow/deny)');
        }

        // Validate roles
        for (const [roleId, roleConfig] of Object.entries(policies.roles)) {
            if (!roleConfig.name) {
                throw new Error(`Role ${roleId} is missing 'name' property`);
            }
        }

        // Validate resources and actions
        for (const [resourceId, resourceConfig] of Object.entries(policies.resources)) {
            if (!resourceConfig.actions) {
                throw new Error(`Resource ${resourceId} is missing 'actions' property`);
            }

            for (const [actionId, actionConfig] of Object.entries(resourceConfig.actions)) {
                if (!actionConfig.roles || !Array.isArray(actionConfig.roles)) {
                    throw new Error(`Action ${resourceId}.${actionId} is missing 'roles' array`);
                }

                // Validate that all referenced roles exist
                for (const role of actionConfig.roles) {
                    if (!policies.roles[role]) {
                        logger.warn(`[PolicyLoader] Unknown role '${role}' referenced in ${resourceId}.${actionId}`);
                    }
                }
            }
        }

        logger.debug('[PolicyLoader] Policy structure validation passed');
    }

    /**
     * Transform YAML policies to optimized internal format
     * 
     * @param {Object} yamlPolicies - Raw YAML policies
     * @returns {Object} Transformed policies
     */
    transformPolicies(yamlPolicies) {
        const transformed = {
            metadata: yamlPolicies.metadata || {},
            settings: yamlPolicies.settings || {},
            roles: yamlPolicies.roles || {},
            resources: {},
            customRules: yamlPolicies.custom_rules || [],
            ipWhitelist: yamlPolicies.ip_whitelist || { enabled: false },
            rateLimits: yamlPolicies.rate_limits || { enabled: false }
        };

        // Transform resources for quick lookup
        // Format: { resourceName: { actionName: { roles: [...], conditions: {...} } } }
        for (const [resourceId, resourceConfig] of Object.entries(yamlPolicies.resources || {})) {
            transformed.resources[resourceId] = {
                description: resourceConfig.description,
                actions: {}
            };

            for (const [actionId, actionConfig] of Object.entries(resourceConfig.actions || {})) {
                transformed.resources[resourceId].actions[actionId] = {
                    roles: actionConfig.roles || [],
                    description: actionConfig.description || '',
                    conditions: actionConfig.conditions || {}
                };
            }
        }

        // Create a quick lookup map for permissions
        // Format: { "resource:action": [roles] }
        transformed.permissionMap = {};
        for (const [resourceId, resourceConfig] of Object.entries(transformed.resources)) {
            for (const [actionId, actionConfig] of Object.entries(resourceConfig.actions)) {
                const key = `${resourceId}:${actionId}`;
                transformed.permissionMap[key] = actionConfig.roles;
            }
        }

        return transformed;
    }

    /**
     * Set up file watcher for hot reload
     */
    setupWatcher() {
        if (this.watcher) {
            this.watcher.close();
        }

        this.watcher = chokidar.watch(this.policyFilePath, {
            persistent: true,
            ignoreInitial: true
        });

        this.watcher.on('change', async () => {
            logger.info('[PolicyLoader] Policy file changed, reloading...');
            try {
                await this.loadPolicies();
                logger.info('[PolicyLoader] Policies reloaded successfully (hot reload)');
            } catch (error) {
                logger.error('[PolicyLoader] Failed to reload policies', {
                    error: error.message
                });
            }
        });

        logger.info('[PolicyLoader] File watcher enabled for hot reload');
    }

    /**
     * Add a listener for policy changes
     * 
     * @param {Function} listener - Callback function(event, policies)
     */
    addListener(listener) {
        if (typeof listener === 'function') {
            this.listeners.push(listener);
        }
    }

    /**
     * Remove a listener
     * 
     * @param {Function} listener - Listener to remove
     */
    removeListener(listener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Notify all listeners of policy changes
     * 
     * @param {string} event - Event type
     * @param {Object} data - Event data
     */
    notifyListeners(event, data) {
        for (const listener of this.listeners) {
            try {
                listener(event, data);
            } catch (error) {
                logger.error('[PolicyLoader] Listener error', { error: error.message });
            }
        }
    }

    /**
     * Get current policies
     * 
     * @returns {Object} Current policies
     */
    getPolicies() {
        return this.policies;
    }

    /**
     * Get settings
     * 
     * @returns {Object} Policy settings
     */
    getSettings() {
        return this.policies?.settings || {};
    }

    /**
     * Get roles
     * 
     * @returns {Object} Role definitions
     */
    getRoles() {
        return this.policies?.roles || {};
    }

    /**
     * Get resources and their actions
     * 
     * @returns {Object} Resources with actions
     */
    getResources() {
        return this.policies?.resources || {};
    }

    /**
     * Get allowed roles for a resource action
     * 
     * @param {string} resource - Resource name
     * @param {string} action - Action name
     * @returns {Array} Allowed roles
     */
    getAllowedRoles(resource, action) {
        const key = `${resource}:${action}`;
        return this.policies?.permissionMap?.[key] || [];
    }

    /**
     * Check if an action exists for a resource
     * 
     * @param {string} resource - Resource name
     * @param {string} action - Action name
     * @returns {boolean} True if action exists
     */
    actionExists(resource, action) {
        return !!this.policies?.resources?.[resource]?.actions?.[action];
    }

    /**
     * Get conditions for an action
     * 
     * @param {string} resource - Resource name
     * @param {string} action - Action name
     * @returns {Object} Conditions
     */
    getConditions(resource, action) {
        return this.policies?.resources?.[resource]?.actions?.[action]?.conditions || {};
    }

    /**
     * Get custom rules
     * 
     * @returns {Array} Custom rules
     */
    getCustomRules() {
        return this.policies?.customRules || [];
    }

    /**
     * Get rate limits for a role
     * 
     * @param {string} role - Role name
     * @returns {Object} Rate limit configuration
     */
    getRateLimits(role) {
        const rateLimits = this.policies?.rateLimits;
        if (!rateLimits?.enabled) {
            return null;
        }

        return rateLimits.by_role?.[role] || rateLimits.default;
    }

    /**
     * Get loader status
     * 
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: !!this.policies,
            policyFile: this.policyFilePath,
            lastLoadTime: this.lastLoadTime,
            hasError: !!this.loadError,
            error: this.loadError?.message,
            version: this.policies?.metadata?.version,
            resourceCount: Object.keys(this.policies?.resources || {}).length,
            roleCount: Object.keys(this.policies?.roles || {}).length
        };
    }

    /**
     * Reload policies manually
     * 
     * @returns {Object} Reloaded policies
     */
    async reload() {
        return this.loadPolicies();
    }

    /**
     * Close the loader and clean up
     */
    close() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.listeners = [];
        logger.info('[PolicyLoader] Closed');
    }
}

// Export singleton instance
module.exports = new PolicyLoader();
