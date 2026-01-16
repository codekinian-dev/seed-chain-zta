# Frontend API Integration

Clean architecture untuk integrasi frontend dengan backend API Gateway.

## 📁 Struktur Folder

```
src/
├── services/
│   ├── http-client.js          # HTTP client dengan interceptors
│   └── api/
│       ├── index.js             # Export semua services
│       ├── identity.service.js  # Authentication & user management
│       ├── seed-batch.service.js # Seed batch operations
│       └── health.service.js    # Health check endpoints
├── composables/
│   ├── useAuth.js               # Auth state management
│   ├── useSeedBatch.js          # Seed batch state management
│   └── useApi.js                # Generic API handler
├── middleware/
│   └── auth.guard.js            # Route guards
└── utils/
    ├── error-handler.js         # Error handling utilities
    ├── validation.js            # Form validation
    ├── date-formatter.js        # Date formatting
    ├── storage.js               # LocalStorage wrapper
    └── constants.js             # Application constants
```

## 🚀 Cara Penggunaan

### 1. Setup Environment Variables

Buat file `.env.development`:

```env
VITE_API_BASE_URL=https://gateway.jabarchain.me
VITE_APP_ENV=development
```

### 2. Menggunakan Service Langsung

```javascript
import { identityService, seedBatchService } from "@/services/api";

// Login
const response = await identityService.login({
  username: "user123",
  password: "password123",
});

// Get batches
const batches = await seedBatchService.getMyBatches();
```

### 3. Menggunakan Composables (Recommended)

```vue
<script setup>
import { useAuth } from "@/composables/useAuth";
import { useSeedBatch } from "@/composables/useSeedBatch";

// Auth composable
const { user, isAuthenticated, login, logout, isLoading, error } = useAuth();

// Seed batch composable
const {
  batches,
  fetchMyBatches,
  createBatch,
  isLoading: batchLoading,
} = useSeedBatch();

// Login function
const handleLogin = async () => {
  try {
    await login({
      username: "user123",
      password: "password123",
    });
    // Redirect to dashboard
    router.push("/dashboard");
  } catch (err) {
    console.error("Login failed:", err);
  }
};

// Fetch batches
const loadBatches = async () => {
  try {
    await fetchMyBatches();
  } catch (err) {
    console.error("Failed to load batches:", err);
  }
};
</script>
```

### 4. Protected Routes

Routes sudah dilengkapi dengan authentication guard:

```javascript
// Route dengan autentikasi
{
  path: '/dashboard',
  name: 'dashboard',
  component: DashboardView,
  meta: { requiresAuth: true }
}

// Route dengan role-based access
{
  path: '/certifications/pre-planting',
  name: 'certifications-pre-planting',
  component: CertificationView,
  meta: {
    requiresAuth: true,
    roles: ['inspector', 'certifier', 'admin']
  }
}

// Route khusus guest (login/register)
{
  path: '/login',
  name: 'login',
  component: LoginView,
  meta: { guestOnly: true }
}
```

## 📚 API Services

### Identity Service

```javascript
import { identityService } from "@/services/api";

// Register
await identityService.register({
  username: "user123",
  email: "user@example.com",
  password: "password123",
  firstName: "John",
  lastName: "Doe",
  role: "producer",
});

// Login
await identityService.login({
  username: "user123",
  password: "password123",
});

// Register and Enroll (blockchain)
await identityService.registerAndEnroll({
  username: "user123",
  email: "user@example.com",
  password: "password123",
  firstName: "John",
  lastName: "Doe",
  role: "producer",
  affiliation: "org1.department1",
});

// Get Identity Status
await identityService.getStatus("user123");

// List Identities
await identityService.listIdentities();

// Logout
identityService.logout();

// Check authentication
const isAuth = identityService.isAuthenticated();

// Get current user
const user = identityService.getCurrentUser();
```

### Seed Batch Service

```javascript
import { seedBatchService } from "@/services/api";

// Get my batches
const myBatches = await seedBatchService.getMyBatches();

// Get all batches
const allBatches = await seedBatchService.getAllBatches({
  status: "CERTIFIED",
  page: 1,
  limit: 10,
});

// Create batch
const newBatch = await seedBatchService.createBatch({
  batchNumber: "BATCH001",
  seedClass: "FS",
  variety: "Padi Gogo",
  quantity: 1000,
  // ... other fields
});

// Get batch by ID
const batch = await seedBatchService.getBatchById("batch-id-123");

// Get batch history
const history = await seedBatchService.getBatchHistory("batch-id-123");

// Submit certification request
await seedBatchService.submitCertificationRequest("batch-id-123", {
  documents: ["ipfs-cid-1", "ipfs-cid-2"],
});

// Record inspection
await seedBatchService.recordInspection("batch-id-123", {
  inspectorId: "inspector-123",
  notes: "Field inspection completed",
  result: "PASSED",
});

// Evaluate inspection
await seedBatchService.evaluateInspection("batch-id-123", {
  evaluatorId: "evaluator-123",
  status: "APPROVED",
  comments: "All criteria met",
});

// Issue certificate
await seedBatchService.issueCertificate("batch-id-123", {
  certificateNumber: "CERT-2026-001",
  issuedBy: "certifier-123",
  validUntil: "2027-01-15",
});

// Record distribution
await seedBatchService.recordDistribution("batch-id-123", {
  distributorId: "dist-123",
  quantity: 500,
  destination: "Warehouse A",
});

// Upload document to IPFS
const file = document.getElementById("fileInput").files[0];
const result = await seedBatchService.uploadDocument(file);
console.log("IPFS CID:", result.cid);

// Get document from IPFS
const doc = await seedBatchService.getDocument("ipfs-cid-123");
```

