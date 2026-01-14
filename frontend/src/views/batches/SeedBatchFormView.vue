<script setup>
import { useRouter } from 'vue-router'
import {
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  BeakerIcon,
  CloudArrowUpIcon,
  CalendarDaysIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const praOptions = [
  { id: 'PT-2025-031', label: 'PT-2025-031 • Batch DxP Tenera-22 (Pre-planting passed)' },
  { id: 'PT-2025-028', label: 'PT-2025-028 • Batch RRIM-600 (Awaiting verification)' },
  { id: 'PT-2025-021', label: 'PT-2025-021 • Batch Liberika-15 (Pre-planting passed)' },
]

const dokumenChecklist = [
  { id: 1, label: 'Harvest report', status: 'Not uploaded' },
  { id: 2, label: 'Laboratory test result', status: 'Complete' },
  { id: 3, label: 'Storage warehouse photos', status: 'Not uploaded' },
]

const timeline = [
  { id: 1, title: 'Batch identity entered', detail: 'Done', tone: 'done' },
  { id: 2, title: 'Upload batch documents', detail: 'Pending', tone: 'pending' },
  { id: 3, title: 'Link to pre/planting-ready', detail: 'Pending', tone: 'pending' },
]

const statusToneClass = (tone) => {
  const map = {
    done: 'bg-primary/10 text-primary',
    pending: 'bg-ink/5 text-ink/70',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const goBackToList = () => router.push('/seed-batches')
</script>

<template>
  <DashboardLayout
    page-title="Seed Batch Form"
    page-subtitle="Record batch identity, lab test results, and link to pre/planting-ready certification."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Batch drafts
      </button>
      <button class="primary-button">
        Save batch
      </button>
    </template>

    <template #subheader-actions>
      <button class="secondary-button" @click="goBackToList">Back to list</button>
    </template>

    <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div class="space-y-6">
        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <DocumentTextIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Batch Identity</h3>
              <p class="text-sm text-ink/60">Seed batch details and pre-planting linkage.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Batch ID</label>
              <input type="text" class="text-input" placeholder="BT-2025-032" />
            </div>
            <div class="input-group">
              <label class="input-label">Batch Name</label>
              <input type="text" class="text-input" placeholder="Batch DxP Tenera-22" />
            </div>
            <div class="input-group md:col-span-2">
              <label class="input-label">Source estate</label>
              <input type="text" class="text-input" placeholder="Seed Source Estate Citra" />
            </div>
            <div class="input-group">
              <label class="input-label">Commodity</label>
              <select class="text-input">
                <option>Palm Oil</option>
                <option>Rubber</option>
                <option>Coffee</option>
                <option>Cocoa</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Variety/Clone</label>
              <input type="text" class="text-input" placeholder="DxP Tenera-22" />
            </div>
            <div class="input-group md:col-span-2">
              <label class="input-label">Related pre-planting ID</label>
              <select class="text-input">
                <option disabled selected>Select a pre-planting application</option>
                <option v-for="pra in praOptions" :key="pra.id">{{ pra.label }}</option>
              </select>
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <BeakerIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Production & Quality</h3>
              <p class="text-sm text-ink/60">Harvest volume, schedule, and lab results.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Volume (seeds/seedlings)</label>
              <input type="number" class="text-input" placeholder="50,000" />
            </div>
            <div class="input-group">
              <label class="input-label">Harvest date</label>
              <div class="flex items-center gap-2">
                <CalendarDaysIcon class="w-5 h-5 text-ink/50" />
                <input type="text" class="text-input" placeholder="05 October 2025" />
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">Moisture content (%)</label>
              <input type="number" class="text-input" placeholder="10" />
            </div>
            <div class="input-group">
              <label class="input-label">Test status</label>
              <select class="text-input">
                <option>Awaiting result</option>
                <option>Passed</option>
                <option>Retest required</option>
              </select>
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <MapPinIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Location & Storage</h3>
              <p class="text-sm text-ink/60">Warehouse details and storage conditions.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Storage warehouse</label>
              <input type="text" class="text-input" placeholder="West Zone Main Warehouse" />
            </div>
            <div class="input-group">
              <label class="input-label">Storage temperature (°C)</label>
              <input type="number" class="text-input" placeholder="22" />
            </div>
            <div class="input-group md:col-span-2">
              <label class="input-label">Condition notes</label>
              <textarea class="text-input min-h-[120px]" placeholder="Warehouse cleanliness, ventilation, and batch labels."></textarea>
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <CloudArrowUpIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Batch Documents</h3>
              <p class="text-sm text-ink/60">Upload harvest report, lab results, and warehouse photos.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="p-6 text-center border border-dashed rounded-2xl border-primary/30 bg-primary/5">
              <p class="text-sm font-semibold text-primary">Drag & drop documents here</p>
              <p class="mt-1 text-xs text-ink/60">PDF, JPG, PNG • max 20MB</p>
              <button class="mx-auto mt-4 primary-button">
                <CloudArrowUpIcon class="w-5 h-5" />
                Choose files
              </button>
            </div>
            <div class="space-y-3">
              <div
                v-for="item in dokumenChecklist"
                :key="item.id"
                class="flex items-center justify-between px-4 py-3 border rounded-xl border-ink/10 bg-surface"
              >
                <div class="flex items-center gap-3">
                  <CheckCircleIcon
                    v-if="item.status === 'Complete'"
                    class="w-5 h-5 text-primary"
                  />
                  <ExclamationTriangleIcon
                    v-else
                    class="w-5 h-5 text-sunshine"
                  />
                  <p class="text-sm font-semibold text-ink">{{ item.label }}</p>
                </div>
                <span :class="['status-pill', item.status === 'Complete' ? 'bg-primary/10 text-primary' : 'bg-sunshine/10 text-sunshine']">
                  {{ item.status }}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <div class="p-6 panel-card">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-ink">Batch Progress</h3>
              <p class="text-sm text-ink/60">Track form completion steps.</p>
            </div>
            <span class="status-pill bg-primary/10 text-primary">1/3 steps</span>
          </div>
          <div class="mt-6 space-y-3">
            <div
              v-for="step in timeline"
              :key="step.id"
              class="flex items-start justify-between px-4 py-3 bg-white border rounded-2xl border-ink/10"
            >
              <div>
                <p class="text-sm font-semibold text-ink">{{ step.title }}</p>
                <p class="text-xs text-ink/50">{{ step.detail }}</p>
              </div>
              <span :class="['status-pill', statusToneClass(step.tone)]">{{ step.tone === 'done' ? 'Done' : 'Pending' }}</span>
            </div>
          </div>
        </div>

        <div class="p-6 space-y-4 panel-card">
          <h3 class="text-lg font-semibold text-ink">Batch checklist</h3>
          <ul class="space-y-3 text-sm text-ink/70">
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary" />
              <span>Batch linked to the source estate.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="w-5 h-5 mt-0.5 text-sunshine" />
              <span>Harvest report not uploaded.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="w-5 h-5 mt-0.5 text-sunshine" />
              <span>Warehouse photos not uploaded.</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </DashboardLayout>
</template>
