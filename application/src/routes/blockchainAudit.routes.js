const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const blockchainAuditController = require('../controllers/blockchainAudit.controller');
const { asyncHandler } = require('../middleware/error');

/**
 * Blockchain Audit Log Routes
 * 
 * API endpoints for querying AuditLog data stored on the Hyperledger Fabric blockchain.
 * All endpoints require admin role access.
 * 
 * The AuditLog records are created by the chaincode for every transaction
 * and contain details about who did what, when, and on which resource.
 */

/**
 * Middleware to check admin access
 */
const requireAdmin = (req, res, next) => {
    const token = req.kauth?.grant?.access_token?.content;

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    // Get roles from token
    const realmRoles = token.realm_access?.roles || [];
    const clientRoles = token.resource_access?.['benih-app']?.roles || [];
    const allRoles = [...realmRoles, ...clientRoles];

    if (!allRoles.includes('role_admin')) {
        logger.warn('[BlockchainAudit] Admin access denied', {
            userId: token.sub,
            username: token.preferred_username,
            roles: allRoles
        });
        return res.status(403).json({
            success: false,
            error: 'Admin access required for blockchain audit logs'
        });
    }

    next();
};

/**
 * @route   GET /api/blockchain-audit/logs
 * @desc    Query blockchain audit logs with filters
 * @access  Admin only
 * 
 * Query Parameters:
 * - startTime: ISO date string (e.g., "2024-01-01T00:00:00Z")
 * - endTime: ISO date string
 * - action: Filter by action type (e.g., "CREATE_SEED_BATCH", "SUBMIT_CERTIFICATION")
 * - limit: Number of records to return (default: 100)
 * - offset: Number of records to skip (for pagination)
 */
router.get(
    '/logs',
    requireAdmin,
    asyncHandler(blockchainAuditController.queryBlockchainAuditLogs)
);

/**
 * @route   GET /api/blockchain-audit/stats
 * @desc    Get audit log statistics summary
 * @access  Admin only
 * 
 * Query Parameters:
 * - days: Number of days to include in statistics (default: 7)
 */
router.get(
    '/stats',
    requireAdmin,
    asyncHandler(blockchainAuditController.getAuditStats)
);

/**
 * @route   GET /api/blockchain-audit/tx/:txId
 * @desc    Get audit log by blockchain transaction ID
 * @access  Admin only
 */
router.get(
    '/tx/:txId',
    requireAdmin,
    asyncHandler(blockchainAuditController.getAuditLogByTxId)
);

/**
 * @route   GET /api/blockchain-audit/resource/:resourceId
 * @desc    Get audit logs for a specific resource (e.g., seed batch ID)
 * @access  Admin only
 * 
 * Query Parameters:
 * - limit: Number of records to return (default: 100)
 * - offset: Number of records to skip (for pagination)
 */
router.get(
    '/resource/:resourceId',
    requireAdmin,
    asyncHandler(blockchainAuditController.getAuditLogsByResourceId)
);

/**
 * @route   GET /api/blockchain-audit/user/:keycloakId
 * @desc    Get audit logs for a specific user by Keycloak ID
 * @access  Admin only
 * 
 * Query Parameters:
 * - limit: Number of records to return (default: 100)
 * - offset: Number of records to skip (for pagination)
 */
router.get(
    '/user/:keycloakId',
    requireAdmin,
    asyncHandler(blockchainAuditController.getAuditLogsByUser)
);

/**
 * @route   GET /api/blockchain-audit/chain-info
 * @desc    Get blockchain chain information (height, latest block hash)
 * @access  Admin only
 * 
 * Returns:
 * - Channel name
 * - Chain height (total number of blocks)
 * - Current block hash
 * - Previous block hash
 */
router.get(
    '/chain-info',
    requireAdmin,
    asyncHandler(blockchainAuditController.getChainInfo)
);

/**
 * @route   GET /api/blockchain-audit/batch/:batchId/blocks
 * @desc    Get block history for a seed batch showing chain linkage
 * @access  Admin only
 * 
 * This endpoint shows all transactions related to a batch with their
 * block information, including previousBlockHash which demonstrates
 * how each block is cryptographically linked to the previous one.
 * 
 * The response includes:
 * - Block number for each transaction
 * - Transaction ID
 * - Block data hash
 * - Previous block hash (links to prior block)
 * - Chain integrity visualization
 */
router.get(
    '/batch/:batchId/blocks',
    requireAdmin,
    asyncHandler(blockchainAuditController.getBatchBlockHistory)
);

/**
 * @route   GET /api/blockchain-audit/block/:blockNumber
 * @desc    Get detailed information about a specific block by its number
 * @access  Admin only
 * 
 * Returns:
 * - Block header (number, previous hash, data hash)
 * - List of transactions in the block
 * - Transaction details (ID, timestamp, creator MSP)
 */
router.get(
    '/block/:blockNumber',
    requireAdmin,
    asyncHandler(blockchainAuditController.getBlockByNumber)
);

module.exports = router;
