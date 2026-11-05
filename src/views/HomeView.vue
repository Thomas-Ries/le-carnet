<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch } from "vue";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";
import FicheRow from "../components/FicheRow.vue";
import CompleteFlashSheet from "../components/CompleteFlashSheet.vue";
import * as api from "../lib/api.js";
import { partagerWhatsapp } from "../lib/util.js";

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

/* Inspiration : piocher une idee de sortie dans les adresses deja notees.
   L'etat vit dans le store : quand on ouvre le detail d'une card depuis la
   selection puis qu'on revient, la modale reapparait a l'etape d'avant.
   Ambiances = uniquement les vraies sorties (resto, bar, bar a vin) —
   on ne va pas chez le caviste pour un tete-a-tete. */
const AMBIANCES = [
  { t: "Resto", themes: ["Resto"] },
  { t: "Bar à vin", themes: ["Bar à vin"] },
  { t: "Bar", themes: ["Bar"] },
  { t: "Dégustation", themes: ["Caviste", "Fromagerie"] },
  { t: "Brunch à la maison", themes: ["Brunch", "Boulangerie", "Fromagerie"] },
];
const inspirOpen = computed(() => store.inspir.open);
const inspirTheme = computed(() => store.inspir.theme);
const catsFiche = (f) => String(f.cat || "").split(",").map((x) => x.trim()).filter(Boolean);
const dansAmbiance = (f, a) => f.type === "adresse" && catsFiche(f).some((t) => a.themes.includes(t));
const themesDispos = computed(() =>
  AMBIANCES
    .map((a) => ({ ...a, c: fiches.value.filter((f) => dansAmbiance(f, a)).length }))
    .filter((a) => a.c)
);
const ambianceChoisie = computed(() => AMBIANCES.find((a) => a.t === store.inspir.theme) || null);
const inspirSelection = computed(() => {
  const a = ambianceChoisie.value;
  if (!a) return [];
  const sel = fiches.value.filter((f) => dansAmbiance(f, a));
  // Filtre deux options : mieux notés (défaut) ou plus aimés
  return (store.inspir.tri === "aime"
    ? [...sel].sort((x, y) => (y.reacts?.length || 0) - (x.reacts?.length || 0) || y.note - x.note)
    : [...sel].sort((x, y) => y.note - x.note || (x.date < y.date ? 1 : -1))
  ).slice(0, 5);
});
async function partagerSelection() {
  const sel = inspirSelection.value;
  if (!sel.length) return;
  const lignes = sel.map((f) => "— « " + f.titre + (f.lieu ? " (" + f.lieu + ")" : "") + " »");
  const nom = (ambianceChoisie.value ? ambianceChoisie.value.t : "").toLowerCase();
  const texte = "Envie " + (nom.startsWith("bar") ? "d'un " : "de ") + nom + " ? Ça vous tente, je réserve ?\n" + lignes.join("\n");
  if (navigator.share) {
    try { await navigator.share({ text: texte }); return; } catch (e) { /* annulé ou indisponible */ }
  }
  partagerWhatsapp(texte);
}
function inspirFermer() {
  store.inspir = { open: false, theme: null, tri: "note" };
}

/* Bienvenue : modale de premiere connexion, posee par JoinView juste apres
   le premier join. Presente l'app, propose d'activer les notifs, puis disparait
   pour toujours (drapeau lc-bienvenue). */
