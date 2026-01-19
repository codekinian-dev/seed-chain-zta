const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const ipfsService = require('../services/ipfs.service');
const fabricService = require('../services/fabric.service');
const transactionService = require('../services/transaction.service');
const queueService = require('../services/queue.service');
const identityService = require('../services/identity.service');
const { cleanupFile } = require('../middleware/upload');
const { AppError } = require('../middleware/error');
const { getUserUUID } = require('../middleware/auth');
const { transformChaincodeToAPI, transformHistory } = require('../utils/chaincode-transformer');

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
        // User doesn't have Fabric identity yet - need to enroll first
        throw new AppError(
            'User identity not found. Please call POST /api/v1/identity/enroll first.',
            403
        );
    }

    return userId;
};

/**
 * Create new seed batch with IPFS document upload
 */
const createSeedBatch = async (req, res) => {
    const txId = uuidv4();
    let uploadedCid = null;

    try {
        // Debug: Log auth structure
        console.log('=== AUTH DEBUG ===');
        console.log('Has kauth:', !!req.kauth);
        console.log('Has grant:', !!(req.kauth && req.kauth.grant));
        console.log('Has Authorization header:', !!req.headers.authorization);
        console.log('Authorization header:', req.headers.authorization?.substring(0, 50));
        console.log('kauth keys:', req.kauth ? Object.keys(req.kauth) : 'none');

        logger.info('[Controller] Auth Debug', {
            hasKauth: !!req.kauth,
            hasGrant: !!(req.kauth && req.kauth.grant),
            hasToken: !!(req.kauth && req.kauth.grant && req.kauth.grant.access_token),
            tokenContent: req.kauth?.grant?.access_token?.content
        });

        // Get user UUID and ensure they have Fabric identity
        const userUUID = await ensureUserIdentity(req);
        console.log('User UUID result:', userUUID);

        // Create transaction log
        transactionService.createTransaction('CREATE_SEED_BATCH', {
            userId: userUUID,
            body: req.body
        });

        // Validate file upload
        if (!req.file) {
            throw new AppError('Seed source document is required', 400);
        }

        logger.info(`[Controller] Creating seed batch`, {
            txId,
            userId: userUUID,
            file: req.file.originalname
        });

        // Step 1: Upload to IPFS (upload-first strategy)
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'STARTED', {
            filename: req.file.originalname
        });

        uploadedCid = await ipfsService.uploadFile(req.file.path);

        transactionService.logStep(txId, 'IPFS_UPLOAD', 'COMPLETED', {
            cid: uploadedCid
        });

        logger.info(`[Controller] File uploaded to IPFS`, {
            txId,
            cid: uploadedCid,
            filename: req.file.originalname
        });

        // Step 2: Submit to blockchain using user's identity
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED', {
            cid: uploadedCid
        });

        // Generate batch ID
        const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Prepare chaincode arguments
        const args = [
            batchId,
            req.body.varietyName,
            req.body.commodity,
            req.body.harvestDate,
            req.body.seedSourceNumber,
            req.body.origin,
            req.body.iupNumber,
            req.body.seedClass,
            userUUID, // producerUUID from authenticated user
            req.file.originalname, // seedSourceDocName
            uploadedCid // seedSourceIpfsCid
        ];

        // Use user-specific identity for the transaction
        const result = await fabricService.invokeAsUser(userUUID, 'createSeedBatch', args);

        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'COMPLETED', {
            batchId,
            transactionId: result
        });

        // Mark transaction as successful
        transactionService.success(txId, {
            batchId,
            cid: uploadedCid,
            transactionId: result
        });

        logger.transaction(txId, 'SUCCESS', {
            batchId,
            cid: uploadedCid
        });

        // Cleanup local file
        cleanupFile(req.file.path);

        res.status(201).json({
            success: true,
            message: 'Seed batch created successfully',
            data: {
                batchId,
                ipfsCid: uploadedCid,
                transactionId: result
            }
        });

    } catch (error) {
        logger.error(`[Controller] Error creating seed batch`, {
            txId,
            error: error.message
        });

        // Rollback on failure
        if (uploadedCid) {
            await transactionService.fail(txId, error);
        }

        // Cleanup local file
        if (req.file) {
            cleanupFile(req.file.path);
        }

        throw new AppError(
            'Failed to create seed batch',
            500,
            error.message
        );
    }
};

/**
 * Submit certification request with document upload
 */
