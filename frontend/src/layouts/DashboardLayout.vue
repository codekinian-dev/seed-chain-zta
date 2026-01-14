<script setup>
import { computed, defineProps, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  Bars3Icon,
  BellIcon,
  Squares2X2Icon,
  ShieldCheckIcon,
  InboxStackIcon,
  CubeIcon,
  BeakerIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
} from '@heroicons/vue/24/outline'

defineProps({
  pageTitle: {
    type: String,
    required: true,
  },
  pageSubtitle: {
    type: String,
    default: '',
  },
})

const navigation = [
  { name: 'Overview', to: '/dashboard', icon: Squares2X2Icon },
  // { name: 'Permohonan', to: '/dashboard/applications', icon: InboxStackIcon },
  // { name: 'Pengujian Mutu', to: '/dashboard/labs', icon: BeakerIcon },
  // { name: 'Validasi Lapangan', to: '/dashboard/field-validation', icon: ShieldCheckIcon },
  { name: 'Seed Source Evaluation', to: '/seed-source-evaluations', icon: ShieldCheckIcon },
  { name: 'Seed Business Recommendation', to: '/seed-business-recommendations', icon: ClipboardDocumentListIcon },
  { name: 'Seed Batches', to: '/seed-batches', icon: CubeIcon },
  { name: 'Pre-Planting Certification', to: '/certifications/pre-planting', icon: DocumentCheckIcon },
  { name: 'Planting-Ready Certification', to: '/certifications/planting-ready', icon: DocumentCheckIcon },
  { name: 'Seed Distribution', to: '/seed-distribution', icon: InboxStackIcon },
  // { name: 'Analitik', to: '/dashboard/analytics', icon: ChartBarIcon },
]

const route = useRoute()

const isSidebarOpen = ref(false)

const activePath = computed(() => route.path)

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}
</script>

<template>
  <div class="min-h-screen bg-surface">
    <div class="relative flex min-h-screen">
      <transition name="fade">
        <div
          v-if="isSidebarOpen"
          class="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm lg:hidden"
          @click="closeSidebar"
        />
      </transition>

      <aside
        :class="[
          'fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-ink/10 bg-white/95 px-5 py-7 shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ]"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center justify-center text-2xl h-11 w-11 rounded-2xl bg-primary/10">🌿</span>
            <div>
              <p class="text-base font-semibold text-ink">SeedCertify</p>
              <p class="text-xs tracking-widest uppercase text-ink/40">Admin Panel</p>
            </div>
          </div>
          <button class="p-2 transition border rounded-2xl border-ink/10 text-ink/50 hover:text-primary lg:hidden" @click="closeSidebar">
            <ArrowRightOnRectangleIcon class="w-5 h-5" />
          </button>
        </div>

        <div class="mt-10 space-y-6">
          <div>
            <p class="section-title">Main Menu</p>
            <nav class="mt-3 space-y-1">
              <template v-for="item in navigation" :key="item.to">
                <RouterLink
                  :to="item.to"
                  class="relative flex items-center gap-3 px-4 py-3 text-sm font-semibold transition group rounded-2xl"
                  :class="
                    activePath.startsWith(item.to)
                      ? 'bg-primary/10 text-primary'
                      : 'text-ink/70 hover:bg-primary/5 hover:text-ink'
                  "
                  @click="closeSidebar"
                >
                  <span
                    class="absolute w-1 h-8 transition-opacity -translate-y-1/2 rounded-full left-2 top-1/2 bg-primary"
                    :class="activePath.startsWith(item.to) ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'"
                  />
                  <component :is="item.icon" class="w-5 h-5" />
                  <span>{{ item.name }}</span>
                </RouterLink>
              </template>
            </nav>
          </div>

          <div class="p-5 text-sm border rounded-3xl border-primary/15 bg-primary/5 text-ink/70">
            <p class="text-xs font-semibold tracking-widest uppercase text-primary">SLA Monitoring</p>
            <p class="mt-3 text-sm">
              This week's SLA reached 86%. Keep field inspection schedules on time.
            </p>
            <button class="w-full mt-5 secondary-button">View Details</button>
          </div>
        </div>

        <div class="p-5 mt-auto space-y-4 text-sm border rounded-3xl border-ink/10 bg-surface/80 text-ink/70">
          <p class="font-semibold text-primary">Need quick help?</p>
          <p>Contact our support center for certification guidance and field assistance.</p>
          <button class="w-full secondary-button">Contact Support</button>
        </div>
      </aside>

      <div class="flex flex-col flex-1">
        <header class="sticky top-0 z-20 border-b border-ink/10 bg-white/90 backdrop-blur-xl">
          <div class="flex flex-wrap items-center gap-3 px-6 py-4">
            <div class="flex items-center gap-4">
              <button class="p-2 transition border rounded-2xl border-ink/10 text-primary hover:border-primary hover:bg-primary/10 lg:hidden" @click="toggleSidebar">
                <Bars3Icon class="w-5 h-5" />
              </button>
              <div>
                <p class="text-xs font-semibold tracking-widest uppercase text-ink/40">SeedCertify Admin</p>
                <h1 class="text-xl font-semibold text-ink lg:text-2xl">{{ pageTitle }}</h1>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-end flex-1 gap-3">
              <slot name="header-actions" />
              <div class="flex items-center gap-3 px-4 py-2 border rounded-2xl border-ink/10 bg-white/80">
                <div class="flex items-center justify-center w-10 h-10 font-semibold rounded-full bg-primary/15 text-primary">
                  AR
                </div>
                <div class="hidden text-left lg:block">
                  <p class="text-sm font-semibold text-ink">Arini Rahma</p>
                  <p class="text-xs text-ink/60">Certification Admin</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 px-6 py-8 bg-surface">
          <div class="mx-auto space-y-8 max-w-7xl">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="space-y-3">
                <nav class="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-ink/40">
                  <RouterLink to="/dashboard" class="hover:text-primary">Dashboard</RouterLink>
                  <span>/</span>
                  <span class="text-ink/60">{{ pageTitle }}</span>
                </nav>
                <div class="space-y-1">
                  <h2 class="text-3xl font-semibold text-ink">{{ pageTitle }}</h2>
                  <p v-if="pageSubtitle" class="text-sm text-ink/60">{{ pageSubtitle }}</p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <slot name="subheader-actions">
                  <button class="secondary-button">Share Report</button>
                </slot>
              </div>
            </div>

            <slot />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
