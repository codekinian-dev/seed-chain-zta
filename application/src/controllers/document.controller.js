/**
 * Document Controller
 * Handles document retrieval and verification endpoints
 */

const logger = require('../utils/logger');
const documentService = require('../services/document.service');
const ipfsService = require('../services/ipfs.service');
const fabricService = require('../services/fabric.service');
const { AppError } = require('../middleware/error');

/**
 * Get document from IPFS by CID
 * Streams file content to client
 */
const getDocument = async (req, res) => {
    try {
        const { cid } = req.params;

        logger.info(`[Document Controller] Retrieving document: ${cid}`);

        // Validate CID format
        if (!ipfsService.validateCID(cid)) {
            throw new AppError('Invalid CID format', 400);
        }

        // Stream file from IPFS
        const { stream, contentType, contentLength } = await documentService.getFileStream(cid);

        // Set response headers
        res.setHeader('Content-Type', contentType);
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        res.setHeader('Content-Disposition', `inline; filename="${cid}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year (immutable content)
        res.setHeader('X-IPFS-CID', cid);

        // Pipe stream to response
        stream.pipe(res);

        stream.on('error', (error) => {
            logger.error(`[Document Controller] Stream error: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to stream document'
                });
            }
        });

    } catch (error) {
        logger.error(`[Document Controller] Error retrieving document: ${error.message}`);

        if (error.response?.status === 404 || error.message.includes('not found')) {
            throw new AppError('Document not found in IPFS', 404);
        }

        throw new AppError(
            'Failed to retrieve document',
            error.statusCode || 500,
            error.message
        );
    }
};

/**
 * Download document with proper filename
 */
const downloadDocument = async (req, res) => {
    try {
        const { cid } = req.params;
        const { filename } = req.query;

        logger.info(`[Document Controller] Downloading document: ${cid}`);

        // Validate CID format
        if (!ipfsService.validateCID(cid)) {
            throw new AppError('Invalid CID format', 400);
        }

        // Stream file from IPFS
        const { stream, contentType, contentLength } = await documentService.getFileStream(cid);

        // Determine filename
        const downloadFilename = filename || `document-${cid.substring(0, 8)}`;

        // Set response headers for download
        res.setHeader('Content-Type', contentType);
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
        res.setHeader('X-IPFS-CID', cid);

        // Pipe stream to response
        stream.pipe(res);

        stream.on('error', (error) => {
            logger.error(`[Document Controller] Stream error: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to download document'
                });
            }
        });

    } catch (error) {
        logger.error(`[Document Controller] Error downloading document: ${error.message}`);
        throw new AppError('Failed to download document', 500, error.message);
    }
};

/**
 * Verify document integrity
 * Compares SHA256 hash of IPFS document with expected hash
 */
const verifyDocument = async (req, res) => {
    try {
        const { cid, expectedHash, batchId, docType } = req.body;

        logger.info(`[Document Controller] Verifying document`, {
            cid,
            batchId,
            docType
        });

        // Validate required fields
        if (!cid) {
            throw new AppError('CID is required', 400);
        }

        // Validate CID format
        if (!ipfsService.validateCID(cid)) {
            throw new AppError('Invalid CID format', 400);
        }

        let hashToVerify = expectedHash;

        // If batchId and docType provided, fetch hash from blockchain
        if (batchId && docType && !expectedHash) {
            logger.info(`[Document Controller] Fetching hash from blockchain for batch: ${batchId}`);

            try {
                // Use admin identity to query blockchain
                const seedBatch = await fabricService.query('querySeedBatch', [batchId]);

                if (!seedBatch) {
                    throw new AppError('Batch not found', 404);
                }

                // Find document by CID or docType
                const documents = seedBatch.documents || [];
                const document = documents.find(doc =>
                    doc.cid === cid || doc.doc_type === docType
                );

                if (!document) {
                    throw new AppError('Document not found in batch metadata', 404);
                }

                if (!document.sha256_hash) {
                    throw new AppError('Document hash not found in blockchain metadata', 400);
                }

                hashToVerify = document.sha256_hash;
            } catch (fabricError) {
                logger.error(`[Document Controller] Blockchain query error: ${fabricError.message}`);
                throw new AppError('Failed to fetch document metadata from blockchain', 500);
            }
        }

        // If no hash provided or found, just return file metadata
        if (!hashToVerify) {
            const metadata = await documentService.getFileMetadata(cid);
            return res.status(200).json({
                success: true,
                message: 'Document metadata retrieved (no hash verification performed)',
                data: {
                    cid,
                    fileSize: metadata.size,
                    calculatedHash: metadata.sha256Hash,
                    verified: false,
                    note: 'Provide expectedHash, or batchId + docType to verify integrity'
                }
            });
        }

        // Verify document integrity
        const result = await documentService.verifyDocumentIntegrity(cid, hashToVerify);

        res.status(200).json({
            success: true,
            message: result.valid
                ? 'Document integrity verified successfully'
                : 'Document integrity verification failed',
            data: result
        });

    } catch (error) {
        logger.error(`[Document Controller] Error verifying document: ${error.message}`);
        throw new AppError(
            error.message || 'Failed to verify document',
            error.statusCode || 500
        );
    }
};

/**
 * Get document metadata (hash, size, etc.)
 */
const getDocumentMetadata = async (req, res) => {
    try {
        const { cid } = req.params;

        logger.info(`[Document Controller] Getting document metadata: ${cid}`);

        // Validate CID format
        if (!ipfsService.validateCID(cid)) {
            throw new AppError('Invalid CID format', 400);
        }

        const metadata = await documentService.getFileMetadata(cid);

        res.status(200).json({
            success: true,
            data: metadata
        });

    } catch (error) {
        logger.error(`[Document Controller] Error getting metadata: ${error.message}`);
        throw new AppError('Failed to get document metadata', 500, error.message);
    }
};

module.exports = {
    getDocument,
    downloadDocument,
    verifyDocument,
    getDocumentMetadata
};
