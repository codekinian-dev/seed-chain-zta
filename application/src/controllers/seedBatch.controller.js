const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const ipfsService = require('../services/ipfs.service');
const fabricService = require('../services/fabric.service');
const transactionService = require('../services/transaction.service');
const queueService = require('../services/queue.service');
const { cleanupFile } = require('../middleware/upload');
const { AppError } = require('../middleware/error');
const { getUserUUID } = require('../middleware/auth');

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

        // Get user UUID
        const userUUID = getUserUUID(req);
        console.log('User UUID result:', userUUID);

        if (!userUUID) {
            throw new AppError('User authentication invalid - no user ID found', 401);
        }

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

        // Step 2: Submit to blockchain
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

        const result = await fabricService.invokeChaincode('createSeedBatch', args);

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
        transactionService.createTransaction('SUBMIT_CERTIFICATION', {
            userId: getUserUUID(req),
            batchId,
            body: req.body
        });

        if (!req.file) {
            throw new AppError('Certification document is required', 400);
        }

        logger.info(`[Controller] Submitting certification`, {
            txId,
            batchId,
            userId: getUserUUID(req)
        });

        // Upload to IPFS
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'STARTED');
        uploadedCid = await ipfsService.uploadFile(req.file.path);
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'COMPLETED', { cid: uploadedCid });

        // Submit to blockchain
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED');

        const args = [
            batchId,
            req.file.originalname,
            uploadedCid
        ];

        const result = await fabricService.invokeChaincode('submitCertification', args);
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
        transactionService.createTransaction('RECORD_INSPECTION', {
            userId: getUserUUID(req),
            batchId,
            body: req.body
        });

        if (!req.file) {
            throw new AppError('Inspection photo is required', 400);
        }

        logger.info(`[Controller] Recording inspection`, {
            txId,
            batchId,
            userId: getUserUUID(req)
        });

        // Upload to IPFS
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'STARTED');
        uploadedCid = await ipfsService.uploadFile(req.file.path);
        transactionService.logStep(txId, 'IPFS_UPLOAD', 'COMPLETED', { cid: uploadedCid });

        // Submit to blockchain
        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED');

        const args = [
            batchId,
            req.body.inspectionResult,
            uploadedCid,
            getUserUUID(req) // inspectorFieldUUID
        ];

        const result = await fabricService.invokeChaincode('recordInspection', args);
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
        transactionService.createTransaction('EVALUATE_INSPECTION', {
            userId: getUserUUID(req),
            batchId,
            body: req.body
        });

        logger.info(`[Controller] Evaluating inspection`, {
            txId,
            batchId,
            userId: getUserUUID(req)
        });

        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED');

        const args = [
            batchId,
            req.body.evaluationNote,
            req.body.approvalStatus,
            getUserUUID(req) // inspectorChiefUUID
        ];

        const result = await fabricService.invokeChaincode('evaluateInspection', args);
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
        transactionService.createTransaction('ISSUE_CERTIFICATE', {
            userId: getUserUUID(req),
            batchId,
            body: req.body
        });

        if (!req.file) {
            throw new AppError('Certificate document is required', 400);
        }

        logger.info(`[Controller] Issuing certificate`, {
            txId,
            batchId,
            userId: getUserUUID(req)
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
            getUserUUID(req)
        ];

        const result = await fabricService.invokeChaincode('issueCertificate', args);
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
        transactionService.createTransaction('DISTRIBUTE_SEED', {
            userId: getUserUUID(req),
            batchId,
            body: req.body
        });

        logger.info(`[Controller] Distributing seed`, {
            txId,
            batchId,
            userId: getUserUUID(req)
        });

        transactionService.logStep(txId, 'BLOCKCHAIN_SUBMIT', 'STARTED');

        const args = [
            batchId,
            req.body.distributionLocation,
            req.body.quantity.toString()
        ];

        const result = await fabricService.invokeChaincode('distributeSeed', args);
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

        logger.info(`[Controller] Querying seed batch`, {
            batchId,
            userId: getUserUUID(req)
        });

        const seedBatch = await fabricService.queryChaincode('querySeedBatch', [batchId]);

        res.status(200).json({
            success: true,
            data: seedBatch
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
        logger.info(`[Controller] Querying all seed batches`, {
            userId: getUserUUID(req)
        });

        const result = await fabricService.queryChaincode('queryAllSeedBatches', []);

        // Validate result
        if (!result) {
            logger.warn('[Controller] Chaincode returned null/undefined result');
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }

        const seedBatches = Array.isArray(result) ? result : [];

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
 * Get seed batch history
 */
const getHistory = async (req, res) => {
    try {
        const { id: batchId } = req.params;

        logger.info(`[Controller] Getting history for seed batch`, {
            batchId,
            userId: getUserUUID(req)
        });

        // Get history with block information including previous block hash
        // const history = await fabricService.getHistoryWithBlockInfo(batchId);
        const history = await fabricService.queryChaincode('getHistory', [batchId]);

        res.status(200).json({
            success: true,
            data: history
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
        // Get user UUID
        const userUUID = getUserUUID(req);

        if (!userUUID) {
            throw new AppError('User authentication invalid - no user ID found', 401);
        }

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

        const result = await fabricService.invokeChaincode('createSeedBatch', args);

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
    getHistory
};
