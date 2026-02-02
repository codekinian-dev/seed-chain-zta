const express = require('express');
const router = express.Router();
const policyEngine = require('../policies/policyEngineYaml');
const policyLoader = require('../policies/policyLoader');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

/**
 * Policy Administration Routes
 * 
 * Provides REST API endpoints for managing access control policies.
 * Only accessible by administrators.
 */

// Middleware to check admin access
const requireAdmin = (req, res, next) => {
    const user = req.user;

    if (!user || !user.roles) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    if (!user.roles.includes('role_admin')) {
        return res.status(403).json({
            success: false,
            error: 'Admin access required for policy administration'
        });
    }

    next();
};

/**
 * @route   GET /api/policies
 * @desc    Get all policies
 * @access  Admin only
 */
router.get('/', requireAdmin, async (req, res) => {
    try {
        const policies = policyEngine.getPolicies();
        const roles = policyEngine.getRoles();
        const settings = policyEngine.getSettings();
        const status = policyEngine.getStatus();

        res.json({
            success: true,
            data: {
                metadata: policyLoader.getPolicies()?.metadata,
                settings,
                roles,
                resources: policies,
                status
            }
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to get policies', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve policies'
        });
    }
});

/**
 * @route   GET /api/policies/status
 * @desc    Get policy engine status
 * @access  Admin only
 */
router.get('/status', requireAdmin, async (req, res) => {
    try {
        const status = policyEngine.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to get status', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to get policy engine status'
        });
    }
});

/**
 * @route   GET /api/policies/roles
 * @desc    Get all role definitions
 * @access  Admin only
 */
router.get('/roles', requireAdmin, async (req, res) => {
    try {
        const roles = policyEngine.getRoles();
        res.json({
            success: true,
            data: roles
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to get roles', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve roles'
        });
    }
});

/**
 * @route   GET /api/policies/resources
 * @desc    Get all resources and their actions
 * @access  Admin only
 */
router.get('/resources', requireAdmin, async (req, res) => {
    try {
        const resources = policyEngine.getPolicies();
        res.json({
            success: true,
            data: resources
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to get resources', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve resources'
        });
    }
});

/**
 * @route   GET /api/policies/resources/:resource
 * @desc    Get policies for a specific resource
 * @access  Admin only
 */
router.get('/resources/:resource', requireAdmin, async (req, res) => {
    try {
        const { resource } = req.params;
        const policies = policyEngine.getPolicies(resource);

        if (Object.keys(policies).length === 0) {
            return res.status(404).json({
                success: false,
                error: `Resource '${resource}' not found`
            });
        }

        res.json({
            success: true,
            data: {
                resource,
                actions: policies
            }
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to get resource policies', {
            error: error.message,
            resource: req.params.resource
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve resource policies'
        });
    }
});

/**
 * @route   POST /api/policies/resources/:resource/actions/:action
 * @desc    Add or update a policy
 * @access  Admin only
 * @body    { roles: string[], description?: string, conditions?: object }
 */
