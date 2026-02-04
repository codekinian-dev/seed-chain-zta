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

        this.workerIndex = workerIndex;

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
                this.batchIds = batches.map(b => b.Key);
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
            certNumber = `CERT-${Date.now()}-${this.workerIndex}-${Math.floor(Math.random() * 100000)}`;
        } while (this.usedCertNumbers.has(certNumber));

        this.usedCertNumbers.add(certNumber);

        // Random expiry between 12-36 months
        const expiryMonths = 12 + Math.floor(Math.random() * 25);

        // New parameters for updated chaincode
        const certDocumentName = `Sertifikat Benih ${certNumber}`;
        const certIpfsCid = `Qm${this.generateRandomHash(44)}`;
        const certifiedQuantity = (1000 + Math.floor(Math.random() * 99000)).toString(); // 1000-100000 units
        const docHash = this.generateSHA256Hash(); // SHA256 hash (64 hex chars)

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'issueCertificate',
            contractArguments: [
                batchId,
                certNumber,
                expiryMonths.toString(),
                certDocumentName,
                certIpfsCid,
                this.issuerUUID,
                certifiedQuantity,
                docHash
            ],
            readOnly: false,
            invokerIdentity: 'appUser'  // Single appUser
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
    return new IssueCertificateWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
