/**
 * Document Routes
 * API endpoints for document management (IPFS retrieval and verification)
 */

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { upload, handleUploadError } = require('../middleware/upload');
const documentController = require('../controllers/document.controller');

/**
 * @route   POST /api/v1/documents/public-verify
 * @desc    Public document verification - upload file and verify against IPFS stored document
 * @access  Public - For QR code scanning verification
 * @query   cid - IPFS CID from QR code
 * @body    file - Document file to verify (multipart/form-data)
 */
router.post(
    '/public-verify',
    upload.single('file'),
    handleUploadError,
    asyncHandler(documentController.publicVerify)
);

/**
 * @route   GET /api/v1/documents/verify-certificate
 * @desc    Public certificate verification via QR Code
 * @access  Public - For QR code scanning verification
 * @query   cert - Certificate number
 * @query   batch - Batch ID
 */
router.get(
    '/verify-certificate',
    asyncHandler(documentController.verifyCertificate)
);

/**
 * @route   GET /api/v1/documents/:cid
 * @desc    Get/stream document from IPFS by CID
 * @access  Public - Documents are immutable and verified by CID
 */
router.get(
    '/:cid',
    asyncHandler(documentController.getDocument)
);

/**
 * @route   GET /api/v1/documents/:cid/download
 * @desc    Download document with filename
 * @access  Public - Documents are immutable and verified by CID
 * @query   filename - Optional filename for download
 */
router.get(
    '/:cid/download',
    asyncHandler(documentController.downloadDocument)
);

/**
 * @route   GET /api/v1/documents/:cid/metadata
 * @desc    Get document metadata (hash, size)
 * @access  Public - Metadata is non-sensitive
 */
router.get(
    '/:cid/metadata',
    asyncHandler(documentController.getDocumentMetadata)
);

/**
 * @route   POST /api/v1/documents/verify
 * @desc    Verify document integrity (compare hash)
 * @access  Public - Verification should be accessible for transparency
 * @body    { cid: string, expectedHash?: string, batchId?: string, docType?: string }
 */
router.post(
    '/verify',
    asyncHandler(documentController.verifyDocument)
);

module.exports = router;