const submitCertification = async (req, res) => {
    const txId = uuidv4();
    const { id: batchId } = req.params;
    let uploadedCid = null;

    try {
        // Get user identity
        const userUUID = await ensureUserIdentity(req);

        transactionService.createTransaction('SUBMIT_CERTIFICATION', {
            userId: userUUID,
            batchId,
            body: req.body
        });

        if (!req.file) {
            throw new AppError('Certification document is required', 400);
        }

        logger.info(`[Controller] Submitting certification`, {
            txId,
            batchId,
            userId: userUUID
        });

        // Upload to IPFS
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'STARTED');
        uploadedCid = await ipfsService.uploadFile(req.file.path);
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'COMPLETED', { cid: uploadedCid });

        // Submit to blockchain using user identity
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED');

        const args = [
            batchId,
            req.file.originalname,
            uploadedCid
        ];

        const result = await fabricService.invokeAsUser(userUUID, 'submitCertification', args);
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'COMPLETED', { transactionId: result });

        transactionService.success(txId, { batchId, cid: uploadedCid, transactionId: result });
        logger.transaction(txId, 'SUCCESS', { batchId, cid: uploadedCid });

        cleanupFile(req.file.path);

        res.status(200).json({
            success: true,
            message: 'Certification submitted successfully',
            data: {
                batchId,
                ipfsCid: uploadedCid,
                transactionId: result
            }
        });

    } catch (error) {
        logger.error(`[Controller] Error submitting certification`, {
            txId,
            batchId,
            error: error.message
        });

        if (uploadedCid) {
            await transactionService.fail(txId, error);
        }

        if (req.file) {
            cleanupFile(req.file.path);
        }

        throw new AppError('Failed to submit certification', 500, error.message);
    }
};

/**
 * Record field inspection with photo upload
 */
const recordInspection = async (req, res) => {
    const txId = uuidv4();
    const { id: batchId } = req.params;
    let uploadedCid = null;

    try {
        // Get user identity
        const userUUID = await ensureUserIdentity(req);

        transactionService.createTransaction('RECORD_INSPECTION', {
            userId: userUUID,
            batchId,
            body: req.body
        });

        if (!req.file) {
            throw new AppError('Inspection photo is required', 400);
        }

        logger.info(`[Controller] Recording inspection`, {
            txId,
            batchId,
            userId: userUUID
        });

        // Upload to IPFS
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'STARTED');
        uploadedCid = await ipfsService.uploadFile(req.file.path);
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'COMPLETED', { cid: uploadedCid });

        // Submit to blockchain using user identity
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED');

        const args = [
            batchId,
            req.body.inspectionResult,
            uploadedCid,
            userUUID // inspectorFieldUUID
        ];

        const result = await fabricService.invokeAsUser(userUUID, 'recordInspection', args);
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'COMPLETED', { transactionId: result });

        transactionService.success(txId, { batchId, cid: uploadedCid, transactionId: result });
        logger.transaction(txId, 'SUCCESS', { batchId, cid: uploadedCid });

        cleanupFile(req.file.path);

        res.status(200).json({
            success: true,
            message: 'Inspection recorded successfully',
            data: {
                batchId,
                ipfsCid: uploadedCid,
                transactionId: result
            }
        });

    } catch (error) {
        logger.error(`[Controller] Error recording inspection`, {
            txId,
            batchId,
            error: error.message
        });

        if (uploadedCid) {
            await transactionService.fail(txId, error);
        }

        if (req.file) {
            cleanupFile(req.file.path);
        }

        throw new AppError('Failed to record inspection', 500, error.message);
    }
};

/**
 * Evaluate inspection (no file upload)
 */
const evaluateInspection = async (req, res) => {
    const txId = uuidv4();
    const { id: batchId } = req.params;

    try {
        // Get user identity
        const userUUID = await ensureUserIdentity(req);

        transactionService.createTransaction('EVALUATE_INSPECTION', {
            userId: userUUID,
            batchId,
            body: req.body
        });

        logger.info(`[Controller] Evaluating inspection`, {
            txId,
            batchId,
            userId: userUUID
        });

        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED');

        const args = [
            batchId,
            req.body.evaluationNote,
            req.body.approvalStatus,
            userUUID // inspectorChiefUUID
        ];

        const result = await fabricService.invokeAsUser(userUUID, 'evaluateInspection', args);
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'COMPLETED', { transactionId: result });

        transactionService.success(txId, { batchId, transactionId: result });
        logger.transaction(txId, 'SUCCESS', { batchId });

        res.status(200).json({
            success: true,
            message: 'Inspection evaluated successfully',
            data: {
                batchId,
                decision: req.body.decision,
                transactionId: result
            }
        });

    } catch (error) {
        logger.error(`[Controller] Error evaluating inspection`, {
            txId,
            batchId,
            error: error.message
        });

        await transactionService.fail(txId, error);

        throw new AppError('Failed to evaluate inspection', 500, error.message);
    }
};

/**
 * Issue certificate (no file upload)
 */
