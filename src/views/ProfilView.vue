<script setup>
import { ref, computed, inject, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import InstallCard from "../components/InstallCard.vue";
import Avatar from "../components/Avatar.vue";
import { exporterFichierJSON } from "../lib/util.js";
import { parseLieux, parseAvis } from "../lib/import.js";
import pkg from "../../package.json";
import * as api from "../lib/api.js";

const notifSupported = computed(() =>
  typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
);
const notifOn = ref(false);
const notifBusy = ref(false);

async function refreshNotif() {
  if (!notifSupported.value) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    notifOn.value = !!sub;
  } catch (e) { notifOn.value = false; }
}
onMounted(refreshNotif);

async function toggleNotif() {
  if (notifBusy.value) return;
  if (store.demoMode) {
    toast("Les notifications sont actives une fois l'app installée en ligne — pas en mode démo");
    return;
  }
  notifBusy.value = true;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (notifOn.value) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribePush(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      notifOn.value = false;
      toast("Notifications désactivées");
      return;
    }
    const res = await api.activerNotifs();
    if (!res.ok) {
      toast(res.raison === "serveur" ? "Notifications indisponibles côté serveur" : "Autorisation refusée dans les réglages du navigateur");
      return;
    }
    notifOn.value = true;
    toast("Notifications activées sur cet appareil");
  } catch (e) {
    toast("Impossible d'activer les notifications");
  } finally {
    notifBusy.value = false;
  }
}

