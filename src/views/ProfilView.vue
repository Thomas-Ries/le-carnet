<script setup>
import { ref, computed, inject, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import InstallCard from "../components/InstallCard.vue";
import Avatar from "../components/Avatar.vue";
import { exporterFichierJSON } from "../lib/util.js";
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
const prenom = ref(store.profil.prenom);

const exportCarnetId = ref(store.carnetId);

const dupErr = ref("");
function savePrenom() {
  const nv = prenom.value.trim();
  if (!nv) return;
  // Pas de doublon avec un autre membre d'un de mes carnets (insensible à la casse)
  const conflit = store.carnets.some((c) =>
    (c.membres || []).some(
      (m) => m.toLowerCase() === nv.toLowerCase() && m !== store.profil.prenom
    )
  );
  if (conflit) {
    dupErr.value = "« " + nv + " » est déjà pris dans un de tes carnets — ajoute une initiale, ex. " + nv + " M.";
    return;
  }
  dupErr.value = "";
  store.setPrenom(nv);
  toast("Prénom enregistré");
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
        <button v-if="prenom.trim() && prenom !== store.profil.prenom" @click="savePrenom"
          class="mt-2 text-xs font-semibold text-accent">Enregistrer</button>
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
          <Ic name="shareUp" class="w-4 h-4 shrink-0" style="color: var(--c-green)" />
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
            <Ic name="shareUp" class="w-4 h-4" /> Exporter en JSON
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


    <p class="text-[11px] text-muted text-center leading-relaxed">
      Tes données t'appartiennent — export disponible à tout moment.<br />
      Le Carnet · V{{ pkg.version }}
    </p>

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