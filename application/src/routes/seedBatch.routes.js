const express = require('express');
const router = express.Router();

const { keycloak, protect, requireRole } = require('../middleware/auth');
const { enforcePolicy } = require('../middleware/policy');
const { upload, handleUploadError, logUpload } = require('../middleware/upload');
const {
    validateBody,
    validateParams,
    validateFileUpload,
    createSeedBatchSchema,
    createSeedBatchLoadTestSchema,
    submitCertificationSchema,
    recordInspectionSchema,
    evaluateInspectionSchema,
    issueCertificateSchema,
    distributeSchema,
    idSchema
} = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');

const seedBatchController = require('../controllers/seedBatch.controller');

/**
 * @route   POST /api/seed-batches/load-test
 * @desc    Create new seed batch for load testing (no file upload)
 * @access  Protected - role_producer
 */
router.post(
    '/load-test',
    protect(),
    enforcePolicy('seed_batch', 'create'),
    validateBody(createSeedBatchLoadTestSchema),
    asyncHandler(seedBatchController.createSeedBatchLoadTest)
);

/**
 * @route   POST /api/seed-batches
 * @desc    Create new seed batch (producer only)
 * @access  Protected - role_producer
 */
router.post(
    '/',
    keycloak.protect(),
    enforcePolicy('seed_batch', 'create'),
    upload.single('document'),
    handleUploadError,
    logUpload,
    validateFileUpload({
        required: true,
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }),
    validateBody(createSeedBatchSchema),
    asyncHandler(seedBatchController.createSeedBatch)
);

/**
 * @route   POST /api/seed-batches/:id/submit
 * @desc    Submit certification request (producer only)
 * @access  Protected - role_producer
 */
router.post(
    '/:id/submit',
    protect(),
    enforcePolicy('seed_batch', 'submit'),
    validateParams(idSchema),
    upload.single('document'),
    handleUploadError,
    logUpload,
    validateFileUpload({
        required: true,
        maxSize: 10 * 1024 * 1024,
        allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }),
    validateBody(submitCertificationSchema),
    asyncHandler(seedBatchController.submitCertification)
);

/**
 * @route   POST /api/seed-batches/:id/inspect
 * @desc    Record field inspection (field inspector only)
 * @access  Protected - role_pbt_field
 */
router.post(
    '/:id/inspect',
    keycloak.protect(),
    enforcePolicy('inspection', 'create'),
    validateParams(idSchema),
    upload.single('photo'),
    handleUploadError,
    logUpload,
    validateFileUpload({
        required: true,
        maxSize: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }),
    validateBody(recordInspectionSchema),
    asyncHandler(seedBatchController.recordInspection)
);

/**
 * @route   POST /api/seed-batches/:id/evaluate
 * @desc    Evaluate inspection result (chief inspector only)
 * @access  Protected - role_pbt_chief
 */
router.post(
    '/:id/evaluate',
    keycloak.protect(),
    enforcePolicy('evaluation', 'approve'),
    validateParams(idSchema),
    validateBody(evaluateInspectionSchema),
    asyncHandler(seedBatchController.evaluateInspection)
);

/**
 * @route   POST /api/seed-batches/:id/certificate
 * @desc    Issue certification (LSM head only)
 * @access  Protected - role_lsm_head
 */
router.post(
    '/:id/certificate',
    keycloak.protect(),
    enforcePolicy('certificate', 'issue'),
    validateParams(idSchema),
    upload.single('certificate'),
    handleUploadError,
    logUpload,
    validateFileUpload({
        required: true,
        maxSize: 10 * 1024 * 1024,
        allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }),
    validateBody(issueCertificateSchema),
    asyncHandler(seedBatchController.issueCertificate)
);

/**
 * @route   POST /api/seed-batches/:id/distribute
 * @desc    Record seed distribution (producer only)
 * @access  Protected - role_producer
 */
router.post(
    '/:id/distribute',
    keycloak.protect(),
    enforcePolicy('distribution', 'create'),
    validateParams(idSchema),
    validateBody(distributeSchema),
    asyncHandler(seedBatchController.distributeSeed)
);

/**
 * @route   GET /api/seed-batches/:id
 * @desc    Get seed batch by ID
 * @access  Protected
 */
router.get(
    '/:id',
    protect(),
    // enforcePolicy('seed_batch', 'read'),
    validateParams(idSchema),
    asyncHandler(seedBatchController.querySeedBatch)
);

/**
 * @route   GET /api/seed-batches
 * @desc    Get all seed batches
 * @access  Protected
 */
router.get(
    '/',
    protect(),
    enforcePolicy('seed_batch', 'read'),
    asyncHandler(seedBatchController.queryAllSeedBatches)
);

/**
 * @route   GET /api/seed-batches/:id/history
 * @desc    Get seed batch history
 * @access  Public (but authentication recommended)
 */
router.get(
    '/:id/history',
    validateParams(idSchema),
    asyncHandler(seedBatchController.getHistory)
);

module.exports = router;
