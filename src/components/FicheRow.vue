<script setup>
import { useRouter } from "vue-router";
import Ic from "./Ic.vue";
import Avatar from "./Avatar.vue";
import NoteBadge from "./NoteBadge.vue";
import { useCarnetStore } from "../stores/carnet.js";

const props = defineProps({ fiche: { type: Object, required: true } });
const router = useRouter();
const store = useCarnetStore();
</script>

<template>
  <button @click="router.push('/fiche/' + fiche.id)"
    class="w-full flex items-center gap-3 rounded-xl p-3 text-left bg-surface border border-hairline active:scale-[.99] transition">
    <div class="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0 bg-soft"
      :style="{ color: fiche.type === 'recette' ? 'var(--c-accent)' : 'var(--c-accent)' }">
      <Ic :name="fiche.type === 'recette' ? 'book' : 'pin'" />
    </div>
    <div class="flex-1 min-w-0">
      <p class="truncate text-[15px] font-serif">{{ fiche.titre }}</p>
      <p class="truncate text-[11px] text-muted">
        {{ fiche.cat }}<template v-if="fiche.lieu"> · {{ fiche.lieu }}</template> · par {{ fiche.auteur }}
      </p>
    </div>
    <div class="flex items-center gap-1.5 shrink-0">
      <span v-if="fiche.reacts.length" class="flex -space-x-1">
        <Avatar v-for="r in fiche.reacts.slice(0, 2)" :key="r" :prenom="r" :size="20" />
      </span>
      <span v-if="fiche.reacts.includes(store.profil.prenom)" class="text-gold">
        <Ic name="heart" class="w-3.5 h-3.5" filled />
      </span>
      <NoteBadge :note="fiche.note" />
    </div>
  </button>
</template>
