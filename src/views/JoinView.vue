<script setup>
// Onboarding : prénom puis mot-clé du carnet (4-15 caractères) — ou lien direct pré-rempli.
import { ref, computed, inject } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import * as api from "../lib/api.js";

const route = useRoute();
const router = useRouter();
const store = useCarnetStore();
const toast = inject("toast");

const step = ref(route.params.code ? 2 : 1);
// V0.4.84 : récupération identité — prénom + code personnel, tout revient.
const recupOpen = ref(false);
const recupCode = ref("");
const recupBusy = ref(false);
const recupIdErr = ref("");
const prenom = ref(store.profil.prenom || "");
// Normalise un mot-clé : minuscules, sans accents, espaces -> tirets, max 15
const normMot = (v) =>
  (v || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 15);
const code = ref(normMot(route.params.code));
const err = ref("");
const dupErr = ref("");
const codeAdmin = ref("");
const codeRecup = ref("");
const showRecupCode = ref(false);
const showRecup = ref(false);
const recupErr = ref("");
const recupOK = ref(false);
const superOpen = ref(false);
const superPass = ref("");
const superErr = ref("");
const connu = computed(() => store.carnets.find((c) => c.code === normMot(code.value)));

async function retrouverMesCarnets() {
  if (recupBusy.value) return;
  recupIdErr.value = "";
  recupBusy.value = true;
  const r = await store.recuperer(prenom.value.trim(), recupCode.value);
  recupBusy.value = false;
  if (r && r.error) {
    recupIdErr.value = r.error === "code_refuse"
      ? "Code refusé — vérifie ton code personnel (4 ou 6 chiffres)."
      : "Impossible pour l'instant — vérifie ta connexion.";
    return;
  }
  toast("Retrouvé — tes carnets sont de retour");
  router.push("/");
}
function goStep2() {
  if (!prenom.value.trim()) return;
  dupErr.value = "";
  store.setPrenom(prenom.value.trim());
  step.value = 2;
}
async function rejoindre() {
  if (normMot(code.value).length < 4) return;
  const cr = codeRecup.value.replace(/\D/g, "");
  const r = await store.rejoindre(normMot(code.value), cr);
  if (r && r.error === "prenom_pris") {
    // Le prénom est déjà pris dans ce carnet : on repart du champ prénom,
    // l'inscription ne passe pas tant que le doublon n'est pas résolu.
    // (La reprise par code de récupération est gérée ci-dessus dans le même écran,
    //  via le bloc « C'est toi ? » — il apparaît au retour à l'étape prénom.)
    dupErr.value =
      "« " + prenom.value.trim() + " » est déjà dans ce carnet — ajoute une initiale pour te distinguer, ex. " +
      prenom.value.trim() + " M.";
    step.value = 1;
    return;
  }
  if (r && r.error === "code_refuse") {
    err.value = "Code personnel refusé — vérifie les 4 ou 6 chiffres.";
    return;
  }
  if (r && r.error === "code_different") {
    err.value = "Ce n'est pas ton code personnel — utilise le même que dans tes autres carnets.";
    return;
  }
  if (r && r.error === "code_manquant") {
    err.value = "Choisis ton code personnel — 4 ou 6 chiffres, il relie le prénom à toi.";
    return;
  }
  if (r && r.error) {
    // Toute erreur de join remonte ici avec un message clair — jamais un crash
    // (mot-clé erroné, refus serveur… l'appareil n'a alors aucun carnet actif).
    toast(r.error === "carnet introuvable"
      ? "Carnet introuvable — vérifie le mot-clé"
      : "Impossible de rejoindre : " + r.error);
    return;
  }
  if (r) {
    toast("Bienvenue dans « " + (store.carnet?.nom || "ton carnet") + " »");
    // Première connexion : la modale Bienvenue (HomeView) présente l'app
    // et propose d'activer les notifs. Les connexions suivantes gardent le
    // prompt silencieux ci-dessous.
    let premiere = false;
    try {
      if (!localStorage.getItem("lc-bienvenue")) {
        localStorage.setItem("lc-bienvenue", "pending");
        premiere = true;
      }
    } catch (e) { /* ok */ }
    router.push("/");
    // Pic d'envie : on propose les notifs juste après le join. Silencieux si refus.
    if (!premiere && typeof Notification !== "undefined" && "serviceWorker" in navigator &&
        "PushManager" in window && Notification.permission === "default" && !store.demoMode) {
      api.activerNotifs().then((res) => {
        if (res && res.ok) toast("Tu seras prévenu quand quelqu'un note une adresse");
      }).catch(() => {});
    }
  } else {
    err.value = "Carnet introuvable — vérifie le mot-clé qui t'a été donné.";
  }
}

