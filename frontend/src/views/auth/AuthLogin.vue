<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthLayout from '../../layouts/AuthLayout.vue'
import { useAuth } from '../../composables/useAuth'

const router = useRouter()
const { login, isLoading, error } = useAuth()

const form = reactive({
  username: '',
  password: '',
  remember: true,
})

const errorMessage = ref('')

async function handleSubmit() {
  errorMessage.value = ''
  
  try {
    const response = await login({
      username: form.username,
      password: form.password,
    })
    
    console.log('Login success:', response)
    console.log('Token stored:', localStorage.getItem('access_token'))
    
    // Use replace instead of push to avoid guard loop
    router.replace('/dashboard')
  } catch (err) {
    console.error('Login error:', err)
    errorMessage.value = error.value || 'Login gagal. Periksa username dan password Anda.'
  }
}
</script>

<template>
  <AuthLayout
    title="Welcome back"
    subtitle=""
    highlight-title="BenihChain"
    highlight-description="End-to-end insights across certification—from batch registration to final validation."
  >
    <!-- Error Alert -->
    <div v-if="errorMessage" class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50">
      <div class="flex items-start">
        <svg class="flex-shrink-0 w-5 h-5 mr-3 text-red-400" viewBox="0 0 20 20" fill="currentColor">
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
          placeholder="Enter your username"
          autocomplete="username"
          class="input-field"
          :disabled="isLoading"
          required
        />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm font-medium text-ink">
          <label for="password">Password</label>
          <!-- <RouterLink to="#" class="text-primary hover:text-primary-600">Forgot password?</RouterLink> -->
        </div>
        <input
          id="password"
          v-model="form.password"
          type="password"
          placeholder="Enter password"
          autocomplete="current-password"
          class="input-field"
          :disabled="isLoading"
          required
          minlength="6"
        />
      </div>

      <div class="flex items-center justify-between text-sm text-ink/70">
        <label class="flex items-center gap-3">
          <input
            v-model="form.remember"
            type="checkbox"
            class="w-4 h-4 rounded border-ink/20 text-primary focus:ring-primary"
          />
          Remember me
        </label>
        <RouterLink to="/register" class="flex items-center gap-1 font-semibold text-primary">
          Create a new account
          <span aria-hidden="true">→</span>
        </RouterLink>
      </div>

      <button type="submit" class="w-full primary-button" :disabled="isLoading">
        <span v-if="isLoading" class="flex items-center justify-center">
          <svg class="w-4 h-4 mr-2 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Signing in...
        </span>
        <span v-else>Sign in</span>
      </button>

      <!-- Public Verification Link -->
      <div class="pt-4 mt-4 text-center border-t border-ink/10">
        <p class="text-sm text-ink/60">
          Perlu memverifikasi dokumen?
          <RouterLink to="/verify" class="font-semibold text-primary hover:text-primary/80">
            Verifikasi Publik →
          </RouterLink>
        </p>
      </div>
    </form>

    <template #footer>
      <!-- <div class="text-sm text-center text-ink/60">
        By signing in, you agree to
        <RouterLink to="#" class="font-semibold text-primary hover:text-primary-600">Terms & Conditions</RouterLink>
        and
        <RouterLink to="#" class="font-semibold text-primary hover:text-primary-600">Privacy Policy</RouterLink>
      </div> -->
    </template>
  </AuthLayout>
</template>
