<script setup>
import { computed } from 'vue'
import {
  UserIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  DocumentCheckIcon
} from '@heroicons/vue/24/outline'

const props = defineProps({
  batch: {
    type: Object,
    required: true
  }
})

// Extract actors yang ada (not null)
const activeActors = computed(() => {
  const actors = props.batch?.actors || {}
  return [
    { key: 'producer', label: 'Producer', icon: UserIcon, data: actors.producer },
    { key: 'inspector_field', label: 'Field Inspector', icon: ShieldCheckIcon, data: actors.inspector_field },
    { key: 'inspector_chief', label: 'Chief Inspector', icon: ShieldCheckIcon, data: actors.inspector_chief },
    { key: 'issuer', label: 'Certificate Issuer', icon: DocumentCheckIcon, data: actors.issuer }
  ].filter(actor => actor.data !== null)
})

// Get role badge color
const getRoleBadgeColor = (role) => {
  const colorMap = {
    'PRODUCER': 'bg-blue-100 text-blue-800',
    'INSPECTOR_FIELD': 'bg-indigo-100 text-indigo-800',
    'INSPECTOR_CHIEF': 'bg-purple-100 text-purple-800',
    'ISSUER': 'bg-green-100 text-green-800'
  }
  return colorMap[role] || 'bg-gray-100 text-gray-800'
}
</script>

<template>
  <div class="space-y-4">
    <div v-for="actor in activeActors" :key="actor.key" class="p-4 bg-white border border-gray-200 rounded-lg">
      <div class="flex items-start space-x-3">
        <!-- Icon -->
        <div class="flex-shrink-0">
          <component :is="actor.icon" class="w-6 h-6 text-gray-400" />
        </div>
        
        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-gray-900">{{ actor.label }}</p>
            <span :class="['inline-flex items-center px-2 py-1 text-xs font-medium rounded-full', getRoleBadgeColor(actor.data.role)]">
              {{ actor.data.role }}
            </span>
          </div>
          
          <p class="mt-1 text-sm font-semibold text-gray-700">{{ actor.data.username }}</p>
          
          <div class="mt-2 text-xs text-gray-500 space-y-1">
            <p class="font-mono">ID: {{ actor.data.keycloak_id }}</p>
            <p>MSP: {{ actor.data.msp_id }}</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Empty state -->
    <div v-if="activeActors.length === 0" class="p-8 text-center text-gray-500">
      <UserCircleIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
      <p class="text-sm">No actors recorded yet</p>
    </div>
  </div>
</template>
