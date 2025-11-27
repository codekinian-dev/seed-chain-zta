'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const dataset = require('./seed-batch-dataset.json');

/**
 * Workload module for querySeedBatch transaction - 200 TPS Round
 * Queries batches from BATCH-30000 to BATCH-41999
 */
class QuerySeedBatchWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.datasetOffset = 30000; // Offset for 200 TPS round
    }

    /**
     * Initialize the workload module
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.totalWorkers = totalWorkers;
    }

    /**
     * Submit transaction to query seed batch
     */
    async submitTransaction() {
        this.txIndex++;

        // Query from the same range as createSeedBatch-200.js (BATCH-30000 to BATCH-41999)
        // Use random selection within this specific range
        const rangeSize = 12000; // 200 TPS creates 12000 batches (200 TPS * 60s)
        const randomOffset = Math.floor(Math.random() * rangeSize);
        const dataIndex = (this.datasetOffset + randomOffset) % dataset.length;
        const batchId = dataset[dataIndex].batchId;

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatch',
            contractArguments: [batchId],
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
    return new QuerySeedBatchWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
