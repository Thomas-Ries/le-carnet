<script setup>
import { t, i18n, setLang } from "../lib/i18n.js";
import { ref, computed, inject, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
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
    toast(t("Les notifications sont actives une fois l'app installée en ligne — pas en mode démo"));
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
      toast(t("Notifications désactivées"));
      return;
    }
    const res = await api.activerNotifs();
    if (!res.ok) {
      toast(res.raison === "serveur" ? "Notifications indisponibles côté serveur" : "Autorisation refusée dans les réglages du navigateur");
      return;
    }
    notifOn.value = true;
    toast(t("Notifications activées sur cet appareil"));
  } catch (e) {
    toast(t("Impossible d'activer les notifications"));
  } finally {
    notifBusy.value = false;
  }
}

const store = useCarnetStore();
const router = useRouter();
const route = useRoute();
// V0.4.81 : la popin nouveauté envoie ici — on ouvre la section G-Maps.
onMounted(() => {
  if (route.query && route.query.gmaps) importOuvert.value = true;
});
const supprCompte = ref(false);
const supprPurge = ref(true);
async function confirmerSupprCompte() {
  supprCompte.value = false;
  await store.supprimerCompte(supprPurge.value);
  toast(t("Compte supprimé de cet appareil — à bientôt"));
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
const nbMesAdresses = computed(() => {
  const cp = store.mesAdresses;
  return cp ? store.fiches.filter((f) => f.carnets.includes(cp.id)).length : 0;
});
// V0.4.78 : section d'import repliée par défaut — elle ne prend plus toute la place.
const importOuvert = ref(false);
const picks = ref([]);        // [{ nom, type: "avis"|"lieux", items, sansLieu? }]
const errImport = ref("");
const resultatImport = ref(null); // { importes, ignores, rattaches, orphelins, sansLieu }
const nbAvis = computed(() => picks.value.filter((p) => p.type === "avis").reduce((n, p) => n + p.items.length, 0));
const nbLieux = computed(() => picks.value.filter((p) => p.type === "lieux").reduce((n, p) => n + p.items.length, 0));
const sansLieuTotal = computed(() => picks.value.reduce((n, p) => n + (p.sansLieu || 0), 0));
// V0.4.74 : UN SEUL bouton multi-fichiers — le parser détecte tout seul le contenu
// (JSON d'avis → fiches avec note ★ ; listes CSV/KML/JSON → fiches « à noter »).
async function onPickExport(e) {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  errImport.value = ""; resultatImport.value = null;
  for (const file of files) {
    if (picks.value.some((p) => p.nom === file.name)) continue; // déjà choisi
    try {
      const txt = await file.text();
      const a = parseAvis(file.name, txt);
      if (a.items && a.items.length) {
        picks.value.push({ nom: file.name, type: "avis", items: a.items, sansLieu: a.sansLieu || 0 });
        continue;
      }
      const l = parseLieux(file.name, txt);
      if (l.items && l.items.length) {
        picks.value.push({ nom: file.name, type: "lieux", items: l.items });
        continue;
      }
      errImport.value = "Rien de reconnaissable dans « " + file.name + " » — vérifie que c'est l'export takeout.google.com (« Maps (vos adresses) »).";
    } catch (err) {
      errImport.value = "Fichier illisible : " + file.name + " — vérifie que c'est un export takeout.google.com.";
    }
  }
}
function retirerPick(nom) { picks.value = picks.value.filter((p) => p.nom !== nom); }
async function validerImport() {
  // Détection automatique : avis → fiches complètes (nom, adresse, note ★, commentaire) ;
  // listes → fiches « à noter » ; si les deux : lieux importés puis avis rattachés.
  const lieux = picks.value.filter((p) => p.type === "lieux").flatMap((p) => p.items);
  const avis = picks.value.filter((p) => p.type === "avis").flatMap((p) => p.items);
  if (!lieux.length && !avis.length) return;
  importBusy.value = true;
  try {
    const r = await store.importerAdresses(lieux.length ? lieux : avis);
    if (r && r.error) { errImport.value = "Import impossible : " + r.error; return; }
    let rattaches = 0, orphelins = [];
    if (lieux.length && avis.length) {
      const ra = await store.rattacherAvis(avis);
      if (ra && !ra.error) { rattaches = ra.rattaches || 0; orphelins = ra.orphelins || []; }
    }
    const sansLieu = !lieux.length ? sansLieuTotal.value : 0;
    resultatImport.value = { ...r, rattaches, orphelins, sansLieu };
    picks.value = [];
  } finally {
    importBusy.value = false;
  }
}
async function ouvrirMesAdresses() {
  let cp = store.mesAdresses;
  if (!cp) {
    // Filet de sécurité : si l'espace privé n'est pas encore dans la liste locale (ex. cache),
    // on rafraîchit depuis le serveur avant d'abandonner — jamais de clic silencieux.
    await store.refresh();
    cp = store.mesAdresses;
  }
  if (!cp) { toast(t("Espace privé introuvable — recharge l'app et réessaie")); return; }
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
      toast(t("Avatar mis à jour"));
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
    <h1 class="text-lg font-serif mb-4">{{ t("Mon profil") }}</h1>

    <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline flex items-center gap-4">
      <label class="cursor-pointer relative">
        <Avatar :prenom="store.profil.prenom || '?'" :size="56" :src="store.profil.avatar" />
        <span class="absolute -bottom-1 -right-1 rounded-full p-1.5 bg-accent text-white" style="border: 2px solid var(--c-surface)">
          <Ic name="camera" class="w-2.5 h-2.5" />
        </span>
        <input type="file" accept="image/*" class="hidden" @change="onAvatar" />
      </label>
      <div class="flex-1">
        <input v-model="prenom" :placeholder="t('Ton prénom')" maxlength="20"
          class="w-full rounded-xl px-3 py-2.5 text-sm bg-bg outline-none"
          :style="dupErr ? 'border-color: var(--c-accent); background: var(--c-soft)' : 'border: 1px solid var(--c-hairline)'" />
        <p v-if="dupErr" class="text-xs text-accent mt-1.5 leading-relaxed">{{ dupErr }}</p>
        <p v-if="saveOk" class="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
          :style="{ color: 'var(--c-green)', background: 'rgba(74,120,86,.12)' }">
          <Ic name="check" class="w-3 h-3" :sw="2.5" /> {{ t("Prénom mis à jour dans tous tes carnets") }}
        </p>
        <button v-if="prenom.trim() && prenom !== store.profil.prenom" @click="savePrenom" :disabled="enCours"
          class="mt-2 text-xs font-semibold text-accent">{{ enCours ? "Enregistrement…" : "Enregistrer" }}</button>
      </div>
    </div>

    <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline">
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2.5">{{ t("Mon activité") }}</p>
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
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">{{ t("Mes carnets (") }}{{ store.carnets.length }})</p>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="c in store.carnets" :key="c.id" class="rounded-full px-3 py-1.5 text-xs font-medium bg-soft text-accent">{{ c.nom }}</span>
      </div>
      <a href="#/carnet"
        class="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
        <Ic name="book" class="w-4 h-4" /> {{ t("Gérer et partager mes carnets") }}
      </a>
    </div>

    
    
    <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline" style="border-color: var(--c-accent)">
      <button class="w-full flex items-start gap-2.5 text-left"
        :class="importOuvert || resultatImport ? 'mb-2.5' : ''"
        @click="importOuvert = !importOuvert">
        <span class="rounded-full w-9 h-9 flex items-center justify-center shrink-0 mt-0.5"
          :style="{ background: 'var(--c-accent)' }"><Ic name="pin" class="w-4 h-4 text-white" /></span>
        <span class="flex-1">
          <span class="flex items-center gap-1.5 font-serif text-lg font-semibold leading-tight">
            {{ t("Mon G-Maps") }}
            <Ic name="chevron" class="w-3.5 h-3.5 text-muted transition-transform" :class="importOuvert ? 'rotate-180' : ''" />
          </span>
          <span class="block text-[11px] text-muted leading-relaxed mt-1">
            {{ nbMesAdresses }} {{ t(nbMesAdresses > 1 ? "lieux importés" : "lieu importé") }} · {{ t(importOuvert || resultatImport ? "Importer mes lieux, notes et commentaires Google Maps — visible de toi seul." : "Importer mes lieux et avis Google Maps — touche pour ouvrir.") }}
          </span>
        </span>
      </button>
      <template v-if="importOuvert || resultatImport">

      <template v-if="!resultatImport">
        <label class="w-full rounded-xl px-3 py-3 mb-2 flex items-center justify-between gap-2 cursor-pointer"
          :style="{ border: '1px dashed ' + (picks.length ? 'var(--c-accent)' : 'var(--c-hairline)') }">
          <span class="text-[11px] leading-tight">
            <span class="block font-semibold text-sm" :class="picks.length ? 'text-accent' : ''">
              {{ picks.length ? picks.length + " fichier" + (picks.length > 1 ? "s" : "") + " choisi" + (picks.length > 1 ? "s" : "") : t("Importer mes fichiers Google Maps") }}</span>
            <span class="text-muted">{{ t("Ton export takeout.google.com (« Maps (vos adresses) ») — tout seul ou tout le zip : on détecte ce qui est dedans. Les avis deviennent des fiches avec ta note ★ et ton commentaire ; les listes deviennent des fiches « à noter ».") }}</span>
            <input type="file" accept=".json,.kml,.xml,.csv,.txt" multiple class="hidden" @change="onPickExport" :disabled="importBusy" />
          </span>
          <Ic name="pin" class="w-4 h-4 text-muted shrink-0" />
        </label>

        <div v-if="picks.length" class="mb-2">
          <div v-for="p in picks" :key="p.nom" class="flex items-center justify-between rounded-xl px-3 py-2 mb-1.5 bg-soft">
            <p class="text-[11px] leading-tight min-w-0">
              <span class="block font-semibold truncate">{{ p.type === "avis" ? "★ " : "· " }}{{ p.nom }}</span>
              <span class="text-muted">{{ p.items.length }} {{ p.type === "avis" ? "avis → fiches complètes" : "lieux → fiches « à noter »" }}<template v-if="p.sansLieu"> · {{ p.sansLieu }} avis sans lieu, ignoré{{ p.sansLieu > 1 ? "s" : "" }}</template></span>
            </p>
            <button class="text-muted p-1 shrink-0" @click="retirerPick(p.nom)"><Ic name="x" class="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <p v-if="errImport" class="text-[11px] text-red-600 mb-2">{{ errImport }}</p>

        <div class="flex gap-2">
          <button class="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-accent text-white disabled:opacity-40"
            :disabled="!picks.length || importBusy" @click="validerImport">
            {{ importBusy ? "Import en cours…" : "Importer" }}</button>
          <button v-if="picks.length" class="rounded-xl px-4 text-sm text-muted"
            :style="{ border: '1px solid var(--c-hairline)' }"
            @click="picks = []; errImport = ''">{{ t("Plus tard") }}</button>
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
          <span v-if="resultatImport.sansLieu" class="rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted"
            :style="{ border: '1px solid var(--c-hairline)' }">{{ resultatImport.sansLieu }} avis sans lieu identifié par Google, ignorés</span>
        </div>
        
        <button class="w-full rounded-xl py-3 text-sm font-semibold text-white bg-accent flex items-center justify-center gap-1.5"
          @click="ouvrirMesAdresses">
          <Ic name="book" class="w-4 h-4" /> Ouvrir Mon G-Maps{{ nbMesAdresses ? " (" + nbMesAdresses + ")" : "" }} →
        </button>
        <p class="text-[11px] text-muted text-center mt-2.5 mb-1">
          {{ t("Pour offrir une adresse à un carnet : appui long sur une fiche dans la liste, puis « Partager ».") }}
        </p>
        <button class="w-full rounded-xl py-2.5 text-xs font-semibold text-muted"
          @click="resultatImport = null">{{ t("Import d'autres fichiers") }}</button>
      </template>

      <button v-if="store.mesAdresses && !resultatImport" class="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-accent bg-soft flex items-center justify-center gap-1.5"
        @click="ouvrirMesAdresses">
        <Ic name="book" class="w-4 h-4" /> Ouvrir Mon G-Maps ({{ nbMesAdresses }}) →
      </button>
      <p class="text-[10px] text-muted mt-2">{{ t("Export : takeout.google.com → « Maps (vos adresses) » — un seul produit contient tes lieux ET tes avis. Aucun compte Google requis.") }}</p>
      </template>
    </div>

    <InstallCard v-if="!appInstallee" />

    
    <div class="rounded-2xl bg-surface border border-hairline mb-3 overflow-hidden">
      <p class="text-[10px] uppercase tracking-widest text-muted pt-4 px-4 mb-1.5">{{ t("Réglages &amp; données") }}</p>

      <details v-if="notifSupported" class="group border-t border-hairline">
        <summary class="lc-sum">
          <Ic name="bolt" class="w-4 h-4 shrink-0" :class="notifOn ? 'text-accent' : 'text-muted'" />
          <span class="flex-1 text-left leading-tight">
            <span class="block text-sm font-semibold">{{ t("Notifications") }}</span>
            <span class="block text-[10px] text-muted">{{ notifEtat }} — propre à cet appareil</span>
          </span>
          <Ic name="chevron" class="w-4 h-4 text-muted shrink-0 transition group-open:rotate-180" />
        </summary>
        <div class="px-4 pb-4">
          <p v-if="store.demoMode" class="text-[11px] mb-2.5 leading-relaxed rounded-xl px-3 py-2.5 bg-soft text-accent">
            {{ t("Flashes, adresses notées, rappel J-6. À activer une fois l'app installée en ligne — pas disponible en mode démo.") }}
          </p>
          <button @click="toggleNotif" :disabled="notifBusy || store.demoMode"
            class="w-full rounded-xl p-3.5 flex items-center justify-between disabled:opacity-50"
            :style="{ background: notifOn ? 'var(--c-soft)' : 'transparent', border: '1px solid var(--c-hairline)' }">
            <span class="flex items-center gap-2.5 text-sm">
              <Ic name="bolt" class="w-4 h-4" :class="notifOn ? 'text-accent' : 'text-muted'" />
              <span class="text-left leading-tight">
                <span class="block font-semibold">{{ store.demoMode ? "En attente de mise en ligne" : notifOn ? "Activées" : "Désactivées" }}</span>
                <span class="block text-[10px] text-muted">{{ t("Flashes, adresses notées, rappel J-6") }}</span>
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
            <span class="block text-sm font-semibold">{{ t("Exporter mes données") }}</span>
            <span class="block text-[10px] text-muted">{{ t("fichier JSON du carnet, à tout moment") }}</span>
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
            <Ic name="share" class="w-4 h-4" /> {{ t("Exporter en JSON") }}
          </button>
        </div>
      </details>

      <details v-if="estAdminQuelconque" class="group border-t border-hairline">
        <summary class="lc-sum">
          <Ic name="user" class="w-4 h-4 shrink-0 text-accent" />
          <span class="flex-1 text-left leading-tight">
            <span class="block text-sm font-semibold">{{ t("Un souci avec l'app ?") }}</span>
            <span class="block text-[10px] text-muted">{{ t("bug, question, suggestion — le support répond vite") }}</span>
          </span>
          <Ic name="chevron" class="w-4 h-4 text-muted shrink-0 transition group-open:rotate-180" />
        </summary>
        <div class="px-4 pb-4">
          <button @click="contacterSupport"
            class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5"
            :style="{ color: 'var(--c-accent)', background: 'var(--c-soft)' }">
            <Ic name="user" class="w-4 h-4" /> {{ t("Contacter le support") }}
          </button>
        </div>
      </details>

      <div v-if="appInstallee" class="border-t border-hairline px-4 pt-3 pb-4">
        <InstallCard />
      </div>
    </div>

    <button @click="toggleTheme"
      class="w-full rounded-2xl p-4 mb-3 bg-surface border border-hairline flex items-center justify-between">
      <span class="flex items-center gap-2.5 text-sm"><Ic name="moon" class="w-4 h-4 text-muted" /> {{ t("Mode sombre") }}</span>
      <span class="relative rounded-full w-11 h-6 transition" :style="{ background: store.dark ? '#7A2E3E' : 'var(--c-hairline)' }">
        <span class="absolute top-0.5 rounded-full w-5 h-5 bg-white transition-all"
          :style="{ left: store.dark ? '22px' : '2px' }" />
      </span>
    </button>

    <button @click="setLang(i18n.lang === 'fr' ? 'en' : 'fr')"
      class="w-full rounded-2xl p-4 mb-3 bg-surface border border-hairline flex items-center justify-between">
      <span class="flex items-center gap-2.5 text-sm"><Ic name="globe" class="w-4 h-4 text-muted" /> {{ t("Langue") }}</span>
      <span class="flex gap-1">
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold transition"
          :class="i18n.lang === 'fr' ? 'bg-accent text-white' : 'text-muted'">FR</span>
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold transition"
          :class="i18n.lang === 'en' ? 'bg-accent text-white' : 'text-muted'">EN</span>
      </span>
    </button>

    <button @click="store.setInspirOn(!store.inspirOn)"
      class="w-full rounded-2xl p-4 mb-3 bg-surface border border-hairline flex items-center justify-between">
      <span class="flex items-center gap-2.5 text-sm">
        <Ic name="sparkle" class="w-4 h-4 text-muted" />
        <span class="min-w-0">
          <span class="block">{{ t("Idées de sorties") }}</span>
          <span class="block text-[10px] text-muted leading-tight">{{ t("le bandeau d'inspiration sur l'accueil") }}</span>
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
      {{ t("Tes données t'appartiennent — export disponible à tout moment.") }}<br />
      Le Carnet · V{{ pkg.version }}
    </p>

    
    <div v-if="demoPopin" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" :style="{ background: 'rgba(0,0,0,.35)' }"
      @click.self="demoPopin = false">
      <div class="w-full rounded-t-2xl sm:rounded-2xl bg-surface p-5 pb-7 sm:shadow-2xl" style="max-width: 480px; margin: 0 auto;">
        <p class="text-sm font-semibold mb-1">{{ t("Espace privé de démo") }}</p>
        <p class="text-[11px] text-muted mb-3">{{ t("Super-admin : entre ton pass pour créer « Mes adresses » avec des fiches de démonstration.") }}</p>
        <input v-model="demoPass" type="password" inputmode="numeric" :placeholder="t('Pass super-admin')"
          class="w-full rounded-xl px-3 py-2.5 text-sm mb-3 bg-soft"
          style="border: 1px solid var(--c-hairline)" />
        <div class="flex gap-2">
          <button class="flex-1 rounded-xl py-2.5 text-sm font-semibold text-muted"
            :style="{ border: '1px solid var(--c-hairline)' }" @click="demoPopin = false">{{ t("Annuler") }}</button>
          <button class="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-accent text-white disabled:opacity-40"
            :disabled="!demoPass" @click="demoValider">{{ t("Valider") }}</button>
        </div>
      </div>
    </div>

    
    <div class="mt-4 pt-4 border-t border-hairline">
      <button @click="supprCompte = true"
        class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 text-accent bg-soft">
        <Ic name="trash" class="w-4 h-4" /> {{ t("Supprimer mon compte") }}
      </button>
    </div>

    
    <div v-if="supprCompte" class="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
      style="background: rgba(20, 14, 12, .55)" @click.self="supprCompte = false">
      <div class="w-full max-w-sm rounded-2xl p-5 bg-bg border border-hairline">
        <p class="text-base font-serif mb-2">{{ t("Supprimer mon compte ?") }}</p>
        <p class="text-xs leading-relaxed text-muted mb-3">
          {{ t("Cet appareil quitte tous ses carnets. C'est définitif : pour revenir, il faudra refaire une           demande d'invitation — et tout ce qui aura été supprimé sera perdu.") }}
        </p>
        <p class="text-xs leading-relaxed text-muted mb-4">
          {{ t("Pour désinstaller l'app : iPhone — maintiens l'icône Le Carnet, puis « Retirer l'app » ·           Android — appui long sur l'icône, puis « Désinstaller ».") }}
        </p>
        <p class="text-[10px] uppercase tracking-widest text-muted mb-2">{{ t("Mes contributions") }}</p>
        <button @click="supprPurge = true" class="w-full rounded-xl p-3 mb-2 text-left"
          :style="{ background: supprPurge ? 'var(--c-soft)' : 'transparent', border: '1px solid ' + (supprPurge ? 'var(--c-accent)' : 'var(--c-hairline)') }">
          <span class="block text-sm font-semibold">{{ t("Tout supprimer") }}</span>
          <span class="block text-[10px] text-muted">{{ t("mes notes, likes, commentaires et flashes disparaissent des carnets") }}</span>
        </button>
        <button @click="supprPurge = false" class="w-full rounded-xl p-3 mb-4 text-left"
          :style="{ background: !supprPurge ? 'var(--c-soft)' : 'transparent', border: '1px solid ' + (!supprPurge ? 'var(--c-accent)' : 'var(--c-hairline)') }">
          <span class="block text-sm font-semibold">{{ t("Les garder dans les carnets") }}</span>
          <span class="block text-[10px] text-muted">{{ t("elles restent visibles, signées de mon prénom") }}</span>
        </button>
        <div class="flex gap-2">
          <button @click="supprCompte = false" class="flex-1 rounded-xl py-3 text-sm font-semibold bg-surface border border-hairline">{{ t("Annuler") }}</button>
          <button @click="confirmerSupprCompte" class="flex-1 rounded-xl py-3 text-sm font-semibold text-white"
            style="background: #7A2E3E">{{ t("Supprimer") }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
