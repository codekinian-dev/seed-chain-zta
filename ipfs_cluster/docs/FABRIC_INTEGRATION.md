# Hyperledger Fabric Integration Guide

Panduan integrasi IPFS Cluster dengan Hyperledger Fabric untuk sistem sertifikasi benih perkebunan.

##  Arsitektur Integrasi

```

                  Application Layer                          
  (Node.js/Go Backend + Fabric SDK + IPFS HTTP Client)      

                                   
                                   
              
          Hyperledger           IPFS    
            Fabric            Cluster   
                                        
          - Chaincode        - Node 1   
          - Ledger           - Node 2   
          - CID Hash         - Auto Pin 
              
                                   
                                   
        Metadata Only         Full Document
        (CID, Timestamp,      (PDF, Images,
         Cert Info)            Attachments)
```

##  Konsep Utama

### 1. Data Separation
- **Blockchain (Fabric)**: Menyimpan metadata dan IPFS CID hash
- **IPFS**: Menyimpan file dokumen aktual (PDF, gambar, dll)

### 2. Workflow
1. Upload dokumen  IPFS Cluster
2. Dapatkan CID dari IPFS
3. Submit transaksi ke Fabric dengan CID
4. Fabric menyimpan CID di ledger
5. Auto-replication via IPFS Cluster

##  Chaincode Example (Go)

### Certificate Chaincode

