<script setup>
import { ref, computed, inject } from "vue";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { exporterFichierJSON } from "../lib/util.js";

const store = useCarnetStore();
const toast = inject("toast");
const modeCreer = ref(false);
const nom = ref("");
const codeInvite = ref("");
const codeAdmin = ref("");
const codeAdmin2 = ref("");
const err = ref("");

const lien = computed(() => {
  if (!store.carnet) return "";
  const base = location.origin + location.pathname;
  return base + "#/join/" + store.carnet.code;
});

async function creer() {
  if (!nom.value.trim() || codeAdmin.value.length !== 6) return;
  if (codeAdmin.value !== codeAdmin2.value) {
    err.value = "Le code admin doit être saisi deux fois à l'identique.";
    return;
  }
  const r = await store.creerCarnet(
    nom.value.trim(),
    codeInvite.value.length === 6 ? codeInvite.value : null,
    codeAdmin.value
  );
  if (r && r.id) {
    modeCreer.value = false; nom.value = ""; codeInvite.value = ""; codeAdmin.value = ""; codeAdmin2.value = "";
    toast("Carnet créé — tu es admin");
  } else {
    // Le serveur a refusé (ou code dupliqué) : message réel, rien n'est créé en local
    err.value = (r && r.error) || "Ce code existe déjà, choisis-en un autre.";
  }
}
function copier() {
  navigator.clipboard?.writeText(lien.value);
  toast("Lien copié — envoie-le à qui tu veux");
}
const pendingRetrait = ref(null);
const popinQuitter = ref(false);

async function quitter() {
  popinQuitter.value = false;
  const r = await store.quitterCarnet(store.carnetId);
  if (r && r.error) { toast(r.error); return; }
  toast("Tu as quitté ce carnet");
}

function retirer(m) { pendingRetrait.value = m; }
async function confirmerRetrait() {
  const m = pendingRetrait.value;
  pendingRetrait.value = null;
  if (await store.retirerMembre(store.carnetId, m)) toast(m + " retiré du carnet");
}
async function exporterJSON() {
  const c = store.carnet;
  if (!c) return;
  const nomFichier = "le-carnet-" + c.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json";
  const r = await exporterFichierJSON(nomFichier, {
    exporte_le: new Date().toISOString(),
    carnet: { nom: c.nom, code: c.code, admin: c.admin, membres: c.membres },
    fiches: store.fichesDuCarnet,
  });
  if (r === "annule") return;
  toast(r === "partage" ? "Export prêt à partager" : "Export JSON téléchargé");
}
</script>

