# Zero Trust Architecture - Policy Engine

## Overview

Implementasi Zero Trust Architecture (ZTA) menggunakan in-process policy engine tanpa server OPA terpisah. Sistem ini menerapkan prinsip **"Never Trust, Always Verify"** dengan kebijakan **Default Deny**.

## Fitur

### 1. **Role-Based Access Control (RBAC)**
- Setiap resource dan action dipetakan ke role yang diizinkan
- Mendukung multiple roles per user
- Validasi role dari token Keycloak

### 2. **Time-Based Access Control**
- Akses ditolak pada jam 22:00 - 06:00
- Mencegah aktivitas di luar jam kerja
- Audit trail untuk akses di waktu tidak biasa

### 3. **Attribute-Based Access Control (ABAC)**
- Context-aware decisions
- Ownership validation
- IP dan User-Agent tracking

### 4. **Default Deny**
- Semua akses ditolak kecuali eksplisit diizinkan
- Unknown resource/action langsung ditolak
- Invalid user langsung ditolak

## Struktur Policy

```javascript
{
  'resource_name': {
    'action_name': ['allowed_role1', 'allowed_role2']
  }
}
```

### Contoh:
```javascript
'seed_batch': {
  'create': ['role_producer'],
  'read': ['role_producer', 'role_pbt_field', 'role_pbt_chief', 'role_lsm_head']
}
```

## Penggunaan

### 1. Menggunakan Middleware (Recommended)

```javascript
const { enforcePolicy } = require('../middleware/policy');

router.post('/seed-batches',
  keycloak.protect(),
  enforcePolicy('seed_batch', 'create'),
  controller.createSeedBatch
);
```

### 2. Menggunakan Policy Engine Langsung

```javascript
const policyEngine = require('../policies/policyEngine');

const user = {
  id: req.kauth.grant.access_token.content.sub,
  username: req.kauth.grant.access_token.content.preferred_username,
  roles: req.kauth.grant.access_token.content.realm_access.roles
};

const decision = policyEngine.evaluate(user, 'seed_batch', 'create');

if (!decision.allow) {
  return res.status(403).json({ error: decision.reason });
}
```

### 3. Ownership Validation

```javascript
router.put('/seed-batches/:id',
  keycloak.protect(),
  enforcePolicy('seed_batch', 'update', { ownerOnly: true }),
  controller.updateSeedBatch
);
```

### 4. Time Restriction Only

```javascript
const { enforceTimeRestriction } = require('../middleware/policy');

router.get('/public-data',
  enforceTimeRestriction(),
  controller.getPublicData
);
```

## Policy Rules

### Seed Batch
- **create**: role_producer
- **read**: role_producer, role_pbt_field, role_pbt_chief, role_lsm_head
- **update**: role_producer
- **delete**: role_producer

### Certification Request
- **submit**: role_producer
- **read**: role_producer, role_pbt_field, role_pbt_chief, role_lsm_head

### Inspection
- **create**: role_pbt_field
- **read**: role_pbt_field, role_pbt_chief, role_lsm_head
- **update**: role_pbt_field

### Evaluation
- **create**: role_pbt_chief
- **read**: role_pbt_chief, role_lsm_head
- **approve**: role_pbt_chief
- **reject**: role_pbt_chief

### Certificate
- **issue**: role_lsm_head
- **read**: role_producer, role_pbt_field, role_pbt_chief, role_lsm_head
- **revoke**: role_lsm_head

### Distribution
- **create**: role_producer
- **read**: role_producer, role_lsm_head

## Time Restrictions

**Restricted Hours**: 22:00 - 06:00

Semua request akan ditolak selama jam ini dengan response:
```json
{
  "error": "Forbidden",
  "message": "System access is restricted between 22:00 and 06:00. Current time: ..."
}
```

## Decision Object

```javascript
{
  allow: true/false,          // Apakah akses diizinkan
  reason: 'string',           // Alasan keputusan
  user: 'username',           // Username yang request
  resource: 'resource_name',  // Resource yang diakses
  action: 'action_name',      // Action yang dilakukan
  matchedRole: 'role_name',   // Role yang cocok (jika allow)
  timestamp: 'ISO8601'        // Waktu evaluasi
}
```

