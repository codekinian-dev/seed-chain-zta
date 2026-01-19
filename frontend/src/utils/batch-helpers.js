/**
 * Batch Helper Utilities
 * Helper functions untuk work dengan seed batch structure
 */

/**
 * Get actor information by role
 * @param {Object} batch - Seed batch object
 * @param {String} role - Actor role: 'producer', 'inspector_field', 'inspector_chief', 'issuer'
 * @returns {Object|null} Actor information
 */
export function getActor(batch, role) {
    return batch?.actors?.[role] || null
}

/**
 * Get producer information
 * @param {Object} batch - Seed batch
 * @returns {Object|null}
 */
export function getProducer(batch) {
    return getActor(batch, 'producer')
}

/**
 * Get field inspector
 * @param {Object} batch - Seed batch
 * @returns {Object|null}
 */
export function getFieldInspector(batch) {
    return getActor(batch, 'inspector_field')
}

/**
 * Get chief inspector
 * @param {Object} batch - Seed batch
 * @returns {Object|null}
 */
export function getChiefInspector(batch) {
    return getActor(batch, 'inspector_chief')
}

/**
 * Get issuer
 * @param {Object} batch - Seed batch
 * @returns {Object|null}
 */
export function getIssuer(batch) {
    return getActor(batch, 'issuer')
}

/**
 * Get latest event
 * @param {Object} batch - Seed batch
 * @returns {Object|null}
 */
export function getLatestEvent(batch) {
    const events = batch?.events || []
    return events.length > 0 ? events[events.length - 1] : null
}

/**
 * Get events by type
 * @param {Object} batch - Seed batch
 * @param {String} type - Event type
 * @returns {Array}
 */
export function getEventsByType(batch, type) {
    const events = batch?.events || []
    return events.filter(e => e.type === type)
}

/**
 * Get document by type
 * @param {Object} batch - Seed batch
 * @param {String} docType - Document type
 * @returns {Object|null}
 */
export function getDocumentByType(batch, docType) {
    const docs = batch?.documents || []
    return docs.find(d => d.doc_type === docType) || null
}

/**
 * Get all documents by type
 * @param {Object} batch - Seed batch
 * @param {String} docType - Document type
 * @returns {Array}
 */
export function getDocumentsByType(batch, docType) {
    const docs = batch?.documents || []
    return docs.filter(d => d.doc_type === docType)
}

/**
 * Check if certificate is valid
 * @param {Object} batch - Seed batch
 * @returns {Boolean}
 */
export function isCertificateValid(batch) {
    if (!batch?.cert_number) return false
    if (batch.cert_revoked_at) return false

    const now = new Date()
    const expiresAt = new Date(batch.cert_expires_at)

    return now <= expiresAt
}

/**
 * Get certificate status
 * @param {Object} batch - Seed batch
 * @returns {Object} {valid, reason, ...}
 */
export function getCertificateStatus(batch) {
    if (!batch?.cert_number) {
        return { valid: false, reason: 'No certificate issued' }
    }

    if (batch.cert_revoked_at) {
        return {
            valid: false,
            reason: 'Certificate revoked',
            revoked_at: batch.cert_revoked_at,
            revoke_reason: batch.cert_revoke_reason
        }
    }

    const now = new Date()
    const expiresAt = new Date(batch.cert_expires_at)

    if (now > expiresAt) {
        return {
            valid: false,
            reason: 'Certificate expired',
            expires_at: batch.cert_expires_at
        }
    }

    return {
        valid: true,
        reason: 'Certificate is valid',
        expires_at: batch.cert_expires_at
    }
}

/**
 * Get actor by uploader_ref from documents/events
 * @param {Object} batch - Seed batch
 * @param {String} ref - Actor ref (producer, inspector_field, etc)
 * @returns {Object|null}
 */
export function getActorByRef(batch, ref) {
    return batch?.actors?.[ref] || null
}

/**
 * Format event type untuk display
 * @param {String} type - Event type
 * @returns {String}
 */
export function formatEventType(type) {
    const typeMap = {
        'CREATED': 'Batch Created',
        'SUBMITTED': 'Certification Submitted',
        'FIELD_INSPECTED': 'Field Inspection',
        'CHIEF_EVALUATED': 'Chief Evaluation',
        'CERT_ISSUED': 'Certificate Issued',
        'DISTRIBUTED': 'Seed Distributed',
        'CERT_REVOKED': 'Certificate Revoked'
    }
    return typeMap[type] || type
}

/**
 * Format document type untuk display
 * @param {String} type - Document type
 * @returns {String}
 */
export function formatDocumentType(type) {
    const typeMap = {
        'seed_source': 'Seed Source Document',
        'certification_request': 'Certification Request',
        'field_inspection': 'Field Inspection Report',
        'chief_evaluation': 'Chief Evaluation',
        'certificate': 'Certificate',
        'distribution': 'Distribution Proof',
        'revocation': 'Revocation Notice'
    }
    return typeMap[type] || type
}

/**
 * Get IPFS gateway URL
 * @param {String} cid - IPFS CID
 * @param {String} gateway - Gateway URL (default: public IPFS gateway)
 * @returns {String}
 */
export function getIPFSUrl(cid, gateway = 'https://ipfs.jabarchain.me/ipfs/') {
    if (!cid) return ''
    return `${gateway}${cid}`
}

/**
 * Get origin display string
 * @param {Object} batch - Seed batch
 * @returns {String}
 */
export function getOriginDisplay(batch) {
    if (batch.origin_detail) {
        const { region, province, country } = batch.origin_detail
        const parts = [region, province, country].filter(Boolean)
        return parts.join(', ')
    }
    return batch.origin || 'N/A'
}

/**
 * Get event icon class
 * @param {String} type - Event type
 * @returns {String}
 */
export function getEventIconClass(type) {
    const iconMap = {
        'CREATED': 'text-blue-500',
        'SUBMITTED': 'text-yellow-500',
        'FIELD_INSPECTED': 'text-indigo-500',
        'CHIEF_EVALUATED': 'text-purple-500',
        'CERT_ISSUED': 'text-green-500',
        'DISTRIBUTED': 'text-cyan-500',
        'CERT_REVOKED': 'text-red-500'
    }
    return iconMap[type] || 'text-gray-500'
}

/**
 * Sort events by timestamp
 * @param {Array} events - Events array
 * @param {Boolean} ascending - Sort order
 * @returns {Array}
 */
export function sortEventsByTime(events, ascending = true) {
    if (!Array.isArray(events)) return []

    return [...events].sort((a, b) => {
        const timeA = new Date(a.at).getTime()
        const timeB = new Date(b.at).getTime()
        return ascending ? timeA - timeB : timeB - timeA
    })
}

/**
 * Build timeline dari events
 * @param {Object} batch - Seed batch
 * @returns {Array} Timeline items dengan actor info
 */
export function buildTimeline(batch) {
    const events = batch?.events || []
    return events.map(event => ({
        ...event,
        actor: getActorByRef(batch, event.actor_ref),
        document: batch.documents?.find(d => d.doc_id === event.ref_doc_id),
        formattedType: formatEventType(event.type),
        iconClass: getEventIconClass(event.type)
    }))
}
