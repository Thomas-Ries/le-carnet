<script setup>
import { computed } from "vue";
import { ICONS } from "../lib/icons.js";
const props = defineProps({
  name: { type: String, required: true },
  class: { type: String, default: "w-5 h-5" },
  sw: { type: [Number, String], default: 1.5 },
  filled: { type: Boolean, default: false },
});
const path = computed(() => ICONS[props.name] || "");
const multi = computed(() => path.value.includes("M") && path.value.trim().split(/\s(?=M)/).length > 1);
const paths = computed(() =>
  multi.value ? path.value.trim().split(/\s(?=M)/) : [path.value]
);
</script>

<template>
  <svg :class="$props.class" viewBox="0 0 24 24" :fill="filled ? 'currentColor' : 'none'" stroke="currentColor"
    :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>
