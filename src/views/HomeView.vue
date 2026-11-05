<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch } from "vue";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";
import FicheRow from "../components/FicheRow.vue";
import CompleteFlashSheet from "../components/CompleteFlashSheet.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import * as api from "../lib/api.js";
import { partagerSelectionFiches, zoneFiche, drapeauPays } from "../lib/util.js";

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
  const base = fiches.value.filter(passeFiltre);
  if (tri.value === "aime") {
    return [...base].sort(
      (a, b) => (b.reacts?.length || 0) - (a.reacts?.length || 0) || (a.date < b.date ? 1 : -1)
    );
  }
  if (tri.value === "az") {
    return [...base].sort((a, b) =>
      (a.titre || "").localeCompare(b.titre || "", "fr", { sensitivity: "base" })
    );
  }
  return base;
});

/* V0.4.76 — Filtre par pays puis par ville. Zone effective = colonnes serveur
   (backfillées au bootstrap) si présentes, sinon détection locale depuis l'adresse.
   « Non précisé » (aucun pays reconnu) est un groupe comme les autres.
   Les chips n'apparaissent que si le carnet touche au moins 2 pays distincts. */
const filtrePays = ref("");
const filtreVille = ref("");
const zonesFiches = computed(() =>
  fiches.value.map((f) => ({ f, z: zoneFiche(f) }))
);
const paysChips = computed(() => {
  const n = new Map();
  for (const { z } of zonesFiches.value) {
    const k = z.pays || "";
    n.set(k, (n.get(k) || 0) + 1);
  }
  return [...n.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([p, c]) => ({ pays: p || "?", label: p || "Non précisé", drapeau: drapeauPays(p), n: c }));
});
const villesChips = computed(() => {
  if (!filtrePays.value) return [];
  const paysCible = filtrePays.value === "?" ? "" : filtrePays.value;
  const n = new Map();
  let sans = 0;
  for (const { z } of zonesFiches.value) {
    if ((z.pays || "") !== paysCible) continue;
    if (z.ville) n.set(z.ville, (n.get(z.ville) || 0) + 1);
    else sans++;
  }
  const out = [...n.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([v, c]) => ({ ville: v, n: c }));
  if (sans) out.push({ ville: "?", n: sans });
  return out;
});
const passeFiltre = (f) => {
  if (!filtrePays.value) return true;
  const z = zoneFiche(f);
  if ((z.pays || "") !== (filtrePays.value === "?" ? "" : filtrePays.value)) return false;
  if (filtreVille.value && (z.ville || "") !== (filtreVille.value === "?" ? "" : filtreVille.value)) return false;
  return true;
};
function choisirPays(p) {
  filtrePays.value = filtrePays.value === p ? "" : p;
  filtreVille.value = "";
}
function choisirVille(v) {
  filtreVille.value = filtreVille.value === v ? "" : v;
}

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
/* Sélection dans la modale : mode cases à cocher, puis « Partager la sélection ».
   1 fiche = sa carte PNG ; plusieurs = un PDF qui les regroupe. */
const inspirMode = ref(false);
const inspirSel = ref([]);
const estSelInspir = (id) => inspirSel.value.includes(id);
function tapInspir(e, f) {
  if (!inspirMode.value) return;
  e.preventDefault(); e.stopPropagation();
  inspirSel.value = estSelInspir(f.id)
    ? inspirSel.value.filter((x) => x !== f.id)
    : [...inspirSel.value, f.id];
}
async function partagerSelInspir() {
  const sel = inspirSelection.value.filter((f) => inspirSel.value.includes(f.id));
  if (!sel.length) return;
  toast(sel.length > 1 ? "Préparation du PDF…" : "Préparation de la carte…");
  await partagerSelectionFiches(sel);
}
/* Le fond ne doit plus scroller quand la modale est ouverte : on scrolle dedans. */
watch(inspirOpen, (o) => {
  document.body.classList.toggle("no-scroll", o);
  if (!o) { inspirMode.value = false; inspirSel.value = []; }
});
watch(inspirTheme, () => { inspirMode.value = false; inspirSel.value = []; });
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
onUnmounted(() => { window.removeEventListener("scroll", surScroll); document.body.classList.remove("no-scroll"); });

