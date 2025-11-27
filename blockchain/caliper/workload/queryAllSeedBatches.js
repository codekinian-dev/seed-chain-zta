'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for queryAllSeedBatches transaction
 */
class QueryAllSeedBatchesWorkload extends WorkloadModuleBase {
    constructor() {
        super();
    }

    /**
     * Submit query all transaction
     */
    async submitTransaction() {
        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'queryAllSeedBatches',
            contractArguments: [],
            readOnly: true,
            invokerIdentity: 'appUser'
        };

        await this.sutAdapter.sendRequests(request);
    }
}

/**
 * Create a new instance of the workload module
 */
function createWorkloadModule() {
    return new QueryAllSeedBatchesWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
