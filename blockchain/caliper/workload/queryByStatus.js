'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for querySeedBatchesByStatus transaction
 */
class QueryByStatusWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.statuses = ['REGISTERED', 'SUBMITTED', 'INSPECTED', 'EVALUATED', 'CERTIFIED', 'DISTRIBUTED', 'REVOKED'];
    }

    /**
     * Submit query by status transaction
     */
    async submitTransaction() {
        // Randomly select a status
        const status = this.statuses[Math.floor(Math.random() * this.statuses.length)];

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatchesByStatus',
            contractArguments: [status],
            readOnly: true,
            invokerIdentity: 'producer_bpsbp'
        };

        await this.sutAdapter.sendRequests(request);
    }
}

/**
 * Create a new instance of the workload module
 */
function createWorkloadModule() {
    return new QueryByStatusWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
