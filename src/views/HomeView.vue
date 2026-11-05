<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch } from "vue";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";
import FicheRow from "../components/FicheRow.vue";
import CompleteFlashSheet from "../components/CompleteFlashSheet.vue";
import * as api from "../lib/api.js";

const store = useCarnetStore();
const toast = inject("toast");
const q = ref("");
const flashComplet = ref(null);
const menuCarnets = ref(false);
const tri = ref("recent"); // recent | aime | az — tri façon e-commerce (CTA + menu)
const triOpen = ref(false);
const TRIS = [
  { id: "recent", label: "Le plus récent", defaut: true },
  { id: "aime", label: "Le plus aimé" },
  { id: "az", label: "De A à Z" },
];

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

/* Notifications : carte discrete tant que l'appareil n'a pas souscrit.
   Si la permission a ete refusee (denied), iOS ne permet plus de la redemander -> pas de carte. */
const notifsDispo =
  typeof Notification !== "undefined" && "serviceWorker" in navigator &&
  "PushManager" in window && Notification.permission !== "denied";
const notifOn = ref(false);
onMounted(async () => {
  if (!notifsDispo || store.demoMode) return;
  notifOn.value = await api.notifsSouscrites();
});
async function activerNotifsAccueil() {
  try {
    const r = await api.activerNotifs();
    if (r.ok) { notifOn.value = true; toast("Notifications activées"); }
    else if (r.raison === "refuse") toast("Autorisation refusée — reglages iOS de l'app, Notifications");
    else toast("Notifications indisponibles côté serveur");
  } catch (e) {
    toast("Impossible d'activer les notifications");
  }
}

/* Tri : plus récent (défaut, ordre du carnet) / plus aimé (cœurs décroissants) / A à Z (titre) */
const fichesTri = computed(() => {
  if (tri.value === "aime") {
    return [...fiches.value].sort(
      (a, b) => (b.reacts?.length || 0) - (a.reacts?.length || 0) || (a.date < b.date ? 1 : -1)
    );
  }
  if (tri.value === "az") {
    return [...fiches.value].sort((a, b) =>
      (a.titre || "").localeCompare(b.titre || "", "fr", { sensitivity: "base" })
    );
  }
  return fiches.value;
});

/* Scroll infini facon feed : rendu par tranches de 20, rechargees quand on approche du bas.
   (Avant, seules les 8 premieres fiches etaient affichees : les suivantes etaient invisibles.) */