const store = useCarnetStore();
const router = useRouter();
const supprCompte = ref(false);
const supprPurge = ref(true);
async function confirmerSupprCompte() {
  supprCompte.value = false;
  await store.supprimerCompte(supprPurge.value);
  toast("Compte supprimé de cet appareil — à bientôt");
  router.push("/join");
}
// PWA déjà installée ? Alors la carte d'installation descend en bas des réglages.
const appInstallee = (typeof window !== "undefined") &&
  ((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
   window.navigator.standalone === true);
const toast = inject("toast");

// V0.4.72 « Mes adresses » : import Google Maps — 2 fichiers (le 2e optionnel),
// parsing 100 % LOCAL (.kml/.csv/.json selon le compte, cf. src/lib/import.js),
// puis envoi au serveur qui crée l'espace privé à la volée au premier import.
const importBusy = ref(false);
// Astuce import : Le Carnet est aussi un site web (Mac / PC) — même compte, mêmes carnets.
const urlApp = typeof location !== "undefined" ? location.origin : "https://le-carnet-adresses-animees.pages.dev";
const nbMesAdresses = computed(() => {
  const cp = store.mesAdresses;
  return cp ? store.fiches.filter((f) => f.carnets.includes(cp.id)).length : 0;
});
const lieuxPick = ref(null);   // { nom, items }
const avisPick = ref(null);    // { nom, items }
const errImport = ref("");
const resultatImport = ref(null); // { importes, ignores, rattaches, orphelins }
async function onPickLieux(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  errImport.value = ""; resultatImport.value = null;
  try {
    const r = parseLieux(file.name, await file.text());
    if (r.erreur) { errImport.value = "Lieux : " + r.erreur; return; }
    lieuxPick.value = { nom: file.name, items: r.items };
  } catch (err) {
    errImport.value = "Lieux : fichier illisible — vérifie que c'est un export takeout.google.com (Maps).";
  }
}
async function onPickAvis(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  errImport.value = ""; resultatImport.value = null;
  try {
    const r = parseAvis(file.name, await file.text());
    if (r.erreur) { errImport.value = "Avis : " + r.erreur; return; }
    avisPick.value = { nom: file.name, items: r.items };
  } catch (err) {
    errImport.value = "Avis : fichier illisible — seul le JSON d'avis de Takeout (« Maps (vos adresses) ») est attendu.";
  }
}
async function validerImport() {
  if (!lieuxPick.value) return;
  importBusy.value = true;
  try {
    const r = await store.importerAdresses(lieuxPick.value.items);
    if (r && r.error) { errImport.value = "Import impossible : " + r.error; return; }
    let rattaches = 0, orphelins = [];
    if (avisPick.value && avisPick.value.items.length) {
      const ra = await store.rattacherAvis(avisPick.value.items);
      if (ra && !ra.error) { rattaches = ra.rattaches || 0; orphelins = ra.orphelins || []; }
    }
    resultatImport.value = { ...r, rattaches, orphelins };
    lieuxPick.value = null; avisPick.value = null;
  } finally {
    importBusy.value = false;
  }
}
function ouvrirMesAdresses() {
  const cp = store.mesAdresses;
  if (!cp) return;
  store.switchCarnet(cp.id);
  router.push("/");
}
// Super-admin : appui long sur la version → espace privé de démo (pass vérifié serveur)
const demoPopin = ref(false);
const demoPass = ref("");
let demoTimer = null, demoPos = null;
function demoStart(e) {
  const p = e.touches?.[0] || e;
  demoPos = { x: p.clientX, y: p.clientY };
  demoTimer = setTimeout(() => { demoPopin.value = true; }, 600);
}
function demoMove(e) {
  if (!demoPos) return;
  const p = e.touches?.[0] || e;
  if (Math.abs(p.clientX - demoPos.x) > 8 || Math.abs(p.clientY - demoPos.y) > 8) clearTimeout(demoTimer);
}
function demoEnd() { clearTimeout(demoTimer); demoTimer = null; demoPos = null; }
async function demoValider() {
  const r = await store.demoPrive(demoPass.value);
  demoPopin.value = false; demoPass.value = "";
  if (r && r.ok) toast("Espace privé de démo prêt — " + r.ajoutees + " fiches");
  else toast(r && r.error ? r.error : "Pass super-admin refusé");
}
const prenom = ref(store.profil.prenom);

const exportCarnetId = ref(store.carnetId);

const dupErr = ref("");
const saveOk = ref(false);
const enCours = ref(false);
let okTimer = null;
async function savePrenom() {
  const nv = prenom.value.trim();
  if (!nv || enCours.value) return;
  enCours.value = true;
  dupErr.value = "";
  // Le contrôle de doublon est fait par le serveur, sur TOUS les carnets de
  // l'appareil — un membre qui rejoint plus tard ne peut pas créer d'homonyme.
  const r = await store.changerPrenom(nv);
  enCours.value = false;
  if (r && r.error) {
    dupErr.value = r.error === "prenom_pris"
      ? "« " + nv + " » est déjà pris dans " + (r.carnets || []).map((c) => "« " + c + " »").join(", ")
        + " — ajoute une initiale, ex. " + nv + " M."
      : r.error === "C'est déjà ton prénom" || r.error === "Prénom vide" ? r.error
      : "Impossible d'enregistrer : " + r.error;
    return;
  }
  saveOk.value = true;
  clearTimeout(okTimer);
  okTimer = setTimeout(() => (saveOk.value = false), 2600);
}
function onAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 200;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const k = Math.max(size / img.width, size / img.height);
      canvas.getContext("2d").drawImage(img, (size - img.width * k) / 2, (size - img.height * k) / 2, img.width * k, img.height * k);
      store.setAvatar(canvas.toDataURL("image/jpeg", 0.8));
      toast("Avatar mis à jour");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function toggleTheme() {
  store.setDark(!store.dark);
}
const exportCarnet = computed(() => store.carnets.find((c) => c.id === exportCarnetId.value) || null);
const moi = computed(() => store.profil.prenom);
// Support : ouvre le client mail sans afficher l'adresse en clair à l'écran
function contacterSupport() {
  window.location.href = "mailto:thomasries.dev@gmail.com?subject=" + encodeURIComponent("Le Carnet — support");
}

// La carte « Contacter le support » est réservée aux admins (de n'importe quel carnet)
const estAdminQuelconque = computed(() => Object.values(store.roles).some(r => r === "admin"));

// État des notifications tel qu'affiché replié dans l'accordéon
const notifEtat = computed(() =>
  store.demoMode ? "à activer une fois l'app en ligne" : notifOn.value ? "activées" : "désactivées"
);

const badges = computed(() => {
  const mesFiches = store.fiches.filter((f) => f.auteur === moi.value);
  const mesFlashes = store.flashes.filter((f) => f.auteur === moi.value);
  return [
    { ic: "pin", label: "adresses notées", val: mesFiches.filter((f) => f.type === "adresse").length },
    { ic: "book", label: "recettes partagées", val: mesFiches.filter((f) => f.type === "recette").length },
    { ic: "bolt", label: "flashes en vie", val: mesFlashes.length },
    { ic: "heart", label: "amour reçu", val: mesFiches.reduce((n, f) => n + (f.reacts?.length || 0), 0) + mesFlashes.reduce((n, f) => n + (f.reacts?.length || 0), 0) },
  ];
});
async function exporterJSON() {
  const c = exportCarnet.value;
  if (!c) return;
  const fiches = store.fiches.filter((f) => f.carnets.includes(c.id));
  const nomFichier = "le-carnet-" + c.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json";
  const r = await exporterFichierJSON(nomFichier, {
    exporte_le: new Date().toISOString(),
    carnet: { nom: c.nom, code: c.code, admin: c.admin, membres: c.membres },
    fiches,
  });
  if (r === "annule") return;
  toast(r === "partage" ? "Export prêt à partager" : "Export JSON téléchargé");
}
</script>

<template>
  <div>
    <h1 class="text-lg font-serif mb-4">Mon profil</h1>

    <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline flex items-center gap-4">
      <label class="cursor-pointer relative">
        <Avatar :prenom="store.profil.prenom || '?'" :size="56" :src="store.profil.avatar" />
        <span class="absolute -bottom-1 -right-1 rounded-full p-1.5 bg-accent text-white" style="border: 2px solid var(--c-surface)">
          <Ic name="camera" class="w-2.5 h-2.5" />
        </span>
        <input type="file" accept="image/*" class="hidden" @change="onAvatar" />
      </label>
      <div class="flex-1">
        <input v-model="prenom" placeholder="Ton prénom" maxlength="20"
          class="w-full rounded-xl px-3 py-2.5 text-sm bg-bg outline-none"
          :style="dupErr ? 'border-color: var(--c-accent); background: var(--c-soft)' : 'border: 1px solid var(--c-hairline)'" />
        <p v-if="dupErr" class="text-xs text-accent mt-1.5 leading-relaxed">{{ dupErr }}</p>
        <p v-if="saveOk" class="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
          :style="{ color: 'var(--c-green)', background: 'rgba(74,120,86,.12)' }">
          <Ic name="check" class="w-3 h-3" :sw="2.5" /> Prénom mis à jour dans tous tes carnets
        </p>
        <button v-if="prenom.trim() && prenom !== store.profil.prenom" @click="savePrenom" :disabled="enCours"
          class="mt-2 text-xs font-semibold text-accent">{{ enCours ? "Enregistrement…" : "Enregistrer" }}</button>
      </div>
    </div>

    <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline">
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2.5">Mon activité</p>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="b in badges" :key="b.label" class="rounded-xl p-3 flex items-center gap-2.5 bg-soft">
          <span class="rounded-full w-8 h-8 flex items-center justify-center text-accent shrink-0" style="background: var(--c-surface);">
            <Ic :name="b.ic" class="w-4 h-4" />
          </span>
          <span class="min-w-0">
            <span class="block text-base font-serif leading-none">{{ b.val }}</span>
            <span class="block text-[10px] text-muted truncate">{{ b.label }}</span>
          </span>
        </div>
      </div>
    </div>


    <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline">
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Mes carnets ({{ store.carnets.length }})</p>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="c in store.carnets" :key="c.id" class="rounded-full px-3 py-1.5 text-xs font-medium bg-soft text-accent">{{ c.nom }}</span>
      </div>
      <a href="#/carnet"
        class="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
        <Ic name="book" class="w-4 h-4" /> Gérer et partager mes carnets
      </a>
    </div>

    
    <!-- V0.4.72 : Mes adresses — import Google (lieux + avis optionnel), espace privé créé au premier import -->
    <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline">
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Mes adresses — {{ nbMesAdresses }} lieu{{ nbMesAdresses > 1 ? "x" : "" }}</p>
      <p class="text-[11px] text-muted leading-relaxed mb-3">
        Ton réservoir privé : visible de toi seul. Rien n'est partagé sans ton geste explicite.
      </p>

      <!-- Astuce : l'import est plus simple au clavier — Le Carnet est aussi un site web -->
      <div class="rounded-xl px-3 py-2.5 mb-3 flex items-start gap-2 bg-soft">
        <Ic name="share" class="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <p class="text-[11px] text-muted leading-snug">
          Plus simple sur ordi : Le Carnet est aussi un site web — ouvre
          <span class="font-semibold text-accent">{{ urlApp }}</span>
          sur Mac ou PC, rejoins tes carnets avec tes codes, et fais l'import Takeout au clavier.
          Les adresses partagées se retrouvent sur tous tes écrans.
        </p>
      </div>

      <template v-if="!resultatImport">
        <div class="flex items-center justify-between rounded-xl px-3 py-2.5 mb-2 cursor-pointer"
          :style="{ border: '1px solid ' + (lieuxPick ? 'var(--c-accent)' : 'var(--c-hairline)') }">
          <label class="flex-1 text-[11px] leading-tight cursor-pointer">
            <span class="block font-semibold text-sm" :class="lieuxPick ? 'text-accent' : ''">
              {{ lieuxPick ? "✓ " + lieuxPick.nom : "1. Tes lieux enregistrés" }}</span>
            <span class="text-muted">Obligatoire — export Takeout Google (produit « Maps (vos adresses) »)</span>
            <input type="file" accept=".kml,.xml,.csv,.json,.txt" class="hidden" @change="onPickLieux" :disabled="importBusy" />
          </label>
          <Ic name="pin" class="w-4 h-4 text-muted" />
        </div>
        <div class="flex items-center justify-between rounded-xl px-3 py-2.5 mb-2 cursor-pointer"
          :style="{ border: '1px solid ' + (avisPick ? 'var(--c-accent)' : 'var(--c-hairline)'), opacity: lieuxPick ? '1' : '.55' }">
          <label class="flex-1 text-[11px] leading-tight cursor-pointer">
            <span class="block font-semibold text-sm" :class="avisPick ? 'text-accent' : ''">
              {{ avisPick ? "✓ " + avisPick.nom : "2. Tes avis Google — optionnel" }}</span>
            <span class="text-muted">Notes ★★★★★ et commentaires — ajoutable plus tard</span>
            <input type="file" accept=".json" class="hidden" @change="onPickAvis" :disabled="importBusy || !lieuxPick" />
          </label>
          <Ic name="star" class="w-4 h-4 text-muted" />
        </div>

        <p v-if="lieuxPick" class="text-[11px] text-muted mb-2">
          {{ lieuxPick.items.length }} lieu{{ lieuxPick.items.length > 1 ? "x" : "" }} trouvé{{ lieuxPick.items.length > 1 ? "s" : "" }}
          <template v-if="avisPick"> · {{ avisPick.items.length }} avis à rattacher</template>
        </p>
        <p v-if="errImport" class="text-[11px] text-red-600 mb-2">{{ errImport }}</p>

        <div class="flex gap-2">
          <button class="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-accent text-white disabled:opacity-40"
            :disabled="!lieuxPick || importBusy" @click="validerImport">
            {{ importBusy ? "Import en cours…" : "Importer" }}</button>
          <button v-if="lieuxPick || avisPick" class="rounded-xl px-4 text-sm text-muted"
            :style="{ border: '1px solid var(--c-hairline)' }"
            @click="lieuxPick = null; avisPick = null; errImport = ''">Plus tard</button>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-wrap gap-2 mb-3">
          <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" :style="{ background: 'var(--c-accent)' }">✓ {{ resultatImport.importes }} importés</span>
          <span v-if="resultatImport.ignores" class="rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted"
            :style="{ border: '1px solid var(--c-hairline)' }">{{ resultatImport.ignores }} doublons ignorés</span>
          <span v-if="resultatImport.rattaches" class="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" :style="{ background: 'var(--c-accent)' }">★ {{ resultatImport.rattaches }} avis rattachés</span>
          <span v-if="resultatImport.orphelins && resultatImport.orphelins.length" class="rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted"
            :style="{ border: '1px solid var(--c-hairline)' }">{{ resultatImport.orphelins.length }} avis sans lieu correspondant</span>
        </div>
        <button class="w-full rounded-xl py-2.5 text-sm font-semibold text-accent bg-soft"
          @click="resultatImport = null">Import d'autres fichiers</button>
      </template>

      <button v-if="store.mesAdresses" class="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-accent bg-soft flex items-center justify-center gap-1.5"
        @click="ouvrirMesAdresses">
        <Ic name="book" class="w-4 h-4" /> Ouvrir Mes adresses ({{ nbMesAdresses }}) →
      </button>
      <p class="text-[10px] text-muted mt-2">Export : takeout.google.com → « Maps (vos adresses) » — un seul produit contient tes lieux ET tes avis. Aucun compte Google requis.</p>
    </div>

    <InstallCard v-if="!appInstallee" />

    <!-- Réglages & données : 3 accordéons natifs (details/summary), état visible même repliés -->
    <div class="rounded-2xl bg-surface border border-hairline mb-3 overflow-hidden">
      <p class="text-[10px] uppercase tracking-widest text-muted pt-4 px-4 mb-1.5">Réglages &amp; données</p>

      <details v-if="notifSupported" class="group border-t border-hairline">
        <summary class="lc-sum">
          <Ic name="bolt" class="w-4 h-4 shrink-0" :class="notifOn ? 'text-accent' : 'text-muted'" />
          <span class="flex-1 text-left leading-tight">
            <span class="block text-sm font-semibold">Notifications</span>
            <span class="block text-[10px] text-muted">{{ notifEtat }} — propre à cet appareil</span>
          </span>
          <Ic name="chevron" class="w-4 h-4 text-muted shrink-0 transition group-open:rotate-180" />
        </summary>
        <div class="px-4 pb-4">
          <p v-if="store.demoMode" class="text-[11px] mb-2.5 leading-relaxed rounded-xl px-3 py-2.5 bg-soft text-accent">
            Flashes, adresses notées, rappel J-6. À activer une fois l'app installée en ligne — pas disponible en mode démo.
          </p>
          <button @click="toggleNotif" :disabled="notifBusy || store.demoMode"
            class="w-full rounded-xl p-3.5 flex items-center justify-between disabled:opacity-50"
            :style="{ background: notifOn ? 'var(--c-soft)' : 'transparent', border: '1px solid var(--c-hairline)' }">
            <span class="flex items-center gap-2.5 text-sm">
              <Ic name="bolt" class="w-4 h-4" :class="notifOn ? 'text-accent' : 'text-muted'" />
              <span class="text-left leading-tight">
                <span class="block font-semibold">{{ store.demoMode ? "En attente de mise en ligne" : notifOn ? "Activées" : "Désactivées" }}</span>
                <span class="block text-[10px] text-muted">Flashes, adresses notées, rappel J-6</span>
              </span>
            </span>
            <span class="relative rounded-full w-11 h-6 transition shrink-0" :style="{ background: notifOn ? '#7A2E3E' : 'var(--c-hairline)' }">
              <span class="absolute top-0.5 rounded-full w-5 h-5 bg-white transition-all"
                :style="{ left: notifOn ? '22px' : '2px' }" />
            </span>
          </button>
        </div>
      </details>

      <details class="group border-t border-hairline">
        <summary class="lc-sum">
          <Ic name="share" class="w-4 h-4 shrink-0" style="color: var(--c-green)" />
          <span class="flex-1 text-left leading-tight">
            <span class="block text-sm font-semibold">Exporter mes données</span>
            <span class="block text-[10px] text-muted">fichier JSON du carnet, à tout moment</span>
          </span>
          <Ic name="chevron" class="w-4 h-4 text-muted shrink-0 transition group-open:rotate-180" />
        </summary>
        <div class="px-4 pb-4">
          <div class="relative mb-3">
            <select v-model="exportCarnetId"
              class="w-full appearance-none rounded-xl px-3 py-3 pr-9 text-sm bg-bg border border-hairline outline-none cursor-pointer">
              <option v-for="c in store.carnets" :key="c.id" :value="c.id">{{ c.nom }}</option>
            </select>
            <Ic name="chevron" class="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
          </div>
          <p v-if="exportCarnet" class="text-[11px] text-muted mb-2.5 leading-relaxed">
            Fichier JSON du carnet « {{ exportCarnet.nom }} » : fiches, notes et commentaires. Sur iPhone, la feuille de partage natif s'ouvre.
          </p>
          <button @click="exporterJSON"
            class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5"
            :style="{ color: 'var(--c-green)', background: 'color-mix(in srgb, var(--c-green) 12%, transparent)' }">
            <Ic name="share" class="w-4 h-4" /> Exporter en JSON
          </button>
        </div>
      </details>

      <details v-if="estAdminQuelconque" class="group border-t border-hairline">
        <summary class="lc-sum">
          <Ic name="user" class="w-4 h-4 shrink-0 text-accent" />
          <span class="flex-1 text-left leading-tight">
            <span class="block text-sm font-semibold">Un souci avec l'app ?</span>
            <span class="block text-[10px] text-muted">bug, question, suggestion — le support répond vite</span>
          </span>
          <Ic name="chevron" class="w-4 h-4 text-muted shrink-0 transition group-open:rotate-180" />
        </summary>
        <div class="px-4 pb-4">
          <button @click="contacterSupport"
            class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5"
            :style="{ color: 'var(--c-accent)', background: 'var(--c-soft)' }">
            <Ic name="user" class="w-4 h-4" /> Contacter le support
          </button>
        </div>
      </details>

      <div v-if="appInstallee" class="border-t border-hairline px-4 pt-3 pb-4">
        <InstallCard />
      </div>
    </div>

    <button @click="toggleTheme"
      class="w-full rounded-2xl p-4 mb-3 bg-surface border border-hairline flex items-center justify-between">
      <span class="flex items-center gap-2.5 text-sm"><Ic name="moon" class="w-4 h-4 text-muted" /> Mode sombre</span>
      <span class="relative rounded-full w-11 h-6 transition" :style="{ background: store.dark ? '#7A2E3E' : 'var(--c-hairline)' }">
        <span class="absolute top-0.5 rounded-full w-5 h-5 bg-white transition-all"
          :style="{ left: store.dark ? '22px' : '2px' }" />
      </span>
    </button>

    <button @click="store.setInspirOn(!store.inspirOn)"
      class="w-full rounded-2xl p-4 mb-3 bg-surface border border-hairline flex items-center justify-between">
      <span class="flex items-center gap-2.5 text-sm">
        <Ic name="sparkle" class="w-4 h-4 text-muted" />
        <span class="min-w-0">
          <span class="block">Idées de sorties</span>
          <span class="block text-[10px] text-muted leading-tight">le bandeau d'inspiration sur l'accueil</span>
        </span>
      </span>
      <span class="relative rounded-full w-11 h-6 transition" :style="{ background: store.inspirOn ? '#7A2E3E' : 'var(--c-hairline)' }">
        <span class="absolute top-0.5 rounded-full w-5 h-5 bg-white transition-all"
          :style="{ left: store.inspirOn ? '22px' : '2px' }" />
      </span>
    </button>


    <p class="text-[11px] text-muted text-center leading-relaxed select-none"
      @touchstart="demoStart" @touchmove="demoMove" @touchend="demoEnd"
      @mousedown="demoStart" @mousemove="demoMove" @mouseup="demoEnd">
      Tes données t'appartiennent — export disponible à tout moment.<br />
      Le Carnet · V{{ pkg.version }}
    </p>

    <!-- Popin super-admin : crée l'espace privé de démo (pass vérifié serveur) -->
    <div v-if="demoPopin" class="fixed inset-0 z-50 flex items-end" :style="{ background: 'rgba(0,0,0,.35)' }"
      @click.self="demoPopin = false">
      <div class="w-full rounded-t-2xl bg-surface p-5 pb-7" style="max-width: 480px; margin: 0 auto;">
        <p class="text-sm font-semibold mb-1">Espace privé de démo</p>
        <p class="text-[11px] text-muted mb-3">Super-admin : entre ton pass pour créer « Mes adresses » avec des fiches de démonstration.</p>
        <input v-model="demoPass" type="password" inputmode="numeric" placeholder="Pass super-admin"
          class="w-full rounded-xl px-3 py-2.5 text-sm mb-3 bg-soft"
          style="border: 1px solid var(--c-hairline)" />
        <div class="flex gap-2">
          <button class="flex-1 rounded-xl py-2.5 text-sm font-semibold text-muted"
            :style="{ border: '1px solid var(--c-hairline)' }" @click="demoPopin = false">Annuler</button>
          <button class="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-accent text-white disabled:opacity-40"
            :disabled="!demoPass" @click="demoValider">Valider</button>
        </div>
      </div>
    </div>

    <!-- Zone sensible : tout en bas du profil, bien séparée -->
    <div class="mt-4 pt-4 border-t border-hairline">
      <button @click="supprCompte = true"
        class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 text-accent bg-soft">
        <Ic name="trash" class="w-4 h-4" /> Supprimer mon compte
      </button>
    </div>

    <!-- Modale : choix des contributions + mode d'emploi de la désinstallation -->
    <div v-if="supprCompte" class="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
      style="background: rgba(20, 14, 12, .55)" @click.self="supprCompte = false">
      <div class="w-full max-w-sm rounded-2xl p-5 bg-bg border border-hairline">
        <p class="text-base font-serif mb-2">Supprimer mon compte ?</p>
        <p class="text-xs leading-relaxed text-muted mb-3">
          Cet appareil quitte tous ses carnets. C'est définitif : pour revenir, il faudra refaire une
          demande d'invitation — et tout ce qui aura été supprimé sera perdu.
        </p>
        <p class="text-xs leading-relaxed text-muted mb-4">
          Pour désinstaller l'app : iPhone — maintiens l'icône Le Carnet, puis « Retirer l'app » ·
          Android — appui long sur l'icône, puis « Désinstaller ».
        </p>
        <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Mes contributions</p>
        <button @click="supprPurge = true" class="w-full rounded-xl p-3 mb-2 text-left"
          :style="{ background: supprPurge ? 'var(--c-soft)' : 'transparent', border: '1px solid ' + (supprPurge ? 'var(--c-accent)' : 'var(--c-hairline)') }">
          <span class="block text-sm font-semibold">Tout supprimer</span>
          <span class="block text-[10px] text-muted">mes notes, likes, commentaires et flashes disparaissent des carnets</span>
        </button>
        <button @click="supprPurge = false" class="w-full rounded-xl p-3 mb-4 text-left"
          :style="{ background: !supprPurge ? 'var(--c-soft)' : 'transparent', border: '1px solid ' + (!supprPurge ? 'var(--c-accent)' : 'var(--c-hairline)') }">
          <span class="block text-sm font-semibold">Les garder dans les carnets</span>
          <span class="block text-[10px] text-muted">elles restent visibles, signées de mon prénom</span>
        </button>
        <div class="flex gap-2">
          <button @click="supprCompte = false" class="flex-1 rounded-xl py-3 text-sm font-semibold bg-surface border border-hairline">Annuler</button>
          <button @click="confirmerSupprCompte" class="flex-1 rounded-xl py-3 text-sm font-semibold text-white"
            style="background: #7A2E3E">Supprimer</button>
        </div>
      </div>
    </div>
  </div>
</template>