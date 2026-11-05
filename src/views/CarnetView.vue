<script setup>
import { ref, computed, inject } from "vue";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { exporterFichierJSON, texteInvitation, partagerWhatsapp, partagerSms } from "../lib/util.js";

const store = useCarnetStore();
const toast = inject("toast");
const modeCreer = ref(false);
const nom = ref("");
const codeInvite = ref("");
// Normalise un mot-clé : minuscules, sans accents, espaces -> tirets, max 15
const normMot = (v) =>
  (v || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 15);
const codeAdmin = ref("");
const codeAdmin2 = ref("");
const showAdmin = ref(false);
const showAdmin2 = ref(false);
const err = ref("");

/* Rejoindre un carnet : par mot-clé (invitation d'un admin) — aussi la porte de
   secours pour retrouver un carnet quand on change d'appareil. */
const modeRejoindre = ref(false);
const codeRejoindre = ref("");
const codeRecupJoin = ref("");
const codeAdminReprise = ref("");
const errRejoindre = ref("");
const prisDans = ref(false); // prenom_pris : le bloc reprise apparaît
const errReprise = ref("");
async function rejoindre() {
  const code = normMot(codeRejoindre.value);
  const cr = codeRecupJoin.value.replace(/\D/g, "");
  if (code.length < 4 || ![4, 6].includes(cr.length)) return;
  errRejoindre.value = "";
  prisDans.value = false;
  const r = await store.rejoindre(code, cr);
  if (r && r.error) {
    if (r.error === "prenom_pris") {
      prisDans.value = true;
      errRejoindre.value = "« " + store.profil.prenom + " » est déjà pris dans ce carnet — entre ton code personnel ci-dessus, ou ton code admin ci-dessous si tu l'administres.";
      return;
    }
    if (r.error === "code_refuse") { errRejoindre.value = "Code personnel refusé — vérifie les chiffres."; return; }
    if (r.error === "code_different") { errRejoindre.value = "Ce n'est pas ton code personnel — utilise le même que dans tes autres carnets."; return; }
    errRejoindre.value = r.error === "carnet introuvable" ? "Carnet introuvable — vérifie le mot-clé."
      : "Impossible de rejoindre : " + r.error;
    return;
  }
  modeRejoindre.value = false;
  codeRejoindre.value = "";
  codeRecupJoin.value = "";
  toast("Bienvenue dans « " + (store.carnet?.nom || "ton carnet") + " »");
}
// Reprise admin (nouvel appareil) : le mot-clé d'invitation + le code admin recréent la session.
async function reprendreAdmin() {
  if (![4, 6].includes(codeAdminReprise.value.length)) return;
  errReprise.value = "";
  const r = await store.recupererAdmin(normMot(codeRejoindre.value), codeAdminReprise.value, store.profil.prenom);
  if (r && r.ok) {
    modeRejoindre.value = false;
    codeRejoindre.value = "";
    codeAdminReprise.value = "";
    errRejoindre.value = "";
    prisDans.value = false;
    toast("Carnet repris — tu es de retour");
  } else {
    errReprise.value = (r && r.error) || "Code admin refusé — vérifie les 4 ou 6 chiffres.";
  }
}

const lien = computed(() => {
  if (!store.carnet) return "";
  return location.origin + "/join/" + store.carnet.code;
});

