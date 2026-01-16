<!-- Example: Seed Batches List Component -->
<template>
  <div class="container mx-auto px-4 py-8">
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Batch Benih</h1>
        <p class="mt-2 text-sm text-gray-700">
          Daftar batch benih yang Anda kelola
        </p>
      </div>
      <div class="mt-4 sm:mt-0">
        <router-link
          to="/seed-batches/new"
          class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Tambah Batch
        </router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="mt-8 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      <p class="mt-2 text-sm text-gray-500">Memuat data...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="mt-8 rounded-md bg-red-50 p-4">
      <p class="text-sm text-red-800">{{ error }}</p>
      <button
        @click="loadBatches"
        class="mt-2 text-sm font-medium text-red-600 hover:text-red-500"
      >
        Coba Lagi
      </button>
    </div>

    <!-- Batches List -->
    <div v-else-if="batches.length > 0" class="mt-8 flex flex-col">
      <div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table class="min-w-full divide-y divide-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Nomor Batch
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Varietas
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Kelas Benih
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Jumlah
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-for="batch in batches" :key="batch.id">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                    {{ batch.batchNumber }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ batch.variety }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ batch.seedClass }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ batch.quantity }} kg
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm">
                    <span
                      :class="getStatusClass(batch.status)"
                      class="inline-flex rounded-full px-2 text-xs font-semibold leading-5"
                    >
                      {{ getStatusLabel(batch.status) }}
                    </span>
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <router-link
                      :to="`/seed-batches/${batch.id}`"
                      class="text-indigo-600 hover:text-indigo-900"
                    >
                      Detail
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="mt-8 text-center">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">Belum ada batch</h3>
      <p class="mt-1 text-sm text-gray-500">
        Mulai dengan membuat batch benih baru.
      </p>
      <div class="mt-6">
        <router-link
          to="/seed-batches/new"
          class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Tambah Batch
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSeedBatch } from '@/composables/useSeedBatch'
import { BATCH_STATUS_LABELS, BATCH_STATUS_COLORS } from '@/utils/constants'

const { batches, isLoading, error, fetchMyBatches } = useSeedBatch()

const loadBatches = async () => {
  try {
    await fetchMyBatches()
  } catch (err) {
    console.error('Failed to load batches:', err)
  }
}

const getStatusLabel = (status) => {
  return BATCH_STATUS_LABELS[status] || status
}

const getStatusClass = (status) => {
  const color = BATCH_STATUS_COLORS[status] || 'gray'
  const colorMap = {
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
    red: 'bg-red-100 text-red-800',
  }
  return colorMap[color]
}

onMounted(() => {
  loadBatches()
})
</script>