```go
package main

import (
    "encoding/json"
    "fmt"
    "time"

    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Certificate represents a plantation seed certificate
type Certificate struct {
    CertID        string    `json:"certId"`
    SeedType      string    `json:"seedType"`
    Producer      string    `json:"producer"`
    IssueDate     time.Time `json:"issueDate"`
    ExpiryDate    time.Time `json:"expiryDate"`
    DocumentCID   string    `json:"documentCid"`   // IPFS CID for main document
    AttachmentCIDs []string `json:"attachmentCids"` // IPFS CIDs for attachments
    Status        string    `json:"status"`
    CreatedAt     time.Time `json:"createdAt"`
    UpdatedAt     time.Time `json:"updatedAt"`
    CreatedBy     string    `json:"createdBy"`
}

// SmartContract provides functions for managing certificates
type SmartContract struct {
    contractapi.Contract
}

// RegisterCertificate creates a new certificate record with IPFS CID
func (s *SmartContract) RegisterCertificate(ctx contractapi.TransactionContextInterface,
    certID string, seedType string, producer string, issueDateStr string,
    expiryDateStr string, documentCID string) error {

    // Check if certificate already exists
    exists, err := s.CertificateExists(ctx, certID)
    if err != nil {
        return err
    }
    if exists {
        return fmt.Errorf("certificate %s already exists", certID)
    }

    // Parse dates
    issueDate, err := time.Parse("2006-01-02", issueDateStr)
    if err != nil {
        return fmt.Errorf("invalid issue date format: %v", err)
    }
    expiryDate, err := time.Parse("2006-01-02", expiryDateStr)
    if err != nil {
        return fmt.Errorf("invalid expiry date format: %v", err)
    }

    // Get transaction timestamp
    txTimestamp, err := ctx.GetStub().GetTxTimestamp()
    if err != nil {
        return err
    }
    createdAt := time.Unix(txTimestamp.Seconds, 0)

    // Get submitter identity
    clientID, err := ctx.GetClientIdentity().GetID()
    if err != nil {
        return err
    }

    // Create certificate
    certificate := Certificate{
        CertID:         certID,
        SeedType:       seedType,
        Producer:       producer,
        IssueDate:      issueDate,
        ExpiryDate:     expiryDate,
        DocumentCID:    documentCID,
        AttachmentCIDs: []string{},
        Status:         "active",
        CreatedAt:      createdAt,
        UpdatedAt:      createdAt,
        CreatedBy:      clientID,
    }

    certificateJSON, err := json.Marshal(certificate)
    if err != nil {
        return err
    }

    return ctx.GetStub().PutState(certID, certificateJSON)
}

// GetCertificate retrieves a certificate by ID
func (s *SmartContract) GetCertificate(ctx contractapi.TransactionContextInterface,
    certID string) (*Certificate, error) {

    certificateJSON, err := ctx.GetStub().GetState(certID)
    if err != nil {
        return nil, fmt.Errorf("failed to read certificate: %v", err)
    }
    if certificateJSON == nil {
        return nil, fmt.Errorf("certificate %s does not exist", certID)
    }

    var certificate Certificate
    err = json.Unmarshal(certificateJSON, &certificate)
    if err != nil {
        return nil, err
    }

    return &certificate, nil
}

// AddAttachment adds an IPFS CID for an attachment to a certificate
func (s *SmartContract) AddAttachment(ctx contractapi.TransactionContextInterface,
    certID string, attachmentCID string) error {

    certificate, err := s.GetCertificate(ctx, certID)
    if err != nil {
        return err
    }

    // Add attachment CID
    certificate.AttachmentCIDs = append(certificate.AttachmentCIDs, attachmentCID)

    // Update timestamp
    txTimestamp, err := ctx.GetStub().GetTxTimestamp()
    if err != nil {
        return err
    }
    certificate.UpdatedAt = time.Unix(txTimestamp.Seconds, 0)

    certificateJSON, err := json.Marshal(certificate)
    if err != nil {
        return err
    }

    return ctx.GetStub().PutState(certID, certificateJSON)
}

// RevokeCertificate marks a certificate as revoked
func (s *SmartContract) RevokeCertificate(ctx contractapi.TransactionContextInterface,
    certID string, reason string) error {

    certificate, err := s.GetCertificate(ctx, certID)
    if err != nil {
        return err
    }

    if certificate.Status == "revoked" {
        return fmt.Errorf("certificate %s is already revoked", certID)
    }

    certificate.Status = "revoked"

    // Update timestamp
    txTimestamp, err := ctx.GetStub().GetTxTimestamp()
    if err != nil {
        return err
    }
    certificate.UpdatedAt = time.Unix(txTimestamp.Seconds, 0)

    certificateJSON, err := json.Marshal(certificate)
    if err != nil {
        return err
    }

    return ctx.GetStub().PutState(certID, certificateJSON)
}

// CertificateExists checks if a certificate exists
func (s *SmartContract) CertificateExists(ctx contractapi.TransactionContextInterface,
    certID string) (bool, error) {

    certificateJSON, err := ctx.GetStub().GetState(certID)
    if err != nil {
        return false, fmt.Errorf("failed to read certificate: %v", err)
    }

    return certificateJSON != nil, nil
}

// GetAllCertificates returns all certificates
func (s *SmartContract) GetAllCertificates(ctx contractapi.TransactionContextInterface) ([]*Certificate, error) {
    resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
    if err != nil {
        return nil, err
    }
    defer resultsIterator.Close()

    var certificates []*Certificate
    for resultsIterator.HasNext() {
        queryResponse, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }

        var certificate Certificate
        err = json.Unmarshal(queryResponse.Value, &certificate)
        if err != nil {
            return nil, err
        }
        certificates = append(certificates, &certificate)
    }

    return certificates, nil
}

func main() {
    chaincode, err := contractapi.NewChaincode(&SmartContract{})
    if err != nil {
        fmt.Printf("Error creating certificate chaincode: %v\n", err)
        return
    }

    if err := chaincode.Start(); err != nil {
        fmt.Printf("Error starting certificate chaincode: %v\n", err)
    }
}
```

##  Application Integration (Node.js)

### Backend Service Example

