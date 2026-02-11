const logger = require('../utils/logger');
const fabricService = require('../services/fabric.service');
const identityService = require('../services/identity.service');
const { AppError } = require('../middleware/error');

/**
 * Blockchain Audit Controller
 * 
 * Handles API requests for querying AuditLog data stored on the blockchain.
 * Only accessible by admin users.
 */

/**
 * Helper function to get or create user identity for Fabric
 * @param {Object} req - Express request with Keycloak auth
 * @returns {Promise<string>} User ID for Fabric operations
 */
const ensureUserIdentity = async (req) => {
    const token = req.kauth?.grant?.access_token?.content;
    if (!token) {
        throw new AppError('User authentication invalid - no token found', 401);
    }

    const userId = token.sub; // Keycloak user UUID

    // Check if user has Fabric identity
    const hasIdentity = await identityService.hasIdentity(userId);

    if (!hasIdentity) {
        throw new AppError(
            'User identity not found. Please call POST /api/v1/identity/enroll first.',
            403
        );
    }

    return userId;
};

/**
 * Query blockchain audit logs
 * 
 * @route GET /api/blockchain-audit/logs
 * @access Admin only
 */
const queryBlockchainAuditLogs = async (req, res) => {
    try {
        const userUUID = await ensureUserIdentity(req);

        const { startTime, endTime, action, limit, offset } = req.query;

        logger.info('[BlockchainAudit] Querying audit logs', {
            userId: userUUID,
            startTime,
            endTime,
            action
        });

        // Call chaincode queryAuditLogs function
        // Parameters: startTime, endTime, action (all optional)
        const result = await fabricService.queryAsUser(
            userUUID,
            'queryAuditLogs',
            [startTime || '', endTime || '', action || '']
        );

        // Parse and format the result
        let auditLogs = Array.isArray(result) ? result : [];

        // Sort by timestamp (newest first)
        auditLogs.sort((a, b) => {
            const timeA = new Date(a.Record?.timestamp || 0);
            const timeB = new Date(b.Record?.timestamp || 0);
            return timeB - timeA;
        });

        // Apply pagination if provided
        const limitNum = parseInt(limit) || 100;
        const offsetNum = parseInt(offset) || 0;
        const paginatedLogs = auditLogs.slice(offsetNum, offsetNum + limitNum);

        // Transform the data for API response
        const transformedLogs = paginatedLogs.map(log => ({
            id: log.Key,
            txId: log.Record?.txId,
            channelId: log.Record?.channelId,
            timestamp: log.Record?.timestamp,
            action: log.Record?.action,
            resourceId: log.Record?.resourceId,
            user: {
                userId: log.Record?.userID,
                keycloakId: log.Record?.keycloakId,
                username: log.Record?.username,
                role: log.Record?.role,
                mspId: log.Record?.mspId
            },
            details: log.Record?.details,
            status: log.Record?.status
        }));

        logger.info('[BlockchainAudit] Query completed', {
            totalRecords: auditLogs.length,
            returnedRecords: transformedLogs.length
        });

        res.json({
            success: true,
            total: auditLogs.length,
            limit: limitNum,
            offset: offsetNum,
            data: transformedLogs
        });

    } catch (error) {
        logger.error('[BlockchainAudit] Query failed', {
            error: error.message,
            stack: error.stack
        });

        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get audit log by transaction ID
 * 
 * @route GET /api/blockchain-audit/tx/:txId
 * @access Admin only
 */
const getAuditLogByTxId = async (req, res) => {
    try {
        const userUUID = await ensureUserIdentity(req);
        const { txId } = req.params;

        if (!txId) {
            throw new AppError('Transaction ID is required', 400);
        }

        logger.info('[BlockchainAudit] Getting audit log by txId', {
            userId: userUUID,
            txId
        });

        // Query all audit logs and filter by txId
        const result = await fabricService.queryAsUser(
            userUUID,
            'queryAuditLogs',
            ['', '', '']
        );

        let auditLogs = Array.isArray(result) ? result : [];
        const auditLog = auditLogs.find(log => log.Record?.txId === txId);

        if (!auditLog) {
            throw new AppError(`Audit log with transaction ID ${txId} not found`, 404);
        }

        const transformedLog = {
            id: auditLog.Key,
            txId: auditLog.Record?.txId,
            channelId: auditLog.Record?.channelId,
            timestamp: auditLog.Record?.timestamp,
            action: auditLog.Record?.action,
            resourceId: auditLog.Record?.resourceId,
            user: {
                userId: auditLog.Record?.userID,
                keycloakId: auditLog.Record?.keycloakId,
                username: auditLog.Record?.username,
                role: auditLog.Record?.role,
                mspId: auditLog.Record?.mspId
            },
            details: auditLog.Record?.details,
            status: auditLog.Record?.status
        };

        res.json({
            success: true,
            data: transformedLog
        });

    } catch (error) {
        logger.error('[BlockchainAudit] Get by txId failed', {
            error: error.message
        });

        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get audit logs by resource ID
 * 
 * @route GET /api/blockchain-audit/resource/:resourceId
 * @access Admin only
 */
const getAuditLogsByResourceId = async (req, res) => {
    try {
        const userUUID = await ensureUserIdentity(req);
        const { resourceId } = req.params;
        const { limit, offset } = req.query;

        if (!resourceId) {
            throw new AppError('Resource ID is required', 400);
        }

        logger.info('[BlockchainAudit] Getting audit logs by resourceId', {
            userId: userUUID,
            resourceId
        });

        // Query all audit logs and filter by resourceId
        const result = await fabricService.queryAsUser(
            userUUID,
            'queryAuditLogs',
            ['', '', '']
        );

        let auditLogs = Array.isArray(result) ? result : [];
        let filteredLogs = auditLogs.filter(log => log.Record?.resourceId === resourceId);

        // Sort by timestamp (newest first)
        filteredLogs.sort((a, b) => {
            const timeA = new Date(a.Record?.timestamp || 0);
            const timeB = new Date(b.Record?.timestamp || 0);
            return timeB - timeA;
        });

        // Apply pagination
        const limitNum = parseInt(limit) || 100;
        const offsetNum = parseInt(offset) || 0;
        const paginatedLogs = filteredLogs.slice(offsetNum, offsetNum + limitNum);

        const transformedLogs = paginatedLogs.map(log => ({
            id: log.Key,
            txId: log.Record?.txId,
            channelId: log.Record?.channelId,
            timestamp: log.Record?.timestamp,
            action: log.Record?.action,
            resourceId: log.Record?.resourceId,
            user: {
                userId: log.Record?.userID,
                keycloakId: log.Record?.keycloakId,
                username: log.Record?.username,
                role: log.Record?.role,
                mspId: log.Record?.mspId
            },
            details: log.Record?.details,
            status: log.Record?.status
        }));

        res.json({
            success: true,
            total: filteredLogs.length,
            limit: limitNum,
            offset: offsetNum,
            data: transformedLogs
        });

    } catch (error) {
        logger.error('[BlockchainAudit] Get by resourceId failed', {
            error: error.message
        });

        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get audit logs by user (keycloakId)
 * 
 * @route GET /api/blockchain-audit/user/:keycloakId
 * @access Admin only
 */
const getAuditLogsByUser = async (req, res) => {
    try {
        const userUUID = await ensureUserIdentity(req);
        const { keycloakId } = req.params;
        const { limit, offset } = req.query;

        if (!keycloakId) {
            throw new AppError('User Keycloak ID is required', 400);
        }

        logger.info('[BlockchainAudit] Getting audit logs by user', {
            userId: userUUID,
            keycloakId
        });

        // Query all audit logs and filter by keycloakId
        const result = await fabricService.queryAsUser(
            userUUID,
            'queryAuditLogs',
            ['', '', '']
        );

        let auditLogs = Array.isArray(result) ? result : [];
        let filteredLogs = auditLogs.filter(log => log.Record?.keycloakId === keycloakId);

        // Sort by timestamp (newest first)
        filteredLogs.sort((a, b) => {
            const timeA = new Date(a.Record?.timestamp || 0);
            const timeB = new Date(b.Record?.timestamp || 0);
            return timeB - timeA;
        });

        // Apply pagination
        const limitNum = parseInt(limit) || 100;
        const offsetNum = parseInt(offset) || 0;
        const paginatedLogs = filteredLogs.slice(offsetNum, offsetNum + limitNum);

        const transformedLogs = paginatedLogs.map(log => ({
            id: log.Key,
            txId: log.Record?.txId,
            channelId: log.Record?.channelId,
            timestamp: log.Record?.timestamp,
            action: log.Record?.action,
            resourceId: log.Record?.resourceId,
            user: {
                userId: log.Record?.userID,
                keycloakId: log.Record?.keycloakId,
                username: log.Record?.username,
                role: log.Record?.role,
                mspId: log.Record?.mspId
            },
            details: log.Record?.details,
            status: log.Record?.status
        }));

        res.json({
            success: true,
            total: filteredLogs.length,
            limit: limitNum,
            offset: offsetNum,
            data: transformedLogs
        });

    } catch (error) {
        logger.error('[BlockchainAudit] Get by user failed', {
            error: error.message
        });

        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get audit statistics summary
 * 
 * @route GET /api/blockchain-audit/stats
 * @access Admin only
 */
const getAuditStats = async (req, res) => {
    try {
        const userUUID = await ensureUserIdentity(req);
        const { days } = req.query;

        logger.info('[BlockchainAudit] Getting audit statistics', {
            userId: userUUID,
            days
        });

        // Calculate date range
        const daysNum = parseInt(days) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysNum);
        const startTime = startDate.toISOString();

        // Query audit logs for the time range
        const result = await fabricService.queryAsUser(
            userUUID,
            'queryAuditLogs',
            [startTime, '', '']
        );

        let auditLogs = Array.isArray(result) ? result : [];

        // Calculate statistics
        const stats = {
            totalLogs: auditLogs.length,
            period: {
                from: startTime,
                to: new Date().toISOString(),
                days: daysNum
            },
            byAction: {},
            byRole: {},
            byUser: {},
            timeline: {}
        };

        // Aggregate by action, role, user, and date
        auditLogs.forEach(log => {
            const record = log.Record;
            if (!record) return;

            // By action
            const action = record.action || 'UNKNOWN';
            stats.byAction[action] = (stats.byAction[action] || 0) + 1;

            // By role
            const role = record.role || 'UNKNOWN';
            stats.byRole[role] = (stats.byRole[role] || 0) + 1;

            // By user (username)
            const username = record.username || 'UNKNOWN';
            stats.byUser[username] = (stats.byUser[username] || 0) + 1;

            // By date (timeline)
            if (record.timestamp) {
                const date = record.timestamp.split('T')[0];
                stats.timeline[date] = (stats.timeline[date] || 0) + 1;
            }
        });

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error('[BlockchainAudit] Get stats failed', {
            error: error.message
        });

        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get blockchain history with block hash information for a batch
 * 
 * This shows the chain of blocks with previousBlockHash linking each block
 * to demonstrate the immutability and chain structure of the blockchain.
 * 
 * @route GET /api/blockchain-audit/batch/:batchId/blocks
 * @access Admin only
 */
const getBatchBlockHistory = async (req, res) => {
    try {
        const userUUID = await ensureUserIdentity(req);
        const { batchId } = req.params;

        if (!batchId) {
            throw new AppError('Batch ID is required', 400);
        }

        logger.info('[BlockchainAudit] Getting block history for batch', {
            userId: userUUID,
            batchId
        });

        // Use the fabric service method to get history with block information
        const historyWithBlocks = await fabricService.getHistoryWithBlockInfo(batchId);

        // Transform the data to clearly show the block chain relationship
        const blockChain = historyWithBlocks.map((entry, index) => {
            // Parse timestamp properly
            let timestampStr = null;
            if (entry.timestamp) {
                if (entry.timestamp.seconds) {
                    // Fabric timestamp format
                    const seconds = typeof entry.timestamp.seconds.toInt === 'function'
                        ? entry.timestamp.seconds.toInt()
                        : (entry.timestamp.seconds.low || entry.timestamp.seconds);
                    timestampStr = new Date(seconds * 1000).toISOString();
                } else if (typeof entry.timestamp === 'string') {
                    timestampStr = entry.timestamp;
                }
            }

            return {
                sequence: index + 1,
                blockNumber: entry.blockNumber,
                transactionId: entry.txId,
                timestamp: timestampStr,
                isDelete: entry.isDelete || false,

                // Block hash information - this shows the chain linkage
                blockHashes: {
                    // Hash of this block's data
                    dataHash: entry.blockDataHash || null,
                    // Hash of the previous block - THIS LINKS THE CHAIN
                    previousBlockHash: entry.previousBlockHash || null
                },

                // The actual data/state at this point in time
                data: entry.data
            };
        });

        // Sort by block number (oldest first to show chain progression)
        blockChain.sort((a, b) => {
            const numA = parseInt(a.blockNumber) || 0;
            const numB = parseInt(b.blockNumber) || 0;
            return numA - numB;
        });

        // Re-sequence after sorting
        blockChain.forEach((block, index) => {
            block.sequence = index + 1;
        });

        // Build chain visualization
        const chainVisualization = blockChain.map((block, index) => {
            const prevBlock = index > 0 ? blockChain[index - 1] : null;
            return {
                blockNumber: block.blockNumber,
                linkedToPrevious: prevBlock ? {
                    previousBlockNumber: prevBlock.blockNumber,
                    hashMatch: block.blockHashes.previousBlockHash === prevBlock.blockHashes.dataHash
                } : null
            };
        });

        logger.info('[BlockchainAudit] Block history retrieved', {
            batchId,
            totalBlocks: blockChain.length
        });

        res.json({
            success: true,
            batchId: batchId,
            totalTransactions: blockChain.length,
            chainIntegrity: {
                description: 'Each block contains the hash of the previous block, creating an immutable chain',
                visualization: chainVisualization
            },
            blocks: blockChain
        });

    } catch (error) {
        logger.error('[BlockchainAudit] Get batch block history failed', {
            error: error.message,
            stack: error.stack
        });

        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get specific block information by block number
 * 
 * @route GET /api/blockchain-audit/block/:blockNumber
 * @access Admin only
 */
const getBlockByNumber = async (req, res) => {
    try {
        const userUUID = await ensureUserIdentity(req);
        const { blockNumber } = req.params;

        if (!blockNumber) {
            throw new AppError('Block number is required', 400);
        }

        logger.info('[BlockchainAudit] Getting block by number', {
            userId: userUUID,
            blockNumber
        });

        // Query block using qscc (Query System Chaincode)
        const network = fabricService.network;
        const qsccContract = network.getContract('qscc');
        const channelName = fabricService.channelName;

        // GetBlockByNumber requires channel name and block number
        const blockBuffer = await qsccContract.evaluateTransaction(
            'GetBlockByNumber',
            channelName,
            blockNumber.toString()
        );

        // Decode the block
        const { BlockDecoder } = require('fabric-common');
        const block = BlockDecoder.decode(blockBuffer);

        // Extract block information
        let blockInfo = {
            blockNumber: blockNumber,
            header: {},
            transactions: []
        };

        if (block && block.header) {
            // Block number
            if (block.header.number) {
                if (typeof block.header.number.toInt === 'function') {
                    blockInfo.header.number = block.header.number.toInt().toString();
                } else if (typeof block.header.number === 'object' && block.header.number.low !== undefined) {
                    blockInfo.header.number = block.header.number.low.toString();
                } else {
                    blockInfo.header.number = block.header.number.toString();
                }
            }

            // Previous hash
            if (block.header.previous_hash) {
                blockInfo.header.previousHash = block.header.previous_hash;
            }

            // Data hash
            if (block.header.data_hash) {
                blockInfo.header.dataHash = block.header.data_hash;
            }
        }

        // Extract transaction information from block data
        if (block && block.data && block.data.data) {
            block.data.data.forEach((tx, txIndex) => {
                try {
                    const txInfo = {
                        index: txIndex,
                        txId: null,
                        timestamp: null,
                        creator: null,
                        type: null
                    };

                    // Get transaction header info
                    if (tx.payload && tx.payload.header) {
                        const channelHeader = tx.payload.header.channel_header;
                        if (channelHeader) {
                            txInfo.txId = channelHeader.tx_id || null;
                            txInfo.type = channelHeader.typeString || channelHeader.type;

                            if (channelHeader.timestamp) {
                                const seconds = channelHeader.timestamp.seconds;
                                if (typeof seconds === 'object' && seconds.low !== undefined) {
                                    txInfo.timestamp = new Date(seconds.low * 1000).toISOString();
                                } else if (typeof seconds === 'number') {
                                    txInfo.timestamp = new Date(seconds * 1000).toISOString();
                                }
                            }
                        }

                        // Get creator info
                        const signatureHeader = tx.payload.header.signature_header;
                        if (signatureHeader && signatureHeader.creator) {
                            txInfo.creator = {
                                mspId: signatureHeader.creator.mspid || null
                            };
                        }
                    }

                    blockInfo.transactions.push(txInfo);
                } catch (txError) {
                    logger.warn(`[BlockchainAudit] Could not parse transaction ${txIndex}:`, txError.message);
                    blockInfo.transactions.push({
                        index: txIndex,
                        error: 'Could not parse transaction'
                    });
                }
            });
        }

        logger.info('[BlockchainAudit] Block retrieved', {
            blockNumber,
            transactionCount: blockInfo.transactions.length
        });

        res.json({
            success: true,
            data: blockInfo
        });

    } catch (error) {
        logger.error('[BlockchainAudit] Get block by number failed', {
            error: error.message,
            stack: error.stack
        });

        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get blockchain chain info (latest block, chain height)
 * 
 * @route GET /api/blockchain-audit/chain-info
 * @access Admin only
 */
const getChainInfo = async (req, res) => {
    try {
        const userUUID = await ensureUserIdentity(req);

        logger.info('[BlockchainAudit] Getting chain info', {
            userId: userUUID
        });

        // Query chain info using qscc
        const network = fabricService.network;
        const qsccContract = network.getContract('qscc');
        const channelName = fabricService.channelName;

        // GetChainInfo returns the blockchain info
        const chainInfoBuffer = await qsccContract.evaluateTransaction(
            'GetChainInfo',
            channelName
        );

        // Decode chain info using fabric-common
        const fabproto6 = require('fabric-protos');
        const chainInfo = fabproto6.common.BlockchainInfo.decode(chainInfoBuffer);

        let height = null;
        let currentBlockHash = null;
        let previousBlockHash = null;

        if (chainInfo) {
            // Height (number of blocks)
            if (chainInfo.height) {
                if (typeof chainInfo.height.toInt === 'function') {
                    height = chainInfo.height.toInt();
                } else if (typeof chainInfo.height === 'object' && chainInfo.height.low !== undefined) {
                    height = chainInfo.height.low;
                } else {
                    height = parseInt(chainInfo.height);
                }
            }

            // Current block hash
            if (chainInfo.currentBlockHash) {
                currentBlockHash = Buffer.from(chainInfo.currentBlockHash).toString('hex');
            }

            // Previous block hash
            if (chainInfo.previousBlockHash) {
                previousBlockHash = Buffer.from(chainInfo.previousBlockHash).toString('hex');
            }
        }

        logger.info('[BlockchainAudit] Chain info retrieved', {
            height
        });

        res.json({
            success: true,
            data: {
                channelName: channelName,
                height: height,
                latestBlockNumber: height ? height - 1 : null,
                currentBlockHash: currentBlockHash,
                previousBlockHash: previousBlockHash,
                description: 'The chain height represents the total number of blocks. Block numbers are 0-indexed.'
            }
        });

    } catch (error) {
        logger.error('[BlockchainAudit] Get chain info failed', {
            error: error.message,
            stack: error.stack
        });

        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    queryBlockchainAuditLogs,
    getAuditLogByTxId,
    getAuditLogsByResourceId,
    getAuditLogsByUser,
    getAuditStats,
    getBatchBlockHistory,
    getBlockByNumber,
    getChainInfo
};
