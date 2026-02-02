/**
 * Document Routes
 * API endpoints for document management (IPFS retrieval and verification)
 */

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const documentController = require('../controllers/document.controller');

/**
 * @route   GET /api/v1/documents/:cid
 * @desc    Get/stream document from IPFS by CID
 * @access  Protected
 */
router.get(
    '/:cid',
    protect(),
    asyncHandler(documentController.getDocument)
);

/**
 * @route   GET /api/v1/documents/:cid/download
 * @desc    Download document with filename
 * @access  Protected
 * @query   filename - Optional filename for download
 */
router.get(
    '/:cid/download',
    protect(),
    asyncHandler(documentController.downloadDocument)
);

/**
 * @route   GET /api/v1/documents/:cid/metadata
 * @desc    Get document metadata (hash, size)
 * @access  Protected
 */
router.get(
    '/:cid/metadata',
    protect(),
    asyncHandler(documentController.getDocumentMetadata)
);

/**
 * @route   POST /api/v1/documents/verify
 * @desc    Verify document integrity (compare hash)
 * @access  Protected
 * @body    { cid: string, expectedHash?: string, batchId?: string, docType?: string }
 */
router.post(
    '/verify',
    protect(),
    asyncHandler(documentController.verifyDocument)
);

module.exports = router;
