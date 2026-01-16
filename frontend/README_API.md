# Frontend API Integration - Quick Start

## 🎯 Quick Links

- [Full Documentation](./API_INTEGRATION.md)
- [Backend API Docs](https://gateway.jabarchain.me/api-docs/)

## 📦 What's Been Created

### 1. **Services Layer** (`src/services/`)

- HTTP Client dengan auto-authentication
- Identity Service (login, register, enroll)
- Seed Batch Service (CRUD operations)
- Health Service (monitoring)

### 2. **Composables** (`src/composables/`)

- `useAuth()` - Authentication state management
- `useSeedBatch()` - Seed batch state management
- `useApi()` - Generic API handler

### 3. **Utilities** (`src/utils/`)

- Error handling
- Form validation
- Date formatting
- Storage wrapper
- Constants

### 4. **Middleware** (`src/middleware/`)

- Authentication guard
- Role-based authorization
- Guest-only routes

## 🚀 Getting Started

### 1. Install Dependencies (if needed)

```bash
cd frontend
npm install
```

### 2. Setup Environment

```bash
# Copy .env.example
cp .env.example .env.development

# Content of .env.development:
VITE_API_BASE_URL=https://gateway.jabarchain.me
VITE_APP_ENV=development
```

### 3. Run Development Server

```bash
npm run dev
```

## 💡 Usage Examples

### Login Example

```vue
<script setup>
import { ref } from "vue";
import { useAuth } from "@/composables/useAuth";

const { login, isLoading, error } = useAuth();
const username = ref("");
const password = ref("");

const handleLogin = async () => {
  try {
    await login({ username: username.value, password: password.value });
    // Success - redirect handled by auth guard
  } catch (err) {
    console.error(error.value);
  }
};
</script>
```

### Fetch Data Example

```vue
<script setup>
import { onMounted } from "vue";
import { useSeedBatch } from "@/composables/useSeedBatch";

const { batches, isLoading, error, fetchMyBatches } = useSeedBatch();

onMounted(async () => {
  await fetchMyBatches();
});
</script>
```

### Create Batch Example

```vue
<script setup>
import { useSeedBatch } from "@/composables/useSeedBatch";

const { createBatch, isLoading } = useSeedBatch();

const handleSubmit = async (formData) => {
  try {
    await createBatch({
      batchNumber: formData.batchNumber,
      seedClass: formData.seedClass,
      variety: formData.variety,
      quantity: formData.quantity,
    });
    // Success
  } catch (err) {
    // Handle error
  }
};
</script>
```

## 📁 File Structure

```
frontend/src/
├── services/
│   ├── http-client.js              # ✅ HTTP client with auth
│   └── api/
│       ├── index.js                # ✅ All services export
│       ├── identity.service.js     # ✅ Auth & user management
│       ├── seed-batch.service.js   # ✅ Seed operations
│       └── health.service.js       # ✅ Health checks
│
├── composables/
│   ├── useAuth.js                  # ✅ Auth composable
│   ├── useSeedBatch.js             # ✅ Batch composable
│   └── useApi.js                   # ✅ Generic API composable
│
├── middleware/
│   └── auth.guard.js               # ✅ Route guards
│
├── utils/
│   ├── error-handler.js            # ✅ Error utilities
│   ├── validation.js               # ✅ Form validation
│   ├── date-formatter.js           # ✅ Date formatting
│   ├── storage.js                  # ✅ Storage wrapper
│   └── constants.js                # ✅ App constants
│
└── router/
    └── index.js                    # ✅ Updated with guards
```

## 🔐 Authentication Flow

1. User login → Token saved to localStorage
2. Token automatically added to all API requests
3. On 401 error → User redirected to login
4. Route guards check auth before navigation

## 🎨 Features

✅ Clean Architecture  
✅ Easy to Maintain  
✅ Type-safe with JSDoc  
✅ Error Handling  
✅ Loading States  
✅ Auto Authentication  
✅ Route Protection  
✅ Role-based Access  
✅ IPFS Integration  
✅ File Upload Support

## 📝 Available API Methods

### Identity Service

- `register(userData)`
- `login(credentials)`
- `registerAndEnroll(userData)`
- `enroll(enrollData)`
- `getStatus(username)`
- `reenroll(username)`
- `revoke(username)`
- `listIdentities()`
- `logout()`
- `getCurrentUser()`
- `isAuthenticated()`

### Seed Batch Service

- `getMyBatches()`
- `getAllBatches(params)`
- `createBatch(batchData)`
- `getBatchById(id)`
- `getBatchHistory(id)`
- `submitCertificationRequest(id, data)`
- `recordInspection(id, inspectionData)`
- `evaluateInspection(id, evaluationData)`
- `issueCertificate(id, certificateData)`
- `recordDistribution(id, distributionData)`
- `uploadDocument(file)`
- `getDocument(cid)`

### Health Service

- `getHealth()`
- `getLiveness()`
- `getReadiness()`

## 🛠️ Next Steps

1. **Update existing components** to use new services
2. **Add loading states** using `isLoading` from composables
3. **Add error handling** using `error` from composables
4. **Test authentication flow** with real backend
5. **Implement IPFS upload** in forms

## 📚 Documentation

- [Full API Integration Guide](./API_INTEGRATION.md)
- [Backend API Documentation](https://gateway.jabarchain.me/api-docs/)

## 🆘 Common Issues

**CORS Error?**  
→ Check backend CORS configuration

**401 Unauthorized?**  
→ Token expired, user will be redirected to login

**Network Error?**  
→ Check API_BASE_URL in .env file

## ✨ Key Benefits

1. **Clean Code**: Separation of concerns
2. **Reusable**: Composables can be used anywhere
3. **Type Safe**: JSDoc for better IDE support
4. **Error Handling**: Centralized error management
5. **Maintainable**: Easy to update and extend
6. **Testable**: Services can be mocked easily

---

**Status**: ✅ Ready to Use  
**Architecture**: Clean & Maintainable  
**Backend**: https://gateway.jabarchain.me
