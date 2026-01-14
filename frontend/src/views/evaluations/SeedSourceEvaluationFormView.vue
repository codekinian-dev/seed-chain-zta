<script setup>
import { useRouter } from 'vue-router'
import {
  CloudArrowUpIcon,
  ClipboardDocumentListIcon,
  MapPinIcon,
  ChartBarSquareIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const dokumenChecklist = [
  { id: 1, label: 'Estate map and boundaries', status: 'Complete' },
  { id: 2, label: 'Field inspection minutes', status: 'Not uploaded' },
  { id: 3, label: 'Seed moisture test result', status: 'Complete' },
  { id: 4, label: 'Sample block photos', status: 'Not uploaded' },
]

const timeline = [
  { id: 1, title: 'Evaluation requested', detail: '03 Oct 2025 • System', tone: 'done' },
  { id: 2, title: 'Field officer assigned', detail: '04 Oct 2025 • West Zone', tone: 'done' },
  { id: 3, title: 'Upload seed documents', detail: 'Pending', tone: 'pending' },
  { id: 4, title: 'Technical validation', detail: 'Auto-check after upload', tone: 'pending' },
]

const statusToneClass = (tone) => {
  const map = {
    done: 'bg-primary/10 text-primary',
    pending: 'bg-ink/5 text-ink/70',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const goBackToList = () => {
  router.push('/seed-source-evaluations')
}
</script>

<template>
  <DashboardLayout
    page-title="Seed Source Evaluation Form"
    page-subtitle="Fill in estate details, commodity info, documents, and field notes."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Evaluation drafts
      </button>
      <button class="primary-button">
        Save & submit evaluation
      </button>
    </template>

    <template #subheader-actions>
      <button class="secondary-button" @click="goBackToList">Back to list</button>
    </template>

    <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div class="space-y-6">
        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <MapPinIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Estate Information</h3>
              <p class="text-sm text-ink/60">Seed source location identity.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Estate Name</label>
              <input type="text" class="text-input" placeholder="e.g., Seed Source Estate Citra" />
            </div>
            <div class="input-group">
              <label class="input-label">Estate Code</label>
              <input type="text" class="text-input" placeholder="SC-KBN-2025-019" />
            </div>
            <div class="input-group">
              <label class="input-label">Province</label>
              <input type="text" class="text-input" placeholder="West Java" />
            </div>
            <div class="input-group">
              <label class="input-label">Regency/City</label>
              <input type="text" class="text-input" placeholder="Bogor" />
            </div>
            <div class="input-group">
              <label class="input-label">Coordinate (Lat)</label>
              <input type="text" class="text-input" placeholder="-6.5890" />
            </div>
            <div class="input-group">
              <label class="input-label">Coordinate (Long)</label>
              <input type="text" class="text-input" placeholder="106.8166" />
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <DocumentTextIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Commodity Details</h3>
              <p class="text-sm text-ink/60">Block specs and planting material.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Commodity</label>
              <select class="text-input">
                <option>Palm Oil</option>
                <option>Rubber</option>
                <option>Coffee</option>
                <option>Cocoa</option>
                <option>Liberica Coffee</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Clone/Variety</label>
              <input type="text" class="text-input" placeholder="DxP Tenera-19" />
            </div>
            <div class="input-group">
              <label class="input-label">Mother Source</label>
              <input type="text" class="text-input" placeholder="Mother Block 03" />
            </div>
            <div class="input-group">
              <label class="input-label">Block Area (ha)</label>
              <input type="number" class="text-input" placeholder="12" />
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-3">
            <div class="input-group">
              <label class="input-label">Productive Population</label>
              <input type="number" class="text-input" placeholder="3,250" />
            </div>
            <div class="input-group">
              <label class="input-label">Bunch yield / ha</label>
              <input type="number" class="text-input" placeholder="135" />
            </div>
            <div class="input-group">
              <label class="input-label">Estimated seed production</label>
              <div class="flex items-center gap-2">
                <input type="number" class="text-input" placeholder="18,500" />
                <span class="text-sm text-ink/50">seeds</span>
              </div>
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <CloudArrowUpIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Upload Seed Documents</h3>
              <p class="text-sm text-ink/60">Attach required documents: lab results, minutes, and block photos.</p>
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

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <ChartBarSquareIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Field Evaluation Notes</h3>
              <p class="text-sm text-ink/60">Enter on-site observations.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Sanitation condition</label>
              <select class="text-input">
                <option>Good</option>
                <option>Fair</option>
                <option>Needs improvement</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Pest & disease notes</label>
              <input type="text" class="text-input" placeholder="No symptoms found" />
            </div>
            <div class="input-group md:col-span-2">
              <label class="input-label">Additional notes</label>
              <textarea
                class="text-input min-h-[120px]"
                placeholder="Write a summary of the inspection and follow-up recommendations."
              ></textarea>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <div class="p-6 panel-card">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-ink">Evaluation Progress</h3>
              <p class="text-sm text-ink/60">Track form completion steps.</p>
            </div>
            <span class="status-pill bg-primary/10 text-primary">3/5 steps</span>
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
          <h3 class="text-lg font-semibold text-ink">Validation checklist</h3>
          <ul class="space-y-3 text-sm text-ink/70">
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="mt-0.5 h-5 w-5 text-primary" />
              <span>Estate location, coordinates, and area completed.</span>
            </li>
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="mt-0.5 h-5 w-5 text-primary" />
              <span>Commodity, mother source, and productive population filled.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 text-sunshine" />
              <span>Upload seed moisture test document.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 text-sunshine" />
              <span>Sample block photos and inspection minutes not uploaded yet.</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </DashboardLayout>
</template>