async function creer() {
  if (!nom.value.trim() || ![4, 6].includes(codeAdmin.value.length)) return;
  if (!store.profil.prenom) {
    err.value = "Ton prénom est manquant — renseigne-le dans Profil, puis reviens créer ton carnet.";
    return;
  }
  if (codeAdmin.value !== codeAdmin2.value) {
    err.value = "Le code admin doit être saisi deux fois à l'identique.";
    return;
  }
  if (codeInvite.value.trim() && !normMot(codeInvite.value)) {
    err.value = "Le mot-clé d'invitation doit faire 4 à 15 caractères (lettres sans accents, chiffres, tirets).";
    return;
  }
  const r = await store.creerCarnet(
    nom.value.trim(),
    codeInvite.value.trim() ? normMot(codeInvite.value) : null,
    codeAdmin.value
  );
  if (r && r.id) {
    modeCreer.value = false; nom.value = ""; codeInvite.value = ""; codeAdmin.value = ""; codeAdmin2.value = "";
    toast("Carnet créé — tu es admin");
  } else {
    // Le serveur a refusé (ou code dupliqué) : message réel, rien n'est créé en local
    if (r && r.error === "code_different") {
      err.value = "Ce n'est pas ton code personnel — utilise le même que dans tes autres carnets.";
      return;
    }
    err.value = (r && r.error) || "Ce code existe déjà, choisis-en un autre.";
  }
}
function copier() {
  navigator.clipboard?.writeText(lien.value);
  toast("Lien copié — envoie-le à qui tu veux");
}
const texteInvit = computed(() =>
  store.carnet ? texteInvitation(store.profil.prenom, store.carnet, lien.value) : ""
);
const whatsapp = () => partagerWhatsapp(texteInvit.value);
const sms = () => partagerSms(texteInvit.value);
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
          <span class="block text-[11px] text-muted">{{ c.membres.length }} membre(s) · code : {{ c.code }}</span>
        </span>
        <Ic v-if="c.id === store.carnetId" name="check" class="w-4 h-4 text-accent" />
      </button>
      <button @click="modeCreer = !modeCreer; modeRejoindre = false"
        class="w-full rounded-2xl py-3.5 text-sm font-semibold text-accent flex items-center justify-center gap-1.5"
        style="border: 1.5px dashed var(--c-hairline)">
        <Ic name="plus" class="w-4 h-4" /> Créer un carnet
      </button>
      <button @click="modeRejoindre = !modeRejoindre; modeCreer = false"
        class="w-full rounded-2xl py-3.5 text-sm font-semibold text-accent flex items-center justify-center gap-1.5"
        style="border: 1.5px dashed var(--c-hairline)">
        <Ic name="users" class="w-4 h-4" /> Rejoindre un carnet
      </button>
    </div>

    <!-- Rejoindre par mot-clé -->
    <div v-if="modeRejoindre" class="rounded-2xl p-4 mb-6 bg-surface border border-hairline">
      <p class="text-sm font-semibold mb-1">Rejoindre un carnet</p>
      <p class="text-[11px] text-muted mb-3 leading-relaxed">
        Entre le mot-clé que l'admin t'a donné. C'est aussi la porte de secours d'un nouvel
        appareil : même carnet, même prénom, tu retrouves tout.
      </p>
      <label for="lc-rejoindre" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Mot-clé d'invitation</label>
      <input id="lc-rejoindre" v-model="codeRejoindre" type="text" autocapitalize="none" autocomplete="off" maxlength="15"
        placeholder="ex. les-copains" @input="codeRejoindre = codeRejoindre.slice(0, 15)"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-3 tracking-[.3em]" />
      <label for="lc-recup" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Ton code personnel — 4 ou 6 chiffres</label>
      <input id="lc-recup" v-model="codeRecupJoin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
        placeholder="●●●●●●"
        @input="codeRecupJoin = codeRecupJoin.replace(/\D/g, '').slice(0, 6)"
        class="w-full rounded-xl px-3 py-3 text-sm text-center tracking-[.3em] bg-bg border border-hairline outline-none mb-1" />
      <p class="text-[11px] mb-3 leading-relaxed">
        <span class="font-semibold">Mémorise bien ce code : il te servira à créer tes propres carnets et à retrouver
        tes carnets si tu changes de téléphone.</span>
        <span class="text-muted"> Obligatoire pour un nouveau prénom — et si tu reprends le tien sur un nouvel appareil, c'est lui qui le prouve.</span>
      </p>
      <p v-if="errRejoindre" class="text-xs text-accent mb-2 leading-relaxed">{{ errRejoindre }}</p>
      <!-- Prénom déjà pris : c'est peut-être toi sur un nouvel appareil → code admin -->
      <div v-if="prisDans" class="rounded-xl p-3 bg-soft mb-2">
        <p class="text-[11px] text-muted leading-relaxed mb-2">
          C'est toi, sur un nouvel appareil ? Entre ton code admin — celui choisi à la création du carnet — pour reprendre ta place.
        </p>
        <input v-model="codeAdminReprise" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
          placeholder="Code admin"
          @input="codeAdminReprise = codeAdminReprise.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-3 py-3 mb-2 text-sm text-center tracking-[.3em] bg-surface border border-hairline outline-none" />
        <p v-if="errReprise" class="text-xs text-accent mb-2">{{ errReprise }}</p>
        <button @click="reprendreAdmin" :disabled="![4, 6].includes(codeAdminReprise.length)"
          class="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-accent disabled:opacity-40">
          Reprendre ma place
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button @click="modeRejoindre = false" class="rounded-xl py-2.5 text-sm font-semibold border border-hairline">Annuler</button>
        <button @click="rejoindre" :disabled="normMot(codeRejoindre).length < 4 || ![4, 6].includes(codeRecupJoin.replace(/\D/g, '').length)"
          class="rounded-xl py-2.5 text-sm font-semibold text-white bg-accent disabled:opacity-40">Rejoindre</button>
      </div>
    </div>

    <!-- Création -->
    <div v-if="modeCreer" class="rounded-2xl p-4 mb-6 bg-surface border border-hairline">
      <p class="text-sm font-semibold mb-1">Nouveau carnet</p>
      <p class="text-[11px] text-muted mb-3">Invité ? Tu peux créer le tien aussi — c'est comme ça que ça grandit.</p>

      <label for="lc-nom" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Nom du carnet</label>
      <input id="lc-nom" v-model="nom" placeholder="Famille, Les copains, Boulot…" maxlength="24"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-1" />
      <p class="text-[11px] text-muted mb-3">Visible seulement par les membres que tu invites.</p>

      <label for="lc-code" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Mot-clé d'invitation — 4 à 15 caractères</label>
      <input id="lc-code" v-model="codeInvite" type="text" autocapitalize="none" autocomplete="off" maxlength="15"
        placeholder="ex. famille-A ou spice-girls (auto si vide)"
        @input="codeInvite = codeInvite.slice(0, 15)"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-1 tracking-[.3em]" />
      <p class="text-[11px] text-muted mb-3">À donner aux personnes que tu invites — plus facile à retenir qu'un numéro. Généré automatiquement si tu laisses vide.</p>

      <label for="lc-code-admin" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Ton code personnel — 4 ou 6 chiffres</label>
      <div class="relative mb-1">
        <input id="lc-code-admin" v-model="codeAdmin" :type="showAdmin ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
          placeholder="4 chiffres ou 6, à toi de choisir"
          @input="codeAdmin = codeAdmin.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-3 py-3 pr-11 text-sm bg-bg border border-hairline outline-none tracking-[.3em]" />
        <button type="button" @click="showAdmin = !showAdmin" aria-label="Afficher le code"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <Ic :name="showAdmin ? 'eyeSlash' : 'eye'" class="w-5 h-5" />
        </button>
      </div>
      <div class="relative mb-1">
        <input v-model="codeAdmin2" :type="showAdmin2 ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
          placeholder="Encore une fois pour vérifier"
          @input="codeAdmin2 = codeAdmin2.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-3 py-3 pr-11 text-sm bg-bg border border-hairline outline-none tracking-[.3em]" />
        <button type="button" @click="showAdmin2 = !showAdmin2" aria-label="Afficher le code"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <Ic :name="showAdmin2 ? 'eyeSlash' : 'eye'" class="w-5 h-5" />
        </button>
      </div>
      <p class="text-[11px] mb-3 leading-relaxed">
        <span class="font-semibold">Mémorise bien ce code : il te servira à créer tes propres carnets et à retrouver
        tes carnets si tu changes de téléphone.</span>
        <span class="text-muted"> Il devient le code admin de ce carnet. Ne le donne à personne.</span>
      </p>

      <p v-if="err" class="text-xs text-accent mb-2">{{ err }}</p>
      <div class="grid grid-cols-2 gap-2">
        <button @click="modeCreer = false" class="rounded-xl py-2.5 text-sm font-semibold border border-hairline">Annuler</button>
        <button @click="creer" :disabled="!nom.trim() || ![4, 6].includes(codeAdmin.length) || codeAdmin.length !== codeAdmin2.length"
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
        <div class="grid grid-cols-3 gap-2">
          <button @click="whatsapp" class="rounded-xl py-3 text-[13px] font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
            <Ic name="chat" class="w-4 h-4" /> WhatsApp
          </button>
          <button @click="sms" class="rounded-xl py-3 text-[13px] font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
            <Ic name="sms" class="w-4 h-4" /> SMS
          </button>
          <button @click="copier" class="rounded-xl py-3 text-[13px] font-semibold text-accent border border-hairline flex items-center justify-center gap-1.5">
            <Ic name="share" class="w-4 h-4" /> Copier
          </button>
        </div>
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