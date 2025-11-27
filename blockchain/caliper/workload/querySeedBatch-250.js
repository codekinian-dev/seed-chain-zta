'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const dataset = require('./seed-batch-dataset.json');

/**
 * Workload module for querySeedBatch transaction - 250 TPS Round
 * Queries batches from BATCH-50000 to BATCH-64999
 */
class QuerySeedBatchWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.datasetOffset = 50000; // Offset for 250 TPS round
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

        // Query from the same range as createSeedBatch-250.js (BATCH-50000 to BATCH-64999)
        // Use random selection within this specific range
        const rangeSize = 15000; // 250 TPS creates 15000 batches (250 TPS * 60s)
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
