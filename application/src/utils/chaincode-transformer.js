/**
 * Chaincode Data Transformer
 * Transforms nested chaincode structure to API-friendly format
 * and provides helper functions for extracting data
 */

/**
 * Extract actual batch data from various response formats
 * @param {Object} data - Raw data that might be wrapped in different ways
 * @returns {Object} The actual batch data
 */
const extractBatchData = (data) => {
    if (!data) return null;

    // If data has transactionId, the batch is inside it
    if (data.transactionId && data.transactionId.id) {
        return data.transactionId;
    }

    // If data has id directly, it's the batch itself
    if (data.id && data.doc_type === 'SeedBatch') {
        return data;
    }

    // Return as-is
    return data;
};

/**
 * Transform nested chaincode structure to flat API response
 * @param {Object} chaincodeData - Raw data from chaincode with nested structure
 * @returns {Object} Transformed data for API response
 */
const transformChaincodeToAPI = (chaincodeData) => {
    if (!chaincodeData) return null;

    // Handle array of batches (from queryAll)
    if (Array.isArray(chaincodeData)) {
        return chaincodeData.map(item => {
            if (item.Record) {
                return {
                    key: item.Key,
                    ...transformSingleBatch(extractBatchData(item.Record))
                };
            }
            return transformSingleBatch(extractBatchData(item));
        });
    }

    // Handle single batch - extract actual batch data first
    return transformSingleBatch(extractBatchData(chaincodeData));
};

/**
 * Transform single seed batch from nested to API format
 * @param {Object} batch - Single batch with nested structure (already extracted)
 * @returns {Object} Transformed batch
 */
const transformSingleBatch = (batch) => {
    if (!batch) return null;

    const transformed = {
        // Top level
        id: batch.id,
        doc_type: batch.doc_type,
        schema_version: batch.schema_version,

        // Batch info (flattened)
        batch_code: batch.batch?.batch_code,
        variety_name: batch.batch?.variety_name,
        commodity: batch.batch?.commodity,
        seed_class: batch.batch?.seed_class,
        label_color: batch.batch?.label_color,

        // Seed source (flattened)
        seed_source_number: batch.seed_source?.seed_source_number,
        iup_number: batch.seed_source?.iupb_number_ref,
        harvest_date: batch.seed_source?.harvest?.harvest_date,
        origin: batch.seed_source?.origin?.region || '',
        origin_detail: batch.seed_source?.origin, // Keep full origin object

        // Certification (flattened) - map from nested certification object
        cert_number: batch.certification?.cert_number,
        cert_id: batch.certification?.cert_id,
        cert_issued_at: batch.certification?.issued_at,
        cert_expires_at: batch.certification?.expires_at,
        cert_issue_date: batch.certification?.issued_at, // Alias for frontend compatibility
        cert_expiry_date: batch.certification?.expires_at, // Alias for frontend compatibility
        cert_revoked_at: batch.certification?.revoked_at,
        cert_revoke_reason: batch.certification?.revoke_reason,

        // Keep full certification object for reference
        certification: batch.certification,

        // Quantity tracking
        quantity: batch.quantity,

        // Status
        current_status: batch.status?.current,
        status_since: batch.status?.since,

        // Actors (keep as nested for easier access)
        actors: batch.actors,

        // Documents and events (keep as arrays)
        documents: batch.documents || [],
        events: batch.events || [],

        // Distributions array
        distributions: batch.distributions || [],

        // Audit trail
        created_at: batch.audit?.created_at,
        created_by: batch.audit?.created_by_ref,
        last_modified_at: batch.audit?.last_modified_at,
        last_modified_by: batch.audit?.last_modified_by_ref,
        updated_at: batch.audit?.last_modified_at, // Alias
        revision: batch.audit?.revision
    };

    // Add rejection count if exists (for REJECT handling)
    if (batch.rejection_count !== undefined) {
        transformed.rejection_count = batch.rejection_count;
    }

    return transformed;
};

/**
 * Extract actor information by role
 * @param {Object} batch - Seed batch with nested structure
 * @param {String} role - Role name: 'producer', 'inspector_field', 'inspector_chief', 'issuer'
 * @returns {Object|null} Actor information or null if not found
 */
