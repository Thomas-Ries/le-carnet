<script setup>
import { t } from "../lib/i18n.js";
// V0.4.99 : visionneuse de flash — la photo en grand (même rendu que les fiches),
// agrandissement plein écran au tap, like, complétion pour l'auteur.
// Le scroll de la page derrière est verrouillé tant que la visionneuse est ouverte.
import { ref, computed, onMounted, onUnmounted } from "vue";
import Ic from "./Ic.vue";
import ConfirmModal from "./ConfirmModal.vue";
import { useCarnetStore } from "../stores/carnet.js";
import { lockScroll } from "../lib/util.js";

const props = defineProps({ flash: { type: Object, required: true } });
const emit = defineEmits(["close", "completer"]);
const store = useCarnetStore();
const plein = ref(false);
const suppr = ref(false);
const aime = computed(() => (props.flash.reacts || []).includes(store.profil.prenom));
const miens = computed(() => props.flash.auteur === store.profil.prenom);
const nbAmours = computed(() => (props.flash.reacts || []).length);
onMounted(() => lockScroll(true));
onUnmounted(() => lockScroll(false));
function aimer() { store.liker(props.flash.id, !aime.value); }
// V0.4.103 : l'auteur peut effacer son flash avant les 7 jours.
async function confirmerSuppr() {
  suppr.value = false;
  const r = await store.supprimerFlash(props.flash.id);
  if (r && r.error) { emit('close'); return; }
  emit('close');
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center pt-4 px-4 pb-[calc(var(--lc-nav-h)+var(--lc-safe-b)+16px)] sm:pb-4 bg-black/45" @click="emit('close')">
    <div class="w-full max-w-[430px] mx-auto rounded-t-3xl sm:rounded-2xl bg-cream p-5 sm:shadow-2xl max-h-[90vh] overflow-y-auto" @click.stop>
      <div class="w-10 h-1 rounded-full bg-hairline mx-auto mb-4" />
      <div class="flex items-center gap-2 mb-4">
        <Ic name="bolt" class="w-4 h-4" />
        <p class="text-lg flex-1 font-serif text-left">{{ t('Flash de') }} {{ flash.auteur }}</p>
        <button class="rounded-full p-2 bg-surface border border-hairline" @click="emit('close')">
          <Ic name="x" class="w-4 h-4" />
        </button>
      </div>

      <div v-if="flash.photo" class="relative mb-4" @click="plein = true">
        <img :src="flash.photo" class="w-full aspect-[4/3] object-cover rounded-2xl" alt="Flash" />
        <span class="absolute bottom-2.5 right-2.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
          style="background: rgba(30, 23, 20, .55); color: #fff">{{ t("Agrandir") }}</span>
      </div>

      <p v-if="flash.com" class="text-sm italic text-left leading-relaxed mb-4 px-1">« {{ flash.com }} »</p>

      <div class="flex gap-2">
        <button @click="aimer" class="flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 transition active:scale-[.99]"
          :style="{
            color: aime ? '#fff' : 'var(--c-accent)',
            background: aime ? 'var(--c-gold)' : 'var(--c-soft)',
            border: '1px solid ' + (aime ? 'var(--c-gold)' : 'var(--c-hairline)'),
          }">
          <Ic name="heart" class="w-4 h-4" :filled="aime" /> {{ nbAmours }}
        </button>
        <button v-if="miens" @click="emit('completer')"
          class="flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 transition active:scale-[.99]"
          :style="{ color: '#fff', background: '#7A2E3E' }">
          <Ic name="bolt" class="w-4 h-4" /> {{ t("En faire une fiche notée") }}
        </button>
      </div>
      <p class="text-center text-[10px] text-muted mt-2.5 leading-relaxed">
        {{ t("Il vit 7 jours — aime-le, et l'auteur en fera peut-être une fiche.") }}
      </p>
      <button v-if="miens" @click="suppr = true"
        class="w-full rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 mt-1 transition active:scale-[.99]"
        :style="{ color: 'var(--c-muted)', border: '1px solid var(--c-hairline)' }">
        <Ic name="trash" class="w-3.5 h-3.5" /> {{ t("Supprimer ce flash") }}
      </button>

      <ConfirmModal :open="suppr"
        :title="t('Supprimer ce flash') + ' ?'"
        :text="t('Le flash disparaît pour tous les membres du carnet. Aucune récupération possible.')"
        confirmLabel="Supprimer"
        @confirm="confirmerSuppr" @cancel="suppr = false" />
    </div>
  </div>

  <!-- Agrandissement plein écran, même rendu que la visionneuse des fiches -->
  <div v-if="plein" class="fixed inset-0 z-[80] flex items-center justify-center pt-4 px-4 pb-[calc(var(--lc-nav-h)+var(--lc-safe-b)+16px)] sm:pb-4"
    style="background: rgba(20, 14, 12, .94)" @click="plein = false">
    <img :src="flash.photo" alt="" class="max-w-full max-h-full object-contain rounded-xl" @click.stop />
  </div>
</template>