const bienvenue = ref(false);
const notifBienvenue = ref("attente"); // attente | ok | refuse | indispo
onMounted(() => {
  try {
    if (localStorage.getItem("lc-bienvenue") === "pending") bienvenue.value = true;
  } catch (e) { /* ok */ }
});
function fermerBienvenue() {
  bienvenue.value = false;
  try { localStorage.setItem("lc-bienvenue", "vu"); } catch (e) { /* ok */ }
}
async function activerNotifsBienvenue() {
  if (store.demoMode) { notifBienvenue.value = "indispo"; return; }
  try {
    const r = await api.activerNotifs();
    if (r && r.ok) {
      notifBienvenue.value = "ok";
      notifOn.value = true;
      toast("Tu seras prévenu quand quelqu'un note une adresse");
    } else {
      notifBienvenue.value = r && r.raison === "refuse" ? "refuse" : "indispo";
    }
  } catch (e) { notifBienvenue.value = "indispo"; }
}

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
      <div class="grid grid-cols-2 gap-3 mb-3">
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

      <!-- Bandeau inspiration : compact, deux lignes, réglable depuis le profil -->
      <button v-if="store.inspirOn && themesDispos.length" @click="store.inspir.open = true"
        class="w-full rounded-2xl p-3 mb-6 flex items-center gap-3 text-left active:scale-[.99] transition"
        style="background: var(--c-soft); border: 1px solid var(--c-hairline)">
        <span class="rounded-full w-8 h-8 flex items-center justify-center shrink-0 text-accent"
          style="background: var(--c-surface)"><Ic name="sparkle" class="w-4 h-4" /></span>
        <span class="flex-1 min-w-0">
          <span class="block text-sm font-semibold text-accent leading-tight">Envie d'inspiration ?</span>
          <span class="block text-[11px] text-muted leading-tight">Un after-work, un tête à tête… Laisse-toi guider</span>
        </span>
        <Ic name="chevron" class="w-4 h-4 text-muted rotate-90 shrink-0" :sw="2" />
      </button>

      <!-- Modale Bienvenue : premiere connexion -->
      <div v-if="bienvenue" class="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4"
        style="background: rgba(20, 14, 12, .6)">
        <div class="w-full max-w-sm rounded-2xl p-5 bg-bg border border-hairline">
          <p class="text-lg font-serif text-center mb-0.5">Bienvenue dans Le Carnet</p>
          <p class="text-[11px] text-muted text-center mb-4">Le carnet « {{ store.carnet?.nom }} » est à toi aussi, maintenant.</p>

          <div class="space-y-2.5 mb-4">
            <div class="flex items-start gap-3">
              <span class="rounded-full w-8 h-8 flex items-center justify-center shrink-0 bg-soft text-accent"><Ic name="pin" class="w-4 h-4" /></span>
              <p class="text-xs leading-relaxed flex-1"><span class="font-semibold">Note les adresses que tu aimes</span> — resto, caviste, bar… avec une note sur 100 et une photo.</p>
            </div>
            <div class="flex items-start gap-3">
              <span class="rounded-full w-8 h-8 flex items-center justify-center shrink-0 bg-soft text-accent"><Ic name="bolt" class="w-4 h-4" /></span>
              <p class="text-xs leading-relaxed flex-1"><span class="font-semibold">Flash</span> — une photo éclair à faire aimer en 7 jours, avant de la noter en fiche.</p>
            </div>
            <div class="flex items-start gap-3">
              <span class="rounded-full w-8 h-8 flex items-center justify-center shrink-0 bg-soft text-accent"><Ic name="heart" class="w-4 h-4" /></span>
              <p class="text-xs leading-relaxed flex-1"><span class="font-semibold">Aime les notes des autres</span> — son auteur reçoit un petit signe, et tu peux commenter.</p>
            </div>
            <div class="flex items-start gap-3">
              <span class="rounded-full w-8 h-8 flex items-center justify-center shrink-0 bg-soft text-accent"><Ic name="sparkle" class="w-4 h-4" /></span>
              <p class="text-xs leading-relaxed flex-1"><span class="font-semibold">Envie d'inspiration ?</span> — le carnet te propose une sortie par thème, à partager.</p>
            </div>
          </div>

          <!-- Notifs : proposees ici au lieu du prompt silencieux, premier passage -->
          <div v-if="notifsDispo && !store.demoMode && !notifOn" class="rounded-xl p-3.5 mb-4 bg-soft border border-hairline">
            <p class="text-xs leading-relaxed mb-2.5">
              <span class="font-semibold">Pour ne rien rater</span> — une alerte quand quelqu'un partage une adresse ou un flash.
            </p>
            <button v-if="notifBienvenue === 'attente'" @click="activerNotifsBienvenue"
              class="w-full rounded-lg py-2.5 text-xs font-semibold text-white" style="background: var(--c-accent)">
              Activer les notifications
            </button>
            <p v-else-if="notifBienvenue === 'ok'" class="text-[11px] text-accent font-semibold text-center">C'est noté — tu seras prévenu.</p>
            <p v-else-if="notifBienvenue === 'refuse'" class="text-[11px] text-muted text-center leading-relaxed">
              Pas grave — tu pourras les activer plus tard dans Profil, Réglages.
            </p>
            <p v-else class="text-[11px] text-muted text-center leading-relaxed">
              Notifications indisponibles pour l'instant — réessaie plus tard depuis ton Profil.
            </p>
          </div>

          <button @click="fermerBienvenue"
            class="w-full rounded-xl py-3 text-sm font-semibold text-white" style="background: var(--c-accent)">
            C'est parti
          </button>
        </div>
      </div>

      <!-- Modale inspiration : choix du thème puis sélection des mieux notées -->
      <div v-if="store.inspir.open" class="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
        style="background: rgba(20, 14, 12, .55)" @click.self="inspirFermer">
        <div class="w-full max-w-sm rounded-2xl p-5 bg-bg border border-hairline max-h-[82vh] overflow-y-auto">
          <template v-if="!inspirTheme">
            <p class="text-base font-serif mb-1">Ce soir, l'ambiance est plutôt…</p>
            <p class="text-[11px] text-muted mb-3.5 leading-relaxed">Pioche un thème — on te sort les adresses les mieux notées du carnet, à ouvrir ou à partager.</p>
            <div class="flex flex-wrap gap-1.5 mb-1">
              <button v-for="t in themesDispos" :key="t.t" @click="store.inspir.theme = t.t; store.inspir.tri = 'note'"
                class="rounded-full px-3 py-2 text-xs font-medium"
                :style="{ background: 'var(--c-soft)', color: 'var(--c-accent)', border: '1px solid var(--c-accent)' }">
                {{ t.t }} <span class="text-[10px] opacity-70">{{ t.c }}</span>
              </button>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center justify-between mb-3.5">
              <button @click="store.inspir.theme = null" class="rounded-full p-2 bg-surface border border-hairline">
                <Ic name="back" class="w-4 h-4" />
              </button>
              <p class="text-sm font-serif flex-1 text-center">Envie de {{ (ambianceChoisie ? ambianceChoisie.t : "").toLowerCase() }} ?</p>
              <button @click="inspirFermer" class="rounded-full p-2 bg-surface border border-hairline">
                <Ic name="x" class="w-4 h-4" />
              </button>
            </div>
            <div class="flex gap-1.5 mb-3">
              <button v-for="fl in [{ id: 'note', label: 'Les mieux notés' }, { id: 'aime', label: 'Les plus aimés' }]"
                :key="fl.id" @click="store.inspir.tri = fl.id"
                class="rounded-full px-3 py-1.5 text-xs font-medium"
                :style="{
                  background: store.inspir.tri === fl.id ? 'var(--c-soft)' : 'var(--c-surface)',
                  color: store.inspir.tri === fl.id ? 'var(--c-accent)' : 'var(--c-muted)',
                  border: '1px solid ' + (store.inspir.tri === fl.id ? 'var(--c-accent)' : 'var(--c-hairline)'),
                }">{{ fl.label }}</button>
            </div>
            <div class="space-y-2 mb-3">
              <!-- Tap sur une card : on garde la modale en memoire (store), le retour du detail rouvre la selection -->
              <FicheRow v-for="f in inspirSelection" :key="f.id" :fiche="f" />
              <p v-if="!inspirSelection.length" class="text-sm text-muted text-center py-4">Pas encore d'adresse ici — note la première.</p>
            </div>
            <button v-if="inspirSelection.length" @click="partagerSelection"
              class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 text-white mb-2"
              style="background: var(--c-accent)">
              <Ic name="share" class="w-4 h-4" /> Ça vous tente, je réserve ?
            </button>
            <button @click="store.inspir.theme = null"
              class="w-full rounded-xl py-2.5 text-xs font-semibold text-muted bg-surface border border-hairline">
              Changer de thème
            </button>
          </template>
        </div>
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