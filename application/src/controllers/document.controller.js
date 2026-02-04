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
                const seedBatch = await fabricService.queryChaincode('querySeedBatch', [batchId]);

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

/**
 * Public document verification with file upload
 * Verifies uploaded document against IPFS stored document
 * Returns batch/certificate data if verification passes
 */
const publicVerify = async (req, res) => {
    try {
        const { cid } = req.query;
        const uploadedFile = req.file;

        logger.info(`[Document Controller] Public verification request`, { cid, hasFile: !!uploadedFile });

        // Validate CID
        if (!cid) {
            throw new AppError('CID is required as query parameter', 400);
        }

        if (!ipfsService.validateCID(cid)) {
            throw new AppError('Invalid CID format', 400);
        }

        // Validate file upload
        if (!uploadedFile) {
            throw new AppError('File upload is required', 400);
        }

        // Calculate SHA256 of uploaded file
        const uploadedHash = await documentService.calculateFileHash(uploadedFile.path);

        // Get stored document metadata from IPFS
        let storedMetadata;
        try {
            storedMetadata = await documentService.getFileMetadata(cid);
        } catch (ipfsError) {
            // Clean up uploaded file
            const fs = require('fs');
            try {
                fs.unlinkSync(uploadedFile.path);
            } catch (cleanupError) {
                logger.warn(`[Document Controller] Failed to cleanup uploaded file: ${cleanupError.message}`);
            }

            logger.error(`[Document Controller] IPFS retrieval error: ${ipfsError.message}`);

            // Check if it's a 404 error
            if (ipfsError.message?.includes('404') || ipfsError.message?.includes('not found')) {
                throw new AppError('Document not found in IPFS. The CID may be invalid or the document has not been uploaded yet.', 404);
            }

            throw new AppError('Failed to retrieve document from IPFS. Please try again later.', 503);
        }

        // Compare hashes
        const isValid = uploadedHash.toLowerCase() === storedMetadata.sha256Hash.toLowerCase();

        // Clean up uploaded file
        const fs = require('fs');
        try {
            fs.unlinkSync(uploadedFile.path);
        } catch (cleanupError) {
            logger.warn(`[Document Controller] Failed to cleanup uploaded file: ${cleanupError.message}`);
        }

        if (!isValid) {
            return res.status(200).json({
                success: true,
                verified: false,
                message: 'Document verification failed - hash mismatch',
                data: {
                    cid,
                    uploadedHash: uploadedHash.toLowerCase(),
                    storedHash: storedMetadata.sha256Hash.toLowerCase(),
                    fileSize: storedMetadata.size,
                    verifiedAt: new Date().toISOString()
                }
            });
        }

        // Hash matches - try to find associated batch data
        let batchData = null;
        try {
            // Query all seed batches to find one containing this document
            const allBatches = await fabricService.queryChaincode('queryAllSeedBatches', []);

            if (allBatches && Array.isArray(allBatches)) {
                for (const batch of allBatches) {
                    const documents = batch.documents || [];
                    const matchingDoc = documents.find(doc => doc.cid === cid);

                    if (matchingDoc) {
                        batchData = {
                            batchId: batch.batchId,
                            batchNumber: batch.batchNumber,
                            varietyName: batch.varietyName,
                            producerName: batch.producerName,
                            status: batch.status,
                            quantity: batch.quantity,
                            quantityUnit: batch.quantityUnit,
                            certificationStatus: batch.certificationStatus,
                            documentType: matchingDoc.doc_type,
                            documentName: matchingDoc.filename,
                            uploadedAt: matchingDoc.uploadedAt,
                            // Certificate info if available
                            certificate: batch.certificate || null
                        };
                        break;
                    }
                }
            }
        } catch (fabricError) {
            logger.warn(`[Document Controller] Could not fetch batch data: ${fabricError.message}`);
            // Continue without batch data - verification still succeeds
        }

        res.status(200).json({
            success: true,
            verified: true,
            message: 'Document verified successfully - integrity confirmed',
            data: {
                cid,
                hash: storedMetadata.sha256Hash.toLowerCase(),
                fileSize: storedMetadata.size,
                verifiedAt: new Date().toISOString(),
                batchData
            }
        });

    } catch (error) {
        // Clean up uploaded file on error
        if (req.file) {
            const fs = require('fs');
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                logger.warn(`[Document Controller] Failed to cleanup uploaded file: ${cleanupError.message}`);
            }
        }

        logger.error(`[Document Controller] Error in public verification: ${error.message}`);
        throw new AppError(
            error.message || 'Failed to verify document',
            error.statusCode || 500
        );
    }
};

