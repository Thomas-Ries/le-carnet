<script setup>
import { ref, computed, inject } from "vue";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";
import FicheRow from "../components/FicheRow.vue";
import CompleteFlashSheet from "../components/CompleteFlashSheet.vue";

const store = useCarnetStore();
const toast = inject("toast");
const q = ref("");
const flashComplet = ref(null);
const prefereDe = ref(null);
const menuCarnets = ref(false);

const fiches = computed(() => store.fichesDuCarnet);
const results = computed(() =>
  q.value.trim()
    ? fiches.value.filter((f) =>
        (f.titre + " " + f.lieu + " " + f.com + " " + f.cat).toLowerCase().includes(q.value.toLowerCase())
      )
    : []
);
const flashes = computed(() => store.flashesDuCarnet);
const miens = (f) => f.auteur === store.profil.prenom;
const prefere = computed(() =>
  prefereDe.value ? fiches.value.filter((f) => f.auteur === prefereDe.value) : []
);
</script>

<template>
  <div>
    <!-- En-tête : switcher carnet -->
    <div class="flex items-center justify-between mb-4">
      <div class="relative">
        <button @click="menuCarnets = !menuCarnets" class="flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5 bg-surface border border-hairline">
          <Avatar :prenom="store.profil.prenom || '·'" :size="26" :src="store.profil.avatar" />
          <span class="text-sm font-serif">{{ store.carnet?.nom }}</span>
          <Ic name="chevron" class="w-3.5 h-3.5 text-muted rotate-90" :sw="2" />
        </button>
        <div v-if="menuCarnets" class="absolute top-full mt-1 left-0 rounded-xl overflow-hidden z-30 w-44 bg-surface border border-hairline"
          style="box-shadow: 0 8px 24px rgba(43,35,32,.25)">
          <button v-for="c in store.carnets" :key="c.id"
            @click="store.switchCarnet(c.id); menuCarnets = false; prefereDe = null"
            class="w-full text-left px-3 py-2.5 text-sm flex items-center justify-between"
            :style="{ color: c.id === store.carnetId ? 'var(--c-accent)' : 'var(--c-ink)', background: c.id === store.carnetId ? 'var(--c-soft)' : 'transparent' }">
            {{ c.nom }} <Ic v-if="c.id === store.carnetId" name="check" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div class="text-right">
        <p class="text-lg leading-none font-serif text-accent">Le Carnet</p>
        <p class="text-[9px] uppercase tracking-[.25em] text-muted">adresses aimées</p>
      </div>
    </div>

    <!-- Recherche -->
    <div class="relative mb-4">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Ic name="search" class="w-4 h-4" /></span>
      <input v-model="q" placeholder="On cherche quoi ? Un resto, un vin, une recette…"
        class="w-full rounded-xl pl-9 pr-3 py-3 text-sm bg-surface border border-hairline outline-none" />
    </div>

    <!-- Résultats -->
    <template v-if="q.trim()">
      <p class="text-xs uppercase tracking-widest text-muted mb-2">
        {{ results.length }} résultat(s) dans « {{ store.carnet?.nom }} »
      </p>
      <div class="space-y-2">
        <FicheRow v-for="f in results" :key="f.id" :fiche="f" />
        <p v-if="!results.length" class="text-sm text-muted text-center py-6">Rien pour ça — tu peux le noter en premier.</p>
      </div>
    </template>

    <template v-else>
      <!-- Flashes façon stories -->
      <div v-if="flashes.length" class="mb-5">
        <p class="text-xs uppercase tracking-widest text-muted mb-2">Moments — pas encore notés</p>
        <div class="flex gap-3 overflow-x-auto pb-1">
          <button v-for="fl in flashes" :key="fl.id" class="flex flex-col items-center gap-1 shrink-0 transition active:scale-95"
            @click="miens(fl) ? (flashComplet = fl) : store.liker(fl.id, !fl.reacts.includes(store.profil.prenom))">
            <span class="relative rounded-full p-[2.5px]" style="background: linear-gradient(135deg, #D9C589, #7A2E3E)">
              <span class="rounded-full overflow-hidden flex items-center justify-center w-[60px] h-[60px]"
                style="border: 2.5px solid var(--c-bg); background: linear-gradient(140deg, rgba(217,197,137,.55), rgba(122,46,62,.3))">
                <img v-if="fl.photo" :src="fl.photo" class="absolute inset-0 w-full h-full object-cover rounded-full" alt="" />
              </span>
              <span v-if="miens(fl)" class="absolute -top-1 -right-1 rounded-full p-1 bg-accent text-white" style="border: 1.5px solid var(--c-bg)">
                <Ic name="bolt" class="w-2.5 h-2.5" />
              </span>
              <span v-else class="absolute -top-1 -right-1 rounded-full p-1" :style="{ background: fl.reacts.includes(store.profil.prenom) ? 'var(--c-gold)' : 'var(--c-surface)', color: fl.reacts.includes(store.profil.prenom) ? '#fff' : 'var(--c-muted)' }">
                <Ic name="heart" class="w-2.5 h-2.5" :filled="fl.reacts.includes(store.profil.prenom)" />
              </span>
            </span>
            <span class="text-[10px] font-medium text-muted">{{ miens(fl) ? "À toi de noter" : fl.auteur }}</span>
          </button>
        </div>
        <p class="text-[10px] text-muted mt-1.5">Éclair = à noter (7 jours). Les autres likent ; toi seul complètes.</p>
      </div>

      <!-- Tuiles -->
      <div class="grid grid-cols-2 gap-3 mb-6">
        <button @click="$router.push('/add?type=adresse')" class="rounded-2xl p-4 text-left bg-surface border border-hairline active:scale-[.98] transition">
          <span class="inline-flex items-center justify-center rounded-full w-9 h-9 mb-2 bg-gold/15 text-gold"><Ic name="pin" /></span>
          <p class="text-lg font-serif">Adresse</p>
          <p class="text-[11px] leading-tight text-muted mt-0.5">Resto · caviste · bar · fromagerie…</p>
        </button>
        <button @click="$router.push('/add?type=recette')" class="rounded-2xl p-4 text-left bg-surface border border-hairline active:scale-[.98] transition">
          <span class="inline-flex items-center justify-center rounded-full w-9 h-9 mb-2 bg-gold/15 text-gold"><Ic name="book" /></span>
          <p class="text-lg font-serif">Recette</p>
          <p class="text-[11px] leading-tight text-muted mt-0.5">Le tiramisu de Chetto, la tarte de Mamie…</p>
        </button>
      </div>

      <!-- Préférés d'un proche -->
      <div v-if="fiches.length" class="flex items-center justify-between mb-2">
        <p class="text-xs uppercase tracking-widest text-muted">Dernièrement dans le carnet</p>
        <button @click="prefereDe = prefereDe ? null : (store.carnet?.membres.find(m => m !== store.profil.prenom) || null)"
          class="text-xs font-semibold text-accent">
          {{ prefereDe ? "Tout le carnet" : "Les préférés d'un proche" }}
        </button>
      </div>
      <div class="space-y-2">
        <FicheRow v-for="f in (prefereDe ? prefere : fiches).slice(0, 8)" :key="f.id" :fiche="f" />
        <p v-if="prefereDe && !prefere.length" class="text-sm text-muted text-center py-6">
          {{ prefereDe }} n'a rien noté ici pour l'instant.
        </p>
      </div>

      <p v-if="!fiches.length" class="text-center text-sm text-muted py-8 leading-relaxed">
        Le carnet « {{ store.carnet?.nom }} » attend sa première adresse aimée.<br />
        Sois celui qui note le premier.
      </p>
    </template>

    <CompleteFlashSheet v-if="flashComplet" :flash="flashComplet" @close="flashComplet = null" @done="flashComplet = null" />
  </div>
</template>
