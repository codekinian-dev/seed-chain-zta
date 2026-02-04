<script setup>
import { computed } from 'vue'
import {
  CheckCircleIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  TruckIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/vue/24/outline'
import { formatDate } from '../../utils/date-formatter'
import { buildTimeline, formatEventType } from '../../utils/batch-helpers'

const props = defineProps({
  batch: {
    type: Object,
    required: true
  },
  limit: {
    type: Number,
    default: null
  }
})

// Build timeline with actor and document references
const timeline = computed(() => {
  const items = buildTimeline(props.batch)
  return props.limit ? items.slice(-props.limit) : items
})

// Get icon component for event type
const getEventIcon = (type) => {
  const iconMap = {
    'CREATED': ClockIcon,
    'SUBMITTED': DocumentTextIcon,
    'FIELD_INSPECTED': ClipboardDocumentCheckIcon,
    'CHIEF_EVALUATED': CheckCircleIcon,
    'CERT_ISSUED': CheckCircleIcon,
    'DISTRIBUTED': TruckIcon,
    'CERT_REVOKED': XCircleIcon
  }
  return iconMap[type] || ClockIcon
}

// Get color class for event type
const getEventColorClass = (type) => {
  const colorMap = {
    'CREATED': 'text-blue-600 bg-blue-100',
    'SUBMITTED': 'text-yellow-600 bg-yellow-100',
    'FIELD_INSPECTED': 'text-indigo-600 bg-indigo-100',
    'CHIEF_EVALUATED': 'text-purple-600 bg-purple-100',
    'CERT_ISSUED': 'text-green-600 bg-green-100',
    'DISTRIBUTED': 'text-cyan-600 bg-cyan-100',
    'CERT_REVOKED': 'text-red-600 bg-red-100'
  }
  return colorMap[type] || 'text-gray-600 bg-gray-100'
}
</script>

<template>
  <div class="flow-root">
    <ul class="-mb-8">
      <li v-for="(event, idx) in timeline" :key="event.event_id" class="relative pb-8">
        <!-- Connector line -->
        <span
          v-if="idx !== timeline.length - 1"
          class="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200"
          aria-hidden="true"
        />
        
        <div class="relative flex items-start space-x-3">
          <!-- Icon -->
          <div>
            <span :class="['h-10 w-10 rounded-full flex items-center justify-center', getEventColorClass(event.type)]">
              <component :is="getEventIcon(event.type)" class="w-5 h-5" aria-hidden="true" />
            </span>
          </div>
          
          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div>
              <div class="text-sm">
                <span class="font-semibold text-gray-900">{{ event.formattedType }}</span>
              </div>
              <p class="mt-0.5 text-xs text-gray-500">
                {{ formatDate(event.at) }}
              </p>
            </div>
            
            <!-- Actor info -->
            <div v-if="event.actor" class="mt-1 text-sm text-gray-700">
              <span class="font-medium">{{ event.actor.username }}</span>
              <span class="text-gray-500"> • {{ event.actor.role }}</span>
            </div>
            
            <!-- Event note -->
            <div v-if="event.note" class="mt-1 text-sm text-gray-600">
              {{ event.note }}
            </div>
            
            <!-- Document reference -->
            <!-- <div v-if="event.document && event.document.cid" class="mt-2 text-sm">
              <a
                :href="`/ipfs/${event.document.cid}`"
                target="_blank"
                class="inline-flex items-center text-primary hover:text-primary-dark"
              >
                <DocumentTextIcon class="w-4 h-4 mr-1" />
                {{ event.document.file_name || event.document.name }}
              </a>
            </div> -->
            
            <!-- Decision badge (for evaluation events) -->
            <div v-if="event.decision" class="mt-2">
              <span
                :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  event.decision === 'APPROVE' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                ]"
              >
                {{ event.decision }}
              </span>
            </div>
            
            <!-- Certificate number -->
            <div v-if="event.cert_number" class="mt-1 font-mono text-sm text-gray-600">
              Cert #{{ event.cert_number }}
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Additional styles if needed */
</style>
