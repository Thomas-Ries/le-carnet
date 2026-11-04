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
const codeInvite = ref(genCode());
const codeAdmin = ref("");
const codeAdmin2 = ref("");
const err = ref("");
const recap = ref(null); // { nom, code } affiché une fois après création

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const lien = computed(() => {
  if (!store.carnet) return "";
  const base = location.origin + location.pathname;
  return base + "#/join/" + store.carnet.code;
});

async function creer() {
  if (!nom.value.trim() || codeAdmin.value.length !== 6) return;
  if (codeAdmin.value !== codeAdmin2.value) { err.value = "Les deux codes admin ne sont pas identiques."; return; }
  const c = await store.creerCarnet(nom.value.trim(), codeInvite.value, codeAdmin.value);
  if (c) {
    modeCreer.value = false;
    recap.value = { nom: c.nom, code: c.code };
    nom.value = ""; codeAdmin.value = ""; codeAdmin2.value = ""; codeInvite.value = genCode();
    err.value = "";
  } else err.value = "Ce code existe déjà, choisis-en un autre.";
}
function copier() {
  navigator.clipboard?.writeText(lien.value);
  toast("Lien copié — envoie-le à qui tu veux");
}

/* Retrait de membre (réservé admin, vérifié aussi côté serveur) */
const pendingRetrait = ref(null);
function retirer(m) { pendingRetrait.value = m; }
async function confirmerRetrait() {
  const m = pendingRetrait.value;
  pendingRetrait.value = null;
  const ok = await store.retirerMembre(store.carnetId, m);
  if (ok) toast(m + " retiré du carnet");
  else toast("Action réservée à l'admin");
}

/* Pouvoirs admin */
const showAdmin = computed(() => store.carnet && store.isAdminCarnet(store.carnetId));
const nouveauCodeAdmin = ref("");
const nouveauCodeAdmin2 = ref("");
const errAdmin = ref("");
const popinRegen = ref(false);