router.post('/resources/:resource/actions/:action', requireAdmin, async (req, res) => {
    try {
        const { resource, action } = req.params;
        const { roles, description, conditions } = req.body;

        if (!roles || !Array.isArray(roles) || roles.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'roles must be a non-empty array'
            });
        }

        // Validate roles exist
        const definedRoles = policyEngine.getRoles();
        const invalidRoles = roles.filter(r => !definedRoles[r]);
        if (invalidRoles.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Unknown roles: ${invalidRoles.join(', ')}`
            });
        }

        await policyEngine.addPolicy(resource, action, roles, {
            actionDescription: description,
            conditions,
            persist: true
        });

        logger.info('[PolicyAdmin] Policy updated', {
            user: req.user?.username,
            resource,
            action,
            roles
        });

        res.json({
            success: true,
            message: `Policy for ${resource}:${action} updated successfully`,
            data: {
                resource,
                action,
                roles,
                description,
                conditions
            }
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to update policy', {
            error: error.message,
            resource: req.params.resource,
            action: req.params.action
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update policy'
        });
    }
});

/**
 * @route   DELETE /api/policies/resources/:resource/actions/:action
 * @desc    Delete a policy
 * @access  Admin only
 */
router.delete('/resources/:resource/actions/:action', requireAdmin, async (req, res) => {
    try {
        const { resource, action } = req.params;

        // Check if policy exists
        const policies = policyEngine.getPolicies(resource);
        if (!policies[action]) {
            return res.status(404).json({
                success: false,
                error: `Policy for ${resource}:${action} not found`
            });
        }

        await policyEngine.removePolicy(resource, action, { persist: true });

        logger.info('[PolicyAdmin] Policy deleted', {
            user: req.user?.username,
            resource,
            action
        });

        res.json({
            success: true,
            message: `Policy for ${resource}:${action} deleted successfully`
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to delete policy', {
            error: error.message,
            resource: req.params.resource,
            action: req.params.action
        });
        res.status(500).json({
            success: false,
            error: 'Failed to delete policy'
        });
    }
});

/**
 * @route   POST /api/policies/evaluate
 * @desc    Test policy evaluation
 * @access  Admin only
 * @body    { user: { id, username, roles }, resource, action, context? }
 */
router.post('/evaluate', requireAdmin, async (req, res) => {
    try {
        const { user, resource, action, context } = req.body;

        if (!user || !resource || !action) {
            return res.status(400).json({
                success: false,
                error: 'user, resource, and action are required'
            });
        }

        const decision = policyEngine.evaluate(user, resource, action, context || {});

        res.json({
            success: true,
            data: {
                decision,
                testMode: true
            }
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Policy evaluation failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Policy evaluation failed'
        });
    }
});

/**
 * @route   POST /api/policies/reload
 * @desc    Reload policies from YAML file
 * @access  Admin only
 */
router.post('/reload', requireAdmin, async (req, res) => {
    try {
        await policyEngine.reload();

        logger.info('[PolicyAdmin] Policies reloaded', {
            user: req.user?.username
        });

        res.json({
            success: true,
            message: 'Policies reloaded successfully',
            data: policyEngine.getStatus()
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to reload policies', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to reload policies'
        });
    }
});

/**
 * @route   GET /api/policies/yaml
 * @desc    Get raw YAML content
 * @access  Admin only
 */
router.get('/yaml', requireAdmin, async (req, res) => {
    try {
        const status = policyLoader.getStatus();
        const yamlContent = await fs.readFile(status.policyFile, 'utf8');

        res.set('Content-Type', 'text/yaml');
        res.send(yamlContent);
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to get YAML', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve YAML content'
        });
    }
});

/**
 * @route   PUT /api/policies/yaml
 * @desc    Update entire YAML file
 * @access  Admin only
 * @body    YAML content (text/yaml) or { yaml: string }
 */
router.put('/yaml', requireAdmin, async (req, res) => {
    try {
        let yamlContent;

        // Handle different content types
        if (req.is('text/yaml') || req.is('application/x-yaml')) {
            yamlContent = req.body;
        } else if (req.body.yaml) {
            yamlContent = req.body.yaml;
        } else {
            return res.status(400).json({
                success: false,
                error: 'YAML content required'
            });
        }

        // Validate YAML syntax
        let parsed;
        try {
            parsed = yaml.load(yamlContent);
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                error: `Invalid YAML syntax: ${parseError.message}`
            });
        }

        // Validate structure
        const requiredSections = ['settings', 'roles', 'resources'];
        for (const section of requiredSections) {
            if (!parsed[section]) {
                return res.status(400).json({
                    success: false,
                    error: `Missing required section: ${section}`
                });
            }
        }

        // Backup current file
        const status = policyLoader.getStatus();
        const backupPath = `${status.policyFile}.backup.${Date.now()}`;
        const currentContent = await fs.readFile(status.policyFile, 'utf8');
        await fs.writeFile(backupPath, currentContent, 'utf8');

        // Write new content
        await fs.writeFile(status.policyFile, yamlContent, 'utf8');

        // Reload policies
        await policyEngine.reload();

        logger.info('[PolicyAdmin] YAML file updated', {
            user: req.user?.username,
            backupFile: backupPath
        });

        res.json({
            success: true,
            message: 'YAML file updated and policies reloaded',
            data: {
                backupFile: backupPath,
                status: policyEngine.getStatus()
            }
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to update YAML', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to update YAML file'
        });
    }
});

/**
 * @route   GET /api/policies/settings
 * @desc    Get policy settings
 * @access  Admin only
 */
router.get('/settings', requireAdmin, async (req, res) => {
    try {
        const settings = policyEngine.getSettings();
        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to get settings', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve settings'
        });
    }
});

/**
 * @route   PUT /api/policies/settings
 * @desc    Update policy settings
 * @access  Admin only
 * @body    Settings object to update
 */
router.put('/settings', requireAdmin, async (req, res) => {
    try {
        const newSettings = req.body;
        const policies = policyLoader.getPolicies();

        // Merge settings
        policies.settings = { ...policies.settings, ...newSettings };

        // Convert back to YAML and save
        const status = policyLoader.getStatus();
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

        const yamlString = yaml.dump(yamlFormat, {
            indent: 2,
            lineWidth: 120,
            noRefs: true
        });

        await fs.writeFile(status.policyFile, yamlString, 'utf8');
        await policyEngine.reload();

        logger.info('[PolicyAdmin] Settings updated', {
            user: req.user?.username,
            settings: newSettings
        });

        res.json({
            success: true,
            message: 'Settings updated successfully',
            data: policyEngine.getSettings()
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to update settings', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to update settings'
        });
    }
});

/**
 * @route   GET /api/policies/audit
 * @desc    Get policy decision audit log
 * @access  Admin only
 */
router.get('/audit', requireAdmin, async (req, res) => {
    try {
        // This would typically read from a database or log file
        // For now, return a placeholder
        res.json({
            success: true,
            message: 'Audit logs are available in the application logs',
            data: {
                logPath: path.join(__dirname, '../../logs'),
                tip: 'Filter logs with "[PolicyEngine]" to see policy decisions'
            }
        });
    } catch (error) {
        logger.error('[PolicyAdmin] Failed to get audit logs', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit logs'
        });
    }
});

module.exports = router;
