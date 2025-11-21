/**
 * Mock Keycloak Middleware for Testing
 */

const mockKeycloak = {
    protect: () => (req, res, next) => {
        // Mock authentication - always pass in tests
        req.kauth = {
            grant: {
                access_token: {
                    content: {
                        realm_access: {
                            roles: [
                                'role_producer',
                                'role_pbt_field',
                                'role_pbt_chief',
                                'role_lsm_head'
                            ]
                        }
                    }
                }
            }
        };
        next();
    }
};

const mockRequireRole = (roles) => (req, res, next) => {
    // Mock role check - always pass in tests
    next();
};

const mockInitializeAuth = async () => {
    return { keycloak: mockKeycloak };
};

module.exports = {
    keycloak: mockKeycloak,
    requireRole: mockRequireRole,
    initializeAuth: mockInitializeAuth
};
