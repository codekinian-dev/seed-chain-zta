'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for distributeSeed transaction
 */
class DistributeSeedWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.batchIds = [];
        this.txIndex = 0;
        this.locations = [
            'Toko Tani Bandung',
            'Koperasi Pertanian Bogor',
            'Distributor Benih Cianjur',
            'UD Maju Tani Sukabumi',
            'Toko Pertanian Garut Jaya',
            'Kios Benih Tasikmalaya',
            'CV Tani Makmur Kuningan',
            'Distributor Agro Majalengka',
            'Toko Tani Sumedang Sejahtera',
            'Koperasi Benih Purwakarta'
        ];
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        const queryRequest = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatchesByStatus',
            contractArguments: ['CERTIFIED'],
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
            console.warn('Could not fetch CERTIFIED batches');
        }
    }

    async submitTransaction() {
        if (this.batchIds.length === 0) {
            console.warn('No CERTIFIED batches available for distribution');
            return;
        }

        this.txIndex++;

        const batchId = this.batchIds[Math.floor(Math.random() * this.batchIds.length)];
        const location = this.locations[Math.floor(Math.random() * this.locations.length)];

        // Random quantity between 100-5000 kg
        const quantity = (100 + Math.floor(Math.random() * 4900)).toString();

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'distributeSeed',
            contractArguments: [
                batchId,
                location,
                quantity
            ],
            readOnly: false,
            invokerIdentity: 'producer_bpsbp'
        };

        await this.sutAdapter.sendRequests(request);
    }
}

function createWorkloadModule() {
    return new DistributeSeedWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
