'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for querySeedBatch transaction - 150 TPS Round
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

        // Fetch existing batch IDs from ledger
        const statuses = ['REGISTERED', 'SUBMITTED', 'CERTIFIED'];

        for (const status of statuses) {
            try {
                const queryRequest = {
                    contractId: this.roundArguments.contractId,
                    contractFunction: 'querySeedBatchesByStatus',
                    contractArguments: [status],
                    readOnly: true,
                    invokerIdentity: 'appUser'
                };

                const result = await this.sutAdapter.sendRequests(queryRequest);

                // Handle different response formats
                let resultData = null;
                if (result && result.status === 'success') {
                    resultData = result.result;
                } else if (result && typeof result === 'object' && result.result) {
                    resultData = result.result;
                } else if (result && Buffer.isBuffer(result)) {
                    resultData = result;
                }

                if (resultData) {
                    const resultStr = resultData.toString();
                    console.log(`[Worker ${workerIndex}] Query ${status} raw result length: ${resultStr.length}`);

                    if (resultStr && resultStr.length > 2) {  // More than just "[]"
                        const batches = JSON.parse(resultStr);
                        if (Array.isArray(batches) && batches.length > 0) {
                            const ids = batches.map(b => b.Key || b.id || b.batch_id).filter(id => id);
                            this.batchIds.push(...ids);
                            console.log(`[Worker ${workerIndex}] Found ${ids.length} ${status} batches`);
                        }
                    }
                }
            } catch (error) {
                console.warn(`[Worker ${workerIndex}] Could not fetch ${status} batches: ${error.message}`);
            }
        }

        this.batchIds = [...new Set(this.batchIds)];

        if (this.batchIds.length === 0) {
            console.error('[QuerySeedBatch-150] ⚠️  NO BATCHES FOUND IN LEDGER!');
            console.error('[QuerySeedBatch-150] Please run Scenario A (createSeedBatch) first to populate data.');
            this.batchIds.push('BATCH-NO-DATA-FOUND');
        }

        console.log(`[Worker ${workerIndex}] Total ${this.batchIds.length} batch IDs for 150 TPS query round`);
        if (this.batchIds.length > 0 && this.batchIds.length <= 10) {
            console.log(`[Worker ${workerIndex}] Batch IDs: ${this.batchIds.join(', ')}`);
        }
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
            invokerIdentity: 'appUser'
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
