const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class FabricGateway {
    constructor() {
        this.gateway = null;
        this.network = null;
        this.contract = null;
        this.wallet = null;
        this.isConnected = false;
        this.currentUserId = null;

        // Configuration from environment
        this.networkPath = process.env.FABRIC_NETWORK_PATH || './config/connection-profile.json';
        this.channelName = process.env.FABRIC_CHANNEL || 'benihchannel';
        this.contractName = process.env.FABRIC_CONTRACT || 'benih-certification';
        this.walletPath = process.env.FABRIC_WALLET_PATH || './wallet';
        this.defaultUserId = process.env.FABRIC_USER_ID || 'admin';
        this.mspId = process.env.FABRIC_MSP_ID || 'BPSBPBenihMSP';

        // Cache for user-specific gateways (for per-user identity)
        this.userGateways = new Map();
        this.userContracts = new Map();
    }

    /**
     * Get connection profile
     */
    _getConnectionProfile() {
        const ccpPath = path.resolve(__dirname, '../../', this.networkPath);
        const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
        return JSON.parse(ccpJSON);
    }

    /**
     * Get gateway options
     */
    _getGatewayOptions(userId) {
        return {
            wallet: this.wallet,
            identity: userId,
            discovery: {
                enabled: true,
                asLocalhost: true
            },
            eventHandlerOptions: {
                commitTimeout: 300,
                endorseTimeout: 300
            },
            clientTlsIdentity: undefined,
            grpcOptions: {
                'grpc.max_receive_message_length': 200 * 1024 * 1024,
                'grpc.max_send_message_length': 200 * 1024 * 1024,
                'grpc.keepalive_time_ms': 120000,
                'grpc.keepalive_timeout_ms': 20000
            }
        };
    }

    /**
     * Initialize and connect to Fabric network with default/admin identity
     */
    async connect() {
        try {
            if (this.isConnected) {
                logger.warn('[Fabric] Already connected to network');
                return;
            }

            logger.info('[Fabric] Connecting to Hyperledger Fabric network...');

            // Create file system wallet
            const walletPathResolved = path.resolve(__dirname, '../../', this.walletPath);
            this.wallet = await Wallets.newFileSystemWallet(walletPathResolved);

            // Check if default user exists in wallet
            const identity = await this.wallet.get(this.defaultUserId);
            if (!identity) {
                logger.warn(`[Fabric] Default identity ${this.defaultUserId} not found in wallet.`);
                logger.warn('[Fabric] Per-user identity mode will be used exclusively.');
            } else {
                logger.info(`[Fabric] Default user ${this.defaultUserId} loaded from wallet`);

                // Connect with default identity
                const ccp = this._getConnectionProfile();
                this.gateway = new Gateway();
                await this.gateway.connect(ccp, this._getGatewayOptions(this.defaultUserId));

                logger.info('[Fabric] Connected to gateway with default identity');

                // Get network (channel)
                this.network = await this.gateway.getNetwork(this.channelName);
                logger.info(`[Fabric] Connected to channel: ${this.channelName}`);

                // Get contract
                this.contract = this.network.getContract(this.contractName);
                logger.info(`[Fabric] Contract ${this.contractName} loaded`);

                this.currentUserId = this.defaultUserId;
            }

            this.isConnected = true;
            logger.info('[Fabric] Successfully connected to Hyperledger Fabric');

        } catch (error) {
            logger.error(`[Fabric] Connection failed: ${error.message}`, { error });
            throw new Error(`Failed to connect to Fabric network: ${error.message}`);
        }
    }

    /**
     * Disconnect from Fabric network
     */
    async disconnect() {
        try {
            if (this.gateway) {
                await this.gateway.disconnect();
                this.isConnected = false;
                logger.info('[Fabric] Disconnected from network');
            }
        } catch (error) {
            logger.error(`[Fabric] Disconnect error: ${error.message}`);
        }
    }

    /**
     * Reconnect to Fabric network
     */
    async reconnect() {
        logger.info('[Fabric] Attempting to reconnect...');
        await this.disconnect();
        await this.connect();
    }

    /**
     * Get or create a gateway for a specific user
     * @param {string} userId - User ID (Keycloak UUID)
     * @returns {Promise<Object>} - { gateway, network, contract }
     */
    async getGatewayForUser(userId) {
        try {
            // Check cache first
            if (this.userContracts.has(userId)) {
                logger.debug(`[Fabric] Using cached gateway for user: ${userId}`);
                return {
                    gateway: this.userGateways.get(userId),
                    contract: this.userContracts.get(userId)
                };
            }

            // Check if user identity exists in wallet
            if (!this.wallet) {
                const walletPathResolved = path.resolve(__dirname, '../../', this.walletPath);
                this.wallet = await Wallets.newFileSystemWallet(walletPathResolved);
            }

            const identity = await this.wallet.get(userId);
            if (!identity) {
                throw new Error(`Identity ${userId} not found in wallet. User must enroll first.`);
            }

            logger.info(`[Fabric] Creating gateway for user: ${userId}`);

            // Create new gateway for this user
            const ccp = this._getConnectionProfile();
            const userGateway = new Gateway();
            await userGateway.connect(ccp, this._getGatewayOptions(userId));

            // Get network and contract
            const userNetwork = await userGateway.getNetwork(this.channelName);
            const userContract = userNetwork.getContract(this.contractName);

            // Cache the gateway and contract
            this.userGateways.set(userId, userGateway);
            this.userContracts.set(userId, userContract);

            logger.info(`[Fabric] Gateway created for user: ${userId}`);

            return {
                gateway: userGateway,
                contract: userContract
            };

        } catch (error) {
            logger.error(`[Fabric] Failed to get gateway for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Disconnect a specific user's gateway
     * @param {string} userId - User ID
     */
    async disconnectUser(userId) {
        try {
            if (this.userGateways.has(userId)) {
                const gateway = this.userGateways.get(userId);
                await gateway.disconnect();
                this.userGateways.delete(userId);
                this.userContracts.delete(userId);
                logger.info(`[Fabric] Disconnected gateway for user: ${userId}`);
            }
        } catch (error) {
            logger.error(`[Fabric] Error disconnecting user ${userId}: ${error.message}`);
        }
    }

    /**
     * Disconnect all user gateways
     */
    async disconnectAllUsers() {
        for (const [userId, gateway] of this.userGateways) {
            try {
                await gateway.disconnect();
                logger.info(`[Fabric] Disconnected gateway for user: ${userId}`);
            } catch (error) {
                logger.error(`[Fabric] Error disconnecting user ${userId}: ${error.message}`);
            }
        }
        this.userGateways.clear();
        this.userContracts.clear();
    }

    /**
     * Invoke chaincode function with user-specific identity
     * @param {string} userId - User ID (Keycloak UUID)
     * @param {string} functionName - Chaincode function name
     * @param {Array} args - Function arguments
     * @returns {Promise<Object>} - Transaction result
     */
    async invokeAsUser(userId, functionName, args = []) {
        try {
            const { contract } = await this.getGatewayForUser(userId);

            logger.info(`[Fabric] Invoking as user ${userId}: ${functionName}`, { args });

            const startTime = Date.now();
            const result = await contract.submitTransaction(functionName, ...args);
            const duration = Date.now() - startTime;

            const response = result.toString();
            logger.info(`[Fabric] Transaction submitted successfully (${duration}ms)`, {
                function: functionName,
                userId: userId,
                duration
            });

            return JSON.parse(response);

        } catch (error) {
            logger.error(`[Fabric] Transaction failed for user ${userId}: ${functionName}`, {
                error: error.message,
                stack: error.stack
            });

            // If connection error, remove from cache to force reconnect
            if (error.message.includes('connection') || error.message.includes('timeout')) {
                await this.disconnectUser(userId);
            }

            throw error;
        }
    }

    /**
     * Query chaincode function with user-specific identity
     * @param {string} userId - User ID (Keycloak UUID)
     * @param {string} functionName - Chaincode function name
     * @param {Array} args - Function arguments
     * @returns {Promise<Object>} - Query result
     */
    async queryAsUser(userId, functionName, args = []) {
        try {
            const { contract } = await this.getGatewayForUser(userId);

            logger.info(`[Fabric] Querying as user ${userId}: ${functionName}`, { args });

            const startTime = Date.now();
            const result = await contract.evaluateTransaction(functionName, ...args);
            const duration = Date.now() - startTime;

            const response = result.toString();

            if (!response || response.trim() === '') {
                throw new Error('Chaincode returned empty response');
            }

            logger.info(`[Fabric] Query successful (${duration}ms)`, {
                function: functionName,
                userId: userId,
                duration,
                responseLength: response.length
            });

            return JSON.parse(response);

        } catch (error) {
            logger.error(`[Fabric] Query failed for user ${userId}: ${functionName}`, {
                error: error.message
            });

            // If connection error, remove from cache to force reconnect
            if (error.message.includes('connection') || error.message.includes('timeout')) {
                await this.disconnectUser(userId);
            }

            throw error;
        }
    }

    /**
     * Invoke chaincode function (submit transaction)
     * @param {string} functionName - Chaincode function name
     * @param {Array} args - Function arguments
     * @returns {Promise<Object>} - Transaction result
     */
    async invokeChaincode(functionName, args = []) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            logger.info(`[Fabric] Invoking: ${functionName}`, { args });

            const startTime = Date.now();
            const result = await this.contract.submitTransaction(functionName, ...args);
            const duration = Date.now() - startTime;

            const response = result.toString();
            logger.info(`[Fabric] Transaction submitted successfully (${duration}ms)`, {
                function: functionName,
                duration
            });

            return JSON.parse(response);

        } catch (error) {
            logger.error(`[Fabric] Transaction failed: ${functionName}`, {
                error: error.message,
                stack: error.stack
            });

            // Auto-reconnect on connection errors
            if (error.message.includes('connection') || error.message.includes('timeout')) {
                logger.warn('[Fabric] Connection error detected, attempting reconnect...');
                await this.reconnect();
            }

            throw error;
        }
    }

    /**
     * Query chaincode function (evaluate transaction - read-only)
     * @param {string} functionName - Chaincode function name
     * @param {Array} args - Function arguments
     * @returns {Promise<Object>} - Query result
     */
    async queryChaincode(functionName, args = []) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            logger.info(`[Fabric] Querying: ${functionName}`, { args });

            const startTime = Date.now();
            const result = await this.contract.evaluateTransaction(functionName, ...args);
            const duration = Date.now() - startTime;

            const response = result.toString();

            // Validate response is not empty
            if (!response || response.trim() === '') {
                logger.error(`[Fabric] Empty response from chaincode: ${functionName}`);
                throw new Error('Chaincode returned empty response');
            }

            logger.info(`[Fabric] Query successful (${duration}ms)`, {
                function: functionName,
                duration,
                responseLength: response.length
            });

            return JSON.parse(response);

        } catch (error) {
            logger.error(`[Fabric] Query failed: ${functionName}`, {
                error: error.message
            });

            // Auto-reconnect on connection errors
            if (error.message.includes('connection') || error.message.includes('timeout')) {
                logger.warn('[Fabric] Connection error detected, attempting reconnect...');
                await this.reconnect();
            }

            throw error;
        }
    }

    /**
     * Get history with block information (including previous block hash)
     * @param {string} key - Key to get history for
     * @returns {Promise<Array>} History with block info
     */
    /**
     * Get history with block information (including previous block hash)
     * @param {string} key - Key to get history for
     * @returns {Promise<Array>} History with block info
     */
    async getHistoryWithBlockInfo(key) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            logger.info(`[Fabric] Getting history with block info for key: ${key}`);

            // Get basic history from chaincode
            const historyResponse = await this.queryChaincode('getHistory', [key]);

            // Get channel and qscc contract for querying blocks
            const channel = this.network.getChannel();
            const qsccContract = this.network.getContract('qscc');

            // Enrich history with block information
            const enrichedHistory = [];

            for (const entry of historyResponse) {
                try {
                    const txId = entry.txId;
                    logger.info(`[Fabric] Querying block for txId: ${txId}`);

                    // Query block using qscc (Query System Chaincode)
                    // GetBlockByTxID returns the block that contains the transaction
                    const blockBuffer = await qsccContract.evaluateTransaction(
                        'GetBlockByTxID',
                        this.channelName,
                        txId
                    );

                    logger.info(`[Fabric] Block data received, size: ${blockBuffer.length} bytes`);

                    // Decode the block
                    const { BlockDecoder } = require('fabric-common');
                    const block = BlockDecoder.decode(blockBuffer);

                    let blockNumber = null;
                    let previousHash = null;
                    let dataHash = null;

                    // Extract block metadata
                    if (block && block.header) {
                        // Block number - handle Long type
                        if (block.header.number) {
                            if (typeof block.header.number.toInt === 'function') {
                                blockNumber = block.header.number.toInt().toString();
                            } else if (typeof block.header.number === 'object' && block.header.number.low !== undefined) {
                                // Handle protobuf Long type
                                blockNumber = block.header.number.low.toString();
                            } else {
                                blockNumber = block.header.number.toString();
                            }
                        }

                        // Previous hash - always a buffer in decoded block
                        if (block.header.previous_hash) {
                            previousHash = block.header.previous_hash;
                        }

                        // Data hash
                        if (block.header.data_hash) {
                            dataHash = block.header.data_hash;
                        }

                        logger.info(`[Fabric] Block #${blockNumber} - prevHash: ${previousHash}, dataHash: ${dataHash}`);
                    }

                    enrichedHistory.push({
                        ...entry,
                        blockNumber: blockNumber,
                        previousBlockHash: previousHash,
                        blockDataHash: dataHash
                    });

                } catch (blockError) {
                    logger.error(`[Fabric] Could not get block info for tx ${entry.txId}:`, {
                        error: blockError.message,
                        stack: blockError.stack
                    });
                    // Include entry without block info if query fails
                    enrichedHistory.push({
                        ...entry,
                        blockNumber: null,
                        previousBlockHash: null,
                        blockDataHash: null
                    });
                }
            }

            logger.info(`[Fabric] Retrieved ${enrichedHistory.length} history entries with block info`);
            return enrichedHistory;

        } catch (error) {
            logger.error(`[Fabric] Failed to get history with block info: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if Fabric service is available
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            if (!this.isConnected) {
                return false;
            }

            // Actually ping the network to verify connection is alive
            // Try to query a simple chaincode function with timeout
            const pingPromise = this.contract.evaluateTransaction('ping').catch(() => {
                // If ping fails, try any other simple query that should work
                return this.contract.evaluateTransaction('queryAllSeedBatches', []);
            });

            // Set a 5 second timeout for health check
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Health check timeout')), 5000)
            );

            await Promise.race([pingPromise, timeoutPromise]);
            return true;

        } catch (error) {
            logger.error(`[Fabric] Service not available: ${error.message}`);
            this.isConnected = false; // Mark as disconnected if health check fails
            return false;
        }
    }
}

// Singleton instance
const fabricGateway = new FabricGateway();

module.exports = fabricGateway;
