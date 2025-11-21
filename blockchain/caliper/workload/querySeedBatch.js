'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for querySeedBatch transaction
 */
class QuerySeedBatchWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.batchIds = [];
    }

    /**
     * Initialize the workload module
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        // First, query all batches to get IDs for testing
        const queryRequest = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'queryAllSeedBatches',
            contractArguments: [],
            readOnly: true,
            invokerIdentity: 'producer_bpsbp'
        };

        try {
            const result = await this.sutAdapter.sendRequests(queryRequest);
            if (result && result.status === 'success') {
                const batches = JSON.parse(result.result.toString());
                this.batchIds = batches.map(b => b.id);
            }
        } catch (error) {
            console.warn('Could not fetch existing batches, will use generated IDs');
            // Generate some default batch IDs for testing
            for (let i = 0; i < 100; i++) {
                this.batchIds.push(`BATCH-${i}`);
            }
        }

        if (this.batchIds.length === 0) {
            // Fallback to generated IDs
            for (let i = 0; i < 100; i++) {
                this.batchIds.push(`BATCH-${i}`);
            }
        }
    }

    /**
     * Submit query transaction
     */
    async submitTransaction() {
        // Randomly select a batch ID
        const batchId = this.batchIds[Math.floor(Math.random() * this.batchIds.length)];

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatch',
            contractArguments: [batchId],
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
    return new QuerySeedBatchWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
