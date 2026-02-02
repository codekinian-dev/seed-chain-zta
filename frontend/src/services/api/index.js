/**
 * API Services Index
 * Central export for all API services
 */

import identityService from './identity.service'
import seedBatchService from './seed-batch.service'
import healthService from './health.service'
import documentService from './document.service'

export {
    identityService,
    seedBatchService,
    healthService,
    documentService,
}

export default {
    identity: identityService,
    seedBatch: seedBatchService,
    health: healthService,
    document: documentService,
}
