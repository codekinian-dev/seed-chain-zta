<script setup>
import { ref, onMounted } from 'vue'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ServerIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'
import { healthService, identityService } from '../../services/api'

// State
const loading = ref(true)
const healthStatus = ref(null)
const identityStatus = ref(null)
const healthError = ref(null)
const identityError = ref(null)

// Get current user
const currentUser = identityService.getCurrentUser()

// Load health status
const loadHealthStatus = async () => {
  try {
    healthError.value = null
    const response = await healthService.getHealth()
    healthStatus.value = response.data || response
  } catch (error) {
    console.error('Failed to load health status:', error)
    healthError.value = error.message || 'Failed to check system health'
    healthStatus.value = { status: 'error' }
  }
}

// Load identity status
const loadIdentityStatus = async () => {
  if (!currentUser) {
    identityStatus.value = { enrolled: false, message: 'No user logged in' }
    return
  }

  try {
    identityError.value = null
    const response = await identityService.getStatus(currentUser.username)
    identityStatus.value = response.data || response
  } catch (error) {
    console.error('Failed to load identity status:', error)
    identityError.value = error.message || 'Failed to check enrollment status'
    identityStatus.value = { enrolled: false, error: true }
  }
}

// Load all data
const loadData = async () => {
  loading.value = true
  await Promise.all([
    loadHealthStatus(),
    loadIdentityStatus()
  ])
  loading.value = false
}

