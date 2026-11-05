<script setup>
import { t } from "../lib/i18n.js";
// Popin maison de confirmation — utilisée pour toute suppression/retrait de l'app.
// Jamais confirm()/alert() natifs (règle charte).
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  text: { type: String, default: "" },
  confirmLabel: { type: String, default: "Supprimer" },
});
const emit = defineEmits(["confirm", "cancel"]);
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
    style="background: rgba(43,35,32,.45)" @click.self="emit('cancel')">
    <div class="w-full max-w-[430px] rounded-t-2xl sm:rounded-2xl bg-surface p-5 pb-7 sm:shadow-2xl"
      style="border-top: 1px solid var(--c-hairline)">
      <p class="font-serif text-lg mb-1">{{ title }}</p>
      <p class="text-xs text-muted mb-4 leading-relaxed">{{ text }}</p>
      <div class="grid grid-cols-2 gap-2">
        <button @click="emit('cancel')"
          class="rounded-xl py-3 text-sm font-semibold border border-hairline">{{ t("Annuler") }}</button>
        <button @click="emit('confirm')"
          class="rounded-xl py-3 text-sm font-semibold text-white bg-accent">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>