```javascript
// certificate-service.js
const { Gateway, Wallets } = require('fabric-network');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class CertificateService {
    constructor(fabricConfig, ipfsConfig) {
        this.fabricConfig = fabricConfig;
        this.ipfsConfig = ipfsConfig;
        this.gateway = null;
        this.contract = null;
    }

    // Initialize Fabric connection
    async connect() {
        const wallet = await Wallets.newFileSystemWallet(this.fabricConfig.walletPath);
        this.gateway = new Gateway();
        
        await this.gateway.connect(this.fabricConfig.connectionProfile, {
            wallet,
            identity: this.fabricConfig.userId,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await this.gateway.getNetwork(this.fabricConfig.channelName);
        this.contract = network.getContract(this.fabricConfig.chaincodeName);
    }

    // Upload document to IPFS
    async uploadToIPFS(filePath) {
        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath));

            const response = await axios.post(
                `${this.ipfsConfig.apiUrl}/api/v0/add`,
                formData,
                {
                    headers: formData.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            const cid = response.data.Hash;
            console.log(`File uploaded to IPFS: ${cid}`);

            // Pin to cluster for replication
            await this.pinToCluster(cid);

            return cid;
        } catch (error) {
            throw new Error(`IPFS upload failed: ${error.message}`);
        }
    }

    // Pin CID to IPFS Cluster for automatic replication
    async pinToCluster(cid) {
        try {
            await axios.post(
                `${this.ipfsConfig.clusterApiUrl}/pins/${cid}`,
                {
                    replication_factor_min: 2,
                    replication_factor_max: 2,
                    name: `certificate-${cid}`
                }
            );
            console.log(`CID ${cid} pinned to cluster`);
        } catch (error) {
            console.warn(`Cluster pin warning: ${error.message}`);
        }
    }

    // Download document from IPFS
    async downloadFromIPFS(cid, outputPath) {
        try {
            const response = await axios.get(
                `${this.ipfsConfig.gatewayUrl}/ipfs/${cid}`,
                { responseType: 'stream' }
            );

            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (error) {
            throw new Error(`IPFS download failed: ${error.message}`);
        }
    }

    // Register certificate on blockchain
    async registerCertificate(certData, documentPath) {
        try {
            // 1. Upload document to IPFS
            const documentCID = await this.uploadToIPFS(documentPath);
            console.log(`Document CID: ${documentCID}`);

            // 2. Submit transaction to Fabric
            await this.contract.submitTransaction(
                'RegisterCertificate',
                certData.certId,
                certData.seedType,
                certData.producer,
                certData.issueDate,
                certData.expiryDate,
                documentCID
            );

            console.log(`Certificate ${certData.certId} registered on blockchain`);

            return {
                certId: certData.certId,
                documentCID: documentCID,
                transactionId: this.contract.getTransactionId()
            };
        } catch (error) {
            throw new Error(`Certificate registration failed: ${error.message}`);
        }
    }

    // Add attachment to existing certificate
    async addAttachment(certId, attachmentPath) {
        try {
            // 1. Upload attachment to IPFS
            const attachmentCID = await this.uploadToIPFS(attachmentPath);

            // 2. Add attachment CID to certificate
            await this.contract.submitTransaction(
                'AddAttachment',
                certId,
                attachmentCID
            );

            console.log(`Attachment added to certificate ${certId}`);

            return {
                certId: certId,
                attachmentCID: attachmentCID
            };
        } catch (error) {
            throw new Error(`Add attachment failed: ${error.message}`);
        }
    }

    // Get certificate with document
    async getCertificate(certId, downloadDocument = false, outputDir = './downloads') {
        try {
            // 1. Get certificate from blockchain
            const result = await this.contract.evaluateTransaction(
                'GetCertificate',
                certId
            );
            const certificate = JSON.parse(result.toString());

            // 2. Optionally download document from IPFS
            if (downloadDocument && certificate.documentCid) {
                const outputPath = path.join(
                    outputDir,
                    `${certId}_document.pdf`
                );
                await this.downloadFromIPFS(certificate.documentCid, outputPath);
                certificate.downloadedPath = outputPath;
            }

            return certificate;
        } catch (error) {
            throw new Error(`Get certificate failed: ${error.message}`);
        }
    }

    // Revoke certificate
    async revokeCertificate(certId, reason) {
        try {
            await this.contract.submitTransaction(
                'RevokeCertificate',
                certId,
                reason
            );
            console.log(`Certificate ${certId} revoked`);
            return true;
        } catch (error) {
            throw new Error(`Revoke certificate failed: ${error.message}`);
        }
    }

    // Verify certificate integrity
    async verifyCertificate(certId, documentPath) {
        try {
            // 1. Get certificate from blockchain
            const certificate = await this.getCertificate(certId);

            // 2. Calculate CID of local file
            const localCID = await this.uploadToIPFS(documentPath);

            // 3. Compare CIDs
            if (localCID === certificate.documentCid) {
                return {
                    valid: true,
                    message: 'Document is authentic and unmodified'
                };
            } else {
                return {
                    valid: false,
                    message: 'Document has been modified or is not the original',
                    blockchainCID: certificate.documentCid,
                    localCID: localCID
                };
            }
        } catch (error) {
            throw new Error(`Verification failed: ${error.message}`);
        }
    }

    // Disconnect
    async disconnect() {
        if (this.gateway) {
            await this.gateway.disconnect();
        }
    }
}

module.exports = CertificateService;
```

