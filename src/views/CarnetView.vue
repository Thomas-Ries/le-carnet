<script setup>
import { t } from "../lib/i18n.js";
import { ref, computed, inject, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { exporterFichierJSON, texteInvitation, partagerWhatsapp, partagerSms, lockScroll } from "../lib/util.js";

const store = useCarnetStore();
const router = useRouter();
const toast = inject("toast");
// V0.4.77 : l'espace privé Google Maps vit ici, toujours accessible.
const nbGmaps = computed(() => {
  const cp = store.mesAdresses;
  return cp ? store.fiches.filter((f) => (f.carnets || []).includes(cp.id)).length : 0;
});
// V0.4.82 : l'espace privé G-Maps n'est PAS un cercle — il ne figure pas dans
// la liste des carnets (sa carte dédiée au-dessus suffit), sinon il apparaît
// deux fois et prête à confusion.
const carnetsCercles = computed(() =>
  store.carnets.filter((c) => c.prive !== "1" && c.prive !== 1)
);
function ouvrirEspaceGmaps() {
  const cp = store.mesAdresses;
  if (!cp) return;
  store.switchCarnet(cp.id);
  router.push("/");
}
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
    if (r.error === "code_refuse") { errRejoindre.value = t("Code personnel refusé — vérifie les chiffres."); return; }
    if (r.error === "code_different") { errRejoindre.value = t("Ce n'est pas ton code personnel — utilise le même que dans tes autres carnets."); return; }
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
    toast(t("Carnet repris — tu es de retour"));
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
    err.value = t("Ton prénom est manquant — renseigne-le dans Profil, puis reviens créer ton carnet.");
    return;
  }
  if (codeAdmin.value !== codeAdmin2.value) {
    err.value = t("Le code admin doit être saisi deux fois à l'identique.");
    return;
  }
  if (codeInvite.value.trim() && !normMot(codeInvite.value)) {
    err.value = t("Le mot-clé d'invitation doit faire 4 à 15 caractères (lettres sans accents, chiffres, tirets).");
    return;
  }
  const r = await store.creerCarnet(
    nom.value.trim(),
    codeInvite.value.trim() ? normMot(codeInvite.value) : null,
    codeAdmin.value
  );
  if (r && r.id) {
    modeCreer.value = false; nom.value = ""; codeInvite.value = ""; codeAdmin.value = ""; codeAdmin2.value = "";
    toast(t("Carnet créé — tu es admin"));
    // V0.4.97 : proposer tout de suite de nourrir le carnet avec des notes
    // existantes — les invités ne tombent pas sur un carnet vide.
    // V0.4.102 : la popin s'ouvre TOUJOURS — même sur un appareil neuf ou purgé
    // (fiches vides), avec un état vide explicatif. Avant, la condition
    // autres.length la gardait fermée silencieusement et le créateur croyait
    // à un bug. Garde défensive (f.carnets || []) : une fiche sans liens ne
    // fait plus planter l'ouverture.
    const autres = store.fiches.filter((f) => !(f.carnets || []).includes(r.id));
    seedCarnet.value = r; seedPicks.value = new Set(); seedOuvert.value = true;
    void autres;
  } else {
    // Le serveur a refusé (ou code dupliqué) : message réel, rien n'est créé en local
    if (r && r.error === "code_different") {
      err.value = t("Ce n'est pas ton code personnel — utilise le même que dans tes autres carnets.");
      return;
    }
    err.value = (r && r.error) || "Ce code existe déjà, choisis-en un autre.";
  }
}
/* V0.4.97 : nourrir un carnet fraîchement créé — sélection de notes existantes
   (rattachement de liens fiche↔carnet, la fiche reste dans son carnet d'origine). */
const seedOuvert = ref(false);
const seedCarnet = ref(null);
const seedPicks = ref(new Set());
const seedPossibles = computed(() =>
  seedCarnet.value
    ? store.fiches.filter((f) => !(f.carnets || []).includes(seedCarnet.value.id)).slice(0, 100)
    : []);
