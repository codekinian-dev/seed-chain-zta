<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  delta: {
    type: Number,
    default: 0,
  },
  deltaLabel: {
    type: String,
    default: 'sejak bulan lalu',
  },
  icon: {
    type: Object,
    required: true,
  },
  accent: {
    type: String,
    default: 'primary',
  },
})

const accentStyles = computed(() => {
  const palette = {
    primary: {
      halo: 'bg-primary/15',
      badge: 'bg-primary/10 text-primary',
      text: 'text-primary',
    },
    ocean: {
      halo: 'bg-ocean/15',
      badge: 'bg-ocean/10 text-ocean',
      text: 'text-ocean',
    },
    sunshine: {
      halo: 'bg-sunshine/20',
      badge: 'bg-sunshine/10 text-sunshine',
      text: 'text-sunshine',
    },
  }

  return palette[props.accent] ?? palette.primary
})

const trendStyles = computed(() => {
  if (props.delta >= 0) {
    return {
      background: 'bg-primary/5',
      text: accentStyles.value.text,
      symbol: '▲',
    }
  }

  return {
    background: 'bg-red-100',
    text: 'text-red-500',
    symbol: '▼',
  }
})
</script>

<template>
  <div class="panel-card relative overflow-hidden px-6 py-6">
    <div :class="['absolute -right-6 -top-10 h-32 w-32 rounded-full blur-2xl', accentStyles.halo]" />
    <div class="relative z-10 space-y-5">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-widest text-ink/40">{{ title }}</p>
          <p class="text-3xl font-semibold text-ink">{{ value }}</p>
        </div>
        <div :class="['rounded-2xl p-3 shadow-inner', accentStyles.badge]">
          <component :is="icon" class="h-7 w-7" />
        </div>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <span :class="['status-pill', trendStyles.background, trendStyles.text]">
          <span>{{ trendStyles.symbol }}</span>
          {{ Math.abs(delta).toFixed(1) }}%
        </span>
        <span class="text-ink/50">{{ deltaLabel }}</span>
      </div>
    </div>
  </div>
</template>