### Usage Example

```javascript
// app.js
const CertificateService = require('./certificate-service');

const fabricConfig = {
    connectionProfile: './connection-profile.json',
    walletPath: './wallet',
    userId: 'appUser',
    channelName: 'certification-channel',
    chaincodeName: 'certificate'
};

const ipfsConfig = {
    apiUrl: 'http://localhost:5001',
    gatewayUrl: 'http://localhost:8080',
    clusterApiUrl: 'http://localhost:9094'
};

async function main() {
    const service = new CertificateService(fabricConfig, ipfsConfig);
    
    try {
        // Connect to Fabric
        await service.connect();
        console.log('Connected to Hyperledger Fabric');

        // Register new certificate
        const certData = {
            certId: 'CERT-2025-001',
            seedType: 'Kelapa Sawit',
            producer: 'PT Perkebunan Nusantara',
            issueDate: '2025-01-15',
            expiryDate: '2026-01-15'
        };

        const result = await service.registerCertificate(
            certData,
            './documents/certificate-001.pdf'
        );
        console.log('Certificate registered:', result);

        // Add attachment
        await service.addAttachment(
            'CERT-2025-001',
            './documents/lab-test-results.pdf'
        );

        // Get certificate
        const certificate = await service.getCertificate(
            'CERT-2025-001',
            true,
            './downloads'
        );
        console.log('Certificate retrieved:', certificate);

        // Verify certificate
        const verification = await service.verifyCertificate(
            'CERT-2025-001',
            './documents/certificate-001.pdf'
        );
        console.log('Verification result:', verification);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await service.disconnect();
    }
}

main();
```

##  Security Considerations

### 1. Access Control
```go
// In chaincode - check caller identity
clientID, err := ctx.GetClientIdentity().GetID()
mspID, err := ctx.GetClientIdentity().GetMSPID()

// Verify role/attributes
hasRole, err := ctx.GetClientIdentity().HasAttribute("role")
```

### 2. Data Privacy
- Store sensitive data encrypted in IPFS
- Use Fabric private data collections for confidential info
- IPFS CID is deterministic - same file = same CID

### 3. IPFS Private Network
- Swarm key ensures only authorized nodes join
- No data leakage to public IPFS network

##  Monitoring & Maintenance

### Health Check Script
```bash
#!/bin/bash
# health-check.sh

echo "=== Fabric Network Status ==="
peer channel list
peer channel getinfo -c certification-channel

echo "=== IPFS Cluster Status ==="
curl http://localhost:9094/health

echo "=== IPFS Nodes ==="
curl http://localhost:5001/api/v0/id
curl http://localhost:5002/api/v0/id
```

##  Deployment Checklist

- [ ] Deploy Fabric network (orderer, peers, CAs)
- [ ] Install and instantiate chaincode
- [ ] Start IPFS Cluster nodes
- [ ] Generate swarm key for private network
- [ ] Configure cluster secret
- [ ] Test certificate registration flow
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategy for both systems

##  Resources

- [Hyperledger Fabric Docs](https://hyperledger-fabric.readthedocs.io/)
- [IPFS Cluster Docs](https://ipfscluster.io/documentation/)
- [Fabric SDK Node](https://hyperledger.github.io/fabric-sdk-node/)
- [IPFS HTTP API](https://docs.ipfs.tech/reference/kubo/rpc/)