const issueCertificate = async (req, res) => {
    const txId = uuidv4();
    const { id: batchId } = req.params;
    let uploadedCid = null;

    try {
        // Get user identity
        const userUUID = await ensureUserIdentity(req);

        transactionService.createTransaction('ISSUE_CERTIFICATE', {
            userId: userUUID,
            batchId,
            body: req.body
        });

        if (!req.file) {
            throw new AppError('Certificate document is required', 400);
        }

        logger.info(`[Controller] Issuing certificate`, {
            txId,
            batchId,
            userId: userUUID
        });

        // Upload to IPFS
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'STARTED');
        uploadedCid = await ipfsService.uploadFile(req.file.path);
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'COMPLETED', { cid: uploadedCid });

        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED');

        const args = [
            batchId,
            req.body.certificateNumber,
            req.body.expiryMonths,
            req.file.originalname,
            uploadedCid,
            userUUID // issuerUUID
        ];

        const result = await fabricService.invokeAsUser(userUUID, 'issueCertificate', args);
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'COMPLETED', { transactionId: result });

        transactionService.success(txId, { batchId, cid: uploadedCid, transactionId: result });
        logger.transaction(txId, 'SUCCESS', { batchId, cid: uploadedCid });

        cleanupFile(req.file.path);

        res.status(200).json({
            success: true,
            message: 'Certificate issued successfully',
            data: {
                batchId,
                certificateNumber: req.body.certificateNumber,
                ipfsCid: uploadedCid,
                transactionId: result
            }
        });

    } catch (error) {
        logger.error(`[Controller] Error issuing certificate`, {
            txId,
            batchId,
            error: error.message
        });

        if (uploadedCid) {
            await transactionService.fail(txId, error);
        }

        if (req.file) {
            cleanupFile(req.file.path);
        }

        throw new AppError('Failed to issue certificate', 500, error.message);
    }
};

/**
 * Distribute seed (no file upload)
 */
const distributeSeed = async (req, res) => {
    const txId = uuidv4();
    const { id: batchId } = req.params;

    try {
        // Get user identity
        const userUUID = await ensureUserIdentity(req);

        transactionService.createTransaction('DISTRIBUTE_SEED', {
            userId: userUUID,
            batchId,
            body: req.body
        });

        logger.info(`[Controller] Distributing seed`, {
            txId,
            batchId,
            userId: userUUID
        });

        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED');

        const args = [
            batchId,
            req.body.distributionLocation,
            req.body.quantity.toString()
        ];

        const result = await fabricService.invokeAsUser(userUUID, 'distributeSeed', args);
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'COMPLETED', { transactionId: result });

        transactionService.success(txId, { batchId, transactionId: result });
        logger.transaction(txId, 'SUCCESS', { batchId });

        res.status(200).json({
            success: true,
            message: 'Seed distributed successfully',
            data: {
                batchId,
                distributionLocation: req.body.distributionLocation,
                quantity: req.body.quantity,
                transactionId: result
            }
        });

    } catch (error) {
        logger.error(`[Controller] Error distributing seed`, {
            txId,
            batchId,
            error: error.message
        });

        await transactionService.fail(txId, error);

        throw new AppError('Failed to distribute seed', 500, error.message);
    }
};

/**
 * Query seed batch by ID
 */
const querySeedBatch = async (req, res) => {
    try {
        const { id: batchId } = req.params;

        // Get user identity for query
        const userUUID = await ensureUserIdentity(req);

        logger.info(`[Controller] Querying seed batch`, {
            batchId,
            userId: userUUID
        });

        const seedBatch = await fabricService.queryAsUser(userUUID, 'querySeedBatch', [batchId]);

        // Transform nested structure to API-friendly format
        const transformed = transformChaincodeToAPI(seedBatch);

        res.status(200).json({
            success: true,
            data: transformed
        });

    } catch (error) {
        logger.error(`[Controller] Error querying seed batch`, {
            batchId: req.params.id,
            error: error.message
        });

        throw new AppError('Failed to query seed batch', 500, error.message);
    }
};

/**
 * Query all seed batches
 */
const queryAllSeedBatches = async (req, res) => {
    try {
        // Get user identity for query
        const userUUID = await ensureUserIdentity(req);

        logger.info(`[Controller] Querying all seed batches`, {
            userId: userUUID
        });

        const result = await fabricService.queryAsUser(userUUID, 'queryAllSeedBatches', []);

        // Validate result
        if (!result) {
            logger.warn('[Controller] Chaincode returned null/undefined result');
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }

        // Transform nested structure to API-friendly format
        const transformed = transformChaincodeToAPI(result);
        const seedBatches = Array.isArray(transformed) ? transformed : [];

        res.status(200).json({
            success: true,
            count: seedBatches.length,
            data: seedBatches
        });

    } catch (error) {
        logger.error(`[Controller] Error querying all seed batches`, {
            error: error.message
        });

        throw new AppError('Failed to query seed batches', 500, error.message);
    }
};

