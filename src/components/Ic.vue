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
</script>

<template>
  <!-- Un seul <path> pour toute l'icône (tous les sous-chemins ensemble) :
       fill-rule evenodd perce alors les formes internes — le petit rond du pin
       et l'objectif de la caméra restent des trous même sur l'icône active (remplie).
       Découper en plusieurs <path> (ancien code) annulait l'effet du evenodd. -->
  <svg :class="$props.class" viewBox="0 0 24 24" :fill="filled ? 'currentColor' : 'none'" fill-rule="evenodd" clip-rule="evenodd" stroke="currentColor"
    :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="path" />
  </svg>
</template>