/**
 * Public certificate verification via QR Code
 * Verifies certificate number against batch ID
 * Returns certificate status and details
 */
const verifyCertificate = async (req, res) => {
    try {
        const { cert, batch } = req.query;

        logger.info(`[Document Controller] Public certificate verification`, { cert, batch });

        // Validate required params
        if (!cert) {
            throw new AppError('Certificate number (cert) is required', 400);
        }

        if (!batch) {
            throw new AppError('Batch ID (batch) is required', 400);
        }

        // Query seed batch from blockchain
        let seedBatch;
        try {
            seedBatch = await fabricService.queryChaincode('querySeedBatch', [batch]);
        } catch (fabricError) {
            logger.error(`[Document Controller] Blockchain query error: ${fabricError.message}`);

            if (fabricError.message?.includes('tidak ditemukan') || fabricError.message?.includes('not found')) {
                return res.status(200).json({
                    success: true,
                    status: 'NOT_FOUND',
                    message: 'Batch tidak ditemukan di sistem',
                    data: {
                        certNumber: cert,
                        batchId: batch,
                        valid: false,
                        verifiedAt: new Date().toISOString()
                    }
                });
            }

            throw new AppError('Failed to query blockchain', 503);
        }

        if (!seedBatch) {
            return res.status(200).json({
                success: true,
                status: 'NOT_FOUND',
                message: 'Batch tidak ditemukan di sistem',
                data: {
                    certNumber: cert,
                    batchId: batch,
                    valid: false,
                    verifiedAt: new Date().toISOString()
                }
            });
        }

        // Check if certification exists and matches
        const certification = seedBatch.certification;

        if (!certification || !certification.cert_number) {
            return res.status(200).json({
                success: true,
                status: 'NOT_CERTIFIED',
                message: 'Batch ini belum memiliki sertifikat',
                data: {
                    certNumber: cert,
                    batchId: batch,
                    valid: false,
                    batchStatus: seedBatch.status?.current || seedBatch.status,
                    verifiedAt: new Date().toISOString()
                }
            });
        }

        // Verify certificate number matches
        if (certification.cert_number !== cert) {
            return res.status(200).json({
                success: true,
                status: 'MISMATCH',
                message: 'Nomor sertifikat tidak sesuai dengan batch ini',
                data: {
                    certNumber: cert,
                    batchId: batch,
                    valid: false,
                    verifiedAt: new Date().toISOString()
                }
            });
        }

        // Determine certificate status
        let status = 'VALID';
        let statusMessage = 'Sertifikat valid dan aktif';

        // Check if revoked
        if (certification.revoked_at) {
            status = 'REVOKED';
            statusMessage = `Sertifikat telah dicabut pada ${new Date(certification.revoked_at).toLocaleDateString('id-ID')}`;
        }
        // Check if expired
        else if (certification.expires_at) {
            const expiryDate = new Date(certification.expires_at);
            if (expiryDate < new Date()) {
                status = 'EXPIRED';
                statusMessage = `Sertifikat kedaluwarsa pada ${expiryDate.toLocaleDateString('id-ID')}`;
            }
        }

        // Get issuer info
        const issuer = seedBatch.actors?.issuer || {};

        // Debug: Log the full batch structure to understand document storage
        logger.info(`[Document Controller] Batch documents debug:`, {
            documentsCount: seedBatch.documents?.length || 0,
            documents: seedBatch.documents || [],
            certification: certification,
            hasCertDocCid: !!certification.cert_doc_cid,
            certDocCid: certification.cert_doc_cid
        });

        // Find certificate document for fingerprint
        // Try multiple matching strategies since document structure may vary
        let certDocument = (seedBatch.documents || []).find(doc =>
            doc.doc_type === 'certificate' && doc.meta?.cert_number === cert
        );

        // Fallback: find any certificate document
        if (!certDocument) {
            certDocument = (seedBatch.documents || []).find(doc =>
                doc.doc_type === 'certificate'
            );
        }

        // Fallback: find document by certification cert_id
        if (!certDocument && certification.cert_id) {
            certDocument = (seedBatch.documents || []).find(doc =>
                doc.meta?.cert_id === certification.cert_id || doc.doc_id === certification.cert_id
            );
        }

        // Fallback: check if CID is stored directly in certification object
        if (!certDocument && certification.cert_doc_cid) {
            certDocument = {
                cid: certification.cert_doc_cid,
                sha256_hash: certification.cert_doc_hash || certification.sha256_hash,
                file_name: certification.cert_doc_name || `certificate-${cert}.pdf`,
                uploaded_at: certification.issued_at
            };
        }

        // Fallback: check if CID is stored in certification.document
        if (!certDocument && certification.document?.cid) {
            certDocument = {
                cid: certification.document.cid,
                sha256_hash: certification.document.sha256_hash || certification.document.hash,
                file_name: certification.document.file_name || certification.document.fileName,
                uploaded_at: certification.document.uploaded_at
            };
        }

        // Last resort: get the most recent document if any exist
        if (!certDocument && seedBatch.documents && seedBatch.documents.length > 0) {
            // Sort by uploaded_at descending and get the first one
            const sortedDocs = [...seedBatch.documents].sort((a, b) => {
                const dateA = new Date(a.uploaded_at || 0);
                const dateB = new Date(b.uploaded_at || 0);
                return dateB - dateA;
            });
            certDocument = sortedDocs[0];
        }

        logger.info(`[Document Controller] Certificate document found: ${!!certDocument}`, {
            certDocument: certDocument ? { cid: certDocument.cid, doc_type: certDocument.doc_type } : null
        });

        // Build response
        const responseData = {
            certNumber: certification.cert_number,
            certId: certification.cert_id,
            batchId: batch,
            valid: status === 'VALID',
            status,
            statusMessage,

            // Certificate details
            issuedAt: certification.issued_at,
            expiresAt: certification.expires_at,
            revokedAt: certification.revoked_at,
            revokeReason: certification.revoke_reason,

            // Issuer info
            issuer: {
                name: issuer.name || issuer.actor_name,
                organization: issuer.org || issuer.organization,
                role: issuer.role,
                issuedAt: issuer.at || issuer.timestamp
            },

            // Batch info
            batch: {
                batchNumber: seedBatch.batch_number || seedBatch.batchNumber,
                varietyName: seedBatch.variety?.name || seedBatch.varietyName,
                producerName: seedBatch.producer?.name || seedBatch.producerName,
                quantity: seedBatch.quantity?.certified || seedBatch.certifiedQuantity,
                quantityUnit: seedBatch.quantity?.qty_base_unit || seedBatch.quantityUnit || 'kg',
                status: seedBatch.status?.current || seedBatch.status
            },

            // Document fingerprint
            document: certDocument ? {
                cid: certDocument.cid,
                sha256Hash: certDocument.sha256_hash,
                fileName: certDocument.file_name,
                uploadedAt: certDocument.uploaded_at
            } : null,

            verifiedAt: new Date().toISOString()
        };

        res.status(200).json({
            success: true,
            status,
            message: statusMessage,
            data: responseData
        });

    } catch (error) {
        logger.error(`[Document Controller] Error verifying certificate: ${error.message}`);
        throw new AppError(
            error.message || 'Failed to verify certificate',
            error.statusCode || 500
        );
    }
};

module.exports = {
    getDocument,
    downloadDocument,
    verifyDocument,
    getDocumentMetadata,
    publicVerify,
    verifyCertificate
};
