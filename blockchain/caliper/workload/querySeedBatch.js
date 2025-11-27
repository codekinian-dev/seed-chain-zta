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
            invokerIdentity: 'appUser'
        };

        try {
            const result = await this.sutAdapter.sendRequests(queryRequest);
            if (result && result.status === 'success') {
                const batches = JSON.parse(result.result.toString());
                this.batchIds = batches.map(b => b.Key);
                console.log(`[Worker ${workerIndex}] Berhasil mengambil ${this.batchIds.length} ID benih dari ledger.`);
            } else {
                console.warn(`[Worker ${workerIndex}] Gagal mengambil data benih. Status: ${result.status}`);
            }
        } catch (error) {
            console.warn(`[Worker ${workerIndex}] Error saat mengambil data awal: ${error.message}`);
            // Generate some default batch IDs for testing (assuming Worker 0 created them)
            for (let i = 1; i <= 100; i++) {
                this.batchIds.push(`BATCH-${i}`);
            }
        }

        if (this.batchIds.length === 0) {
            console.warn(`[Worker ${workerIndex}] TIDAK ADA DATA DI LEDGER. Menggunakan ID dummy (akan error 500).`);
            // Fallback to generated IDs
            for (let i = 1; i <= 100; i++) {
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
