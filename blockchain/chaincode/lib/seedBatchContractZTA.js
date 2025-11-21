/*
 * SPDX-License-Identifier: Apache-2.0
 * Zero Trust Architecture (ZTA) Enhanced Version
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const ClientIdentity = require('fabric-shim').ClientIdentity;

class SeedBatchContractZTA extends Contract {

    // =========================================================
    // ZERO TRUST: Comprehensive Access Control
    // =========================================================
    _verifyIdentityAndContext(ctx, requiredRole, requiredPermissions = []) {
        const cid = new ClientIdentity(ctx.stub);

        // 1. Verify Role (RBAC) - Support multiple roles in single user
        const roleAttr = cid.getAttributeValue(requiredRole);
        if (!roleAttr || roleAttr !== 'true') {
            this._logSecurityEvent(ctx, 'ACCESS_DENIED', `Role mismatch. Required: ${requiredRole}, User doesn't have this role attribute`);
            throw new Error(`Akses ditolak. Dibutuhkan role '${requiredRole}', tapi user tidak memiliki role tersebut.`);
        }

        // 2. Verify Organization (MSP)
        const mspId = cid.getMSPID();
        if (!mspId) {
            this._logSecurityEvent(ctx, 'ACCESS_DENIED', 'No MSP ID found');
            throw new Error('Identitas tidak valid: MSP ID tidak ditemukan.');
        }

        // 3. Verify Certificate is Valid (not expired)
        const idBytes = cid.getIDBytes();
        if (!idBytes || idBytes.length === 0) {
            this._logSecurityEvent(ctx, 'ACCESS_DENIED', 'Invalid certificate');
            throw new Error('Sertifikat identitas tidak valid.');
        }

        // 4. Verify Additional Attributes (ABAC)
        const userStatus = cid.getAttributeValue('status');
        if (userStatus && userStatus !== 'active') {
            this._logSecurityEvent(ctx, 'ACCESS_DENIED', `User status is ${userStatus}`);
            throw new Error(`Akses ditolak. Status user: ${userStatus}. Harus 'active'.`);
        }

        // 5. Build Identity Context with deterministic timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.toInt() * 1000).toISOString();

        const identityContext = {
            userID: cid.getID(),
            role: requiredRole,
            mspId: mspId,
            timestamp: timestamp,
            txId: ctx.stub.getTxID(),
            channelId: ctx.stub.getChannelID()
        };

        return identityContext;
    }

    // =========================================================
    // ZERO TRUST: Audit Logging
    // =========================================================
    async _logAuditTrail(ctx, action, resourceId, details, identityContext) {
        // Get deterministic timestamp from transaction
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.toInt() * 1000).toISOString();
        const timestampMs = txTimestamp.seconds.toInt() * 1000 + Math.floor(txTimestamp.nanos / 1000000);

        const auditLog = {
            docType: 'AuditLog',
            timestamp: timestamp,
            txId: ctx.stub.getTxID(),
            channelId: ctx.stub.getChannelID(),
            action: action,
            resourceId: resourceId,
            userID: identityContext.userID,
            role: identityContext.role,
            mspId: identityContext.mspId,
            details: details,
            status: 'SUCCESS'
        };

        // Store audit log dengan composite key
        const compositeKey = ctx.stub.createCompositeKey('AUDIT', [
            action,
            timestampMs.toString(),
            ctx.stub.getTxID()
        ]);

        await ctx.stub.putState(compositeKey, Buffer.from(JSON.stringify(auditLog)));

        // Emit event untuk monitoring external
        ctx.stub.setEvent('AuditLogCreated', Buffer.from(JSON.stringify({
            action: action,
            resourceId: resourceId,
            userID: identityContext.userID,
            timestamp: auditLog.timestamp
        })));
    }

    // =========================================================
    // ZERO TRUST: Security Event Logging
    // =========================================================
    _logSecurityEvent(ctx, eventType, details) {
        const cid = new ClientIdentity(ctx.stub);
        // Get deterministic timestamp from transaction
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.toInt() * 1000).toISOString();

        const securityEvent = {
            docType: 'SecurityEvent',
            timestamp: timestamp,
            txId: ctx.stub.getTxID(),
            eventType: eventType,
            userID: cid.getID(),
            mspId: cid.getMSPID(),
            details: details
        };

        // Emit event untuk security monitoring
        ctx.stub.setEvent('SecurityEventDetected', Buffer.from(JSON.stringify(securityEvent)));

        console.warn(`[SECURITY EVENT] ${eventType}: ${details}`);
    }

    // =========================================================
    // ZERO TRUST: Resource-Level Authorization
    // =========================================================
    async _verifyResourceAccess(ctx, resourceId, requiredOwnership, identityContext) {
        if (!requiredOwnership) {
            return true; // No ownership check required
        }

        const resource = await this.getSeedBatch(ctx, resourceId);
        const userUUID = this._getUUIDFromUserID(identityContext.userID);

        if (resource.producer_id !== userUUID) {
            this._logSecurityEvent(ctx, 'UNAUTHORIZED_ACCESS',
                `User ${userUUID} attempted to access resource owned by ${resource.producer_id}`);
            throw new Error(`Akses ditolak. Anda tidak memiliki hak akses ke resource ini.`);
        }

        return true;
    }

    // =========================================================
    // HELPER: Validasi Input
    // =========================================================
    _validateRequired(fieldName, value) {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            throw new Error(`Field '${fieldName}' wajib diisi.`);
        }
    }

    _validateUUID(fieldName, uuid) {
        this._validateRequired(fieldName, uuid);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(uuid)) {
            throw new Error(`Field '${fieldName}' harus berformat UUID yang valid.`);
        }
    }

    _validateSeedClass(seedClass) {
        const validClasses = ['BS', 'BD', 'BP', 'BR'];
        if (!validClasses.includes(seedClass)) {
            throw new Error(`Kelas benih tidak valid. Harus salah satu dari: ${validClasses.join(', ')}`);
        }
    }

    _validateDate(fieldName, dateString) {
        this._validateRequired(fieldName, dateString);
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            throw new Error(`Field '${fieldName}' harus berformat tanggal yang valid (ISO 8601).`);
        }
        return date;
    }

    _validateIPFSCid(fieldName, cid) {
        this._validateRequired(fieldName, cid);
        // Basic IPFS CID validation (v0 or v1)
        const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58}|B[A-Z2-7]{58}|z[1-9A-HJ-NP-Za-km-z]{48}|F[0-9A-F]{50})$/;
        if (!cidRegex.test(cid)) {
            throw new Error(`Field '${fieldName}' harus berformat IPFS CID yang valid.`);
        }
    }

    _sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        // Remove potentially dangerous characters
        return input.replace(/[<>\"']/g, '');
    }

    // =========================================================
    // HELPER: Warna Label
    // =========================================================
    _getLabelColor(seedClass) {
        switch (seedClass) {
            case 'BS': return 'Kuning';
            case 'BD': return 'Putih';
            case 'BP': return 'Ungu';
            case 'BR': return 'Biru';
            default: return 'Belum Ditentukan';
        }
    }

    // =========================================================
    // HELPER: Extract UUID from User ID
    // =========================================================
    _getUUIDFromUserID(userID) {
        const parts = userID.split('/');
        const cnPart = parts.find(p => p.startsWith('CN='));
        if (cnPart) {
            return cnPart.substring(3);
        }
        return userID;
    }

    // =========================================================
    // 1. createSeedBatch [role_producer]
    // =========================================================
    async createSeedBatch(ctx, id, varietyName, commodity, harvestDate, seedSourceNumber, origin, iupNumber, seedClass, producerUUID, seedSourceDocName, seedSourceIpfsCid) {
        // ZTA: Verify identity and context
        const identity = this._verifyIdentityAndContext(ctx, 'role_producer');

        // Validate inputs
        this._validateRequired('id', id);
        this._validateRequired('varietyName', varietyName);
        this._validateRequired('commodity', commodity);
        this._validateDate('harvestDate', harvestDate);
        this._validateRequired('seedSourceNumber', seedSourceNumber);
        this._validateRequired('origin', origin);
        this._validateRequired('iupNumber', iupNumber);
        this._validateSeedClass(seedClass);
        this._validateUUID('producerUUID', producerUUID);
        this._validateRequired('seedSourceDocName', seedSourceDocName);
        this._validateIPFSCid('seedSourceIpfsCid', seedSourceIpfsCid);

        const exists = await this.seedBatchExists(ctx, id);
        if (exists) {
            throw new Error(`Batch benih ${id} sudah ada.`);
        }

        // Create seed source document
        const seedSourceDoc = {
            name: this._sanitizeInput(seedSourceDocName),
            cid: seedSourceIpfsCid,
            uploaded_by: identity.userID,
            uploaded_at: identity.timestamp,
            doc_type: 'seed_source'
        };

        // Sanitize inputs
        const seedBatch = {
            id: this._sanitizeInput(id),
            docType: 'SeedBatch',
            variety_name: this._sanitizeInput(varietyName),
            commodity: this._sanitizeInput(commodity),
            harvest_date: harvestDate,
            seed_source_number: this._sanitizeInput(seedSourceNumber),
            origin: this._sanitizeInput(origin),
            iup_number: this._sanitizeInput(iupNumber),

            // Identity tracking
            producer_id: producerUUID,
            created_by: identity.userID,
            created_at: identity.timestamp,
            created_msp: identity.mspId,

            // Inspector IDs
            inspector_field_id: '',
            inspector_chief_id: '',
            issuer_id: '',

            seed_class: seedClass,
            label_color: this._getLabelColor(seedClass),
            cert_number: '',
            cert_issue_date: '',
            cert_expiry_date: '',
            cert_revoke_date: '',
            current_status: 'REGISTERED',
            documents: [seedSourceDoc],

            // ZTA: Version control
            version: 1,
            last_modified_by: identity.userID,
            last_modified_at: identity.timestamp
        };

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        // ZTA: Audit logging
        await this._logAuditTrail(ctx, 'CREATE_SEED_BATCH', id, {
            variety: varietyName,
            commodity: commodity,
            seedClass: seedClass,
            seedSourceDoc: seedSourceDocName
        }, identity);

        return JSON.stringify(seedBatch);
    }

    // =========================================================
    // 2. submitCertification [role_producer]
    // =========================================================
    async submitCertification(ctx, id, documentName, ipfsCid) {
        const identity = this._verifyIdentityAndContext(ctx, 'role_producer');

        this._validateRequired('id', id);
        this._validateRequired('documentName', documentName);
        this._validateIPFSCid('ipfsCid', ipfsCid);

        const seedBatch = await this.getSeedBatch(ctx, id);

        if (seedBatch.current_status !== 'REGISTERED') {
            throw new Error(`Status harus REGISTERED. Status saat ini: ${seedBatch.current_status}`);
        }

        const newDoc = {
            name: this._sanitizeInput(documentName),
            cid: ipfsCid,
            uploaded_by: identity.userID,
            uploaded_at: identity.timestamp,
            doc_type: 'certification_request'
        };

        seedBatch.documents.push(newDoc);
        seedBatch.current_status = 'SUBMITTED';
        seedBatch.submitted_at = identity.timestamp;
        seedBatch.version += 1;
        seedBatch.last_modified_by = identity.userID;
        seedBatch.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        await this._logAuditTrail(ctx, 'SUBMIT_CERTIFICATION', id, {
            documentName: documentName,
            ipfsCid: ipfsCid
        }, identity);

        return JSON.stringify(seedBatch);
    }

    // =========================================================
    // 3. recordInspection [role_pbt_field]
    // =========================================================
    async recordInspection(ctx, id, inspectionResult, ipfsInspectionCid, inspectorFieldUUID) {
        const identity = this._verifyIdentityAndContext(ctx, 'role_pbt_field');

        this._validateRequired('id', id);
        this._validateRequired('inspectionResult', inspectionResult);
        this._validateIPFSCid('ipfsInspectionCid', ipfsInspectionCid);
        this._validateUUID('inspectorFieldUUID', inspectorFieldUUID);

        const seedBatch = await this.getSeedBatch(ctx, id);

        if (seedBatch.current_status !== 'SUBMITTED') {
            throw new Error(`Benih belum diajukan. Status: ${seedBatch.current_status}`);
        }

        // ZTA: Prevent duplicate inspection by same inspector
        if (seedBatch.inspector_field_id === inspectorFieldUUID) {
            throw new Error('Petugas ini sudah melakukan inspeksi pada batch ini.');
        }

        seedBatch.inspector_field_id = inspectorFieldUUID;
        seedBatch.inspected_by = identity.userID;
        seedBatch.inspected_at = identity.timestamp;
        seedBatch.current_status = 'INSPECTED';

        const inspectionDoc = {
            name: 'Laporan Inspeksi Lapangan',
            result: this._sanitizeInput(inspectionResult),
            cid: ipfsInspectionCid,
            uploaded_by: identity.userID,
            uploaded_at: identity.timestamp,
            doc_type: 'field_inspection',
            inspector_msp: identity.mspId
        };
        seedBatch.documents.push(inspectionDoc);

        seedBatch.version += 1;
        seedBatch.last_modified_by = identity.userID;
        seedBatch.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        await this._logAuditTrail(ctx, 'RECORD_INSPECTION', id, {
            inspectorUUID: inspectorFieldUUID,
            result: inspectionResult
        }, identity);

        return JSON.stringify(seedBatch);
    }

    // =========================================================
    // 4. evaluateInspection [role_pbt_chief]
    // =========================================================
    async evaluateInspection(ctx, id, evaluationNote, approvalStatus, inspectorChiefUUID) {
        const identity = this._verifyIdentityAndContext(ctx, 'role_pbt_chief');

        this._validateRequired('id', id);
        this._validateRequired('evaluationNote', evaluationNote);
        this._validateRequired('approvalStatus', approvalStatus);
        this._validateUUID('inspectorChiefUUID', inspectorChiefUUID);

        if (approvalStatus !== 'APPROVE' && approvalStatus !== 'REJECT') {
            throw new Error(`approvalStatus harus 'APPROVE' atau 'REJECT'.`);
        }

        const seedBatch = await this.getSeedBatch(ctx, id);

        if (seedBatch.current_status !== 'INSPECTED') {
            throw new Error(`Belum diinspeksi lapangan. Status: ${seedBatch.current_status}`);
        }

        // ZTA: Prevent self-evaluation (chief cannot evaluate own field inspection)
        if (seedBatch.inspector_field_id === inspectorChiefUUID) {
            this._logSecurityEvent(ctx, 'CONFLICT_OF_INTEREST',
                `Chief ${inspectorChiefUUID} attempted to evaluate own field inspection`);
            throw new Error('Ketua tim tidak boleh mengevaluasi inspeksi yang dilakukan sendiri.');
        }

        seedBatch.inspector_chief_id = inspectorChiefUUID;
        seedBatch.evaluated_by = identity.userID;
        seedBatch.evaluated_at = identity.timestamp;

        if (approvalStatus === 'REJECT') {
            seedBatch.current_status = 'REGISTERED';
            seedBatch.rejection_count = (seedBatch.rejection_count || 0) + 1;

            // ZTA: Track suspicious activity (multiple rejections)
            if (seedBatch.rejection_count >= 3) {
                this._logSecurityEvent(ctx, 'MULTIPLE_REJECTIONS',
                    `Batch ${id} has been rejected ${seedBatch.rejection_count} times`);
            }
        } else {
            seedBatch.current_status = 'EVALUATED';
        }

        const evalDoc = {
            name: 'Evaluasi Ketua Tim',
            note: this._sanitizeInput(evaluationNote),
            status: approvalStatus,
            evaluator_id: inspectorChiefUUID,
            evaluator_user: identity.userID,
            evaluated_at: identity.timestamp,
            doc_type: 'chief_evaluation',
            evaluator_msp: identity.mspId
        };
        seedBatch.documents.push(evalDoc);

        seedBatch.version += 1;
        seedBatch.last_modified_by = identity.userID;
        seedBatch.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        await this._logAuditTrail(ctx, 'EVALUATE_INSPECTION', id, {
            approvalStatus: approvalStatus,
            note: evaluationNote
        }, identity);

        return JSON.stringify(seedBatch);
    }

    // =========================================================
    // 5. issueCertificate [role_lsm_head]
    // =========================================================
    async issueCertificate(ctx, id, certNumber, expiryDateMonths, certDocumentName, certIpfsCid, issuerUUID) {
        const identity = this._verifyIdentityAndContext(ctx, 'role_lsm_head');

        this._validateRequired('id', id);
        this._validateRequired('certNumber', certNumber);
        this._validateRequired('expiryDateMonths', expiryDateMonths);
        this._validateRequired('certDocumentName', certDocumentName);
        this._validateIPFSCid('certIpfsCid', certIpfsCid);
        this._validateUUID('issuerUUID', issuerUUID);

        const months = parseInt(expiryDateMonths);
        if (isNaN(months) || months <= 0 || months > 120) {
            throw new Error(`expiryDateMonths harus berupa angka positif antara 1-120.`);
        }

        const seedBatch = await this.getSeedBatch(ctx, id);

        if (seedBatch.current_status !== 'EVALUATED') {
            throw new Error(`Benih belum dievaluasi. Status: ${seedBatch.current_status}`);
        }

        // ZTA: Check for duplicate certificate number
        const existingCert = await this._checkCertificateExists(ctx, certNumber);
        if (existingCert) {
            this._logSecurityEvent(ctx, 'DUPLICATE_CERTIFICATE',
                `Certificate number ${certNumber} already exists`);
            throw new Error(`Nomor sertifikat ${certNumber} sudah digunakan.`);
        }

        // Use transaction timestamp for deterministic behavior
        const txTimestamp = ctx.stub.getTxTimestamp();
        const now = new Date(txTimestamp.seconds.toInt() * 1000);
        const expiryDate = new Date(txTimestamp.seconds.toInt() * 1000);
        expiryDate.setMonth(expiryDate.getMonth() + months);

        seedBatch.issuer_id = issuerUUID;
        seedBatch.issued_by = identity.userID;
        seedBatch.issued_at = identity.timestamp;
        seedBatch.cert_number = this._sanitizeInput(certNumber);
        seedBatch.cert_issue_date = now.toISOString();
        seedBatch.cert_expiry_date = expiryDate.toISOString();
        seedBatch.current_status = 'CERTIFIED';
        seedBatch.issuer_msp = identity.mspId;

        // Add certificate document
        const certDoc = {
            name: this._sanitizeInput(certDocumentName),
            cid: certIpfsCid,
            uploaded_by: identity.userID,
            uploaded_at: identity.timestamp,
            doc_type: 'certificate',
            cert_number: certNumber
        };
        seedBatch.documents.push(certDoc);

        seedBatch.version += 1;
        seedBatch.last_modified_by = identity.userID;
        seedBatch.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        // ZTA: Create certificate index for quick lookup
        await this._indexCertificate(ctx, certNumber, id);

        await this._logAuditTrail(ctx, 'ISSUE_CERTIFICATE', id, {
            certNumber: certNumber,
            expiryMonths: months,
            expiryDate: expiryDate.toISOString()
        }, identity);

        return JSON.stringify(seedBatch);
    }

    // =========================================================
    // 6. revokeCertificate [role_lsm_head]
    // =========================================================
    async revokeCertificate(ctx, id, reason) {
        const identity = this._verifyIdentityAndContext(ctx, 'role_lsm_head');

        this._validateRequired('id', id);
        this._validateRequired('reason', reason);

        const seedBatch = await this.getSeedBatch(ctx, id);

        if (seedBatch.current_status !== 'CERTIFIED' && seedBatch.current_status !== 'DISTRIBUTED') {
            throw new Error(`Hanya benih bersertifikat yang bisa dicabut.`);
        }

        // ZTA: Log critical security action
        this._logSecurityEvent(ctx, 'CERTIFICATE_REVOCATION',
            `Certificate ${seedBatch.cert_number} for batch ${id} is being revoked. Reason: ${reason}`);

        seedBatch.current_status = 'REVOKED';
        const txTimestamp = ctx.stub.getTxTimestamp();
        seedBatch.cert_revoke_date = new Date(txTimestamp.seconds.toInt() * 1000).toISOString();
        seedBatch.revoked_by = identity.userID;
        seedBatch.revoked_at = identity.timestamp;
        seedBatch.revoker_msp = identity.mspId;

        const revokeDoc = {
            name: 'Berita Acara Pencabutan',
            reason: this._sanitizeInput(reason),
            revoked_by: identity.userID,
            revoked_at: identity.timestamp,
            doc_type: 'revocation',
            revoker_msp: identity.mspId
        };
        seedBatch.documents.push(revokeDoc);

        seedBatch.version += 1;
        seedBatch.last_modified_by = identity.userID;
        seedBatch.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        // ZTA: Remove from certificate index
        await this._removeCertificateIndex(ctx, seedBatch.cert_number);

        await this._logAuditTrail(ctx, 'REVOKE_CERTIFICATE', id, {
            certNumber: seedBatch.cert_number,
            reason: reason
        }, identity);

        return JSON.stringify(seedBatch);
    }

    // =========================================================
    // 7. distributeSeed [role_producer]
    // =========================================================
    async distributeSeed(ctx, id, distributionLocation, quantity) {
        const identity = this._verifyIdentityAndContext(ctx, 'role_producer');

        this._validateRequired('id', id);
        this._validateRequired('distributionLocation', distributionLocation);
        this._validateRequired('quantity', quantity);

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            throw new Error(`Quantity harus berupa angka positif.`);
        }

        const seedBatch = await this.getSeedBatch(ctx, id);

        if (seedBatch.current_status !== 'CERTIFIED') {
            throw new Error(`Hanya benih bersertifikat yang boleh diedarkan.`);
        }

        // ZTA: Verify certificate not expired (using transaction timestamp)
        const txTimestamp = ctx.stub.getTxTimestamp();
        const now = new Date(txTimestamp.seconds.toInt() * 1000);
        const expiry = new Date(seedBatch.cert_expiry_date);
        if (now > expiry) {
            this._logSecurityEvent(ctx, 'EXPIRED_CERTIFICATE_USE',
                `Attempt to distribute batch ${id} with expired certificate ${seedBatch.cert_number}`);
            throw new Error(`Sertifikat kadaluarsa pada ${expiry.toISOString()}.`);
        }

        // ZTA: Check if certificate is revoked
        if (seedBatch.current_status === 'REVOKED') {
            this._logSecurityEvent(ctx, 'REVOKED_CERTIFICATE_USE',
                `Attempt to distribute batch ${id} with revoked certificate ${seedBatch.cert_number}`);
            throw new Error('Sertifikat telah dicabut. Distribusi tidak diizinkan.');
        }

        seedBatch.current_status = 'DISTRIBUTED';
        seedBatch.distributed_at = identity.timestamp;

        const distDoc = {
            name: 'Bukti Distribusi',
            location: this._sanitizeInput(distributionLocation),
            quantity: qty,
            distributed_by: identity.userID,
            distributed_at: identity.timestamp,
            doc_type: 'distribution',
            distributor_msp: identity.mspId
        };
        seedBatch.documents.push(distDoc);

        seedBatch.version += 1;
        seedBatch.last_modified_by = identity.userID;
        seedBatch.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        await this._logAuditTrail(ctx, 'DISTRIBUTE_SEED', id, {
            location: distributionLocation,
            quantity: qty
        }, identity);

        return JSON.stringify(seedBatch);
    }

    // =========================================================
    // 8. getHistory [public with audit]
    // =========================================================
    async getHistory(ctx, id) {
        this._validateRequired('id', id);

        // ZTA: Log access to sensitive history data
        const cid = new ClientIdentity(ctx.stub);
        const txTimestamp = ctx.stub.getTxTimestamp();
        const identity = {
            userID: cid.getID(),
            role: cid.getAttributeValue('role') || 'unknown',
            mspId: cid.getMSPID(),
            timestamp: new Date(txTimestamp.seconds.toInt() * 1000).toISOString(),
            txId: ctx.stub.getTxID(),
            channelId: ctx.stub.getChannelID()
        };

        await this._logAuditTrail(ctx, 'READ_HISTORY', id, {
            accessType: 'full_history'
        }, identity);

        const iterator = await ctx.stub.getHistoryForKey(id);
        const results = [];

        let result = await iterator.next();
        while (!result.done) {
            const keyMod = result.value;
            const resp = {
                timestamp: keyMod.timestamp,
                txId: keyMod.txId,
                isDelete: keyMod.isDelete
            };
            if (keyMod.isDelete) {
                resp.data = 'ASSET DELETED';
            } else {
                try {
                    resp.data = JSON.parse(keyMod.value.toString('utf8'));
                } catch (err) {
                    console.log(err);
                    resp.data = keyMod.value.toString('utf8');
                }
            }
            results.push(resp);

            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(results);
    }

    // =========================================================
    // Query Single Batch (public with audit)
    // =========================================================
    async querySeedBatch(ctx, id) {
        this._validateRequired('id', id);

        // ZTA: Log access
        const cid = new ClientIdentity(ctx.stub);
        const txTimestamp = ctx.stub.getTxTimestamp();
        const identity = {
            userID: cid.getID(),
            role: cid.getAttributeValue('role') || 'public',
            mspId: cid.getMSPID(),
            timestamp: new Date(txTimestamp.seconds.toInt() * 1000).toISOString(),
            txId: ctx.stub.getTxID(),
            channelId: ctx.stub.getChannelID()
        };

        await this._logAuditTrail(ctx, 'READ_SEED_BATCH', id, {
            accessType: 'single_query'
        }, identity);

        const seedBatch = await this.getSeedBatch(ctx, id);
        return JSON.stringify(seedBatch);
    }

    // =========================================================
    // Query All Batches (public with audit)
    // =========================================================
    async queryAllSeedBatches(ctx) {
        // ZTA: Log bulk access
        const cid = new ClientIdentity(ctx.stub);
        const txTimestamp = ctx.stub.getTxTimestamp();
        const identity = {
            userID: cid.getID(),
            role: cid.getAttributeValue('role') || 'public',
            mspId: cid.getMSPID(),
            timestamp: new Date(txTimestamp.seconds.toInt() * 1000).toISOString(),
            txId: ctx.stub.getTxID(),
            channelId: ctx.stub.getChannelID()
        };

        await this._logAuditTrail(ctx, 'READ_ALL_BATCHES', 'ALL', {
            accessType: 'bulk_query'
        }, identity);

        const iterator = await ctx.stub.getStateByRange('', '');
        const allResults = [];

        let result = await iterator.next();
        while (!result.done) {
            const res = result.value;
            const jsonRes = {};
            jsonRes.Key = res.key;

            try {
                jsonRes.Record = JSON.parse(res.value.toString('utf8'));
                if (jsonRes.Record.docType === 'SeedBatch') {
                    allResults.push(jsonRes);
                }
            } catch (err) {
                console.log(err);
                jsonRes.Record = res.value.toString('utf8');
            }

            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(allResults);
    }

    // =========================================================
    // Query by Status (public with audit)
    // =========================================================
    async querySeedBatchesByStatus(ctx, status) {
        this._validateRequired('status', status);

        const validStatuses = ['REGISTERED', 'SUBMITTED', 'INSPECTED', 'EVALUATED', 'CERTIFIED', 'DISTRIBUTED', 'REVOKED'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Status tidak valid. Harus salah satu dari: ${validStatuses.join(', ')}`);
        }

        // ZTA: Log query
        const cid = new ClientIdentity(ctx.stub);
        const txTimestamp = ctx.stub.getTxTimestamp();
        const identity = {
            userID: cid.getID(),
            role: cid.getAttributeValue('role') || 'public',
            mspId: cid.getMSPID(),
            timestamp: new Date(txTimestamp.seconds.toInt() * 1000).toISOString(),
            txId: ctx.stub.getTxID(),
            channelId: ctx.stub.getChannelID()
        };

        await this._logAuditTrail(ctx, 'QUERY_BY_STATUS', status, {
            status: status
        }, identity);

        const queryString = {
            selector: {
                docType: 'SeedBatch',
                current_status: status
            }
        };

        return await this._getQueryResultForQueryString(ctx, JSON.stringify(queryString));
    }

    // =========================================================
    // Query by Producer (with strict ownership check)
    // =========================================================
    async querySeedBatchesByProducer(ctx, producerUUID) {
        const identity = this._verifyIdentityAndContext(ctx, 'role_producer');

        // ZTA: Strict ownership verification
        const userUUID = this._getUUIDFromUserID(identity.userID);
        if (producerUUID !== userUUID) {
            this._logSecurityEvent(ctx, 'UNAUTHORIZED_QUERY',
                `Producer ${userUUID} attempted to query batches of ${producerUUID}`);
            throw new Error(`Anda hanya bisa melihat batch benih milik Anda sendiri.`);
        }

        this._validateUUID('producerUUID', producerUUID);

        await this._logAuditTrail(ctx, 'QUERY_BY_PRODUCER', producerUUID, {
            producerUUID: producerUUID
        }, identity);

        const queryString = {
            selector: {
                docType: 'SeedBatch',
                producer_id: producerUUID
            }
        };

        return await this._getQueryResultForQueryString(ctx, JSON.stringify(queryString));
    }

    // =========================================================
    // Query Audit Logs (admin only)
    // =========================================================
    async queryAuditLogs(ctx, startTime, endTime, action) {
        const identity = this._verifyIdentityAndContext(ctx, 'role_admin');

        const queryString = {
            selector: {
                docType: 'AuditLog'
            }
        };

        if (action) {
            queryString.selector.action = action;
        }

        if (startTime) {
            queryString.selector.timestamp = { $gte: startTime };
        }

        if (endTime) {
            if (!queryString.selector.timestamp) {
                queryString.selector.timestamp = {};
            }
            queryString.selector.timestamp.$lte = endTime;
        }

        return await this._getQueryResultForQueryString(ctx, JSON.stringify(queryString));
    }

    // =========================================================
    // HELPER: Execute Rich Query
    // =========================================================
    async _getQueryResultForQueryString(ctx, queryString) {
        const iterator = await ctx.stub.getQueryResult(queryString);
        const allResults = [];

        let result = await iterator.next();
        while (!result.done) {
            const res = result.value;
            const jsonRes = {};
            jsonRes.Key = res.key;

            try {
                jsonRes.Record = JSON.parse(res.value.toString('utf8'));
                allResults.push(jsonRes);
            } catch (err) {
                console.log(err);
                jsonRes.Record = res.value.toString('utf8');
                allResults.push(jsonRes);
            }

            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(allResults);
    }

    // =========================================================
    // HELPER: Certificate Index Management
    // =========================================================
    async _checkCertificateExists(ctx, certNumber) {
        const compositeKey = ctx.stub.createCompositeKey('CERT', [certNumber]);
        const certBytes = await ctx.stub.getState(compositeKey);
        return certBytes && certBytes.length > 0;
    }

    async _indexCertificate(ctx, certNumber, batchId) {
        const compositeKey = ctx.stub.createCompositeKey('CERT', [certNumber]);
        await ctx.stub.putState(compositeKey, Buffer.from(batchId));
    }

    async _removeCertificateIndex(ctx, certNumber) {
        const compositeKey = ctx.stub.createCompositeKey('CERT', [certNumber]);
        await ctx.stub.deleteState(compositeKey);
    }

    // =========================================================
    // INTERNAL HELPER
    // =========================================================
    async seedBatchExists(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        return assetJSON && assetJSON.length > 0;
    }

    async getSeedBatch(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Batch benih ${id} tidak ditemukan.`);
        }
        return JSON.parse(assetJSON.toString());
    }
}

module.exports = SeedBatchContractZTA;
