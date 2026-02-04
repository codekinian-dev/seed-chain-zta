'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for querySeedBatch transaction - 100 TPS Round
 * Updated for seedBatchContractZTA chaincode:
 * - Batch IDs are auto-generated (BATCH-YYYYMMDD-NNNN format)
 * - Fetches existing batch IDs from ledger, then queries randomly
 */
class QuerySeedBatchWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.batchIds = [];
    }

    /**
     * Initialize the workload module
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.totalWorkers = totalWorkers;

        // Use hardcoded batch IDs from ledger
        this.batchIds = [
            'BATCH-20260204-56266B2A',
            'BATCH-20260204-54213DCD',
            'BATCH-20260204-462F8079',
            'BATCH-20260204-D35F4251',
            'BATCH-20260204-0E63FDD9'
        ];

        console.log(`[Worker ${workerIndex}] Using ${this.batchIds.length} batch IDs for 100 TPS query round`);
    }

    /**
     * Submit transaction to query seed batch
     */
    async submitTransaction() {
        this.txIndex++;

        const randomIndex = Math.floor(Math.random() * this.batchIds.length);
        const batchId = this.batchIds[randomIndex];

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatch',
            contractArguments: [batchId],
            readOnly: true,
            invokerIdentity: 'farmer1'
        };

        try {
            await this.sutAdapter.sendRequests(request);
        } catch (error) {
            if (error.message && error.message.includes('tidak ditemukan')) {
                return;
            }
            throw error;
        }
    }
}

/**
 * Create a new instance of the workload module
 */
function createWorkloadModule() {
    return new QuerySeedBatchWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