const PARC = 20;
const page = ref(1);
const affiches = computed(() => fichesTri.value.slice(0, page.value * PARC));
watch([tri, () => store.carnetId], () => { page.value = 1; });
function surScroll() {
  if (page.value * PARC >= fichesTri.value.length) return;
  if (window.innerHeight + window.scrollY > document.body.offsetHeight - 500) page.value += 1;
}
onMounted(() => {
  window.addEventListener("scroll", surScroll, { passive: true });
  surScroll(); // liste courte écran grand : charger la 2e tranche tout de suite
});
onUnmounted(() => window.removeEventListener("scroll", surScroll));
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
            @click="store.switchCarnet(c.id); menuCarnets = false"
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

    <!-- Notifications : rappel discret tant que pas activées -->
    <div v-if="notifsDispo && !notifOn && !store.demoMode" class="rounded-2xl p-3.5 mb-4 bg-surface border border-hairline flex items-center gap-3">
      <span class="rounded-full w-9 h-9 flex items-center justify-center shrink-0 bg-soft text-accent">
        <Ic name="bolt" class="w-4 h-4" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-semibold">Sois prévenu des nouvelles notes</span>
        <span class="block text-[11px] text-muted leading-snug">Une alerte quand quelqu'un partage une adresse aimée ou un flash.</span>
      </span>
      <button @click="activerNotifsAccueil" class="rounded-xl px-3.5 py-2 text-xs font-semibold text-white shrink-0"
        style="background: var(--c-accent)">Activer</button>
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
            <span v-if="fl.com" class="text-[9px] text-muted italic max-w-[64px] truncate leading-tight">« {{ fl.com }} »</span>
          </button>
        </div>
        <p class="text-[10px] text-muted mt-1.5">Éclair = à noter (7 jours). Les autres likent ; toi seul complètes.</p>
      </div>

      <!-- Tuiles -->
      <div class="grid grid-cols-2 gap-3 mb-6">
        <button @click="$router.push('/add?type=adresse')" class="rounded-2xl p-4 text-left bg-surface border border-hairline active:scale-[.98] transition">
          <span class="inline-flex items-center justify-center rounded-full w-9 h-9 mb-2 bg-gold/15 text-gold"><Ic name="pin" /></span>
          <p class="text-lg font-serif">Noter une adresse</p>
          <p class="text-[11px] leading-tight text-muted mt-0.5">Resto, caviste, bar, fromagerie — un lieu que tu aimes</p>
        </button>
        <button @click="$router.push('/add?type=recette')" class="rounded-2xl p-4 text-left bg-surface border border-hairline active:scale-[.98] transition">
          <span class="inline-flex items-center justify-center rounded-full w-9 h-9 mb-2 bg-gold/15 text-gold"><Ic name="book" /></span>
          <p class="text-lg font-serif">Partager une recette</p>
          <p class="text-[11px] leading-tight text-muted mt-0.5">Le tiramisu de Chetto, la tarte de Mamie…</p>
        </button>
      </div>

      <!-- Tri : CTA façon e-commerce — un bouton qui ouvre le choix du tri -->
      <div v-if="fiches.length" class="flex items-center justify-between mb-2 gap-2 relative">
        <p class="text-xs uppercase tracking-widest text-muted shrink-0">
          {{ tri === "recent" ? "Dernièrement dans le carnet" : tri === "aime" ? "Les plus aimés du carnet" : "Le carnet de A à Z" }}
        </p>
        <div class="relative">
          <button @click="triOpen = !triOpen" title="Choisir le tri"
            class="w-8 h-8 rounded-full border border-hairline bg-surface flex items-center justify-center active:scale-95 transition"
            :style="triOpen || tri !== 'recent' ? 'border-color: var(--c-accent)' : ''">
            <Ic name="sort" class="w-4 h-4" :class="triOpen || tri !== 'recent' ? 'text-accent' : 'text-muted'" :sw="2" />
          </button>
          <div v-if="triOpen" class="absolute top-full right-0 mt-1 rounded-xl overflow-hidden z-30 w-52 bg-surface border border-hairline"
            style="box-shadow: 0 8px 24px rgba(43,35,32,.25)">
            <button v-for="t in TRIS" :key="t.id"
              @click="tri = t.id; triOpen = false"
              class="w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between"
              :style="{ color: t.id === tri ? 'var(--c-accent)' : 'var(--c-ink)', background: t.id === tri ? 'var(--c-soft)' : 'transparent' }">
              <span>{{ t.label }}<span v-if="t.defaut" class="text-[10px] text-muted ml-1">défaut</span></span>
              <Ic v-if="t.id === tri" name="check" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <div class="space-y-2">
        <FicheRow v-for="f in affiches" :key="f.id" :fiche="f" />
      </div>

      <p v-if="affiches.length < fichesTri.length" class="text-center text-[10px] text-muted pt-2">Fais défiler pour découvrir les {{ fichesTri.length }} adresses du carnet…</p>

      <p v-if="!fiches.length" class="text-center text-sm text-muted py-8 leading-relaxed">
        Le carnet « {{ store.carnet?.nom }} » attend sa première adresse aimée.<br />
        Sois celui qui note le premier.
      </p>
    </template>

    <CompleteFlashSheet v-if="flashComplet" :flash="flashComplet" @close="flashComplet = null" @done="flashComplet = null" />
  </div>
</template>