<template>
  <div>
    <h1 class="text-lg font-serif mb-1">Mes carnets</h1>
    <p class="text-xs text-muted mb-4">Un par cercle : famille, copains, boulot…</p>

    <div class="space-y-2 mb-6">
      <button v-for="c in store.carnets" :key="c.id"
        @click="store.switchCarnet(c.id)"
        class="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
        :style="{
          background: c.id === store.carnetId ? 'var(--c-soft)' : 'var(--c-surface)',
          border: '1px solid ' + (c.id === store.carnetId ? 'var(--c-accent)' : 'var(--c-hairline)'),
        }">
        <span class="rounded-full w-10 h-10 flex items-center justify-center font-serif text-accent"
          :style="{ background: c.id === store.carnetId ? 'var(--c-surface)' : 'var(--c-soft)' }">{{ c.nom[0] }}</span>
        <span class="flex-1">
          <span class="block text-sm font-semibold">{{ c.nom }}</span>
          <span class="block text-[11px] text-muted">{{ c.membres.length }} membre(s) · code {{ c.code }}</span>
        </span>
        <Ic v-if="c.id === store.carnetId" name="check" class="w-4 h-4 text-accent" />
      </button>
      <button @click="modeCreer = !modeCreer"
        class="w-full rounded-2xl py-3.5 text-sm font-semibold text-accent flex items-center justify-center gap-1.5"
        style="border: 1.5px dashed var(--c-hairline)">
        <Ic name="plus" class="w-4 h-4" /> Créer un carnet
      </button>
    </div>

    <!-- Création -->
    <div v-if="modeCreer" class="rounded-2xl p-4 mb-6 bg-surface border border-hairline">
      <p class="text-sm font-semibold mb-1">Nouveau carnet</p>
      <p class="text-[11px] text-muted mb-3">Invité ? Tu peux créer le tien aussi — c'est comme ça que ça grandit.</p>

      <label for="lc-nom" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Nom du carnet</label>
      <input id="lc-nom" v-model="nom" placeholder="Famille, Les copains, Boulot…" maxlength="24"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-1" />
      <p class="text-[11px] text-muted mb-3">Visible seulement par les membres que tu invites.</p>

      <label for="lc-code" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Code d'invitation — 6 chiffres</label>
      <input id="lc-code" v-model="codeInvite" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
        placeholder="123456 (auto si vide)"
        @input="codeInvite = codeInvite.replace(/\D/g, '').slice(0, 6)"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-1 tracking-[.3em]" />
      <p class="text-[11px] text-muted mb-3">À donner aux personnes que tu invites. Généré automatiquement si tu laisses vide.</p>

      <label for="lc-code-admin" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Ton code admin — 6 chiffres</label>
      <input id="lc-code-admin" v-model="codeAdmin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
        placeholder="654321"
        @input="codeAdmin = codeAdmin.replace(/\D/g, '').slice(0, 6)"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-1 tracking-[.3em]" />
      <input v-model="codeAdmin2" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
        placeholder="Encore une fois pour vérifier"
        @input="codeAdmin2 = codeAdmin2.replace(/\D/g, '').slice(0, 6)"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none tracking-[.3em]" />
      <p class="text-[11px] text-muted mb-3">Il prouve que c'est toi sur un autre appareil. Ne le donne à personne — garde-le précieusement.</p>

      <p v-if="err" class="text-xs text-accent mb-2">{{ err }}</p>
      <div class="grid grid-cols-2 gap-2">
        <button @click="modeCreer = false" class="rounded-xl py-2.5 text-sm font-semibold border border-hairline">Annuler</button>
        <button @click="creer" :disabled="!nom.trim() || codeAdmin.length !== 6 || codeAdmin2.length !== 6"
          class="rounded-xl py-2.5 text-sm font-semibold text-white bg-accent disabled:opacity-40">Créer</button>
      </div>
    </div>

    <!-- Carnet courant -->
    <template v-if="store.carnet">
      <h2 class="text-lg font-serif mb-1">« {{ store.carnet.nom }} »</h2>
      <p class="text-xs text-muted mb-3">{{ store.fichesDuCarnet.length }} adresse(s) aimée(s)</p>

      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Membres</p>
      <div class="space-y-1.5 mb-5">
        <div v-for="m in store.carnet.membres" :key="m" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-surface border border-hairline">
          <Avatar :prenom="m" :size="28" />
          <span class="flex-1 text-sm">{{ m }}<span v-if="m === store.profil.prenom" class="text-muted text-xs"> (toi)</span></span>
          <Ic v-if="m === store.carnet.admin" name="lock" class="w-3.5 h-3.5 text-gold" />
          <button v-if="m !== store.profil.prenom && m !== store.carnet.admin" @click="retirer(m)"
            class="text-muted p-1"><Ic name="x" class="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <!-- Invitation -->
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Inviter</p>
      <div class="rounded-2xl p-4 bg-surface border border-hairline mb-4">
        <p class="text-[11px] text-muted mb-2.5 leading-relaxed">Partage ce lien — ou le code <span class="font-semibold text-accent tracking-widest">{{ store.carnet.code }}</span> à la main. Toute personne invitée peut aussi créer son propre carnet.</p>
        <button @click="copier" class="w-full rounded-xl py-3 text-sm font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
          <Ic name="share" class="w-4 h-4" /> Copier le lien d'invitation
        </button>
      </div>

      <button v-if="!store.isAdminCarnet(store.carnetId)" @click="popinQuitter = true"
        class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 mb-3"
        :style="{ color: 'var(--c-accent)', border: '1px solid var(--c-hairline)' }">
        <Ic name="x" class="w-4 h-4" /> Quitter ce carnet
      </button>

      <button @click="exporterJSON"
        class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 mb-4"
        :style="{ color: 'var(--c-green)', background: 'color-mix(in srgb, var(--c-green) 12%, transparent)' }">
        <Ic name="share" class="w-4 h-4" /> Exporter « {{ store.carnet.nom }} » en JSON
      </button>

      <p class="text-[11px] text-muted text-center leading-relaxed">
        L'admin du carnet ajoute ou retire qui il veut.<br />
        Tes données t'appartiennent : export à tout moment, aussi depuis le profil.
      </p>

      <ConfirmModal :open="popinQuitter"
        :title="'Quitter « ' + (store.carnet?.nom || '') + ' » ?'"
        text="Tu ne recevras plus rien de ce carnet et toutes ses publications disparaissent de ton fil. Aucune récupération possible — pour revenir, il faudra une nouvelle invitation."
        confirmLabel="Quitter"
        @confirm="quitter" @cancel="popinQuitter = false" />

      <ConfirmModal :open="!!pendingRetrait"
        :title="'Retirer ' + (pendingRetrait || '') + ' ?'"
        text="Il ne verra plus ce carnet. Il garde ses autres carnets."
        confirmLabel="Retirer"
        @confirm="confirmerRetrait" @cancel="pendingRetrait = null" />
    </template>
  </div>
</template>
