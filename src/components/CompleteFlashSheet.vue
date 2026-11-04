<script setup>
// Complétion d'un flash : nom, catégorie, note -> devient fiche permanente.
import { ref, inject } from "vue";
import Ic from "./Ic.vue";
import { useCarnetStore } from "../stores/carnet.js";
import { noteLabel } from "../lib/util.js";

const props = defineProps({ flash: { type: Object, required: true } });
const emit = defineEmits(["close", "done"]);
const store = useCarnetStore();
const toast = inject("toast");
const titre = ref("");
const com = ref(props.flash.com || "");
const cat = ref("Resto");
const note = ref(80);
const cats = ["Resto", "Caviste", "Bar", "Fromagerie", "Boulangerie", "Recette"];

async function valider() {
  if (!titre.value.trim()) return;
  const type = cat.value === "Recette" ? "recette" : "adresse";
  const fiche = await store.completerFlash(props.flash.id, {
    type, cat: cat.value, titre: titre.value.trim(), lieu: "", note: note.value,
    com: com.value.trim(), recette: null, demandeRecette: [],
  });
  emit("done", fiche);
  toast("Fiche créée — ceux qui ont aimé le flash sont notifiés");
}

async function justeCommentaire() {
  if (!com.value.trim()) return;
  const r = await store.commenterFlash(props.flash.id, com.value.trim());
  if (r && r.error) { toast(r.error); return; }
  emit("close");
  toast("Commentaire ajouté — le flash finira en fiche après ses 7 jours");
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end bg-black/45" @click="emit('close')">
    <div class="w-full max-w-[430px] mx-auto rounded-t-3xl bg-cream p-5" @click.stop>
      <div class="w-10 h-1 rounded-full bg-hairline mx-auto mb-4" />
      <div class="flex items-center gap-2 mb-4">
        <Ic name="bolt" class="w-4 h-4" />
        <p class="text-lg flex-1 font-serif">Compléter ton flash</p>
        <button class="rounded-full p-2 bg-surface border border-hairline" @click="emit('close')">
          <Ic name="x" class="w-4 h-4" />
        </button>
      </div>
      <img v-if="flash.photo" :src="flash.photo" class="w-full h-24 object-cover rounded-2xl mb-4" alt="Flash" />

      <input v-model="titre" placeholder="C'était où ? Le nom du lieu…"
        class="w-full rounded-xl px-3 py-3 text-sm bg-surface border border-hairline outline-none mb-2.5" />
      <textarea v-model="com" rows="2" maxlength="500" placeholder="Un mot sur le moment ? (optionnel)"
        class="w-full rounded-xl px-3 py-2.5 text-sm bg-surface border border-hairline outline-none resize-none mb-3"></textarea>
      <div class="flex flex-wrap gap-1.5 mb-3">
        <button v-for="c in cats" :key="c" @click="cat = c"
          class="rounded-full px-3 py-1.5 text-xs font-medium"
          :style="{
            background: cat === c ? '#7A2E3E' : 'var(--c-surface)',
            color: cat === c ? '#fff' : 'var(--c-muted)',
            border: '1px solid ' + (cat === c ? '#7A2E3E' : 'var(--c-hairline)'),
          }">{{ c }}</button>
      </div>

      <div class="rounded-xl p-4 bg-surface border border-hairline mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs uppercase tracking-widest text-muted">Ta note</span>
          <span class="text-sm font-semibold text-accent">{{ note }} · {{ noteLabel(note) }}</span>
        </div>
        <input type="range" min="70" max="100" v-model.number="note" class="w-full accent-[#7A2E3E]" />
        <div class="flex justify-between text-[10px] text-muted mt-1"><span>70</span><span>85</span><span>100</span></div>
      </div>

      <button @click="valider" :disabled="!titre.trim()"
        class="w-full rounded-xl py-3.5 text-sm font-semibold text-white active:scale-[.99] transition"
        :style="{ background: titre.trim() ? '#7A2E3E' : 'rgba(122,46,62,.3)' }">
        En faire une fiche notée
      </button>
      <button v-if="com.trim() && com.trim() !== (flash.com || '')" @click="justeCommentaire"
        class="w-full rounded-xl py-3 text-xs font-semibold text-accent bg-soft mt-2">
        Enregistrer juste le commentaire — le flash reste 7 jours puis devient une fiche à compléter
      </button>
      <p class="text-center text-[10px] text-muted mt-2 flex items-center justify-center gap-1">
        <Ic name="heart" class="w-3 h-3" /> Ceux qui ont aimé ce flash seront notifiés — une seule fois.
      </p>
    </div>
  </div>
</template>