### Health Service

```javascript
import { healthService } from "@/services/api";

// Check system health
const health = await healthService.getHealth();

// Liveness probe
await healthService.getLiveness();

// Readiness probe
await healthService.getReadiness();
```

## 🛡️ Error Handling

```javascript
import { formatError, logError } from "@/utils/error-handler";

try {
  await seedBatchService.createBatch(data);
} catch (error) {
  // Format error for display
  const formattedError = formatError(error);
  console.log(formattedError.message);

  // Log error for debugging
  logError(error, "createBatch");

  // Show notification
  showNotification({
    type: "error",
    message: formattedError.message,
  });
}
```

## ✅ Form Validation

```javascript
import { validateForm, isValidEmail } from "@/utils/validation";

const formData = {
  username: "user123",
  email: "user@example.com",
  password: "Password123",
};

const rules = {
  username: [
    { required: true, message: "Username wajib diisi" },
    { minLength: 3, message: "Username minimal 3 karakter" },
  ],
  email: [
    { required: true, message: "Email wajib diisi" },
    { email: true, message: "Format email tidak valid" },
  ],
  password: [
    { required: true, message: "Password wajib diisi" },
    { minLength: 8, message: "Password minimal 8 karakter" },
  ],
};

const validation = validateForm(formData, rules);

if (!validation.valid) {
  console.log("Errors:", validation.errors);
}
```

## 📅 Date Formatting

```javascript
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
} from "@/utils/date-formatter";

// Format date
formatDate("2026-01-15"); // "15 Januari 2026"

// Format datetime
formatDateTime("2026-01-15T10:30:00"); // "15 Januari 2026, 10:30"

// Relative time
formatRelativeTime("2026-01-14T10:00:00"); // "2 hari yang lalu"
```

## 💾 Storage Utilities

```javascript
import storage from "@/utils/storage";

// Save data
storage.local.set("user", { name: "John", role: "producer" });

// Get data
const user = storage.local.get("user");

// Check if exists
if (storage.local.has("user")) {
  console.log("User exists");
}

// Remove data
storage.local.remove("user");

// Clear all
storage.local.clear();
```

## 🎯 Constants

```javascript
import {
  USER_ROLES,
  BATCH_STATUS,
  BATCH_STATUS_LABELS,
} from "@/utils/constants";

// Use constants
const role = USER_ROLES.PRODUCER;
const status = BATCH_STATUS.CERTIFIED;
const label = BATCH_STATUS_LABELS[status]; // "Tersertifikasi"
```

## 🔐 Authentication Flow

1. User login → Token disimpan di localStorage
2. Token otomatis ditambahkan ke setiap request (Authorization header)
3. Jika token expired (401), user di-redirect ke login
4. Route guards memeriksa autentikasi sebelum akses halaman

## 🏗️ Best Practices

1. **Gunakan Composables** untuk state management
2. **Centralized Error Handling** menggunakan utils/error-handler.js
3. **Validation** dilakukan di frontend dan backend
4. **Type Safety** - gunakan JSDoc untuk better IDE support
5. **Separation of Concerns** - Service layer terpisah dari UI logic
6. **Reusability** - Composables bisa digunakan di multiple components
7. **Clean Code** - Consistent naming dan structure

## 📝 Testing

```javascript
// Example usage in component
<script setup>
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const username = ref('')
const password = ref('')
const { login, isLoading, error } = useAuth()

const handleSubmit = async () => {
  try {
    await login({
      username: username.value,
      password: password.value
    })
    // Success
  } catch (err) {
    // Error handled by composable
    console.error(error.value)
  }
}
</script>
```

## 🔄 HTTP Client Features

- Automatic token management
- Request/Response interceptors
- Error handling with auto-logout on 401
- Support untuk GET, POST, PUT, PATCH, DELETE
- Support untuk file upload (multipart/form-data)
- Centralized base URL configuration

## 📱 Responsive & Accessible

Semua utility dan service dirancang untuk:

- Mudah di-maintain
- Scalable
- Testable
- Type-safe dengan JSDoc
- Developer-friendly dengan clear documentation

## 🆘 Troubleshooting

### CORS Issues

Pastikan backend mengizinkan origin frontend di CORS configuration.

### 401 Unauthorized

Token expired atau tidak valid. User akan otomatis di-redirect ke login.

### Network Errors

Periksa koneksi internet dan pastikan API base URL benar di `.env`.

## 🚀 Production Deployment

1. Set environment variables di production:

   ```env
   VITE_API_BASE_URL=https://gateway.jabarchain.me
   VITE_APP_ENV=production
   ```

2. Build aplikasi:

   ```bash
   npm run build
   ```

3. Deploy folder `dist` ke hosting

## 📞 Support

Untuk pertanyaan atau issues, silakan buat issue di repository.