/* Sélection longue-press sur une card → partage de la sélection.
   1 card = sa carte PNG ; plusieurs = un PDF qui les regroupe (pas de flood). */
watch(() => store.carnet?.id, () => { filtrePays.value = ""; filtreVille.value = ""; });
const selMode = ref(false);
const selIds = ref([]);
const estSel = (id) => selIds.value.includes(id);
let pressTimer = null, pressPos = null, pressFired = false;
function pressStart(e, f) {
  pressPos = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    pressFired = true;
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* ok */ } }
    selMode.value = true;
    if (!selIds.value.includes(f.id)) selIds.value.push(f.id);
    toast("Sélection — tape les cards, partage en haut");
  }, 450);
}
function pressMove(e) {
  if (!pressPos) return;
  if (Math.abs(e.clientX - pressPos.x) > 10 || Math.abs(e.clientY - pressPos.y) > 10) {
    clearTimeout(pressTimer); pressTimer = null;
  }
}
function pressEnd() {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null; pressPos = null;
}
function tapCard(e, f) {
  // le click qui suit l'appui long ne doit rien faire (ni naviguer, ni décocher)
  if (pressFired) { pressFired = false; e.preventDefault(); e.stopPropagation(); return; }
  if (!selMode.value) return;
  e.preventDefault(); e.stopPropagation();
  selIds.value = estSel(f.id) ? selIds.value.filter((x) => x !== f.id) : [...selIds.value, f.id];
  if (!selIds.value.length) selMode.value = false;
}
function annulerSel() { selIds.value = []; selMode.value = false; }
/* V0.4.72 — carnet privé « Mes adresses » : le partage n'est plus une carte PNG
   mais un TRANSFERT vers un ou plusieurs carnets (chips multi-sélection + modale
   de confirmation, bandeau d'action au-dessus de la zone basse). */
