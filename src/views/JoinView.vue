<script setup>
// Onboarding : prénom puis code carnet (6 chiffres) — ou lien direct avec code pré-rempli.
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
const code = ref((route.params.code || "").replace(/\D/g, "").slice(0, 6));
const err = ref("");
const connu = computed(() => store.carnets.find((c) => c.code === code.value));

function goStep2() {
  if (!prenom.value.trim()) return;
  store.setPrenom(prenom.value.trim());
  step.value = 2;
}
async function rejoindre() {
  if (code.value.length !== 6) return;
  const ok = await store.rejoindre(code.value);
  if (ok) {
    toast("Bienvenue dans « " + store.carnet.nom + " »");
    router.push("/");
  } else {
    err.value = "Carnet introuvable — vérifie le code.";
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
        class="w-full rounded-xl px-4 py-4 text-base bg-surface border border-hairline outline-none mb-3 text-center" />
      <button @click="goStep2" :disabled="!prenom.trim()"
        class="w-full rounded-xl py-4 text-sm font-semibold text-white bg-accent disabled:opacity-40">
        Continuer
      </button>
      <p class="text-center text-xs text-muted mt-4">Pas de mot de passe. Juste ton prénom et le code d'un carnet.</p>
    </div>

    <!-- Étape 2 : code -->
    <div v-else class="w-full max-w-sm mx-auto">
      <p class="text-sm text-muted text-center mb-4">Entre le code du carnet qu'on t'a donné — 6 chiffres.</p>
      <input v-model="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autofocus
        placeholder="• • • • • •"
        class="w-full rounded-xl px-4 py-4 text-2xl text-center tracking-[.5em] bg-surface border border-hairline outline-none mb-2" />
      <p v-if="err" class="text-xs text-accent text-center mb-2">{{ err }}</p>
      <button @click="rejoindre" :disabled="code.length !== 6"
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