// Refresh data
const refresh = () => {
  loadData()
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <DashboardLayout 
    page-title="System Overview" 
    page-subtitle="Health status and user enrollment information"
  >
    <template #header-actions>
      <button 
        class="secondary-button" 
        @click="refresh"
        :disabled="loading"
      >
        <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': loading }" />
        Refresh
      </button>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div class="inline-block w-8 h-8 border-4 rounded-full border-t-transparent border-primary animate-spin"></div>
        <p class="mt-2 text-sm text-ink/60">Loading system status...</p>
      </div>
    </div>

    <!-- Content -->
    <div v-else class="grid gap-6 md:grid-cols-2">
      <!-- Health Status Card -->
      <section class="panel-card p-6">
        <div class="flex items-start justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg bg-primary/10">
              <ServerIcon class="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-ink">API Health Status</h3>
              <p class="text-sm text-ink/60">System connectivity and availability</p>
            </div>
          </div>
        </div>

        <div v-if="healthError" class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-start gap-3">
            <XCircleIcon class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-semibold text-red-900">Health Check Failed</p>
              <p class="text-sm text-red-700 mt-1">{{ healthError }}</p>
            </div>
          </div>
        </div>

        <div v-else-if="healthStatus" class="space-y-4">
          <!-- Overall Status -->
          <div class="p-4 rounded-lg" :class="healthStatus.status === 'healthy' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
            <div class="flex items-center gap-3">
              <CheckCircleIcon v-if="healthStatus.status === 'healthy'" class="w-6 h-6 text-green-600" />
              <XCircleIcon v-else class="w-6 h-6 text-red-600" />
              <div>
                <p class="text-sm font-semibold" :class="healthStatus.status === 'healthy' ? 'text-green-900' : 'text-red-900'">
                  {{ healthStatus.status === 'healthy' ? 'System Healthy' : 'System Error' }}
                </p>
                <p class="text-xs mt-1" :class="healthStatus.status === 'healthy' ? 'text-green-700' : 'text-red-700'">
                  API is {{ healthStatus.status === 'healthy' ? 'operational' : 'experiencing issues' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Service Details -->
          <div v-if="healthStatus.services" class="space-y-3">
            <h4 class="text-sm font-semibold text-ink">Service Status</h4>
            <div 
              v-for="(service, name) in healthStatus.services" 
              :key="name"
              class="p-3 bg-gray-50 border border-gray-200 rounded-lg"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div 
                    class="w-2 h-2 rounded-full" 
                    :class="service.status === 'healthy' || service.status === 'connected' ? 'bg-green-500' : 'bg-red-500'"
                  ></div>
                  <span class="text-sm font-medium text-ink capitalize">{{ name }}</span>
                </div>
                <span 
                  class="text-xs px-2 py-1 rounded-full font-medium"
                  :class="service.status === 'healthy' || service.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                >
                  {{ service.status }}
                </span>
              </div>
              <p v-if="service.message" class="text-xs text-gray-600 mt-1">{{ service.message }}</p>
            </div>
          </div>

          <!-- Additional Info -->
          <div v-if="healthStatus.timestamp || healthStatus.uptime" class="pt-4 border-t border-gray-200">
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div v-if="healthStatus.timestamp">
                <p class="text-ink/60">Last Check</p>
                <p class="font-medium text-ink mt-1">{{ new Date(healthStatus.timestamp).toLocaleString() }}</p>
              </div>
              <div v-if="healthStatus.uptime">
                <p class="text-ink/60">Uptime</p>
                <p class="font-medium text-ink mt-1">{{ Math.floor(healthStatus.uptime / 60) }}m</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Identity Enrollment Status Card -->
      <section class="panel-card p-6">
        <div class="flex items-start justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg bg-ocean/10">
              <UserCircleIcon class="w-6 h-6 text-ocean" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-ink">User Enrollment Status</h3>
              <p class="text-sm text-ink/60">Blockchain identity verification</p>
            </div>
          </div>
        </div>

        <div v-if="!currentUser" class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div class="flex items-start gap-3">
            <XCircleIcon class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-semibold text-yellow-900">No User Logged In</p>
              <p class="text-sm text-yellow-700 mt-1">Please log in to check enrollment status</p>
            </div>
          </div>
        </div>

        <div v-else-if="identityError" class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-start gap-3">
            <XCircleIcon class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-semibold text-red-900">Enrollment Check Failed</p>
              <p class="text-sm text-red-700 mt-1">{{ identityError }}</p>
            </div>
          </div>
        </div>

        <div v-else-if="identityStatus" class="space-y-4">
          <!-- Enrollment Status -->
          <div class="p-4 rounded-lg" :class="identityStatus.enrolled ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'">
            <div class="flex items-center gap-3">
              <CheckCircleIcon v-if="identityStatus.enrolled" class="w-6 h-6 text-green-600" />
              <XCircleIcon v-else class="w-6 h-6 text-yellow-600" />
              <div>
                <p class="text-sm font-semibold" :class="identityStatus.enrolled ? 'text-green-900' : 'text-yellow-900'">
                  {{ identityStatus.enrolled ? 'User Enrolled' : 'Not Enrolled' }}
                </p>
                <p class="text-xs mt-1" :class="identityStatus.enrolled ? 'text-green-700' : 'text-yellow-700'">
                  {{ identityStatus.enrolled ? 'Identity verified in blockchain network' : 'User needs enrollment to access blockchain features' }}
                </p>
              </div>
            </div>
          </div>

          <!-- User Details -->
          <div class="space-y-3">
            <h4 class="text-sm font-semibold text-ink">User Information</h4>
            <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <div class="flex justify-between">
                <span class="text-sm text-ink/60">Username</span>
                <span class="text-sm font-medium text-ink">{{ currentUser.username }}</span>
              </div>
              <div v-if="currentUser.email" class="flex justify-between">
                <span class="text-sm text-ink/60">Email</span>
                <span class="text-sm font-medium text-ink">{{ currentUser.email }}</span>
              </div>
              <div v-if="currentUser.roles && currentUser.roles.length > 0" class="flex justify-between items-center">
                <span class="text-sm text-ink/60">Roles</span>
                <div class="flex flex-wrap gap-1 justify-end">
                  <span 
                    v-for="role in currentUser.roles" 
                    :key="role"
                    class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium"
                  >
                    {{ role.replace('role_', '') }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Enrollment Details -->
          <div v-if="identityStatus.enrolled && identityStatus.certificate" class="space-y-3">
            <h4 class="text-sm font-semibold text-ink">Certificate Details</h4>
            <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2 text-xs">
              <div v-if="identityStatus.mspId" class="flex justify-between">
                <span class="text-ink/60">MSP ID</span>
                <span class="font-mono text-ink">{{ identityStatus.mspId }}</span>
              </div>
              <div v-if="identityStatus.affiliation" class="flex justify-between">
                <span class="text-ink/60">Affiliation</span>
                <span class="font-mono text-ink">{{ identityStatus.affiliation }}</span>
              </div>
              <div v-if="identityStatus.type" class="flex justify-between">
                <span class="text-ink/60">Type</span>
                <span class="font-mono text-ink">{{ identityStatus.type }}</span>
              </div>
            </div>
          </div>

          <!-- Action Button -->
          <div v-if="!identityStatus.enrolled" class="pt-4 border-t border-gray-200">
            <button class="w-full primary-button" @click="$router.push('/identity/enroll')">
              Enroll Identity
            </button>
          </div>
        </div>
      </section>
    </div>
  </DashboardLayout>
</template>
