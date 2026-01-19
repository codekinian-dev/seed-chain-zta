<script setup>
import { computed, defineProps, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
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
  ChevronDownIcon,
  UserCircleIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/vue/24/outline'
import { useAuth } from '../composables/useAuth'
import { USER_ROLE_LABELS } from '../utils/constants'

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

const router = useRouter()
const { user, logout } = useAuth()

// Get user display info
const userName = computed(() => {
  if (user.value) {
    if (user.value.firstName && user.value.lastName) {
      return `${user.value.firstName} ${user.value.lastName}`
    }
    return user.value.username || user.value.name || 'User'
  }
  return 'User'
})

const userInitials = computed(() => {
  const name = userName.value
  if (name && name.length > 0) {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return 'U'
})

const userRole = computed(() => {
  if (user.value) {
    const role = user.value.role || user.value.roles?.[0] || 'role_producer'
    // Get label from constants or format it
    return USER_ROLE_LABELS[role] || role.replace('role_', '').replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }
  return 'User'
})

const navigation = [
  { name: 'Overview', to: '/dashboard', icon: Squares2X2Icon },
  { name: 'Seed Batches', to: '/seed-batches', icon: CubeIcon },
  // DISABLED: Features not yet integrated
  // { name: 'Seed Source Evaluation', to: '/seed-source-evaluations', icon: ShieldCheckIcon },
  // { name: 'Seed Business Recommendation', to: '/seed-business-recommendations', icon: ClipboardDocumentListIcon },
  // { name: 'Pre-Planting Certification', to: '/certifications/pre-planting', icon: DocumentCheckIcon },
  // { name: 'Planting-Ready Certification', to: '/certifications/planting-ready', icon: DocumentCheckIcon },
  // { name: 'Seed Distribution', to: '/seed-distribution', icon: InboxStackIcon },
]

const route = useRoute()

const isSidebarOpen = ref(false)
const isProfileDropdownOpen = ref(false)

const activePath = computed(() => route.path)

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}

function toggleProfileDropdown() {
  isProfileDropdownOpen.value = !isProfileDropdownOpen.value
}

function closeProfileDropdown() {
  isProfileDropdownOpen.value = false
}

function handleLogout() {
  logout()
  router.replace('/login')
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
              <p class="text-base font-semibold text-ink">BenihChain</p>
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
                <p class="text-xs font-semibold tracking-widest uppercase text-ink/40">BenihChain Admin</p>
                <h1 class="text-xl font-semibold text-ink lg:text-2xl">{{ pageTitle }}</h1>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-end flex-1 gap-3">
              <slot name="header-actions" />
              
              <!-- Profile Dropdown -->
              <div class="relative">
                <button 
                  class="flex items-center gap-3 px-4 py-2 transition border rounded-2xl border-ink/10 bg-white/80 hover:border-primary/30"
                  @click="toggleProfileDropdown"
                >
                  <div class="flex items-center justify-center w-10 h-10 font-semibold rounded-full bg-primary/15 text-primary">
                    {{ userInitials }}
                  </div>
                  <div class="hidden text-left lg:block">
                    <p class="text-sm font-semibold text-ink">{{ userName }}</p>
                    <p class="text-xs text-ink/60">{{ userRole }}</p>
                  </div>
                  <ChevronDownIcon class="hidden w-4 h-4 text-ink/40 lg:block" />
                </button>

                <!-- Dropdown Menu -->
                <transition
                  enter-active-class="transition duration-100 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-75 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <div 
                    v-if="isProfileDropdownOpen" 
                    class="absolute right-0 z-50 w-56 py-2 mt-2 origin-top-right bg-white border shadow-lg rounded-2xl ring-1 ring-black/5 border-ink/10"
                  >
                    <!-- User Info -->
                    <div class="px-4 py-3 border-b border-ink/10">
                      <p class="text-sm font-semibold text-ink">{{ userName }}</p>
                      <p class="text-xs text-ink/60">{{ userRole }}</p>
                    </div>
                    
                    <!-- Menu Items -->
                    <div class="py-1">
                      <RouterLink 
                        to="/profile" 
                        class="flex items-center gap-3 px-4 py-2 text-sm transition text-ink/70 hover:bg-primary/5 hover:text-primary"
                        @click="closeProfileDropdown"
                      >
                        <UserCircleIcon class="w-5 h-5" />
                        <span>My Profile</span>
                      </RouterLink>
                      <RouterLink 
                        to="/settings" 
                        class="flex items-center gap-3 px-4 py-2 text-sm transition text-ink/70 hover:bg-primary/5 hover:text-primary"
                        @click="closeProfileDropdown"
                      >
                        <Cog6ToothIcon class="w-5 h-5" />
                        <span>Settings</span>
                      </RouterLink>
                    </div>
                    
                    <!-- Logout -->
                    <div class="py-1 border-t border-ink/10">
                      <button 
                        class="flex items-center w-full gap-3 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                        @click="handleLogout"
                      >
                        <ArrowLeftOnRectangleIcon class="w-5 h-5" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </transition>

                <!-- Backdrop to close dropdown -->
                <div 
                  v-if="isProfileDropdownOpen" 
                  class="fixed inset-0 z-40" 
                  @click="closeProfileDropdown"
                />
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
              <!-- <div class="flex flex-wrap items-center gap-3">
                <slot name="subheader-actions">
                  <button class="secondary-button">Share Report</button>
                </slot>
              </div> -->
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