async function regenererInvitation() {
  const code = await store.regenererCodeInvitation(store.carnetId);
  popinRegen.value = false;
  if (code) {
    recap.value = { nom: store.carnet.nom, code };
    toast("Nouveau lien d'invitation généré");
  } else toast("Action réservée à l'admin");
}
async function changerCodeAdmin() {
  if (nouveauCodeAdmin.value.length !== 6) return;
  if (nouveauCodeAdmin.value !== nouveauCodeAdmin2.value) { errAdmin.value = "Les deux codes ne sont pas identiques."; return; }
  const ok = await store.changerCodeAdmin(store.carnetId, nouveauCodeAdmin.value);
  if (ok) {
    nouveauCodeAdmin.value = ""; nouveauCodeAdmin2.value = ""; errAdmin.value = "";
    toast("Code admin changé — note-le");
  } else errAdmin.value = "Action réservée à l'admin.";
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
        <Ic v-if="store.isAdminCarnet(c.id)" name="lock" class="w-3.5 h-3.5 text-gold" />
        <Ic v-else-if="c.id === store.carnetId" name="check" class="w-4 h-4 text-accent" />
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

      <label for="lc-invite" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Code d'invitation</label>
      <div class="flex gap-2 mb-1">
        <input id="lc-invite" v-model="codeInvite" inputmode="numeric" pattern="[0-9]*" maxlength="6"
          @input="codeInvite = codeInvite.replace(/\D/g, '').slice(0, 6)"
          class="flex-1 rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none tracking-[.3em]" />
        <button @click="codeInvite = String(Math.floor(100000 + Math.random() * 900000)); toast('Nouveau code généré')"
          class="rounded-xl px-3 text-xs font-semibold border border-hairline">Regénérer</button>
      </div>
      <p class="text-[11px] text-muted mb-3">À donner aux gens que tu invites. Tu peux le régénérer plus tard.</p>

      <label for="lc-codea" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Ton code admin</label>
      <input id="lc-codea" v-model="codeAdmin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code"
        placeholder="123456"
        @input="codeAdmin = codeAdmin.replace(/\D/g, '').slice(0, 6)"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-1 tracking-[.3em]" />
      <p class="text-[11px] text-muted mb-2">Personnel : il te donne les droits admin sur un autre appareil.</p>
      <input v-model="codeAdmin2" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Confirme ton code"
        @input="codeAdmin2 = codeAdmin2.replace(/\D/g, '').slice(0, 6)"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-1 tracking-[.3em]" />
      <p class="text-[11px] text-muted mb-3">Note-le précieusement : il n'est affiché qu'une fois et stocké chiffré côté serveur.</p>

      <p v-if="err" class="text-xs text-accent mb-2">{{ err }}</p>
      <div class="grid grid-cols-2 gap-2">
        <button @click="modeCreer = false" class="rounded-xl py-2.5 text-sm font-semibold border border-hairline">Annuler</button>
        <button @click="creer" :disabled="!nom.trim() || codeAdmin.length !== 6 || codeAdmin !== codeAdmin2"
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
          <button v-if="showAdmin && m !== store.carnet.admin" @click="retirer(m)"
            class="text-muted p-1"><Ic name="x" class="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <!-- Invitation -->
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Inviter</p>
      <div class="rounded-2xl p-4 bg-surface border border-hairline mb-3">
        <p class="text-[11px] text-muted mb-2.5 leading-relaxed">Partage ce lien — ou le code <span class="font-semibold text-accent tracking-widest">{{ store.carnet.code }}</span> à la main. Toute personne invitée peut aussi créer son propre carnet.</p>
        <button @click="copier" class="w-full rounded-xl py-3 text-sm font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
          <Ic name="share" class="w-4 h-4" /> Copier le lien d'invitation
        </button>
      </div>

      <!-- Pouvoirs admin -->
      <div v-if="showAdmin" class="rounded-2xl p-4 bg-surface border border-hairline mb-4">
        <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Admin — tes pouvoirs</p>
        <button @click="popinRegen = true"
          class="w-full rounded-xl py-3 text-sm font-semibold mb-3 flex items-center justify-center gap-1.5"
          :style="{ color: 'var(--c-accent)', background: 'var(--c-soft)' }">
          <Ic name="qr" class="w-4 h-4" /> Régénérer le lien d'invitation
        </button>
        <label class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Changer mon code admin</label>
        <input v-model="nouveauCodeAdmin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Nouveau code"
          @input="nouveauCodeAdmin = nouveauCodeAdmin.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-2 tracking-[.3em]" />
        <input v-model="nouveauCodeAdmin2" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Confirme le nouveau code"
          @input="nouveauCodeAdmin2 = nouveauCodeAdmin2.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-2 tracking-[.3em]" />
        <p v-if="errAdmin" class="text-xs text-accent mb-2">{{ errAdmin }}</p>
        <button @click="changerCodeAdmin" :disabled="nouveauCodeAdmin.length !== 6 || nouveauCodeAdmin !== nouveauCodeAdmin2"
          class="w-full rounded-xl py-3 text-sm font-semibold text-white bg-accent disabled:opacity-40">
          Changer le code admin
        </button>
      </div>

      <button @click="exporterJSON"
        class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 mb-4"
        :style="{ color: 'var(--c-green)', background: 'color-mix(in srgb, var(--c-green) 12%, transparent)' }">
        <Ic name="share" class="w-4 h-4" /> Exporter « {{ store.carnet.nom }} » en JSON
      </button>

      <p class="text-[11px] text-muted text-center leading-relaxed">
        Code admin oublié ? Depuis cet appareil admin, tu peux le changer.<br />
        Tes données t'appartiennent : export à tout moment, aussi depuis le profil.
      </p>

      <ConfirmModal :open="!!pendingRetrait"
        :title="'Retirer ' + (pendingRetrait || '') + ' ?'"
        text="Il ne verra plus ce carnet. Il garde ses autres carnets."
        confirmLabel="Retirer"
        @confirm="confirmerRetrait" @cancel="pendingRetrait = null" />

      <!-- Popin régénération lien -->
      <ConfirmModal :open="popinRegen"
        title="Régénérer le lien d'invitation ?"
        text="L'ancien code et l'ancien lien ne fonctionneront plus. Les membres actuels restent membres."
        confirmLabel="Régénérer"
        @confirm="regenererInvitation" @cancel="popinRegen = false" />
    </template>

    <!-- Popin codes (affichés une seule fois) -->
    <div v-if="recap" class="fixed inset-0 z-[80] flex items-end justify-center"
      style="background: rgba(43,35,32,.45)" @click.self="recap = null">
      <div class="w-full max-w-[430px] rounded-t-2xl bg-surface p-5 pb-7">
        <p class="font-serif text-lg mb-1">« {{ recap.nom }} » est prêt</p>
        <p class="text-xs text-muted mb-3 leading-relaxed">Note ces codes — le code admin ne sera plus jamais affiché.</p>
        <div class="rounded-xl p-3.5 mb-3" style="background: var(--c-soft)">
          <p class="text-[10px] uppercase tracking-widest text-muted mb-1">Code d'invitation (à partager)</p>
          <p class="text-2xl tracking-[.3em] font-semibold text-accent">{{ recap.code }}</p>
        </div>
        <button @click="recap = null" class="w-full rounded-xl py-3 text-sm font-semibold text-white bg-accent">
          Je les ai notés
        </button>
      </div>
    </div>
  </div>
</template>
