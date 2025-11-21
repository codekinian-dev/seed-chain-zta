'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for issueCertificate transaction
 */
class IssueCertificateWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.batchIds = [];
        this.txIndex = 0;
        this.issuerUUID = '850e8400-e29b-41d4-a716-446655440001';
        this.usedCertNumbers = new Set();
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        const queryRequest = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatchesByStatus',
            contractArguments: ['EVALUATED'],
            readOnly: true,
            invokerIdentity: 'appUser'
        };

        try {
            const result = await this.sutAdapter.sendRequests(queryRequest);
            if (result && result.status === 'success') {
                const batches = JSON.parse(result.result.toString());
                this.batchIds = batches.map(b => b.id);
            }
        } catch (error) {
            console.warn('Could not fetch EVALUATED batches');
        }
    }

    async submitTransaction() {
        if (this.batchIds.length === 0) {
            console.warn('No EVALUATED batches available for certificate issuance');
            return;
        }

        this.txIndex++;

        const batchId = this.batchIds[Math.floor(Math.random() * this.batchIds.length)];

        // Generate unique certificate number
        let certNumber;
        do {
            certNumber = `CERT-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        } while (this.usedCertNumbers.has(certNumber));

        this.usedCertNumbers.add(certNumber);

        // Random expiry between 12-36 months
        const expiryMonths = 12 + Math.floor(Math.random() * 25);

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'issueCertificate',
            contractArguments: [
                batchId,
                certNumber,
                expiryMonths.toString(),
                this.issuerUUID  // UUID parameter now required
            ],
            readOnly: false,
            invokerIdentity: 'appUser'  // Single appUser
        };

        await this.sutAdapter.sendRequests(request);
    }
}

function createWorkloadModule() {
    return new IssueCertificateWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
