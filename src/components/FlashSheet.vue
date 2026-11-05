<script setup>
import { t } from "../lib/i18n.js";
// Flash : photo -> carnet(s) -> envoyé. Photo = dataURL compressé (pas de stockage en démo).
import { ref, inject } from "vue";
import Ic from "./Ic.vue";
import { useCarnetStore } from "../stores/carnet.js";
import { chargerPhoto } from "../lib/util.js";

const emit = defineEmits(["close"]);
const store = useCarnetStore();
const toast = inject("toast");
const photo = ref(null);
const com = ref("");
const sel = ref([store.carnetId]);

const toggle = (id) => {
  sel.value = sel.value.includes(id)
    ? (sel.value.length > 1 ? sel.value.filter((x) => x !== id) : sel.value)
    : [...sel.value, id];
};

async function onFile(e) {
  const file = e.target.files[0];
  e.target.value = ""; // permet de re-choisir le même fichier après un échec
  if (!file) return;
  try {
    photo.value = await chargerPhoto(file);
  } catch (err) {
    toast(t("Photo illisible — essaie une autre image"));
  }
}

async function envoyer() {
  if (!photo.value) return;
  await store.flasher(sel.value, photo.value, com.value.trim());
  emit("close");
  toast(com.value.trim()
    ? "Flash envoyé — 7 jours puis il devient une fiche à compléter"
    : "Flash envoyé — 7 jours pour le noter");
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/45" @click="emit('close')">
    <div class="w-full max-w-[430px] mx-auto rounded-t-3xl sm:rounded-2xl bg-cream p-5 sm:shadow-2xl" @click.stop>
      <div class="w-10 h-1 rounded-full bg-hairline mx-auto mb-4" />
      <div class="flex items-center justify-between mb-4">
        <p class="text-lg font-serif">{{ t("Flash") }}</p>
        <button class="rounded-full p-2 bg-surface border border-hairline" @click="emit('close')">
          <Ic name="x" class="w-4 h-4" />
        </button>
      </div>

      <label class="block w-full rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition active:scale-[.99]"
        :style="{ height: '150px', background: photo ? 'transparent' : 'var(--c-surface)', border: photo ? '1px solid var(--c-hairline)' : '2px dashed var(--c-accent)' }">
        <input type="file" accept="image/*" capture="environment" class="hidden" @change="onFile" />
        <template v-if="!photo">
          <span class="w-11 h-11 rounded-full flex items-center justify-center bg-accent/10 text-accent">
            <Ic name="camera" class="w-5 h-5" />
          </span>
          <span class="text-sm font-semibold text-accent">{{ t("Tape ici pour photographier") }}</span>
          <span class="text-[11px] text-muted">{{ t("Une bouteille, un plat, une ambiance — ça part en 5 secondes") }}</span>
        </template>
        <template v-else>
          <img :src="photo" class="w-full h-[150px] object-cover rounded-2xl" alt="Aperçu" />
        </template>
      </label>
      <p class="text-center text-[10px] text-muted mt-1.5 mb-3">{{ t("1. la photo · 2. pour qui · 3. envoyé") }}</p>

      <p class="text-[10px] uppercase tracking-widest text-muted mb-1.5">{{ t("Pour qui ?") }}</p>
      <div class="flex flex-wrap gap-1.5 mb-3">
        <button v-for="c in store.carnets" :key="c.id" @click="toggle(c.id)"
          class="rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1"
          :style="{
            background: sel.includes(c.id) ? '#7A2E3E' : 'var(--c-surface)',
            color: sel.includes(c.id) ? '#fff' : 'var(--c-muted)',
            border: '1px solid ' + (sel.includes(c.id) ? '#7A2E3E' : 'var(--c-hairline)'),
          }">
          <Ic v-if="sel.includes(c.id)" name="check" class="w-3 h-3" :sw="2.4" /> {{ c.nom }}
        </button>
      </div>
      <textarea v-model="com" rows="2" maxlength="500" :placeholder="t('Un mot ? (optionnel — il garde le flash et en fait une note après 7 jours)')"
        class="w-full rounded-xl px-3 py-2.5 text-sm bg-surface border border-hairline outline-none resize-none mb-4"></textarea>


      <button @click="envoyer" :disabled="!photo"
        class="w-full rounded-xl py-3.5 text-sm font-semibold text-white active:scale-[.99] transition"
        :style="{ background: photo ? '#7A2E3E' : 'rgba(122,46,62,.3)' }">
        {{ t("Envoyer le flash") }}<template v-if="sel.length > 1"> à {{ sel.length }} carnets</template>
      </button>
      <p class="text-center text-[10px] text-muted mt-2">{{ t("Tu pourras le compléter en fiche notée — badge éclair en attendant.") }}</p>
    </div>
  </div>
</template>
