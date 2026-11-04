<script setup>
// Accès admin : le créateur du carnet entre son code ici (autre appareil) ou y accède directement (appareil de création).
import { ref, computed, inject } from "vue";
import { useRoute } from "vue-router";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";

const route = useRoute();
const store = useCarnetStore();
const toast = inject("toast");

const code = ref("");
const ok = ref(false);
const err = ref("");
const retirerDe = ref(null);

const carnet = computed(() => store.carnet);

function verifier() {
  if (String(store.carnet?.adminCode) === code.value.trim()) {
    ok.value = true;
    err.value = "";
  } else {
    err.value = "Code incorrect pour ce carnet.";
  }
}
async function retirer(m) {
  if (await store.retirerMembre(store.carnetId, m)) toast(m + " retiré du carnet");
  retirerDe.value = null;
}
</script>

<template>
  <div>
    <h1 class="text-lg font-serif mb-1">Admin — « {{ carnet?.nom }} »</h1>
    <p class="text-xs text-muted mb-4">Ajoute ou retire qui tu veux. C'est ton carnet.</p>

    <!-- Pavé code -->
    <div v-if="!ok" class="rounded-2xl p-5 bg-surface border border-hairline max-w-sm mx-auto">
      <p class="text-xs text-muted mb-3 leading-relaxed">Entre le code admin choisi à la création du carnet.</p>
      <input v-model="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Code admin"
        class="w-full rounded-xl px-4 py-4 text-xl text-center tracking-[.4em] bg-bg border border-hairline outline-none mb-2" />
      <p v-if="err" class="text-xs text-accent mb-2 text-center">{{ err }}</p>
      <button @click="verifier" :disabled="code.length < 4"
        class="w-full rounded-xl py-3.5 text-sm font-semibold text-white bg-accent disabled:opacity-40">Déverrouiller</button>
    </div>

    <template v-else>
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Membres ({{ carnet?.membres.length }})</p>
      <div class="space-y-1.5 mb-5">
        <div v-for="m in carnet?.membres" :key="m" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-surface border border-hairline">
          <Avatar :prenom="m" :size="28" />
          <span class="flex-1 text-sm">{{ m }}<span v-if="m === carnet.admin" class="text-[10px] uppercase tracking-widest text-gold ml-1.5">admin</span></span>
          <button v-if="m !== carnet.admin" @click="retirerDe = m" class="text-muted p-1"><Ic name="x" class="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div class="rounded-2xl p-4 bg-surface border border-hairline mb-4">
        <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Inviter dans ce carnet</p>
        <p class="text-[11px] text-muted mb-2.5">Code carnet : <span class="font-semibold text-accent tracking-widest">{{ carnet?.code }}</span> — à donner à la main ou via le lien.</p>
        <button @click="navigator.clipboard?.writeText(location.origin + location.pathname + '#/join/' + carnet?.code); toast('Lien copié')"
          class="w-full rounded-xl py-3 text-sm font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
          <Ic name="share" class="w-4 h-4" /> Copier le lien
        </button>
      </div>

      <p class="text-[11px] text-muted text-center leading-relaxed">
        Un membre invité peut créer son propre carnet ailleurs dans l'app —<br />c'est comme ça que Le Carnet grandit, sans rien faire.
      </p>

      <!-- Popin retrait -->
      <div v-if="retirerDe" class="fixed inset-0 z-50 flex items-end justify-center" style="background: rgba(43,35,32,.45)" @click.self="retirerDe = null">
        <div class="w-full max-w-sm rounded-t-2xl bg-surface p-5 pb-7">
          <p class="font-serif text-lg mb-1">Retirer {{ retirerDe }} ?</p>
          <p class="text-xs text-muted mb-4">Il ne verra plus ce carnet. Il peut toujours y avoir ses autres carnets.</p>
          <div class="grid grid-cols-2 gap-2">
            <button @click="retirerDe = null" class="rounded-xl py-3 text-sm font-semibold border border-hairline">Annuler</button>
            <button @click="retirer(retirerDe)" class="rounded-xl py-3 text-sm font-semibold text-white bg-accent">Retirer</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
