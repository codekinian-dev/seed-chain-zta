<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  PaperClipIcon,
  CheckBadgeIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const route = useRoute()
const router = useRouter()
const isSubmitting = ref(false)

const category = computed(() => route.query.category ?? 'pre-planting')

const form = reactive({
  distributionId: 'DST-2025-001',
  category: category.value,
  batchId: '',
  recipient: '',
  address: '',
  contact: '',
  quantity: '',
  unit: 'bags',
  shippingDate: '',
  notes: '',
  attachments: [],
})

const batchOptions = [
  { id: 'PT-2025-031', label: 'Batch DxP Tenera-22', status: 'Pre-planting approved' },
  { id: 'PT-2025-028', label: 'Batch RRIM-600', status: 'Pre-planting approved' },
  { id: 'ST-2025-010', label: 'Batch RRIM-600', status: 'Planting-ready passed' },
  { id: 'ST-2025-012', label: 'Batch DxP Tenera-22', status: 'Planting-ready passed' },
]

const filteredBatches = computed(() => {
  if (category.value === 'planting-ready') {
    return batchOptions.filter((b) => b.id.startsWith('ST-'))
  }
  return batchOptions.filter((b) => b.id.startsWith('PT-'))
})

const submitForm = async () => {
  isSubmitting.value = true  // Placeholder submission logic
  await new Promise((resolve) => setTimeout(resolve, 800))
  isSubmitting.value = false
  router.push('/seed-distribution')
}

const goBack = () => {
  router.push('/seed-distribution/new')
}
</script>

<template>
  <DashboardLayout
    page-title="Seed Distribution Form"
    :page-subtitle="
      category === 'planting-ready'
        ? 'Distribute planting-ready batches that passed certification.'
        : 'Distribute batches in the pre-planting stage.'
    "
  >
    <div class="flex flex-col gap-6 lg:flex-row">
      <section class="flex-1 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button class="ghost-button" @click="goBack">
            <ArrowLeftIcon class="w-5 h-5" />
            Back to categories
          </button>
          <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3rem] text-ink/40">
            <CheckBadgeIcon class="w-4 h-4" />
            {{ category === 'planting-ready' ? 'Planting-Ready' : 'Pre-Planting' }} Distribution
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <label class="input-label">Distribution ID</label>
            <input v-model="form.distributionId" type="text" class="text-input" disabled />
          </div>
          <div class="space-y-2">
            <label class="input-label">Category</label>
            <input
              v-model="form.category"
              type="text"
              class="text-input"
              disabled
            />
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <label class="input-label">Select batch</label>
            <select v-model="form.batchId" class="text-input">
              <option disabled value="">Select a batch</option>
              <option v-for="batch in filteredBatches" :key="batch.id" :value="batch.id">
                {{ batch.label }} — {{ batch.status }}
              </option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="input-label">Recipient / Organization</label>
            <input v-model="form.recipient" type="text" class="text-input" placeholder="e.g., Regional Nursery" />
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <label class="input-label">Delivery address</label>
            <input v-model="form.address" type="text" class="text-input" placeholder="Street, city, province" />
          </div>
          <div class="space-y-2">
            <label class="input-label">Contact number</label>
            <input v-model="form.contact" type="tel" class="text-input" placeholder="+62xxxxxxxxxx" />
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-3">
          <div class="space-y-2">
            <label class="input-label">Quantity</label>
            <input v-model="form.quantity" type="number" class="text-input" placeholder="e.g., 1200" />
          </div>
          <div class="space-y-2">
            <label class="input-label">Unit</label>
            <select v-model="form.unit" class="text-input">
              <option value="bags">Bags</option>
              <option value="kg">Kilograms</option>
              <option value="seeds">Seeds</option>
              <option value="seedlings">Seedlings</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="input-label">Shipping date</label>
            <input v-model="form.shippingDate" type="date" class="text-input" />
          </div>
        </div>

        <div class="space-y-2">
          <label class="input-label">Notes</label>
          <textarea
            v-model="form.notes"
            rows="3"
            class="text-input"
            placeholder="Additional details for the distribution"
          />
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-ink">Attachments</p>
              <p class="text-xs text-ink/60">Upload delivery documents or approvals.</p>
            </div>
            <button class="ghost-button" type="button">
              <CloudArrowUpIcon class="w-5 h-5" />
              Upload files
            </button>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="flex items-center gap-3 p-3 border rounded-2xl border-ink/10 bg-surface">
              <PaperClipIcon class="w-5 h-5 text-ink/50" />
              <div class="flex-1">
                <p class="text-sm font-semibold text-ink">Delivery order.pdf</p>
                <p class="text-xs text-ink/60">240 KB • PDF</p>
              </div>
              <button class="text-xs font-semibold text-primary hover:text-primary-600">Replace</button>
            </div>
            <div class="flex items-center gap-3 p-3 border rounded-2xl border-ink/10 bg-surface">
              <PaperClipIcon class="w-5 h-5 text-ink/50" />
              <div class="flex-1">
                <p class="text-sm font-semibold text-ink">Approval letter.jpg</p>
                <p class="text-xs text-ink/60">480 KB • JPG</p>
              </div>
              <button class="text-xs font-semibold text-primary hover:text-primary-600">Replace</button>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button class="ghost-button" type="button" @click="goBack">
            <ArrowPathIcon class="w-5 h-5" />
            Cancel
          </button>
          <button class="primary-button" :disabled="isSubmitting" type="button" @click="submitForm">
            <span v-if="isSubmitting" class="flex items-center gap-2">
              <ArrowPathIcon class="w-5 h-5 animate-spin" />
              Submitting...
            </span>
            <span v-else>Submit distribution</span>
          </button>
        </div>
      </section>

      <aside class="w-full max-w-sm space-y-4">
        <div class="p-5 border rounded-3xl border-ink/10 bg-white">
          <p class="text-xs font-semibold uppercase tracking-[0.3rem] text-ink/40">Summary</p>
          <div class="mt-4 space-y-3 text-sm text-ink/80">
            <div class="flex items-center justify-between">
              <span>Category</span>
              <span class="font-semibold text-ink">{{ category === 'planting-ready' ? 'Planting-Ready' : 'Pre-Planting' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Distribution ID</span>
              <span class="font-semibold text-ink">{{ form.distributionId }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Batch</span>
              <span class="font-semibold text-ink">{{ form.batchId || 'Not selected' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Quantity</span>
              <span class="font-semibold text-ink">{{ form.quantity ? `${form.quantity} ${form.unit}` : 'Not set' }}</span>
            </div>
          </div>
        </div>
        <div class="p-5 border rounded-3xl border-primary/15 bg-primary/5 text-ink">
          <div class="flex items-center gap-3">
            <DocumentTextIcon class="w-6 h-6 text-primary" />
            <div>
              <p class="text-sm font-semibold text-ink">Need a template?</p>
              <p class="text-xs text-ink/60">Download distribution template for your region.</p>
            </div>
          </div>
          <button class="w-full mt-4 secondary-button" type="button">Download template</button>
        </div>
      </aside>
    </div>
  </DashboardLayout>
</template>
