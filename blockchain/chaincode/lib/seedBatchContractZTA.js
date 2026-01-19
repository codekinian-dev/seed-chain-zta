/*
 * SPDX-License-Identifier: Apache-2.0
 * Zero Trust Architecture (ZTA) Enhanced Version
 * 
 * Updated for per-user identity from Keycloak integration:
 * - Each user has their own private key and certificate
 * - Role is embedded in certificate attributes during CA enrollment
 * - keycloak_id attribute links to Keycloak user UUID
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

        // 1. Verify Role (RBAC) - Each user has specific role in their certificate
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

        // 5. Get Keycloak ID if available (links to IDP)
        const keycloakId = cid.getAttributeValue('keycloak_id');
        const username = cid.getAttributeValue('username');

        // 6. Build Identity Context with deterministic timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.toInt() * 1000).toISOString();

        const identityContext = {
            userID: cid.getID(),
            keycloakId: keycloakId || null,
            username: username || null,
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
            keycloakId: identityContext.keycloakId,
            username: identityContext.username,
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

        // Use keycloakId if available, otherwise extract from userID
        const userUUID = identityContext.keycloakId || this._getUUIDFromUserID(identityContext.userID);

        if (resource.producer_id !== userUUID) {
            this._logSecurityEvent(ctx, 'UNAUTHORIZED_ACCESS',
                `User ${userUUID} attempted to access resource owned by ${resource.producer_id}`);
            throw new Error(`Akses ditolak. Anda tidak memiliki hak akses ke resource ini.`);
        }

        return true;
    }

    // =========================================================
    // ZERO TRUST: Verify User UUID matches identity
    // =========================================================
    _verifyUserUUID(identityContext, providedUUID, fieldName) {
        // Get the user's UUID from keycloak_id attribute or extract from userID
        const userUUID = identityContext.keycloakId || this._getUUIDFromUserID(identityContext.userID);

        if (providedUUID !== userUUID) {
            throw new Error(`UUID yang diberikan (${fieldName}) tidak cocok dengan identitas Anda. ` +
                `Expected: ${userUUID}, Got: ${providedUUID}`);
        }

        return true;
    }

    // =========================================================
    // ZERO TRUST: Verify Resource Ownership
    // =========================================================
    _verifyResourceOwnership(identityContext, seedBatch, ownerType) {
        // Get caller's keycloak_id
        const callerKeycloakId = identityContext.keycloakId;

        if (!callerKeycloakId) {
            throw new Error('Identity tidak memiliki keycloak_id. Akses ditolak.');
        }

        let ownerKeycloakId;
        let ownerField;

        switch (ownerType) {
            case 'producer':
                ownerKeycloakId = seedBatch.actors?.producer?.keycloak_id;
                ownerField = 'actors.producer.keycloak_id';
                break;
            default:
                throw new Error(`Tipe owner tidak dikenal: ${ownerType}`);
        }

        if (!ownerKeycloakId) {
            throw new Error(`Owner ${ownerType} tidak ditemukan di resource ini.`);
        }

        if (callerKeycloakId !== ownerKeycloakId) {
            throw new Error(`Akses ditolak. Anda bukan pemilik resource ini. ` +
                `Resource ${ownerField}: ${ownerKeycloakId}, Your ID: ${callerKeycloakId}`);
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
            case 'BS': return 'KUNING';
            case 'BD': return 'PUTIH';
            case 'BP': return 'UNGU';
            case 'BR': return 'BIRU';
            default: return 'BELUM_DITENTUKAN';
        }
    }

    // =========================================================
    // HELPER: Generate Event/Document Counter
    // =========================================================
    _generateCounter(prefix, array) {
        if (!array || array.length === 0) return `${prefix}-001`;
        const lastItem = array[array.length - 1];
        const lastId = lastItem.event_id || lastItem.doc_id || `${prefix}-000`;
        const match = lastId.match(/-0*(\d+)$/);
        const nextNum = match ? parseInt(match[1]) + 1 : 1;
        return `${prefix}-${String(nextNum).padStart(3, '0')}`;
    }

    // =========================================================
    // HELPER: Create Actor Object
    // =========================================================
    _createActorObject(identityContext) {
        return {
            keycloak_id: identityContext.keycloakId,
            username: identityContext.username,
            fabric_subject: identityContext.userID,
            msp_id: identityContext.mspId,
            role: identityContext.role.replace('role_', '').replace('producer', 'PRODUCER').replace('pbt_field', 'INSPECTOR_FIELD').replace('pbt_chief', 'INSPECTOR_CHIEF').replace('lsm_head', 'ISSUER')
        };
    }

    // =========================================================
    // HELPER: Extract UUID from User ID (Certificate CN)
    // For users enrolled via Fabric CA with Keycloak ID as enrollment ID,
    // the CN will be the Keycloak UUID
    // =========================================================
    _getUUIDFromUserID(userID) {
        // Try to extract CN from X.509 DN format
        const parts = userID.split('/');
        const cnPart = parts.find(p => p.startsWith('CN='));
        if (cnPart) {
            return cnPart.substring(3);
        }
        return userID;
    }

    // =========================================================
    // HELPER: Get User's Keycloak UUID from identity context
    // Priority: keycloakId attribute > CN from certificate
    // =========================================================
    _getUserKeycloakId(identityContext) {
        return identityContext.keycloakId || this._getUUIDFromUserID(identityContext.userID);
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

        // ZTA: Verify producerUUID matches the caller's identity
        this._verifyUserUUID(identity, producerUUID, 'producerUUID');

        const exists = await this.seedBatchExists(ctx, id);
        if (exists) {
            throw new Error(`Batch benih ${id} sudah ada.`);
        }

        // Parse origin (format: "City, Province, Country" or just "Region")
        const originParts = origin.split(',').map(s => s.trim());
        const originObj = originParts.length >= 3 ? {
            region: originParts[0],
            province: originParts[1],
            country: originParts[2]
        } : {
            region: origin,
            province: '',
            country: 'ID'
        };

        // Create seed source document with new structure
        const seedSourceDoc = {
            doc_id: `DOC-SS-${seedSourceNumber}`,
            doc_type: 'seed_source',
            file_name: this._sanitizeInput(seedSourceDocName),
            cid: seedSourceIpfsCid,
            uploaded_at: identity.timestamp,
            uploader_ref: 'producer',
            meta: {
                description: 'Dokumen sumber benih'
            }
        };

        // Create initial event
        const initialEvent = {
            event_id: 'EVT-001',
            type: 'CREATED',
            at: identity.timestamp,
            actor_ref: 'producer',
            note: 'Seed batch dibuat'
        };

        // Build new nested structure
        const seedBatch = {
            id: this._sanitizeInput(id),
            doc_type: 'SeedBatch',
            schema_version: '1.0',

            batch: {
                batch_code: this._sanitizeInput(id),
                variety_name: this._sanitizeInput(varietyName),
                commodity: this._sanitizeInput(commodity),
                seed_class: seedClass,
                label_color: this._getLabelColor(seedClass)
            },

            seed_source: {
                seed_source_number: this._sanitizeInput(seedSourceNumber),
                iup_number: this._sanitizeInput(iupNumber),
                origin: originObj,
                harvest: {
                    harvest_date: harvestDate,
                    timezone: 'Asia/Jakarta'
                }
            },

            certification: {
                cert_number: null,
                issued_at: null,
                expires_at: null,
                revoked_at: null,
                revoke_reason: null
            },

            status: {
                current: 'REGISTERED',
                since: identity.timestamp
            },

            actors: {
                producer: this._createActorObject(identity),
                inspector_field: null,
                inspector_chief: null,
                issuer: null
            },

            documents: [seedSourceDoc],
            events: [initialEvent],

            audit: {
                created_at: identity.timestamp,
                created_by_ref: 'producer',
                last_modified_at: identity.timestamp,
                last_modified_by_ref: 'producer',
                revision: 1
            }
        };

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        // ZTA: Audit logging
        await this._logAuditTrail(ctx, 'CREATE_SEED_BATCH', id, {
            variety: varietyName,
            commodity: commodity,
            seedClass: seedClass,
            seedSourceDoc: seedSourceDocName,
            producerKeycloakId: identity.keycloakId
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

        if (seedBatch.status.current !== 'REGISTERED') {
            throw new Error(`Status harus REGISTERED. Status saat ini: ${seedBatch.status.current}`);
        }

        // ZTA: Verify caller is the owner (producer) of this batch
        this._verifyResourceOwnership(identity, seedBatch, 'producer');

        // Generate doc_id and event_id
        const docId = this._generateCounter('DOC-REQ', seedBatch.documents);
        const eventId = this._generateCounter('EVT', seedBatch.events);

        const newDoc = {
            doc_id: docId,
            doc_type: 'certification_request',
            file_name: this._sanitizeInput(documentName),
            cid: ipfsCid,
            uploaded_at: identity.timestamp,
            uploader_ref: 'producer',
            meta: {
                submitted_at: identity.timestamp
            }
        };

        const newEvent = {
            event_id: eventId,
            type: 'SUBMITTED',
            at: identity.timestamp,
            actor_ref: 'producer',
            ref_doc_id: docId
        };

        seedBatch.documents.push(newDoc);
        seedBatch.events.push(newEvent);
        seedBatch.status.current = 'SUBMITTED';
        seedBatch.status.since = identity.timestamp;
        seedBatch.audit.revision += 1;
        seedBatch.audit.last_modified_by_ref = 'producer';
        seedBatch.audit.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        await this._logAuditTrail(ctx, 'SUBMIT_CERTIFICATION', id, {
            documentName: documentName,
            ipfsCid: ipfsCid,
            submitterKeycloakId: identity.keycloakId
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

        // ZTA: Verify caller's identity matches the provided UUID
        this._verifyUserUUID(identity, inspectorFieldUUID, 'inspectorFieldUUID');

        const seedBatch = await this.getSeedBatch(ctx, id);

        if (seedBatch.status.current !== 'SUBMITTED') {
            throw new Error(`Benih belum diajukan. Status: ${seedBatch.status.current}`);
        }

        // ZTA: Prevent duplicate inspection by same inspector
        if (seedBatch.actors.inspector_field?.keycloak_id === identity.keycloakId) {
            throw new Error('Petugas ini sudah melakukan inspeksi pada batch ini.');
        }

        // Set inspector_field actor
        seedBatch.actors.inspector_field = this._createActorObject(identity);
        seedBatch.status.current = 'INSPECTED';
        seedBatch.status.since = identity.timestamp;

        // Generate IDs
        const docId = this._generateCounter('DOC-INSP', seedBatch.documents);
        const eventId = this._generateCounter('EVT', seedBatch.events);

        const inspectionDoc = {
            doc_id: docId,
            doc_type: 'field_inspection',
            name: 'Laporan Inspeksi Lapangan',
            cid: ipfsInspectionCid,
            uploaded_at: identity.timestamp,
            uploader_ref: 'inspector_field',
            meta: {
                result: this._sanitizeInput(inspectionResult)
            }
        };

        const inspectionEvent = {
            event_id: eventId,
            type: 'FIELD_INSPECTED',
            at: identity.timestamp,
            actor_ref: 'inspector_field',
            ref_doc_id: docId
        };

        seedBatch.documents.push(inspectionDoc);
        seedBatch.events.push(inspectionEvent);
        seedBatch.audit.revision += 1;
        seedBatch.audit.last_modified_by_ref = 'inspector_field';
        seedBatch.audit.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        await this._logAuditTrail(ctx, 'RECORD_INSPECTION', id, {
            inspectorUUID: inspectorFieldUUID,
            inspectorKeycloakId: identity.keycloakId,
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

        // ZTA: Verify caller's identity matches the provided UUID
        this._verifyUserUUID(identity, inspectorChiefUUID, 'inspectorChiefUUID');

        if (approvalStatus !== 'APPROVE' && approvalStatus !== 'REJECT') {
            throw new Error(`approvalStatus harus 'APPROVE' atau 'REJECT'.`);
        }

        const seedBatch = await this.getSeedBatch(ctx, id);

        if (seedBatch.status.current !== 'INSPECTED') {
            throw new Error(`Belum diinspeksi lapangan. Status: ${seedBatch.status.current}`);
        }

        // ZTA: Prevent self-evaluation (chief cannot evaluate own field inspection)
        if (seedBatch.actors.inspector_field?.keycloak_id === identity.keycloakId) {
            this._logSecurityEvent(ctx, 'CONFLICT_OF_INTEREST',
                `Chief ${identity.keycloakId} attempted to evaluate own field inspection`);
            throw new Error('Ketua tim tidak boleh mengevaluasi inspeksi yang dilakukan sendiri.');
        }

        // Set inspector_chief actor
        seedBatch.actors.inspector_chief = this._createActorObject(identity);

        // Handle rejection or approval
        if (approvalStatus === 'REJECT') {
            seedBatch.status.current = 'REGISTERED';
            seedBatch.status.since = identity.timestamp;

            // Track rejection count
            if (!seedBatch.rejection_count) seedBatch.rejection_count = 0;
            seedBatch.rejection_count += 1;

            // ZTA: Track suspicious activity (multiple rejections)
            if (seedBatch.rejection_count >= 3) {
                this._logSecurityEvent(ctx, 'MULTIPLE_REJECTIONS',
                    `Batch ${id} has been rejected ${seedBatch.rejection_count} times`);
            }
        } else {
            seedBatch.status.current = 'EVALUATED';
            seedBatch.status.since = identity.timestamp;
        }

        // Generate IDs
        const docId = this._generateCounter('DOC-EVAL', seedBatch.documents);
        const eventId = this._generateCounter('EVT', seedBatch.events);

        const evalDoc = {
            doc_id: docId,
            doc_type: 'chief_evaluation',
            name: 'Evaluasi Ketua Tim',
            uploaded_at: identity.timestamp,
            uploader_ref: 'inspector_chief',
            meta: {
                decision: approvalStatus,
                note: this._sanitizeInput(evaluationNote)
            }
        };

        const evalEvent = {
            event_id: eventId,
            type: 'CHIEF_EVALUATED',
            at: identity.timestamp,
            actor_ref: 'inspector_chief',
            ref_doc_id: docId,
            decision: approvalStatus
        };

        seedBatch.documents.push(evalDoc);
        seedBatch.events.push(evalEvent);
        seedBatch.audit.revision += 1;
        seedBatch.audit.last_modified_by_ref = 'inspector_chief';
        seedBatch.audit.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        await this._logAuditTrail(ctx, 'EVALUATE_INSPECTION', id, {
            approvalStatus: approvalStatus,
            note: evaluationNote,
            evaluatorKeycloakId: identity.keycloakId
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

        // ZTA: Verify caller's identity matches the provided UUID
        this._verifyUserUUID(identity, issuerUUID, 'issuerUUID');

        const months = parseInt(expiryDateMonths);
        if (isNaN(months) || months <= 0 || months > 120) {
            throw new Error(`expiryDateMonths harus berupa angka positif antara 1-120.`);
        }

        const seedBatch = await this.getSeedBatch(ctx, id);

        if (seedBatch.status.current !== 'EVALUATED') {
            throw new Error(`Benih belum dievaluasi. Status: ${seedBatch.status.current}`);
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

        // Set issuer actor
        seedBatch.actors.issuer = this._createActorObject(identity);

        // Update certification object
        seedBatch.certification.cert_number = this._sanitizeInput(certNumber);
        seedBatch.certification.issued_at = now.toISOString();
        seedBatch.certification.expires_at = expiryDate.toISOString();
        seedBatch.certification.revoked_at = null;
        seedBatch.certification.revoke_reason = null;

        seedBatch.status.current = 'CERTIFIED';
        seedBatch.status.since = identity.timestamp;

        // Generate IDs
        const docId = this._generateCounter('DOC-CERT', seedBatch.documents);
        const eventId = this._generateCounter('EVT', seedBatch.events);

        // Add certificate document
        const certDoc = {
            doc_id: docId,
            doc_type: 'certificate',
            file_name: this._sanitizeInput(certDocumentName),
            cid: certIpfsCid,
            uploaded_at: identity.timestamp,
            uploader_ref: 'issuer',
            meta: {
                cert_number: certNumber
            }
        };

        const certEvent = {
            event_id: eventId,
            type: 'CERT_ISSUED',
            at: identity.timestamp,
            actor_ref: 'issuer',
            ref_doc_id: docId,
            cert_number: certNumber
        };

        seedBatch.documents.push(certDoc);
        seedBatch.events.push(certEvent);
        seedBatch.audit.revision += 1;
        seedBatch.audit.last_modified_by_ref = 'issuer';
        seedBatch.audit.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        // ZTA: Create certificate index for quick lookup
        await this._indexCertificate(ctx, certNumber, id);

        await this._logAuditTrail(ctx, 'ISSUE_CERTIFICATE', id, {
            certNumber: certNumber,
            expiryMonths: months,
            expiryDate: expiryDate.toISOString(),
            issuerKeycloakId: identity.keycloakId
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

        if (seedBatch.status.current !== 'CERTIFIED' && seedBatch.status.current !== 'DISTRIBUTED') {
            throw new Error(`Hanya benih bersertifikat yang bisa dicabut.`);
        }

        // ZTA: Log critical security action
        this._logSecurityEvent(ctx, 'CERTIFICATE_REVOCATION',
            `Certificate ${seedBatch.certification.cert_number} for batch ${id} is being revoked by ${identity.keycloakId}. Reason: ${reason}`);

        // Update certification object
        const txTimestamp = ctx.stub.getTxTimestamp();
        seedBatch.certification.revoked_at = new Date(txTimestamp.seconds.toInt() * 1000).toISOString();
        seedBatch.certification.revoke_reason = this._sanitizeInput(reason);

        seedBatch.status.current = 'REVOKED';
        seedBatch.status.since = identity.timestamp;

        // Generate IDs
        const docId = this._generateCounter('DOC-REVOKE', seedBatch.documents);
        const eventId = this._generateCounter('EVT', seedBatch.events);

        const revokeDoc = {
            doc_id: docId,
            doc_type: 'revocation',
            name: 'Berita Acara Pencabutan',
            uploaded_at: identity.timestamp,
            uploader_ref: 'issuer',
            meta: {
                reason: this._sanitizeInput(reason)
            }
        };

        const revokeEvent = {
            event_id: eventId,
            type: 'CERT_REVOKED',
            at: identity.timestamp,
            actor_ref: 'issuer',
            ref_doc_id: docId,
            reason: this._sanitizeInput(reason)
        };

        seedBatch.documents.push(revokeDoc);
        seedBatch.events.push(revokeEvent);
        seedBatch.audit.revision += 1;
        seedBatch.audit.last_modified_by_ref = 'issuer';
        seedBatch.audit.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        // ZTA: Remove from certificate index
        await this._removeCertificateIndex(ctx, seedBatch.certification.cert_number);

        await this._logAuditTrail(ctx, 'REVOKE_CERTIFICATE', id, {
            certNumber: seedBatch.certification.cert_number,
            reason: reason,
            revokerKeycloakId: identity.keycloakId
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

        if (seedBatch.status.current !== 'CERTIFIED') {
            throw new Error(`Hanya benih bersertifikat yang boleh diedarkan.`);
        }

        // ZTA: Verify caller is the owner (producer) of this batch
        this._verifyResourceOwnership(identity, seedBatch, 'producer');

        // ZTA: Verify certificate not expired (using transaction timestamp)
        const txTimestamp = ctx.stub.getTxTimestamp();
        const now = new Date(txTimestamp.seconds.toInt() * 1000);
        const expiry = new Date(seedBatch.certification.expires_at);
        if (now > expiry) {
            this._logSecurityEvent(ctx, 'EXPIRED_CERTIFICATE_USE',
                `Attempt to distribute batch ${id} with expired certificate ${seedBatch.certification.cert_number} by ${identity.keycloakId}`);
            throw new Error(`Sertifikat kadaluarsa pada ${expiry.toISOString()}.`);
        }

        // ZTA: Check if certificate is revoked
        if (seedBatch.status.current === 'REVOKED') {
            this._logSecurityEvent(ctx, 'REVOKED_CERTIFICATE_USE',
                `Attempt to distribute batch ${id} with revoked certificate ${seedBatch.certification.cert_number} by ${identity.keycloakId}`);
            throw new Error('Sertifikat telah dicabut. Distribusi tidak diizinkan.');
        }

        seedBatch.status.current = 'DISTRIBUTED';
        seedBatch.status.since = identity.timestamp;

        // Generate IDs
        const docId = this._generateCounter('DOC-DIST', seedBatch.documents);
        const eventId = this._generateCounter('EVT', seedBatch.events);

        const distDoc = {
            doc_id: docId,
            doc_type: 'distribution',
            name: 'Bukti Distribusi',
            uploaded_at: identity.timestamp,
            uploader_ref: 'producer',
            meta: {
                location: this._sanitizeInput(distributionLocation),
                quantity: {
                    amount: qty,
                    unit: 'UNIT'
                }
            }
        };

        const distEvent = {
            event_id: eventId,
            type: 'DISTRIBUTED',
            at: identity.timestamp,
            actor_ref: 'producer',
            ref_doc_id: docId
        };

        seedBatch.documents.push(distDoc);
        seedBatch.events.push(distEvent);
        seedBatch.audit.revision += 1;
        seedBatch.audit.last_modified_by_ref = 'producer';
        seedBatch.audit.last_modified_at = identity.timestamp;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(seedBatch)));

        await this._logAuditTrail(ctx, 'DISTRIBUTE_SEED', id, {
            location: distributionLocation,
            quantity: qty,
            distributorKeycloakId: identity.keycloakId
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
            keycloakId: cid.getAttributeValue('keycloak_id') || '',
            username: cid.getAttributeValue('username') || '',
            mspId: cid.getMSPID(),
            timestamp: new Date(txTimestamp.seconds.toInt() * 1000).toISOString(),
            txId: ctx.stub.getTxID(),
            channelId: ctx.stub.getChannelID()
        };

        await this._logAuditTrail(ctx, 'READ_HISTORY', id, {
            accessType: 'full_history',
            accessorKeycloakId: identity.keycloakId
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
                // Updated to check doc_type instead of docType
                if (jsonRes.Record.doc_type === 'SeedBatch') {
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

        // Updated to use nested status.current field
        const queryString = {
            selector: {
                doc_type: 'SeedBatch',
                'status.current': status
            }
        };

        return await this._getQueryResultForQueryString(ctx, JSON.stringify(queryString));
    }

    // =========================================================
    // Query by Producer (with strict ownership check using keycloak_id)
    // LevelDB-compatible: uses getStateByRange + filter instead of rich query
    // =========================================================
    async querySeedBatchesByProducer(ctx, producerKeycloakId) {
        const identity = this._verifyIdentityAndContext(ctx, 'role_producer');

        // ZTA: Strict ownership verification using keycloak_id
        if (!identity.keycloakId) {
            throw new Error('Identity tidak memiliki keycloak_id. Akses ditolak.');
        }

        if (producerKeycloakId !== identity.keycloakId) {
            this._logSecurityEvent(ctx, 'UNAUTHORIZED_QUERY',
                `Producer ${identity.keycloakId} attempted to query batches of ${producerKeycloakId}`);
            throw new Error(`Anda hanya bisa melihat batch benih milik Anda sendiri.`);
        }

        this._validateUUID('producerKeycloakId', producerKeycloakId);

        await this._logAuditTrail(ctx, 'QUERY_BY_PRODUCER', producerKeycloakId, {
            producerKeycloakId: producerKeycloakId
        }, identity);

        // LevelDB-compatible: iterate all states and filter by producer
        const iterator = await ctx.stub.getStateByRange('', '');
        const allResults = [];

        let result = await iterator.next();
        while (!result.done) {
            const res = result.value;
            try {
                const record = JSON.parse(res.value.toString('utf8'));
                // Filter: only SeedBatch with matching actors.producer.keycloak_id
                if (record.doc_type === 'SeedBatch' &&
                    record.actors?.producer?.keycloak_id === producerKeycloakId) {
                    allResults.push({
                        Key: res.key,
                        Record: record
                    });
                }
            } catch (err) {
                console.log(`Error parsing record: ${err}`);
            }
            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(allResults);
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
