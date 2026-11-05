<script setup>
// Onboarding : prénom puis mot-clé du carnet (4-15 caractères) — ou lien direct pré-rempli.
import { ref, computed, inject } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";

const route = useRoute();
const router = useRouter();
const store = useCarnetStore();
const toast = inject("toast");

const step = ref(route.params.code ? 2 : 1);
const prenom = ref(store.profil.prenom || "");
// Normalise un mot-clé : minuscules, sans accents, espaces -> tirets, max 15
const normMot = (v) =>
  (v || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 15);
const code = ref(normMot(route.params.code));
const err = ref("");
const dupErr = ref("");
const codeAdmin = ref("");
const recupErr = ref("");
const recupOK = ref(false);
const connu = computed(() => store.carnets.find((c) => c.code === normMot(code.value)));

function goStep2() {
  if (!prenom.value.trim()) return;
  dupErr.value = "";
  store.setPrenom(prenom.value.trim());
  step.value = 2;
}
async function rejoindre() {
  if (normMot(code.value).length < 4) return;
  const r = await store.rejoindre(normMot(code.value));
  if (r && r.error === "prenom_pris") {
    // Le prénom est déjà pris dans ce carnet : on repart du champ prénom,
    // l'inscription ne passe pas tant que le doublon n'est pas résolu.
    dupErr.value =
      "« " + prenom.value.trim() + " » est déjà dans ce carnet — ajoute une initiale pour te distinguer, ex. " +
      prenom.value.trim() + " M.";
    step.value = 1;
    return;
  }
  if (r) {
    toast("Bienvenue dans « " + store.carnet.nom + " »");
    router.push("/");
  } else {
    err.value = "Carnet introuvable — vérifie le mot-clé qui t'a été donné.";
  }
}

// C'est moi sur un nouvel appareil (réinstallation) : le prénom est refusé en doublon
// mais le mot-clé d'invitation + le code admin restaurent la session admin.
async function reprendre() {
  if (codeAdmin.value.length !== 6) return;
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
        <input v-model="codeAdmin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Code admin"
          @input="codeAdmin = codeAdmin.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-4 py-3 text-lg text-center tracking-[.3em] bg-bg border border-hairline outline-none mb-2" />
        <p v-if="recupErr" class="text-xs text-accent text-center mb-2">{{ recupErr }}</p>
        <button @click="reprendre" :disabled="codeAdmin.length !== 6"
          class="w-full rounded-xl py-3 text-sm font-semibold text-white bg-accent disabled:opacity-40">
          Reprendre mon carnet
        </button>
      </div>
      <button @click="goStep2" :disabled="!prenom.trim()"
        class="w-full rounded-xl py-4 text-sm font-semibold text-white bg-accent disabled:opacity-40">
        Continuer
      </button>
      <p class="text-center text-xs text-muted mt-4">Pas de mot de passe. Juste ton prénom et le mot-clé du carnet.</p>
    </div>

    <!-- Étape 2 : code -->
    <div v-else class="w-full max-w-sm mx-auto">
      <p class="text-sm text-muted text-center mb-4">Entre le mot-clé du carnet qu'on t'a donné — 4 à 15 caractères.</p>
      <input v-model="code" type="text" autocapitalize="none" autocomplete="off" maxlength="15" autofocus
        placeholder="famille-ries"
        class="w-full rounded-xl px-4 py-4 text-2xl text-center tracking-[.5em] bg-surface border border-hairline outline-none mb-2" />
      <p v-if="err" class="text-xs text-accent text-center mb-2">{{ err }}</p>
      <button @click="rejoindre" :disabled="code.trim().length < 4"
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
  </div>
</template>