/**
 * Query seed batches by current user (producer only)
 * Returns only seed batches owned by the logged-in user
 */
const queryMySeedBatches = async (req, res) => {
    try {
        // Get user identity
        const userUUID = await ensureUserIdentity(req);

        logger.info(`[Controller] Querying seed batches for user`, {
            userId: userUUID
        });

        // Call chaincode querySeedBatchesByProducer (LevelDB-compatible)
        const result = await fabricService.queryAsUser(
            userUUID,
            'querySeedBatchesByProducer',
            [userUUID]
        );

        // Validate result
        if (!result) {
            logger.warn('[Controller] Chaincode returned null/undefined result');
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }

        // Transform nested structure to API-friendly format
        const transformed = transformChaincodeToAPI(result);
        const seedBatches = Array.isArray(transformed) ? transformed : [];

        logger.info(`[Controller] Retrieved seed batches for user`, {
            userId: userUUID,
            count: seedBatches.length
        });

        res.status(200).json({
            success: true,
            count: seedBatches.length,
            data: seedBatches
        });

    } catch (error) {
        logger.error(`[Controller] Error querying user seed batches`, {
            error: error.message,
            userId: req.kauth?.grant?.access_token?.content?.sub
        });

        throw new AppError('Failed to query your seed batches', 500, error.message);
    }
};

/**
 * Get seed batch history
 */
const getHistory = async (req, res) => {
    try {
        const { id: batchId } = req.params;

        // Get user identity for query
        const userUUID = await ensureUserIdentity(req);

        logger.info(`[Controller] Getting history for seed batch`, {
            batchId,
            userId: userUUID
        });

        // Get history with block information including previous block hash
        const history = await fabricService.queryAsUser(userUUID, 'getHistory', [batchId]);

        // Transform history data to include nested structure parsing
        const transformed = transformHistory(history);

        res.status(200).json({
            success: true,
            data: transformed
        });

    } catch (error) {
        logger.error(`[Controller] Error getting history`, {
            batchId: req.params.id,
            error: error.message
        });

        throw new AppError('Failed to get history', 500, error.message);
    }
};

/**
 * Create seed batch for load testing (no file upload required)
 * This endpoint mocks IPFS upload for testing purposes
 */
const createSeedBatchLoadTest = async (req, res) => {
    const txId = uuidv4();

    try {
        // Get user identity
        const userUUID = await ensureUserIdentity(req);

        logger.info(`[Controller] Creating seed batch (load test mode)`, {
            txId,
            userId: userUUID
        });

        // Generate batch ID
        const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Mock IPFS CID for testing (valid CIDv0 format - 46 characters starting with Qm)
        // Generate a realistic looking CID using base58 alphabet
        const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let mockCid = 'Qm';
        for (let i = 0; i < 44; i++) {
            mockCid += base58Chars.charAt(Math.floor(Math.random() * base58Chars.length));
        }

        // Prepare chaincode arguments with mock data
        const args = [
            batchId,
            req.body.varietyName || 'Test Variety',
            req.body.commodity || 'Test Commodity',
            req.body.harvestDate || new Date().toISOString().split('T')[0],
            req.body.seedSourceNumber || `SRC-${Date.now()}`,
            req.body.origin || 'Test Origin',
            req.body.iupNumber || `IUP-${Date.now()}`,
            req.body.seedClass || 'BD',
            userUUID,
            req.body.documentName || 'test_document.pdf',
            mockCid
        ];

        // Use user-specific identity for the transaction
        const result = await fabricService.invokeAsUser(userUUID, 'createSeedBatch', args);

        logger.transaction(txId, 'SUCCESS', {
            batchId,
            loadTestMode: true
        });

        res.status(201).json({
            success: true,
            message: 'Seed batch created successfully (load test mode)',
            data: {
                batchId,
                ipfsCid: mockCid,
                transactionId: result,
                loadTestMode: true
            }
        });

    } catch (error) {
        logger.error(`[Controller] Error creating seed batch (load test)`, {
            txId,
            error: error.message
        });

        throw new AppError(
            'Failed to create seed batch',
            500,
            error.message
        );
    }
};

module.exports = {
    createSeedBatch,
    createSeedBatchLoadTest,
    submitCertification,
    recordInspection,
    evaluateInspection,
    issueCertificate,
    distributeSeed,
    querySeedBatch,
    queryAllSeedBatches,
    queryMySeedBatches,
    getHistory
};
