/**
 * API Services Index
 * Central export for all API services
 */

import identityService from './identity.service'
import seedBatchService from './seed-batch.service'
import healthService from './health.service'

export {
    identityService,
    seedBatchService,
    healthService,
}

export default {
    identity: identityService,
    seedBatch: seedBatchService,
    health: healthService,
}