## API Methods

### `evaluate(user, resource, action, context)`
Evaluasi single request.

**Parameters:**
- `user` (Object): User object dengan id, username, roles
- `resource` (String): Nama resource
- `action` (String): Nama action
- `context` (Object): Optional context (ownerOnly, ownerId, dll)

**Returns:** Decision object

### `evaluateBulk(user, requests)`
Evaluasi multiple requests sekaligus (performance optimization).

**Parameters:**
- `user` (Object): User object
- `requests` (Array): Array of {resource, action, context}

**Returns:** Array of decision objects

### `hasAnyRole(user, roles)`
Check apakah user punya salah satu dari roles.

### `hasAllRoles(user, roles)`
Check apakah user punya semua roles.

### `addPolicy(resource, action, roles)`
Tambah policy rule baru.

### `removePolicy(resource, action)`
Hapus policy rule.

### `getPolicies(resource)`
Ambil semua policies untuk resource.

## Testing

Jalankan unit test:

```bash
node tests/policy-engine.test.js
```

Test coverage:
- ✅ Role-based permissions
- ✅ Default deny
- ✅ Unknown resource/action
- ✅ Invalid user
- ✅ Ownership validation
- ✅ Bulk evaluation
- ✅ Helper functions
- ⏰ Time restrictions (depends on system time)

## Audit & Logging

Setiap policy decision di-log dengan level:
- **info**: Access granted
- **warn**: Access denied, time restriction
- **error**: Evaluation error

Log format:
```javascript
{
  allow: boolean,
  user: 'username',
  resource: 'resource_name',
  action: 'action_name',
  reason: 'string',
  matchedRole: 'role_name',
  timestamp: 'ISO8601'
}
```

## Security Best Practices

1. **Always use middleware**: Jangan bypass policy engine
2. **Validate token**: Selalu gunakan `keycloak.protect()` sebelum `enforcePolicy()`
3. **Least privilege**: Berikan role minimal yang diperlukan
4. **Monitor logs**: Review policy denials secara berkala
5. **Update policies**: Review dan update rules sesuai kebutuhan bisnis

## Troubleshooting

### Access Denied - Invalid User
- Pastikan Keycloak authentication berhasil
- Check `req.kauth.grant` ada
- Verify token contains roles

### Access Denied - Time Restriction
- Check system time
- Adjust restricted hours jika perlu di `policyEngine.js`

### Access Denied - Insufficient Permissions
- Verify user roles di Keycloak
- Check policy rules untuk resource/action
- Pastikan role name match persis

### Unknown Resource/Action
- Check typo di resource/action name
- Tambah policy rule jika resource/action baru

## Extending Policies

Tambah resource/action baru:

```javascript
// Tambah langsung ke policyEngine.policies
policyEngine.addPolicy('new_resource', 'new_action', ['role_name']);

// Atau edit langsung di policyEngine.js constructor
this.policies = {
  // ... existing policies
  'new_resource': {
    'new_action': ['role_name']
  }
};
```

## Performance

- In-process: No network latency
- Synchronous evaluation: < 1ms per request
- Bulk evaluation: Parallel processing
- Memory efficient: Single instance, shared policies

## Comparison with OPA

| Feature | This Implementation | OPA Server |
|---------|-------------------|------------|
| Deployment | In-process | Separate service |
| Latency | < 1ms | Network + processing |
| Complexity | Low | Medium-High |
| Scalability | Process-bound | Independent scaling |
| Policy Language | JavaScript | Rego |
| Learning Curve | Low | Medium |

## Migration Path to OPA (Future)

Jika perlu scaling atau policy management yang lebih kompleks:

1. Keep interface sama (`evaluate()` method)
2. Replace implementation dengan OPA client
3. Migrate policies ke Rego format
4. Deploy OPA server
5. Update config untuk OPA endpoint

Policy engine dirancang dengan abstraction layer yang memudahkan migration.