function toggleSeed(id) {
  const s = new Set(seedPicks.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  seedPicks.value = s;
}
function seedFermer() { seedOuvert.value = false; seedCarnet.value = null; }
// V0.4.100 : la page derrière ne scrolle pas pendant la sélection.
watch(seedOuvert, (v) => lockScroll(!!v));
onUnmounted(() => lockScroll(false));
async function seedConfirmer() {
  const ids = [...seedPicks.value];
  const cible = seedCarnet.value;
  seedOuvert.value = false;
  if (!ids.length || !cible) return;
  const r = await store.copierFiches(ids, cible.id);
  if (r && r.error) { toast(r.error); return; }
  toast(t("Notes ajoutées au carnet"));
  seedCarnet.value = null;
}

/* V0.4.101 : gestion des carnets depuis la liste — renommer/supprimer (admin),
   quitter (membre). Confirmation obligatoire pour les actes définitifs. */
const renomme = ref(null);
const renommeNom = ref("");
const supprCarnet = ref(null);
const pendingQuitter = ref(null);
function ouvrirRenommer(c) { renomme.value = c; renommeNom.value = c.nom; }
async function validerRenommer() {
  const c = renomme.value; renomme.value = null;
  const nom = renommeNom.value.trim();
  if (!c || !nom || nom === c.nom) return;
  const r = await store.renommerCarnet(c.id, nom);
  if (r && r.error) { toast(r.error); return; }
  toast(t("Carnet renommé"));
}
async function confirmerSupprCarnet() {
  const c = supprCarnet.value; supprCarnet.value = null;
  if (!c) return;
  const r = await store.supprimerCarnet(c.id);
  if (r && r.error) { toast(r.error); return; }
  toast(t("Carnet supprimé"));
}
async function confirmerQuitterCarnet() {
  const c = pendingQuitter.value; pendingQuitter.value = null;
  if (!c) return;
  const r = await store.quitterCarnet(c.id);
  if (r && r.error) { toast(r.error); return; }
  toast(t("Tu as quitté ce carnet"));
}

function copier() {
  navigator.clipboard?.writeText(lien.value);
  toast(t("Lien copié — envoie-le à qui tu veux"));
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
  toast(t("Tu as quitté ce carnet"));
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
    <h1 class="text-lg font-serif mb-1">{{ t("Mes carnets") }}</h1>
    <p class="text-xs text-muted mb-2">{{ t("Un par cercle : famille, copains, boulot…") }}</p>
    
    <p class="text-[11px] text-muted leading-relaxed mb-4 rounded-xl px-3 py-2.5 bg-soft">
      {{ t("Tes carnets ne sont pas repris automatiquement d'un appareil à l'autre. Sur un nouvel écran :       rouvre l'app, entre ton") }} <span class="font-semibold text-accent">{{ t("prénom") }}</span> {{ t("puis       «") }} <span class="font-semibold text-accent">{{ t("J'ai déjà mes carnets sur un autre appareil") }}</span> {{ t("» —       ton") }} <span class="font-semibold text-accent">{{ t("code personnel") }}</span> {{ t("remet tout en place,       y compris ton espace G-Maps. Ou rejoins-les un par un avec un mot-clé ci-dessous.") }}
    </p>

    
    <button v-if="store.mesAdresses" @click="ouvrirEspaceGmaps"
      class="w-full rounded-2xl p-4 mb-3 flex items-center gap-3 text-left bg-soft"
      style="border: 1px solid var(--c-accent)">
      <span class="rounded-full w-10 h-10 flex items-center justify-center shrink-0"
        :style="{ background: 'var(--c-accent)' }"><Ic name="pin" class="w-4 h-4 text-white" /></span>
      <span class="flex-1">
        <span class="block text-sm font-semibold">{{ t("Mon G-Maps") }}</span>
        <span class="block text-[11px] text-muted">{{ nbGmaps }} adresse{{ nbGmaps > 1 ? "s" : "" }} importée{{ nbGmaps > 1 ? "s" : "" }} · visible de toi seul · appui long pour partager</span>
      </span>
      <span class="text-accent font-semibold">→</span>
    </button>

    <div class="space-y-2 mb-6">
      <div v-for="c in carnetsCercles" :key="c.id"
        class="w-full rounded-2xl p-4 flex items-center gap-3 text-left cursor-pointer transition"
        :style="{
          background: c.id === store.carnetId ? 'var(--c-soft)' : 'var(--c-surface)',
          border: '1px solid ' + (c.id === store.carnetId ? 'var(--c-accent)' : 'var(--c-hairline)'),
        }"
        @click="store.switchCarnet(c.id)">
        <span class="rounded-full w-10 h-10 flex items-center justify-center font-serif text-accent shrink-0"
          :style="{ background: c.id === store.carnetId ? 'var(--c-surface)' : 'var(--c-soft)' }">{{ c.nom[0] }}</span>
        <span class="flex-1 min-w-0">
          <span class="block text-sm font-semibold truncate">{{ c.nom }}</span>
          <span class="block text-[11px] text-muted">{{ c.membres.length }} {{ t("membre(s) · code :") }} {{ c.code }}</span>
        </span>
        <Ic v-if="c.id === store.carnetId" name="check" class="w-4 h-4 text-accent shrink-0" />
        <span class="flex items-center gap-1 shrink-0" @click.stop>
          <button v-if="store.roles[c.id] === 'admin'" @click="ouvrirRenommer(c)"
            class="rounded-full p-2 bg-surface border border-hairline" :title="t('Renommer le carnet')"
            :aria-label="t('Renommer le carnet')">
            <Ic name="pencil" class="w-3.5 h-3.5 text-muted" />
          </button>
          <button v-if="store.roles[c.id] === 'admin'" @click="supprCarnet = c"
            class="rounded-full p-2 bg-surface border border-hairline" :title="t('Supprimer le carnet')"
            :aria-label="t('Supprimer le carnet')">
            <Ic name="trash" class="w-3.5 h-3.5 text-muted" />
          </button>
          <button v-else @click="pendingQuitter = c"
            class="rounded-full p-2 bg-surface border border-hairline" :title="t('Quitter ce carnet')"
            :aria-label="t('Quitter ce carnet')">
            <Ic name="x" class="w-3.5 h-3.5 text-muted" />
          </button>
        </span>
      </div>
      <button @click="modeCreer = !modeCreer; modeRejoindre = false"
        class="w-full rounded-2xl py-3.5 text-sm font-semibold text-accent flex items-center justify-center gap-1.5"
        style="border: 1.5px dashed var(--c-hairline)">
        <Ic name="plus" class="w-4 h-4" /> {{ t("Créer un carnet") }}
      </button>
      <button @click="modeRejoindre = !modeRejoindre; modeCreer = false"
        class="w-full rounded-2xl py-3.5 text-sm font-semibold text-accent flex items-center justify-center gap-1.5"
        style="border: 1.5px dashed var(--c-hairline)">
        <Ic name="users" class="w-4 h-4" /> {{ t("Rejoindre un carnet") }}
      </button>
    </div>

    
    <div v-if="modeRejoindre" class="rounded-2xl p-4 mb-6 bg-surface border border-hairline">
      <p class="text-sm font-semibold mb-1">{{ t("Rejoindre un carnet") }}</p>
      <p class="text-[11px] text-muted mb-3 leading-relaxed">
        {{ t("Entre le mot-clé que l'admin t'a donné. C'est aussi la porte de secours d'un nouvel         appareil : même carnet, même prénom, tu retrouves tout.") }}
      </p>
      <label for="lc-rejoindre" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">{{ t("Mot-clé d'invitation") }}</label>
      <input id="lc-rejoindre" v-model="codeRejoindre" type="text" autocapitalize="none" autocomplete="off" maxlength="15"
        :placeholder="t('ex. les-copains')" @input="codeRejoindre = codeRejoindre.slice(0, 15)"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-3" />
      <label for="lc-recup" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">{{ t("Ton code personnel — 4 ou 6 chiffres") }}</label>
      <input id="lc-recup" v-model="codeRecupJoin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
        placeholder="●●●●●●"
        @input="codeRecupJoin = codeRecupJoin.replace(/\D/g, '').slice(0, 6)"
        class="w-full rounded-xl px-3 py-3 text-sm text-center tracking-[.3em] bg-bg border border-hairline outline-none mb-1" />
      <p class="text-[11px] mb-3 leading-relaxed">
        <span class="font-semibold">{{ t("Mémorise bien ce code : il te servira à créer tes propres carnets et à retrouver         tes carnets si tu changes de téléphone.") }}</span>
        <span class="text-muted"> {{ t("Obligatoire pour un nouveau prénom — et si tu reprends le tien sur un nouvel appareil, c'est lui qui le prouve.") }}</span>
      </p>
      <p v-if="errRejoindre" class="text-xs text-accent mb-2 leading-relaxed">{{ errRejoindre }}</p>
      
      <div v-if="prisDans" class="rounded-xl p-3 bg-soft mb-2">
        <p class="text-[11px] text-muted leading-relaxed mb-2">
          {{ t("C'est toi, sur un nouvel appareil ? Entre ton code admin — celui choisi à la création du carnet — pour reprendre ta place.") }}
        </p>
        <input v-model="codeAdminReprise" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
          :placeholder="t('Code admin')"
          @input="codeAdminReprise = codeAdminReprise.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-3 py-3 mb-2 text-sm text-center tracking-[.3em] bg-surface border border-hairline outline-none" />
        <p v-if="errReprise" class="text-xs text-accent mb-2">{{ errReprise }}</p>
        <button @click="reprendreAdmin" :disabled="![4, 6].includes(codeAdminReprise.length)"
          class="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-accent disabled:opacity-40">
          {{ t("Reprendre ma place") }}
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button @click="modeRejoindre = false" class="rounded-xl py-2.5 text-sm font-semibold border border-hairline">{{ t("Annuler") }}</button>
        <button @click="rejoindre" :disabled="normMot(codeRejoindre).length < 4 || ![4, 6].includes(codeRecupJoin.replace(/\D/g, '').length)"
          class="rounded-xl py-2.5 text-sm font-semibold text-white bg-accent disabled:opacity-40">{{ t("Rejoindre") }}</button>
      </div>
    </div>

    
    <div v-if="modeCreer" class="rounded-2xl p-4 mb-6 bg-surface border border-hairline">
      <p class="text-sm font-semibold mb-1">{{ t("Nouveau carnet") }}</p>
      <p class="text-[11px] text-muted mb-3">{{ t("Invité ? Tu peux créer le tien aussi — c'est comme ça que ça grandit.") }}</p>

      <label for="lc-nom" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">{{ t("Nom du carnet") }}</label>
      <input id="lc-nom" v-model="nom" :placeholder="t('Famille, Les copains, Boulot…')" maxlength="24"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-1" />
      <p class="text-[11px] text-muted mb-3">{{ t("Visible seulement par les membres que tu invites.") }}</p>

      <label for="lc-code" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">{{ t("Mot-clé d'invitation — 4 à 15 caractères") }}</label>
      <input id="lc-code" v-model="codeInvite" type="text" autocapitalize="none" autocomplete="off" maxlength="15"
        :placeholder="t('ex. famille-A ou spice-girls (auto si vide)')"
        @input="codeInvite = codeInvite.slice(0, 15)"
        class="w-full rounded-xl px-3 py-3 text-sm bg-bg border border-hairline outline-none mb-1" />
      <p class="text-[11px] text-muted mb-3">{{ t("À donner aux personnes que tu invites — plus facile à retenir qu'un numéro. Généré automatiquement si tu laisses vide.") }}</p>

      <label for="lc-code-admin" class="block text-[10px] uppercase tracking-widest text-muted mb-1.5">{{ t("Ton code personnel — 4 ou 6 chiffres") }}</label>
      <div class="relative mb-1">
        <input id="lc-code-admin" v-model="codeAdmin" :type="showAdmin ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
          :placeholder="t('4 chiffres ou 6, à toi de choisir')"
          @input="codeAdmin = codeAdmin.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-3 py-3 pr-11 text-sm bg-bg border border-hairline outline-none tracking-[.3em]" />
        <button type="button" @click="showAdmin = !showAdmin" :aria-label="t('Afficher le code')"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <Ic :name="showAdmin ? 'eyeSlash' : 'eye'" class="w-5 h-5" />
        </button>
      </div>
      <div class="relative mb-1">
        <input v-model="codeAdmin2" :type="showAdmin2 ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
          :placeholder="t('Encore une fois pour vérifier')"
          @input="codeAdmin2 = codeAdmin2.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-3 py-3 pr-11 text-sm bg-bg border border-hairline outline-none tracking-[.3em]" />
        <button type="button" @click="showAdmin2 = !showAdmin2" :aria-label="t('Afficher le code')"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <Ic :name="showAdmin2 ? 'eyeSlash' : 'eye'" class="w-5 h-5" />
        </button>
      </div>
      <p class="text-[11px] mb-3 leading-relaxed">
        <span class="font-semibold">{{ t("Mémorise bien ce code : il te servira à créer tes propres carnets et à retrouver         tes carnets si tu changes de téléphone.") }}</span>
        <span class="text-muted"> {{ t("Il devient le code admin de ce carnet. Ne le donne à personne.") }}</span>
      </p>

      <p v-if="err" class="text-xs text-accent mb-2">{{ err }}</p>
      <div class="grid grid-cols-2 gap-2">
        <button @click="modeCreer = false" class="rounded-xl py-2.5 text-sm font-semibold border border-hairline">{{ t("Annuler") }}</button>
        <button @click="creer" :disabled="!nom.trim() || ![4, 6].includes(codeAdmin.length) || codeAdmin.length !== codeAdmin2.length"
          class="rounded-xl py-2.5 text-sm font-semibold text-white bg-accent disabled:opacity-40">{{ t("Créer") }}</button>
      </div>
    </div>

    
    <template v-if="store.carnet">
      <h2 class="text-lg font-serif mb-1">« {{ store.carnet.nom }} »</h2>
      <p class="text-xs text-muted mb-3">{{ store.fichesDuCarnet.length }} {{ t("adresse(s) aimée(s)") }}</p>

      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">{{ t("Membres") }}</p>
      <div class="space-y-1.5 mb-5">
        <div v-for="m in store.carnet.membres" :key="m" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-surface border border-hairline">
          <Avatar :prenom="m" :size="28" :src="store.avatarDe(m)" />
          <span class="flex-1 text-sm">{{ m }}<span v-if="m === store.profil.prenom" class="text-muted text-xs"> {{ t("(toi)") }}</span></span>
          <Ic v-if="m === store.carnet.admin" name="lock" class="w-3.5 h-3.5 text-gold" />
          <button v-if="m !== store.profil.prenom && m !== store.carnet.admin" @click="retirer(m)"
            class="text-muted p-1"><Ic name="x" class="w-3.5 h-3.5" /></button>
        </div>
      </div>

      
      <template v-if="!store.carnet?.prive">
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">{{ t("Inviter") }}</p>
      <div class="rounded-2xl p-4 bg-surface border border-hairline mb-4">
        <p class="text-[11px] text-muted mb-2.5 leading-relaxed">{{ t("Partage ce lien — ou le code") }} <span class="font-semibold text-accent tracking-widest">{{ store.carnet.code }}</span> {{ t("à la main. Toute personne invitée peut aussi créer son propre carnet.") }}</p>
        <div class="grid grid-cols-3 gap-2">
          <button @click="whatsapp" class="rounded-xl py-3 text-[13px] font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
            <Ic name="chat" class="w-4 h-4" /> {{ t("WhatsApp") }}
          </button>
          <button @click="sms" class="rounded-xl py-3 text-[13px] font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
            <Ic name="sms" class="w-4 h-4" /> {{ t("SMS") }}
          </button>
          <button @click="copier" class="rounded-xl py-3 text-[13px] font-semibold text-accent border border-hairline flex items-center justify-center gap-1.5">
            <Ic name="share" class="w-4 h-4" /> {{ t("Copier") }}
          </button>
        </div>
      </div>
      </template>
      <p v-else class="text-[11px] text-muted leading-relaxed mb-4 rounded-2xl p-4 bg-surface border border-hairline">
        {{ t("Espace privé — visible de toi seul. Pour offrir une adresse à un carnet, sélectionne-la (appui long) dans la liste puis partage-la.") }}
      </p>

      <button v-if="!store.isAdminCarnet(store.carnetId)" @click="popinQuitter = true"
        class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 mb-3"
        :style="{ color: 'var(--c-accent)', border: '1px solid var(--c-hairline)' }">
        <Ic name="x" class="w-4 h-4" /> {{ t("Quitter ce carnet") }}
      </button>

      <button @click="exporterJSON"
        class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 mb-4"
        :style="{ color: 'var(--c-green)', background: 'color-mix(in srgb, var(--c-green) 12%, transparent)' }">
        <Ic name="share" class="w-4 h-4" /> {{ t("Exporter «") }} {{ store.carnet.nom }} » {{ t("en JSON") }}
      </button>

      <p class="text-[11px] text-muted text-center leading-relaxed">
        {{ t("L'admin du carnet ajoute ou retire qui il veut.") }}<br />
        {{ t("Tes données t'appartiennent : export à tout moment, aussi depuis le profil.") }}
      </p>

      <ConfirmModal :open="popinQuitter"
        :title="t('Quitter') + ' « ' + (store.carnet?.nom || '') + ' » ?'"
        text="Tu ne recevras plus rien de ce carnet et toutes ses publications disparaissent de ton fil. Aucune récupération possible — pour revenir, il faudra une nouvelle invitation."
        confirmLabel="Quitter"
        @confirm="quitter" @cancel="popinQuitter = false" />

      <ConfirmModal :open="!!pendingRetrait"
        :title="t('Retirer') + ' ' + (pendingRetrait || '') + ' ?'"
        text="Il ne verra plus ce carnet. Il garde ses autres carnets."
        confirmLabel="Retirer"
        @confirm="confirmerRetrait" @cancel="pendingRetrait = null" />
    </template>

    <!-- V0.4.97 : nourrir le carnet fraîchement créé avec des notes existantes -->
    <div v-if="seedOuvert" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center pt-4 px-4 pb-[calc(var(--lc-nav-h)+var(--lc-safe-b)+16px)] sm:pb-4"
      :style="{ background: 'rgba(0,0,0,.45)' }" @click.self="seedFermer">
      <div class="w-full max-w-[430px] rounded-t-3xl sm:rounded-2xl bg-surface p-5 max-h-[80vh] flex flex-col" @click.stop>
        <p class="text-lg font-serif mb-1">{{ t('Nourrir') }} « {{ seedCarnet?.nom }} »</p>
        <p class="text-xs text-muted mb-4 leading-relaxed text-left">{{ t("Sélectionne des notes de tes autres carnets pour l'ouvrir avec de la matière — tes invités ne tomberont pas sur un carnet vide.") }}</p>
        <div class="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5 mb-4">
          <p v-if="!seedPossibles.length" class="text-xs text-muted leading-relaxed py-6 text-center">
            {{ t("Aucune note à proposer pour l'instant — note ta première adresse, ou retrouve tes carnets depuis Profil si tu viens de changer d'appareil.") }}
          </p>
          <button v-for="f in seedPossibles" :key="f.id" @click="toggleSeed(f.id)"
            class="w-full flex items-center gap-3 rounded-xl p-2.5 border transition"
            :style="{ borderColor: seedPicks.has(f.id) ? 'var(--c-accent)' : 'var(--c-hairline)', background: seedPicks.has(f.id) ? 'var(--c-soft)' : 'transparent' }">
            <span class="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
              :style="{ borderColor: seedPicks.has(f.id) ? 'var(--c-accent)' : 'var(--c-hairline)', background: seedPicks.has(f.id) ? 'var(--c-accent)' : 'transparent' }">
              <Ic v-if="seedPicks.has(f.id)" name="check" class="w-3.5 h-3.5 text-white" />
            </span>
            <span class="flex-1 text-left leading-tight min-w-0">
              <span class="block text-sm font-semibold truncate">{{ f.titre }}</span>
              <span class="block text-[10px] text-muted truncate">{{ f.lieu || t(f.type === 'recette' ? 'Recette' : f.type === 'cocktail' ? 'Cocktail' : 'Adresse') }}</span>
            </span>
            <span v-if="f.note >= 70" class="text-xs font-semibold shrink-0" :style="{ color: 'var(--c-accent)' }">{{ f.note }}</span>
          </button>
        </div>
        <div class="flex gap-2">
          <button @click="seedFermer" class="flex-1 rounded-xl py-3 text-sm font-semibold"
            :style="{ color: 'var(--c-muted)', border: '1px solid var(--c-hairline)' }">{{ t("Plus tard") }}</button>
          <button @click="seedConfirmer" :disabled="!seedPicks.size"
            class="flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
            :style="{ color: 'var(--c-accent)', background: 'var(--c-soft)' }">
            <Ic name="share" class="w-4 h-4" />
            {{ t("Ajouter la sélection") }}<template v-if="seedPicks.size"> ({{ seedPicks.size }})</template>
          </button>
        </div>
      </div>
    </div>

    <!-- V0.4.101 : renommer un carnet (admin) -->
    <div v-if="renomme" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center pt-4 px-4 pb-[calc(var(--lc-nav-h)+var(--lc-safe-b)+16px)] sm:pb-4"
      :style="{ background: 'rgba(0,0,0,.45)' }" @click.self="renomme = null">
      <div class="w-full max-w-[430px] mx-auto rounded-t-3xl sm:rounded-2xl bg-surface p-5" @click.stop>
        <div class="w-10 h-1 rounded-full bg-hairline mx-auto mb-4" />
        <p class="text-lg font-serif mb-1 text-left">{{ t("Renommer le carnet") }}</p>
        <input v-model="renommeNom" maxlength="24" class="w-full rounded-xl px-3 py-3 text-sm bg-cream border border-hairline outline-none mb-4 mt-2"
          :placeholder="t('Le nom du carnet…')" @keyup.enter="validerRenommer" />
        <div class="flex gap-2">
          <button @click="renomme = null" class="flex-1 rounded-xl py-3 text-sm font-semibold"
            :style="{ color: 'var(--c-muted)', border: '1px solid var(--c-hairline)' }">{{ t("Annuler") }}</button>
          <button @click="validerRenommer" :disabled="!renommeNom.trim()"
            class="flex-1 rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
            :style="{ color: '#fff', background: '#7A2E3E' }">{{ t("Enregistrer") }}</button>
        </div>
      </div>
    </div>

    <ConfirmModal :open="!!supprCarnet"
      :title="t('Supprimer') + ' « ' + (supprCarnet?.nom || '') + ' » ?'"
      :text="t('Le carnet et toutes ses données disparaissent pour tous les membres. Aucune récupération possible. Les fiches partagées avec un autre carnet y survivent.')"
      confirmLabel="Supprimer"
      @confirm="confirmerSupprCarnet" @cancel="supprCarnet = null" />

    <ConfirmModal :open="!!pendingQuitter"
      :title="t('Quitter') + ' « ' + (pendingQuitter?.nom || '') + ' » ?'"
      text="Tu ne recevras plus rien de ce carnet et toutes ses publications disparaissent de ton fil. Aucune récupération possible — pour revenir, il faudra une nouvelle invitation."
      confirmLabel="Quitter"
      @confirm="confirmerQuitterCarnet" @cancel="pendingQuitter = null" />
  </div>
</template>