// C'est moi sur un nouvel appareil (réinstallation) : le prénom est refusé en doublon
// mais le mot-clé d'invitation + le code admin restaurent la session admin.
async function superReprendre() {
  if (superPass.value.length < 8) return;
  superErr.value = "";
  const r = await store.recupererSuperAdmin(superPass.value);
  if (r && r.ok) {
    toast("Tous tes carnets sont repris — tu es admin");
    router.push("/");
  } else {
    superErr.value = (r && r.error) || "Phrase de passe refusée.";
  }
}

async function reprendre() {
  if (![4, 6].includes(codeAdmin.value.length)) return;
  recupErr.value = "";
  const r = await store.recupererAdmin(code.value, codeAdmin.value, prenom.value.trim());
  if (r && r.ok) {
    recupOK.value = true;
    toast("Carnet repris — tu es de retour en admin");
    router.push("/");
  } else {
    recupErr.value = (r && r.error) || "Code admin refusé — vérifie les 4 ou 6 chiffres.";
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col justify-center px-6 py-10">
    <div class="mb-8 text-center">
      <p class="font-serif text-3xl text-accent leading-none">Le Carnet</p>
      <p class="text-[10px] uppercase tracking-[.35em] text-muted mt-1.5">adresses aimées</p>
    </div>

    <!-- Étape 1 : prénom -->
    <div v-if="step === 1" class="w-full max-w-sm mx-auto">
      <p class="text-sm text-muted text-center mb-4 leading-relaxed">
        Bienvenue. Ici, on garde les adresses et recettes qu'on a aimées,<br />entre gens qu'on connaît.
      </p>
      <input v-model="prenom" placeholder="Ton prénom" maxlength="20" autofocus
        class="w-full rounded-xl px-4 py-4 text-base bg-surface outline-none mb-3 text-center"
        :style="dupErr ? 'border-color: var(--c-accent); background: var(--c-soft)' : 'border: 1px solid var(--c-hairline)'" />
      <p v-if="dupErr" class="text-xs text-accent text-center -mt-1 mb-3 leading-relaxed">{{ dupErr }}</p>

      <!-- Reprise admin : le prénom existe déjà dans le carnet ET c'est le tien (nouvel appareil) -->
      <div v-if="dupErr && !recupOK" class="rounded-2xl p-4 mb-3 bg-surface border border-hairline">
        <p class="text-[11px] text-muted leading-relaxed mb-2.5">
          C'est toi, sur un nouvel appareil ? Entre ton code admin — celui choisi à la création du carnet —
          pour reprendre ta place.
        </p>
        <div class="relative mb-2">
          <input v-model="codeAdmin" :type="showRecup ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Code admin" autocomplete="off"
            @input="codeAdmin = codeAdmin.replace(/\D/g, '').slice(0, 6)"
            class="w-full rounded-xl px-4 py-3 pr-11 text-lg text-center tracking-[.3em] bg-bg border border-hairline outline-none" />
          <button type="button" @click="showRecup = !showRecup" aria-label="Afficher le code"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            <Ic :name="showRecup ? 'eyeSlash' : 'eye'" class="w-5 h-5" />
          </button>
        </div>
        <p v-if="recupErr" class="text-xs text-accent text-center mb-2">{{ recupErr }}</p>
        <button @click="reprendre" :disabled="![4, 6].includes(codeAdmin.length)"
          class="w-full rounded-xl py-3 text-sm font-semibold text-white bg-accent disabled:opacity-40">
          Reprendre mon carnet
        </button>
      </div>
      <button @click="goStep2" :disabled="!prenom.trim()"
        class="w-full rounded-xl py-4 text-sm font-semibold text-white bg-accent disabled:opacity-40">
        Continuer
      </button>
      <p class="text-center text-xs text-muted mt-4">Pas de mot de passe. Juste ton prénom et le mot-clé du carnet.</p>
      <button @click="recupOpen = !recupOpen" class="w-full py-2 mt-1 text-xs font-semibold text-muted underline">
        J'ai déjà mes carnets sur un autre appareil
      </button>
      <div v-if="recupOpen" class="rounded-2xl p-4 mt-2 bg-surface border border-hairline text-left">
        <p class="text-[11px] text-muted leading-relaxed mb-2.5">
          Prénom + code personnel (4 ou 6 chiffres) : cet appareil retrouve tout seul
          tes carnets et ton espace G-Maps — même après une réinstallation ou un changement de téléphone.
        </p>
        <input v-model="recupCode" :type="showRecup ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Ton code personnel" autocomplete="off"
          @input="recupCode = recupCode.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-4 py-3 text-lg text-center tracking-[.3em] bg-bg border border-hairline outline-none mb-2" />
        <p v-if="recupIdErr" class="text-xs text-accent text-center mb-2">{{ recupIdErr }}</p>
        <button @click="retrouverMesCarnets" :disabled="!prenom.trim() || ![4, 6].includes(recupCode.length) || recupBusy"
          class="w-full rounded-xl py-3 text-sm font-semibold text-white bg-accent disabled:opacity-40">
          {{ recupBusy ? "Recherche…" : "Retrouver mes carnets" }}
        </button>
      </div>
    </div>

    <!-- Étape 2 : code -->
    <div v-else class="w-full max-w-sm mx-auto">
      <p class="text-sm text-muted text-center mb-4">Entre le mot-clé du carnet qu'on t'a donné — 4 à 15 caractères.</p>
      <input v-model="code" type="text" autocapitalize="none" autocomplete="off" maxlength="15" autofocus
        placeholder="famille-A ou spice-girls"
        class="w-full rounded-xl px-4 py-4 text-2xl text-center bg-surface border border-hairline outline-none mb-2" />
      <label class="block text-[10px] uppercase tracking-widest text-muted mt-2 mb-1.5">Ton code personnel — 4 ou 6 chiffres</label>
      <div class="relative mb-1">
        <input v-model="codeRecup" :type="showRecupCode ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
          placeholder="●●●●●●"
          @input="codeRecup = codeRecup.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-4 py-3 pr-11 text-lg text-center tracking-[.3em] bg-surface border border-hairline outline-none" />
        <button type="button" @click="showRecupCode = !showRecupCode" aria-label="Afficher le code"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <Ic :name="showRecupCode ? 'eyeSlash' : 'eye'" class="w-5 h-5" />
        </button>
      </div>
      <p class="text-[11px] leading-relaxed mb-3">
        <span class="font-semibold">Mémorise bien ce code : il te servira à créer tes propres carnets et à retrouver
        tes carnets si tu changes de téléphone.</span>
        <span class="text-muted"> Personne ne pourra te le renvoyer — un seul code, pour tous tes carnets.</span>
      </p>
      <p v-if="err" class="text-xs text-accent text-center mb-2">{{ err }}</p>
      <button @click="rejoindre" :disabled="code.trim().length < 4 || ![4, 6].includes(codeRecup.replace(/\D/g, '').length)"
        class="w-full rounded-xl py-4 text-sm font-semibold text-white bg-accent disabled:opacity-40">
        {{ connu ? "Revenir dans « " + connu.nom + " »" : "Rejoindre le carnet" }}
      </button>
      <p class="text-center text-xs text-muted mt-4 leading-relaxed">
        Personne ne t'a donné de code ? Crée ton carnet<br />et invite les tiens — c'est gratuit.
      </p>
      <button @click="router.push('/carnet')" class="w-full mt-2 text-xs font-semibold text-accent underline underline-offset-4">
        Créer mon carnet
      </button>
    </div>

    <!-- Créateur de l'app : reprise globale par phrase de passe -->
    <div class="w-full max-w-sm mx-auto mt-6 text-center">
      <button v-if="!superOpen" @click="superOpen = true"
        class="text-[11px] text-muted underline underline-offset-2">
        C'est ton appli à toi ? Reprends tous tes carnets
      </button>
      <div v-else class="rounded-2xl p-4 bg-surface border border-hairline text-left">
        <p class="text-[11px] text-muted leading-relaxed mb-2.5">
          Phrase de passe du créateur — elle restaure tes droits d'admin sur tous les carnets,
          sur n'importe quel appareil. Elle ne quitte jamais ton téléphone en clair.
        </p>
        <input v-model="superPass" type="password" placeholder="Ta phrase de passe" autocomplete="off"
          @keyup.enter="superReprendre"
          class="w-full rounded-xl px-4 py-3 mb-2 text-sm bg-bg border border-hairline outline-none" />
        <p v-if="superErr" class="text-xs text-accent mb-2">{{ superErr }}</p>
        <button @click="superReprendre" :disabled="superPass.length < 8"
          class="w-full rounded-xl py-3 text-sm font-semibold text-white bg-accent disabled:opacity-40">
          Reprendre mes carnets
        </button>
      </div>
    </div>
  </div>
</template>