const partageOuvert = ref(false);
const carnetIdsChoisis = ref([]);
const confirmPartage = ref(false);
const carnetsPartageables = computed(() => store.carnets.filter((c) => !(c.prive === "1" || c.prive === 1) && c.id !== store.carnetId));
const estChoisi = (id) => carnetIdsChoisis.value.includes(id);
function toggleChoix(id) {
  carnetIdsChoisis.value = estChoisi(id)
    ? carnetIdsChoisis.value.filter((x) => x !== id)
    : [...carnetIdsChoisis.value, id];
}
const RAISONS = {
  "deja note dans le carnet": "déjà notée dans le carnet",
  "hors espace prive": "plus dans ton espace privé",
  "fiche introuvable": "fiche introuvable",
};
async function partagerSel() {
  if (store.carnet?.prive) { carnetIdsChoisis.value = []; partageOuvert.value = true; return; }
  const sel = fichesTri.value.filter((f) => selIds.value.includes(f.id));
  if (!sel.length) return;
  toast(sel.length > 1 ? "Préparation du PDF…" : "Préparation de la carte…");
  const r = await partagerSelectionFiches(sel);
  if (r === "telecharge") toast("Fichier téléchargé — partage-le depuis ton téléphone");
}
async function confirmerPartage() {
  confirmPartage.value = false;
  const r = await store.partagerFiches([...selIds.value], [...carnetIdsChoisis.value]);
  if (r && r.error) { toast("Partage impossible : " + r.error); return; }
  if (r.partagees) toast(r.partagees + " fiche" + (r.partagees > 1 ? "s" : "") + " partagée" + (r.partagees > 1 ? "s" : ""));
  (r.ignorees || []).forEach((x) => toast("« " + x.titre + " » non partagée : " + (RAISONS[x.raison] || x.raison)));
  partageOuvert.value = false; carnetIdsChoisis.value = [];
  selIds.value = []; selMode.value = false;
}
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
      <!-- Tuiles compactes : icône à gauche, titre à côté -->
      <div class="grid grid-cols-2 gap-3 mb-3">
        <button @click="$router.push('/add?type=adresse')"
          class="rounded-2xl px-3.5 py-3 flex items-center gap-2.5 text-left bg-surface border border-hairline active:scale-[.98] transition">
          <span class="rounded-full w-9 h-9 flex items-center justify-center shrink-0 bg-gold/15 text-gold"><Ic name="pin" class="w-4 h-4" /></span>
          <span class="min-w-0">
            <span class="block text-[15px] font-serif leading-tight">Noter une adresse</span>
            <span class="block text-[10px] leading-tight text-muted">resto, caviste, bar… un lieu que tu aimes</span>
          </span>
        </button>
        <button @click="$router.push('/add?type=recette')"
          class="rounded-2xl px-3.5 py-3 flex items-center gap-2.5 text-left bg-surface border border-hairline active:scale-[.98] transition">
          <span class="rounded-full w-9 h-9 flex items-center justify-center shrink-0 bg-gold/15 text-gold"><Ic name="book" class="w-4 h-4" /></span>
          <span class="min-w-0">
            <span class="block text-[15px] font-serif leading-tight">Partager une recette</span>
            <span class="block text-[10px] leading-tight text-muted">le tiramisu de Chetto…</span>
          </span>
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
            <div class="flex gap-1.5 mb-3 items-center">
              <button v-for="fl in [{ id: 'note', label: 'Les mieux notés' }, { id: 'aime', label: 'Les plus aimés' }]"
                :key="fl.id" @click="store.inspir.tri = fl.id"
                class="rounded-full px-3 py-1.5 text-xs font-medium"
                :style="{
                  background: store.inspir.tri === fl.id ? 'var(--c-soft)' : 'var(--c-surface)',
                  color: store.inspir.tri === fl.id ? 'var(--c-accent)' : 'var(--c-muted)',
                  border: '1px solid ' + (store.inspir.tri === fl.id ? 'var(--c-accent)' : 'var(--c-hairline)'),
                }">{{ fl.label }}</button>
              <!-- Icône seule pour basculer en sélection : cocher des cards à partager -->
              <button @click="inspirMode = !inspirMode; inspirSel = []" title="Partager une sélection"
                class="ml-auto w-7 h-7 rounded-full flex items-center justify-center transition"
                :style="{
                  background: inspirMode ? 'var(--c-accent)' : 'var(--c-surface)',
                  color: inspirMode ? '#fff' : 'var(--c-muted)',
                  border: '1px solid ' + (inspirMode ? 'var(--c-accent)' : 'var(--c-hairline)'),
                }">
                <Ic name="share" class="w-3.5 h-3.5" :sw="2" />
              </button>
            </div>
            <div class="space-y-2 mb-3">
              <!-- Tap sur une card : on garde la modale en memoire (store), le retour du detail rouvre la selection.
                   En mode sélection, le tap coche la card au lieu de naviguer (ring bordeaux, pas de checkbox). -->
              <div v-for="f in inspirSelection" :key="f.id" class="relative rounded-xl"
                :class="estSelInspir(f.id) ? 'ring-2 ring-[#7A2E3E]' : ''"
                @click.capture="tapInspir($event, f)">
                <FicheRow :fiche="f" />
              </div>
              <p v-if="!inspirSelection.length" class="text-sm text-muted text-center py-4">Pas encore d'adresse ici — note la première.</p>
            </div>
            <button v-if="inspirMode && inspirSel.length" @click="partagerSelInspir"
              class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 text-white mb-2"
              style="background: var(--c-accent)">
              <Ic name="share" class="w-4 h-4" /> Partager la sélection
            </button>
            <p v-if="inspirMode && !inspirSel.length" class="text-[11px] text-muted text-center mb-2">
              Coche une ou plusieurs adresses à partager.
            </p>
            <button @click="store.inspir.theme = null"
              class="w-full rounded-xl py-2.5 text-xs font-semibold text-muted bg-surface border border-hairline">
              Changer de thème
            </button>
          </template>
        </div>
      </div>

      <!-- Tri : CTA façon e-commerce — un bouton qui ouvre le choix du tri.
           En sélection : compteur + partage (icône à gauche du tri) + annulation. -->
      <div v-if="fiches.length" class="flex items-center justify-between mb-2 gap-2 relative">
        <p class="text-xs uppercase tracking-widest shrink-0"
          :style="selMode ? { color: 'var(--c-accent)' } : { color: 'var(--c-muted)' }">
          <template v-if="selMode">{{ selIds.length }} sélectionnée{{ selIds.length > 1 ? "s" : "" }}</template>
          <template v-else>{{ tri === "recent" ? "Dernièrement dans le carnet" : tri === "aime" ? "Les plus aimés du carnet" : "Le carnet de A à Z" }}</template>
        </p>
        <div class="flex items-center gap-2">
          <button v-if="selMode" @click="annulerSel" class="text-[10px] font-semibold text-muted underline">Annuler</button>
          <button v-if="selIds.length && !store.carnet?.prive" @click="partagerSel" title="Partager la sélection"
            class="w-8 h-8 rounded-full border flex items-center justify-center active:scale-95 transition"
            :style="{ background: 'var(--c-accent)', color: '#fff', borderColor: 'var(--c-accent)' }">
            <Ic name="share" class="w-4 h-4" :sw="2" />
          </button>
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
      </div>
      <!-- V0.4.76 — Filtre pays : visible dès que le carnet touche 2 pays distincts -->
      <div v-if="paysChips.length > 1 && fiches.length" class="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar pb-0.5">
        <button @click="choisirPays('')"
          class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition"
          :style="{
            background: filtrePays ? 'var(--c-surface)' : 'var(--c-soft)',
            color: filtrePays ? 'var(--c-muted)' : 'var(--c-accent)',
            border: '1px solid ' + (filtrePays ? 'var(--c-hairline)' : 'var(--c-accent)'),
          }">Tous · {{ fiches.length }}</button>
        <button v-for="p in paysChips" :key="p.pays" @click="choisirPays(p.pays)"
          class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition"
          :style="{
            background: filtrePays === p.pays ? 'var(--c-soft)' : 'var(--c-surface)',
            color: filtrePays === p.pays ? 'var(--c-accent)' : 'var(--c-ink)',
            border: '1px solid ' + (filtrePays === p.pays ? 'var(--c-accent)' : 'var(--c-hairline)'),
          }">{{ p.drapeau }} {{ p.label }} · {{ p.n }}</button>
      </div>
      <!-- Sous-filtre ville, révélé quand un pays est choisi -->
      <div v-if="filtrePays && villesChips.length > 1" class="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar pb-0.5">
        <button @click="choisirVille('')"
          class="shrink-0 rounded-full px-3 py-1.5 text-[11px] transition"
          :style="{
            background: filtreVille ? 'var(--c-surface)' : 'var(--c-soft)',
            color: filtreVille ? 'var(--c-muted)' : 'var(--c-accent)',
            border: '1px solid ' + (filtreVille ? 'var(--c-hairline)' : 'var(--c-accent)'),
          }">Toutes les villes</button>
        <button v-for="v in villesChips" :key="v.ville" @click="choisirVille(v.ville)"
          class="shrink-0 rounded-full px-3 py-1.5 text-[11px] transition"
          :style="{
            background: filtreVille === v.ville ? 'var(--c-soft)' : 'var(--c-surface)',
            color: filtreVille === v.ville ? 'var(--c-accent)' : 'var(--c-ink)',
            border: '1px solid ' + (filtreVille === v.ville ? 'var(--c-accent)' : 'var(--c-hairline)'),
          }">{{ v.ville === "?" ? "Non précisé" : v.ville }} · {{ v.n }}</button>
      </div>

      <div class="space-y-2">
        <!-- Appui long sur une card = entrer en sélection ; en sélection, le tap coche/décoche -->
        <div v-for="f in affiches" :key="f.id" class="relative rounded-xl"
          :class="estSel(f.id) ? 'ring-2 ring-[#7A2E3E]' : ''"
          style="-webkit-touch-callout: none; user-select: none"
          @pointerdown="pressStart($event, f)" @pointermove="pressMove"
          @pointerup="pressEnd" @pointercancel="pressEnd"
          @click.capture="tapCard($event, f)">
          <FicheRow :fiche="f" />
        </div>
      </div>

      <p v-if="affiches.length < fichesTri.length" class="text-center text-[10px] text-muted pt-2">Fais défiler pour découvrir les {{ fichesTri.length }} adresses du carnet…</p>

      <p v-if="!fiches.length" class="text-center text-sm text-muted py-8 leading-relaxed">
        Le carnet « {{ store.carnet?.nom }} » attend sa première adresse aimée.<br />
        Sois celui qui note le premier.
      </p>
    </template>

    <CompleteFlashSheet v-if="flashComplet" :flash="flashComplet" @close="flashComplet = null" @done="flashComplet = null" />

    <!-- V0.4.72 — bandeau d'action carnet privé : au-dessus de la zone basse, style charte -->
    <div v-if="store.carnet?.prive && selMode"
      class="fixed left-0 right-0 z-[45] flex items-center justify-between gap-2 px-4 py-3"
      :style="{ bottom: 'calc(var(--lc-nav-h) + env(safe-area-inset-bottom, 0px) + 12px)', background: 'var(--c-surface)', borderTop: '1px solid var(--c-hairline)', boxShadow: '0 -8px 24px rgba(43,35,32,.18)' }">
      <p class="text-sm font-semibold text-accent shrink-0">{{ selIds.length }} sélectionnée{{ selIds.length > 1 ? "s" : "" }}</p>
      <button class="text-[11px] font-semibold text-muted underline shrink-0" @click="annulerSel">Tout désélectionner</button>
      <button class="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-accent disabled:opacity-40"
        :disabled="!selIds.length" @click="partagerSel">Partager</button>
    </div>

    <!-- Sheet : choix des carnets destinataires (chips multi-sélection, bordure active) -->
    <div v-if="partageOuvert" class="fixed inset-0 z-[70] flex items-end justify-center"
      style="background: rgba(43,35,32,.45)" @click.self="partageOuvert = false">
      <div class="w-full max-w-[430px] rounded-t-2xl bg-surface p-5 pb-7" style="border-top: 1px solid var(--c-hairline)">
        <p class="font-serif text-lg mb-1">Partager dans quel carnet ?</p>
        <p class="text-xs text-muted mb-4 leading-relaxed">Les fiches quittent ton espace privé pour rejoindre le ou les carnets choisis. Tes notes et commentaires suivent.</p>
        <div class="flex flex-wrap gap-2 mb-5">
          <button v-for="c in carnetsPartageables" :key="c.id" @click="toggleChoix(c.id)"
            class="rounded-full px-3.5 py-2 text-sm font-medium transition"
            :style="{ border: '1.5px solid ' + (estChoisi(c.id) ? 'var(--c-accent)' : 'var(--c-hairline)'), background: estChoisi(c.id) ? 'var(--c-soft)' : 'transparent', color: estChoisi(c.id) ? 'var(--c-accent)' : 'var(--c-ink)' }">
            {{ c.nom }} <span v-if="estChoisi(c.id)">✓</span>
          </button>
          <p v-if="!carnetsPartageables.length" class="text-xs text-muted">Tu n'es membre d'aucun autre carnet pour l'instant.</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button class="rounded-xl py-3 text-sm font-semibold border border-hairline" @click="partageOuvert = false">Annuler</button>
          <button class="rounded-xl py-3 text-sm font-semibold text-white bg-accent disabled:opacity-40"
            :disabled="!carnetIdsChoisis.length" @click="confirmPartage = true">Continuer</button>
        </div>
      </div>
    </div>

    <ConfirmModal :open="confirmPartage" title="Partager tes fiches privées ?"
      :text="'Tu vas partager tes fiches privées avec : ' + carnetIdsChoisis.map((id) => store.carnets.find((c) => c.id === id)?.nom).filter(Boolean).join(' et ')"
      confirmLabel="Valider" @confirm="confirmerPartage" @cancel="confirmPartage = false" />
  </div>
</template>