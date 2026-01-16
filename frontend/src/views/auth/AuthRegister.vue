<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthLayout from '../../layouts/AuthLayout.vue'
import { useAuth } from '../../composables/useAuth'

const router = useRouter()
const { registerAndEnroll, isLoading, error } = useAuth()

const form = reactive({
  username: '',
  fullName: '',
  organization: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  role: 'role_producer',
  agree: true,
})

const errorMessage = ref('')
const successMessage = ref('')

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  
  if (form.password !== form.confirmPassword) {
    errorMessage.value = 'Password dan konfirmasi password tidak cocok.'
    return
  }

  try {
    // Split full name into first and last name
    const nameParts = form.fullName.trim().split(' ')
    const firstName = nameParts[0] || form.fullName
    const lastName = nameParts.slice(1).join(' ') || firstName

    await registerAndEnroll({
      username: form.username,
      email: form.email,
      password: form.password,
      firstName: firstName,
      lastName: lastName,
      role: form.role,
      affiliation: form.organization || 'org1.department1',
    })
    
    successMessage.value = 'Registrasi berhasil! Silakan login dengan akun Anda.'
    
    // Redirect to login after 2 seconds
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } catch (err) {
    errorMessage.value = error.value || 'Registrasi gagal. Periksa data Anda dan coba lagi.'
  }
}
</script>

<template>
  <AuthLayout
    title="Create your SeedCertify account"
    subtitle="Start modernizing seed certification with fast, transparent cross-team collaboration."
    highlight-title="Estate Collaboration"
    highlight-description="One unified portal for field teams, labs, and regulators to safeguard national seed quality."
  >
    <!-- Success Alert -->
    <div v-if="successMessage" class="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-800">
      <div class="flex items-start">
        <svg class="mr-3 h-5 w-5 flex-shrink-0 text-green-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <span>{{ successMessage }}</span>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="errorMessage" class="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">
      <div class="flex items-start">
        <svg class="mr-3 h-5 w-5 flex-shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <span>{{ errorMessage }}</span>
      </div>
    </div>

    <form class="space-y-5" @submit.prevent="handleSubmit">
      <div class="space-y-2">
        <label class="text-sm font-medium text-ink" for="username">Username</label>
        <input
          id="username"
          v-model="form.username"
          type="text"
          placeholder="Choose a username"
          class="input-field"
          :disabled="isLoading"
          required
          minlength="3"
          maxlength="20"
          pattern="[a-zA-Z0-9_]+"
          title="Username hanya boleh mengandung huruf, angka, dan underscore"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-ink" for="fullName">Full Name</label>
          <input
            id="fullName"
            v-model="form.fullName"
            type="text"
            placeholder="Name as per ID"
            class="input-field"
            :disabled="isLoading"
            required
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-ink" for="organization">Agency / Company</label>
          <input
            id="organization"
            v-model="form.organization"
            type="text"
            placeholder="e.g., Seed Certification Unit"
            class="input-field"
            :disabled="isLoading"
          />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-ink" for="email">Email Address</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="name@agency.gov"
            class="input-field"
            :disabled="isLoading"
            required
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-ink" for="phone">Contact Number</label>
          <input
            id="phone"
            v-model="form.phone"
            type="tel"
            placeholder="+62xxxxxxxxxx"
            class="input-field"
            :disabled="isLoading"
          />
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-ink" for="role">Role</label>
        <select
          id="role"
          v-model="form.role"
          class="input-field"
          :disabled="isLoading"
          required
        >
          <option value="role_producer">Producer (Produsen Benih)</option>
          <option value="role_pbt_field">PBT Field (Petugas Lapangan)</option>
          <option value="role_pbt_chief">PBT Chief (Kepala Tim Sertifikasi)</option>
          <option value="role_lsm_head">LSM Head (Kepala Lembaga Sertifikasi)</option>
        </select>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-ink" for="password">Password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="Minimum 8 characters"
            minlength="8"
            class="input-field"
            :disabled="isLoading"
            required
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-ink" for="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            placeholder="Repeat password"
            minlength="8"
            class="input-field"
            :disabled="isLoading"
            required
          />
        </div>
      </div>

      <label class="flex items-start gap-3 text-sm text-ink/70">
        <input
          v-model="form.agree"
          type="checkbox"
          class="mt-1 h-4 w-4 rounded border-ink/20 text-primary focus:ring-primary"
          required
        />
        <span>
          I agree to the
          <RouterLink to="#" class="font-semibold text-primary hover:text-primary-600">Terms & Conditions</RouterLink>
          and
          <RouterLink to="#" class="font-semibold text-primary hover:text-primary-600">Privacy Policy</RouterLink>
          in effect.
        </span>
      </label>

      <button type="submit" class="primary-button w-full" :disabled="isLoading">
        <span v-if="isLoading" class="flex items-center justify-center">
          <svg class="mr-2 h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Creating Account...
        </span>
        <span v-else>Create Account</span>
      </button>
    </form>

    <template #footer>
      <div class="flex flex-wrap items-center justify-center gap-2 text-sm text-ink/60">
        Already have an account?
        <RouterLink to="/login" class="font-semibold text-primary hover:text-primary-600">Sign in here</RouterLink>
      </div>
    </template>
  </AuthLayout>
</template>
