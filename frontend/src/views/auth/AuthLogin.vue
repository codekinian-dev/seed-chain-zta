<script setup>
import { reactive } from 'vue'
import { RouterLink } from 'vue-router'
import AuthLayout from '../../layouts/AuthLayout.vue'

const form = reactive({
  email: '',
  password: '',
  remember: true,
})

function handleSubmit() {
  // Placeholder: integrate with actual auth flow later
  console.table(form)
}
</script>

<template>
  <AuthLayout
    title="Welcome back"
    subtitle="Sign in to manage seed certification workflows, monitor progress, and collaborate with field teams."
    highlight-title="SeedCertify Analytics"
    highlight-description="End-to-end insights across certification—from batch registration to final validation."
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <div class="space-y-2">
        <label class="text-sm font-medium text-ink" for="email">Email Address</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          placeholder="name@email.com"
          autocomplete="email"
          class="input-field"
          required
        />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm font-medium text-ink">
          <label for="password">Password</label>
          <RouterLink to="#" class="text-primary hover:text-primary-600">Forgot password?</RouterLink>
        </div>
        <input
          id="password"
          v-model="form.password"
          type="password"
          placeholder="Enter password"
          autocomplete="current-password"
          class="input-field"
          required
          minlength="6"
        />
      </div>

      <div class="flex items-center justify-between text-sm text-ink/70">
        <label class="flex items-center gap-3">
          <input
            v-model="form.remember"
            type="checkbox"
            class="h-4 w-4 rounded border-ink/20 text-primary focus:ring-primary"
          />
          Remember me for 30 days
        </label>
        <RouterLink to="/register" class="flex items-center gap-1 font-semibold text-primary">
          Create a new account
          <span aria-hidden="true">→</span>
        </RouterLink>
      </div>

      <button type="submit" class="primary-button w-full">Sign in to SeedCertify</button>
    </form>

    <template #footer>
      <div class="text-center text-sm text-ink/60">
        By signing in, you agree to
        <RouterLink to="#" class="font-semibold text-primary hover:text-primary-600">Terms & Conditions</RouterLink>
        and
        <RouterLink to="#" class="font-semibold text-primary hover:text-primary-600">Privacy Policy</RouterLink>
      </div>
    </template>
  </AuthLayout>
</template>
