/**
 * Identity Service
 * 
 * Handles Fabric CA enrollment and wallet management
 * Integrates with Keycloak user registration
 * 
 * Flow:
 * 1. User registers in Keycloak (IDP)
 * 2. CA generates private key for user
 * 3. Enroll and store wallet in application
 */

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class IdentityService {
    constructor() {
        // Configuration from environment
        this.walletPath = process.env.FABRIC_WALLET_PATH || './wallet';
        this.mspId = process.env.FABRIC_MSP_ID || 'BPSBPBenihMSP';

        // CA Configuration
        this.caUrl = process.env.FABRIC_CA_URL || 'https://localhost:7054';
        this.caName = process.env.FABRIC_CA_NAME || 'ca-bpsbp';
        this.caTlsCertPath = process.env.FABRIC_CA_TLS_CERT || '';

        // Admin credentials for registering new users
        this.adminUserId = process.env.FABRIC_CA_ADMIN_USER || 'admin';
        this.adminUserSecret = process.env.FABRIC_CA_ADMIN_SECRET || 'adminpw';

        this.wallet = null;
        this.caClient = null;
        this.adminIdentity = null;
    }

    /**
     * Initialize the identity service
     */
    async initialize() {
        try {
            logger.info('[Identity] Initializing Identity Service...');

            // Create wallet instance
            const walletPathResolved = path.resolve(__dirname, '../../', this.walletPath);

            // Ensure wallet directory exists
            if (!fs.existsSync(walletPathResolved)) {
                fs.mkdirSync(walletPathResolved, { recursive: true });
                logger.info(`[Identity] Created wallet directory: ${walletPathResolved}`);
            }

            this.wallet = await Wallets.newFileSystemWallet(walletPathResolved);
            logger.info(`[Identity] Wallet initialized at: ${walletPathResolved}`);

            // Initialize CA Client
            await this._initializeCAClient();

            logger.info('[Identity] Identity Service initialized successfully');
            return true;

        } catch (error) {
            logger.error(`[Identity] Initialization failed: ${error.message}`, { error });
            throw error;
        }
    }

    /**
     * Initialize Fabric CA Client
     */
    async _initializeCAClient() {
        try {
            // Build CA TLS options
            const tlsOptions = {
                trustedRoots: [],
                verify: false // Set to true in production with proper certs
            };

            // Load TLS cert if provided
            if (this.caTlsCertPath && fs.existsSync(this.caTlsCertPath)) {
                const tlsCert = fs.readFileSync(this.caTlsCertPath, 'utf8');
                tlsOptions.trustedRoots = [tlsCert];
                tlsOptions.verify = true;
                logger.info('[Identity] CA TLS certificate loaded');
            }

            // Create CA client
            this.caClient = new FabricCAServices(this.caUrl, tlsOptions, this.caName);
            logger.info(`[Identity] CA Client initialized: ${this.caUrl}`);

            // Enroll admin if not in wallet
            await this._ensureAdminEnrolled();

        } catch (error) {
            logger.error(`[Identity] CA Client initialization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Ensure admin identity is enrolled and available
     */
    async _ensureAdminEnrolled() {
        try {
            // Check if admin exists in wallet
            const adminIdentity = await this.wallet.get(this.adminUserId);

            if (adminIdentity) {
                logger.info('[Identity] Admin identity already exists in wallet');
                this.adminIdentity = adminIdentity;
                return;
            }

            // Enroll admin
            logger.info('[Identity] Enrolling admin identity...');

            const enrollment = await this.caClient.enroll({
                enrollmentID: this.adminUserId,
                enrollmentSecret: this.adminUserSecret
            });

            // Create admin identity
            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes()
                },
                mspId: this.mspId,
                type: 'X.509'
            };

            // Store in wallet
            await this.wallet.put(this.adminUserId, x509Identity);
            this.adminIdentity = x509Identity;

            logger.info('[Identity] Admin identity enrolled and stored in wallet');

        } catch (error) {
            logger.error(`[Identity] Admin enrollment failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Map Keycloak role to Fabric role attribute
     * @param {string} keycloakRole - Role from Keycloak
     * @returns {string} Fabric role attribute name
     */
    _mapKeycloakRoleToFabricRole(keycloakRole) {
        const roleMapping = {
            // Keycloak realm roles with role_ prefix
            'role_producer': 'role_producer',
            'role_pbt_field': 'role_pbt_field',
            'role_pbt_field_inspector': 'role_pbt_field',
            'role_pbt_chief': 'role_pbt_chief',
            'role_pbt_chief_inspector': 'role_pbt_chief',
            'role_lsm_head': 'role_lsm_head',
            'role_lsm_issuer': 'role_lsm_head',
        };

        return roleMapping[keycloakRole.toLowerCase()] || null;
    }

    /**
     * Register and enroll a new user identity
     * Called after user registers in Keycloak
     * 
     * @param {Object} userData - User data from Keycloak
     * @param {string} userData.userId - Keycloak user ID (UUID)
     * @param {string} userData.username - Username
     * @param {string} userData.role - User role from Keycloak
     * @param {Object} userData.attributes - Additional attributes
     * @returns {Promise<Object>} Enrollment result
     */
    async registerAndEnrollUser(userData) {
        const { userId, username, role, attributes = {} } = userData;

        try {
            logger.info(`[Identity] Registering user: ${username} (${userId}) with role: ${role}`);

            // Validate inputs
            if (!userId || !username || !role) {
                throw new Error('Missing required fields: userId, username, role');
            }

            // Map Keycloak role to Fabric role
            const fabricRole = this._mapKeycloakRoleToFabricRole(role);
            if (!fabricRole) {
                throw new Error(`Unknown role: ${role}. Cannot map to Fabric role attribute.`);
            }

            // Check if user already exists in wallet
            const existingIdentity = await this.wallet.get(userId);
            if (existingIdentity) {
                logger.warn(`[Identity] User ${userId} already has an identity in wallet`);
                return {
                    success: true,
                    message: 'Identity already exists',
                    userId: userId,
                    username: username,
                    role: fabricRole,
                    alreadyExists: true
                };
            }

            // Get admin identity for registration
            const adminIdentity = await this.wallet.get(this.adminUserId);
            if (!adminIdentity) {
                throw new Error('Admin identity not found. Please initialize the service first.');
            }

            // Build admin user context
            const provider = this.wallet.getProviderRegistry().getProvider(adminIdentity.type);
            const adminUser = await provider.getUserContext(adminIdentity, this.adminUserId);

            // Generate a secure secret for the user
            const userSecret = this._generateSecureSecret();

            // Register user with CA
            // Build attributes for the user
            const userAttrs = [
                { name: fabricRole, value: 'true', ecert: true },
                { name: 'status', value: 'active', ecert: true },
                { name: 'keycloak_id', value: userId, ecert: true },
                { name: 'username', value: username, ecert: true }
            ];

            // Add custom attributes
            for (const [key, value] of Object.entries(attributes)) {
                userAttrs.push({ name: key, value: String(value), ecert: true });
            }

            logger.info(`[Identity] Registering user with CA...`, {
                userId,
                username,
                fabricRole,
                attrCount: userAttrs.length
            });

            await this.caClient.register({
                enrollmentID: userId,
                enrollmentSecret: userSecret,
                role: 'client',
                affiliation: '',
                attrs: userAttrs,
                maxEnrollments: -1  // Unlimited enrollments
            }, adminUser);

            logger.info(`[Identity] User registered with CA: ${userId}`);

            // Enroll user to get certificate and private key
            const enrollment = await this.caClient.enroll({
                enrollmentID: userId,
                enrollmentSecret: userSecret,
                attr_reqs: [
                    { name: fabricRole, optional: false },
                    { name: 'status', optional: false },
                    { name: 'keycloak_id', optional: true },
                    { name: 'username', optional: true }
                ]
            });

            logger.info(`[Identity] User enrolled successfully: ${userId}`);

            // Create X.509 identity
            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes()
                },
                mspId: this.mspId,
                type: 'X.509',
                version: 1
            };

            // Store in wallet using userId (Keycloak UUID) as identifier
            await this.wallet.put(userId, x509Identity);

            logger.info(`[Identity] Identity stored in wallet: ${userId}`);

            // Create metadata file for additional info
            const metadataPath = path.resolve(__dirname, '../../', this.walletPath, `${userId}.metadata.json`);
            const metadata = {
                userId: userId,
                username: username,
                role: role,
                fabricRole: fabricRole,
                mspId: this.mspId,
                enrolledAt: new Date().toISOString(),
                attributes: attributes
            };
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

            return {
                success: true,
                message: 'User registered and enrolled successfully',
                userId: userId,
                username: username,
                role: fabricRole,
                mspId: this.mspId,
                enrolledAt: metadata.enrolledAt,
                alreadyExists: false
            };

        } catch (error) {
            logger.error(`[Identity] Failed to register/enroll user ${username}: ${error.message}`, {
                error,
                userId,
                username,
                role
            });
            throw error;
        }
    }

    /**
     * Get user identity from wallet
     * @param {string} userId - User ID (Keycloak UUID)
     * @returns {Promise<Object|null>} Identity or null if not found
     */
    async getIdentity(userId) {
        try {
            const identity = await this.wallet.get(userId);
            if (!identity) {
                logger.warn(`[Identity] Identity not found for user: ${userId}`);
                return null;
            }

            // Get metadata if exists
            const metadataPath = path.resolve(__dirname, '../../', this.walletPath, `${userId}.metadata.json`);
            let metadata = null;
            if (fs.existsSync(metadataPath)) {
                metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            }

            return {
                ...identity,
                metadata: metadata
            };
        } catch (error) {
            logger.error(`[Identity] Failed to get identity: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if user has identity in wallet
     * @param {string} userId - User ID
     * @returns {Promise<boolean>}
     */
    async hasIdentity(userId) {
        try {
            const identity = await this.wallet.get(userId);
            return !!identity;
        } catch (error) {
            logger.error(`[Identity] Failed to check identity: ${error.message}`);
            return false;
        }
    }

    /**
     * Remove user identity from wallet
     * @param {string} userId - User ID
     * @returns {Promise<boolean>}
     */
    async removeIdentity(userId) {
        try {
            await this.wallet.remove(userId);

            // Remove metadata file if exists
            const metadataPath = path.resolve(__dirname, '../../', this.walletPath, `${userId}.metadata.json`);
            if (fs.existsSync(metadataPath)) {
                fs.unlinkSync(metadataPath);
            }

            logger.info(`[Identity] Identity removed: ${userId}`);
            return true;
        } catch (error) {
            logger.error(`[Identity] Failed to remove identity: ${error.message}`);
            throw error;
        }
    }

    /**
     * List all identities in wallet
     * @returns {Promise<Array>} List of identity labels
     */
    async listIdentities() {
        try {
            const identities = await this.wallet.list();

            // Get metadata for each identity
            const result = [];
            for (const label of identities) {
                const metadataPath = path.resolve(__dirname, '../../', this.walletPath, `${label}.metadata.json`);
                let metadata = null;
                if (fs.existsSync(metadataPath)) {
                    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                }
                result.push({
                    userId: label,
                    metadata: metadata
                });
            }

            return result;
        } catch (error) {
            logger.error(`[Identity] Failed to list identities: ${error.message}`);
            throw error;
        }
    }

    /**
     * Re-enroll user (refresh certificate)
     * @param {string} userId - User ID
     * @returns {Promise<Object>} New enrollment result
     */
    async reenrollUser(userId) {
        try {
            logger.info(`[Identity] Re-enrolling user: ${userId}`);

            const identity = await this.wallet.get(userId);
            if (!identity) {
                throw new Error(`Identity not found for user: ${userId}`);
            }

            // Get user context
            const provider = this.wallet.getProviderRegistry().getProvider(identity.type);
            const user = await provider.getUserContext(identity, userId);

            // Re-enroll
            const enrollment = await this.caClient.reenroll(user);

            // Update identity in wallet
            const newIdentity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes()
                },
                mspId: this.mspId,
                type: 'X.509',
                version: 1
            };

            await this.wallet.put(userId, newIdentity);

            // Update metadata
            const metadataPath = path.resolve(__dirname, '../../', this.walletPath, `${userId}.metadata.json`);
            if (fs.existsSync(metadataPath)) {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                metadata.lastReenrolledAt = new Date().toISOString();
                fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            }

            logger.info(`[Identity] User re-enrolled successfully: ${userId}`);

            return {
                success: true,
                message: 'User re-enrolled successfully',
                userId: userId,
                reenrolledAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`[Identity] Failed to re-enroll user: ${error.message}`);
            throw error;
        }
    }

    /**
     * Revoke user identity
     * @param {string} userId - User ID
     * @param {string} reason - Revocation reason
     * @returns {Promise<Object>}
     */
    async revokeUser(userId, reason = 'unspecified') {
        try {
            logger.info(`[Identity] Revoking user: ${userId}, reason: ${reason}`);

            // Get admin identity
            const adminIdentity = await this.wallet.get(this.adminUserId);
            if (!adminIdentity) {
                throw new Error('Admin identity not found');
            }

            const provider = this.wallet.getProviderRegistry().getProvider(adminIdentity.type);
            const adminUser = await provider.getUserContext(adminIdentity, this.adminUserId);

            // Revoke the user's enrollment
            await this.caClient.revoke({
                enrollmentID: userId,
                reason: reason
            }, adminUser);

            // Remove from wallet
            await this.removeIdentity(userId);

            logger.info(`[Identity] User revoked successfully: ${userId}`);

            return {
                success: true,
                message: 'User identity revoked',
                userId: userId,
                reason: reason,
                revokedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`[Identity] Failed to revoke user: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate secure random secret
     */
    _generateSecureSecret(length = 32) {
        const crypto = require('crypto');
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Get wallet path
     */
    getWalletPath() {
        return path.resolve(__dirname, '../../', this.walletPath);
    }
}

// Singleton instance
const identityService = new IdentityService();

module.exports = identityService;
