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
        this.destinations = [
            { type: 'DISTRIBUTOR', name: 'Toko Tani Bandung', address: 'Jl. Raya Bandung No. 123, Bandung' },
            { type: 'RETAILER', name: 'Koperasi Pertanian Bogor', address: 'Jl. Pajajaran No. 45, Bogor' },
            { type: 'DISTRIBUTOR', name: 'Distributor Benih Cianjur', address: 'Jl. Siliwangi No. 78, Cianjur' },
            { type: 'RETAILER', name: 'UD Maju Tani Sukabumi', address: 'Jl. Ahmad Yani No. 56, Sukabumi' },
            { type: 'DISTRIBUTOR', name: 'Toko Pertanian Garut Jaya', address: 'Jl. Otto Iskandar No. 12, Garut' },
            { type: 'RETAILER', name: 'Kios Benih Tasikmalaya', address: 'Jl. HZ Mustofa No. 34, Tasikmalaya' },
            { type: 'DISTRIBUTOR', name: 'CV Tani Makmur Kuningan', address: 'Jl. Siliwangi No. 89, Kuningan' },
            { type: 'RETAILER', name: 'Distributor Agro Majalengka', address: 'Jl. KH Abdul Halim No. 67, Majalengka' },
            { type: 'DISTRIBUTOR', name: 'Toko Tani Sumedang Sejahtera', address: 'Jl. Mayor Abdurachman No. 23, Sumedang' },
            { type: 'RETAILER', name: 'Koperasi Benih Purwakarta', address: 'Jl. RE Martadinata No. 45, Purwakarta' }
        ];
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        const queryRequest = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatchesByStatus',
            contractArguments: ['CERTIFIED'],
            readOnly: true,
            invokerIdentity: 'farmer1'  // farmer1 has role_producer
        };

        try {
            const result = await this.sutAdapter.sendRequests(queryRequest);
            if (result && result.status === 'success') {
                const batches = JSON.parse(result.result.toString());
                this.batchIds = batches.map(b => b.Key);
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
        const destination = this.destinations[Math.floor(Math.random() * this.destinations.length)];

        // Random quantity between 100-5000 kg
        const quantity = (100 + Math.floor(Math.random() * 4900)).toString();

        // New parameters for updated chaincode
        const evidenceDocName = `Bukti Distribusi ke ${destination.name}`;
        const evidenceIpfsCid = `Qm${this.generateRandomHash(44)}`;
        const evidenceDocHash = this.generateSHA256Hash(); // SHA256 hash (64 hex chars)

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'distributeSeed',
            contractArguments: [
                batchId,
                destination.type,       // destinationType: DISTRIBUTOR or RETAILER
                destination.name,       // destinationName
                destination.address,    // destinationAddress
                quantity,
                evidenceDocName,
                evidenceIpfsCid,
                evidenceDocHash
            ],
            readOnly: false,
            invokerIdentity: 'farmer1'  // farmer1 has role_producer
        };

        await this.sutAdapter.sendRequests(request);
    }

    generateRandomHash(length) {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateSHA256Hash() {
        const hexChars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < 64; i++) {
            result += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
        }
        return result;
    }
}

function createWorkloadModule() {
    return new DistributeSeedWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
