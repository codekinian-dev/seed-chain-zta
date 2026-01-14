<script setup>
import { reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthLayout from '../../layouts/AuthLayout.vue'

const router = useRouter()

const form = reactive({
  fullName: '',
  organization: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  agree: true,
})

function handleSubmit() {
  if (form.password !== form.confirmPassword) {
    alert('Password and confirmation do not match. Please check again.')
    return
  }

  // Placeholder: integrate with backend registration flow
  console.table(form)
  router.push('/dashboard')
}
</script>

<template>
  <AuthLayout
    title="Create your SeedCertify account"
    subtitle="Start modernizing seed certification with fast, transparent cross-team collaboration."
    highlight-title="Estate Collaboration"
    highlight-description="One unified portal for field teams, labs, and regulators to safeguard national seed quality."
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-ink" for="fullName">Full Name</label>
          <input
            id="fullName"
            v-model="form.fullName"
            type="text"
            placeholder="Name as per ID"
            class="input-field"
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
            required
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
            required
          />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-ink" for="password">Password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="Minimum 6 characters"
            minlength="6"
            class="input-field"
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
            minlength="6"
            class="input-field"
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

      <button type="submit" class="primary-button w-full">Create Account</button>
    </form>

    <template #footer>
      <div class="flex flex-wrap items-center justify-center gap-2 text-sm text-ink/60">
        Already have an account?
        <RouterLink to="/login" class="font-semibold text-primary hover:text-primary-600">Sign in here</RouterLink>
      </div>
    </template>
  </AuthLayout>
</template>
