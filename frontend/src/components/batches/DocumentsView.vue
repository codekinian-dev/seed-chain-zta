<script setup>
import { computed } from 'vue'
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  DocumentIcon,
  FolderIcon
} from '@heroicons/vue/24/outline'
import { formatDate } from '../../utils/date-formatter'
import { formatDocumentType, getActorByRef, getIPFSUrl } from '../../utils/batch-helpers'

const props = defineProps({
  batch: {
    type: Object,
    required: true
  },
  groupByType: {
    type: Boolean,
    default: false
  }
})

// Documents dengan actor info
const documentsWithActors = computed(() => {
  const docs = props.batch?.documents || []
  return docs.map(doc => ({
    ...doc,
    actor: getActorByRef(props.batch, doc.uploader_ref),
    formattedType: formatDocumentType(doc.doc_type),
    ipfsUrl: getIPFSUrl(doc.cid)
  }))
})

// Group documents by type jika diminta
const groupedDocuments = computed(() => {
  if (!props.groupByType) return null
  
  const groups = {}
  documentsWithActors.value.forEach(doc => {
    if (!groups[doc.doc_type]) {
      groups[doc.doc_type] = []
    }
    groups[doc.doc_type].push(doc)
  })
  return groups
})

// Get icon untuk document type
const getDocIcon = (docType) => {
  const iconMap = {
    'certificate': DocumentIcon,
    'seed_source': DocumentTextIcon,
    'field_inspection': DocumentTextIcon,
    'chief_evaluation': DocumentTextIcon,
    'certification_request': DocumentTextIcon,
    'distribution': DocumentTextIcon,
    'revocation': DocumentTextIcon
  }
  return iconMap[docType] || DocumentTextIcon
}

// Get badge color untuk doc type
const getDocTypeBadge = (docType) => {
  const colorMap = {
    'seed_source': 'bg-blue-100 text-blue-800',
    'certification_request': 'bg-yellow-100 text-yellow-800',
    'field_inspection': 'bg-indigo-100 text-indigo-800',
    'chief_evaluation': 'bg-purple-100 text-purple-800',
    'certificate': 'bg-green-100 text-green-800',
    'distribution': 'bg-cyan-100 text-cyan-800',
    'revocation': 'bg-red-100 text-red-800'
  }
  return colorMap[docType] || 'bg-gray-100 text-gray-800'
}
</script>

<template>
  <div>
    <!-- List view (default) -->
    <div v-if="!groupByType" class="space-y-3">
      <div
        v-for="doc in documentsWithActors"
        :key="doc.doc_id"
        class="p-4 bg-white border border-gray-200 rounded-lg hover:border-primary/30 transition"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1">
            <!-- Icon -->
            <div class="flex-shrink-0">
              <component :is="getDocIcon(doc.doc_type)" class="w-6 h-6 text-gray-400" />
            </div>
            
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2">
                <p class="text-sm font-medium text-gray-900 truncate">
                  {{ doc.file_name || doc.name }}
                </p>
                <span :class="['inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full', getDocTypeBadge(doc.doc_type)]">
                  {{ doc.formattedType }}
                </span>
              </div>
              
              <p class="mt-1 text-xs text-gray-500">
                Uploaded: {{ formatDate(doc.uploaded_at) }}
              </p>
              
              <div v-if="doc.actor" class="mt-1 text-xs text-gray-600">
                By: <span class="font-medium">{{ doc.actor.username }}</span>
              </div>
              
              <!-- Metadata -->
              <div v-if="doc.meta && Object.keys(doc.meta).length > 0" class="mt-2 p-2 bg-gray-50 rounded text-xs">
                <div v-for="(value, key) in doc.meta" :key="key" class="text-gray-600">
                  <span class="font-medium capitalize">{{ key.replace('_', ' ') }}:</span>
                  <span class="ml-1">
                    {{ typeof value === 'object' ? JSON.stringify(value) : value }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex-shrink-0 ml-3">
            <a
              v-if="doc.cid"
              :href="doc.ipfsUrl"
              target="_blank"
              class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-dark rounded transition"
            >
              <ArrowDownTrayIcon class="w-4 h-4 mr-1" />
              View
            </a>
          </div>
        </div>
      </div>
      
      <!-- Empty state -->
      <div v-if="documentsWithActors.length === 0" class="p-8 text-center text-gray-500">
        <FolderIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p class="text-sm">No documents uploaded yet</p>
      </div>
    </div>
    
    <!-- Grouped view -->
    <div v-else class="space-y-6">
      <div v-for="(docs, type) in groupedDocuments" :key="type">
        <h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center">
          <component :is="getDocIcon(type)" class="w-5 h-5 mr-2 text-gray-400" />
          {{ formatDocumentType(type) }}
          <span class="ml-2 text-xs font-normal text-gray-500">({{ docs.length }})</span>
        </h4>
        
        <div class="space-y-2 ml-7">
          <div
            v-for="doc in docs"
            :key="doc.doc_id"
            class="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">
                {{ doc.file_name || doc.name }}
              </p>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ formatDate(doc.uploaded_at) }}
              </p>
            </div>
            <a
              v-if="doc.cid"
              :href="doc.ipfsUrl"
              target="_blank"
              class="ml-3 text-sm text-primary hover:text-primary-dark"
            >
              View
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