const getActor = (batch, role) => {
    return batch?.actors?.[role] || null;
};

/**
 * Get producer information
 * @param {Object} batch - Seed batch
 * @returns {Object|null} Producer actor
 */
const getProducer = (batch) => getActor(batch, 'producer');

/**
 * Get field inspector information
 * @param {Object} batch - Seed batch
 * @returns {Object|null} Field inspector actor
 */
const getFieldInspector = (batch) => getActor(batch, 'inspector_field');

/**
 * Get chief inspector information
 * @param {Object} batch - Seed batch
 * @returns {Object|null} Chief inspector actor
 */
const getChiefInspector = (batch) => getActor(batch, 'inspector_chief');

/**
 * Get issuer information
 * @param {Object} batch - Seed batch
 * @returns {Object|null} Issuer actor
 */
const getIssuer = (batch) => getActor(batch, 'issuer');

/**
 * Get latest event
 * @param {Object} batch - Seed batch
 * @returns {Object|null} Latest event
 */
const getLatestEvent = (batch) => {
    const events = batch?.events || [];
    return events.length > 0 ? events[events.length - 1] : null;
};

/**
 * Get events by type
 * @param {Object} batch - Seed batch
 * @param {String} type - Event type
 * @returns {Array} Events matching type
 */
const getEventsByType = (batch, type) => {
    const events = batch?.events || [];
    return events.filter(e => e.type === type);
};

/**
 * Get document by type
 * @param {Object} batch - Seed batch
 * @param {String} docType - Document type
 * @returns {Object|null} First matching document
 */
const getDocumentByType = (batch, docType) => {
    const docs = batch?.documents || [];
    return docs.find(d => d.doc_type === docType) || null;
};

/**
 * Get all documents by type
 * @param {Object} batch - Seed batch
 * @param {String} docType - Document type
 * @returns {Array} All matching documents
 */
const getDocumentsByType = (batch, docType) => {
    const docs = batch?.documents || [];
    return docs.filter(d => d.doc_type === docType);
};

/**
 * Check if certificate is valid (not expired, not revoked)
 * @param {Object} batch - Seed batch
 * @returns {Boolean} True if certificate is valid
 */
const isCertificateValid = (batch) => {
    if (!batch?.certification?.cert_number) return false;
    if (batch.certification.revoked_at) return false;

    const now = new Date();
    const expiresAt = new Date(batch.certification.expires_at);

    return now <= expiresAt;
};

/**
 * Get certificate status with reason
 * @param {Object} batch - Seed batch
 * @returns {Object} Status object {valid, reason}
 */
const getCertificateStatus = (batch) => {
    if (!batch?.certification?.cert_number) {
        return { valid: false, reason: 'No certificate issued' };
    }

    if (batch.certification.revoked_at) {
        return {
            valid: false,
            reason: 'Certificate revoked',
            revoked_at: batch.certification.revoked_at,
            revoke_reason: batch.certification.revoke_reason
        };
    }

    const now = new Date();
    const expiresAt = new Date(batch.certification.expires_at);

    if (now > expiresAt) {
        return {
            valid: false,
            reason: 'Certificate expired',
            expires_at: batch.certification.expires_at
        };
    }

    return {
        valid: true,
        reason: 'Certificate is valid',
        expires_at: batch.certification.expires_at
    };
};

/**
 * Transform history data to include nested structure parsing
 * @param {Array} history - History from chaincode
 * @returns {Array} Transformed history
 */
const transformHistory = (history) => {
    if (!Array.isArray(history)) return [];

    return history.map(item => ({
        timestamp: item.timestamp,
        txId: item.txId,
        isDelete: item.isDelete,
        data: item.isDelete ? 'ASSET DELETED' : transformSingleBatch(extractBatchData(item.data))
    }));
};

module.exports = {
    transformChaincodeToAPI,
    transformSingleBatch,
    transformHistory,
    extractBatchData,

    // Actor getters
    getActor,
    getProducer,
    getFieldInspector,
    getChiefInspector,
    getIssuer,

    // Event helpers
    getLatestEvent,
    getEventsByType,

    // Document helpers
    getDocumentByType,
    getDocumentsByType,

    // Certificate validation
    isCertificateValid,
    getCertificateStatus
};
