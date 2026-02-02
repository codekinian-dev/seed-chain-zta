/**
 * Policy Module - Zero Trust Policy Engine
 * 
 * Exports both the YAML-based policy engine and the policy loader.
 * The YAML-based engine is the primary implementation that supports:
 * - Dynamic YAML configuration
 * - Hot reload
 * - Policy Administration API
 */

const policyEngine = require('./policyEngineYaml');
const policyLoader = require('./policyLoader');

// Legacy export (for backward compatibility)
const legacyEngine = require('./policyEngine');

module.exports = {
    // Primary exports
    policyEngine,
    policyLoader,

    // Legacy support
    legacyEngine,

    // Convenience methods
    evaluate: (...args) => policyEngine.evaluate(...args),
    initialize: (...args) => policyEngine.initialize(...args),
    getPolicies: (...args) => policyEngine.getPolicies(...args),
    getRoles: () => policyEngine.getRoles(),
    hasAnyRole: (...args) => policyEngine.hasAnyRole(...args),
    hasAllRoles: (...args) => policyEngine.hasAllRoles(...args)
};
