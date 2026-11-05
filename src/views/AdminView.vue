<script setup>
// Écran admin : déverrouillage par code admin (hashé côté serveur) OU session admin
// déjà active sur cet appareil. Après déverrouillage : gestion des membres,
// régénération du lien, changement du code admin.
import { ref, computed, inject } from "vue";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";
import ConfirmModal from "../components/ConfirmModal.vue";

const store = useCarnetStore();
const toast = inject("toast");

const code = ref("");
const showCode = ref(false);
const showNew = ref(false);
const showNew2 = ref(false);
const err = ref("");
const retirerDe = ref(null);
const popinRegen = ref(false);
const nouveauCode = ref("");
const nouveauCode2 = ref("");
const errCode = ref("");

const carnet = computed(() => store.carnet);
const unlocked = computed(() => !!carnet.value && store.isAdminCarnet(carnet.value.id));

async function verifier() {
  const ok = await store.verifyAdmin(carnet.value.id, code.value.trim());
  if (ok) { code.value = ""; err.value = ""; toast("Admin déverrouillé sur cet appareil"); }
  else err.value = "Code incorrect pour ce carnet.";
}
async function retirer(m) {
  const cible = retirerDe.value;
  retirerDe.value = null;
  const ok = await store.retirerMembre(store.carnetId, cible);
  if (ok) toast(cible + " retiré du carnet");
  else toast("Action réservée à l'admin");
}
async function regenerer() {
  popinRegen.value = false;
  const c = await store.regenererCodeInvitation(store.carnetId);
  if (c) toast("Nouveau code : " + c);
  else toast("Action réservée à l'admin");
}
async function changerCode() {
  if (![4, 6].includes(nouveauCode.value.length) || nouveauCode.value !== nouveauCode2.value) {
    errCode.value = "Les deux codes ne sont pas identiques (4 ou 6 chiffres).";
    return;
  }
  const ok = await store.changerCodeAdmin(store.carnetId, nouveauCode.value);
  if (ok) { nouveauCode.value = ""; nouveauCode2.value = ""; errCode.value = ""; toast("Code admin changé — note-le"); }
  else errCode.value = "Action réservée à l'admin.";
}
</script>

<template>
  <div>
    <h1 class="text-lg font-serif mb-1">Admin — « {{ carnet?.nom }} »</h1>
    <p class="text-xs text-muted mb-4">Ajoute ou retire qui tu veux. C'est ton carnet.</p>

    <!-- Déjà admin sur cet appareil -->
    <div v-if="unlocked" class="rounded-2xl p-4 mb-4 max-w-sm mx-auto text-center"
      :style="{ background: 'var(--c-soft)' }">
      <p class="text-sm font-semibold text-accent flex items-center justify-center gap-1.5">
        <Ic name="lock" class="w-4 h-4 text-gold" /> Session admin active sur cet appareil
      </p>
    </div>

    <!-- Pavé code (autre appareil) -->
    <div v-else class="rounded-2xl p-5 bg-surface border border-hairline max-w-sm mx-auto">
      <p class="text-xs text-muted mb-3 leading-relaxed">Entre ton code admin — celui choisi à la création du carnet. Il est stocké chiffré : personne ne peut te le redonner.</p>
      <div class="relative mb-2">
        <input v-model="code" :type="showCode ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Code admin" autocomplete="off"
          @input="code = code.replace(/\D/g, '').slice(0, 6)"
          class="w-full rounded-xl px-4 py-4 pr-11 text-xl text-center tracking-[.4em] bg-bg border border-hairline outline-none" />
        <button type="button" @click="showCode = !showCode" aria-label="Afficher le code"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <Ic :name="showCode ? 'eyeSlash' : 'eye'" class="w-5 h-5" />
        </button>
      </div>
      <p v-if="err" class="text-xs text-accent mb-2 text-center">{{ err }}</p>
      <button @click="verifier" :disabled="![4, 6].includes(code.length)"
        class="w-full rounded-xl py-3.5 text-sm font-semibold text-white bg-accent disabled:opacity-40">Déverrouiller</button>
      <p class="text-[11px] text-muted mt-3 text-center leading-relaxed">
        Code perdu ? Il peut être changé depuis un appareil<br />où la session admin est encore active.
      </p>
    </div>

    <template v-if="unlocked">
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
        <p class="text-[11px] text-muted mb-2.5">Mot-clé d'invitation : <span class="font-semibold text-accent">{{ carnet?.code }}</span> — à donner à la main ou via le lien.</p>
        <button @click="navigator.clipboard?.writeText(location.origin + '/join/' + carnet?.code); toast('Lien copié')"
          class="w-full rounded-xl py-3 text-sm font-semibold text-accent bg-soft flex items-center justify-center gap-1.5 mb-3">
          <Ic name="share" class="w-4 h-4" /> Copier le lien
        </button>
        <button @click="popinRegen = true"
          class="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5"
          :style="{ color: 'var(--c-accent)', border: '1px solid var(--c-hairline)' }">
          <Ic name="qr" class="w-4 h-4" /> Régénérer le lien d'invitation
        </button>
      </div>

      <div class="rounded-2xl p-4 bg-surface border border-hairline mb-4">
        <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Changer mon code admin — 4 ou 6 chiffres</p>
        <div class="relative mb-2">
          <input v-model="nouveauCode" :type="showNew ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Nouveau code" autocomplete="off"
            @input="nouveauCode = nouveauCode.replace(/\D/g, '').slice(0, 6)"
            class="w-full rounded-xl px-3 py-3 pr-11 text-sm bg-bg border border-hairline outline-none tracking-[.3em]" />
          <button type="button" @click="showNew = !showNew" aria-label="Afficher le code"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            <Ic :name="showNew ? 'eyeSlash' : 'eye'" class="w-5 h-5" />
          </button>
        </div>
        <div class="relative mb-2">
          <input v-model="nouveauCode2" :type="showNew2 ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Confirme le nouveau code" autocomplete="off"
            @input="nouveauCode2 = nouveauCode2.replace(/\D/g, '').slice(0, 6)"
            class="w-full rounded-xl px-3 py-3 pr-11 text-sm bg-bg border border-hairline outline-none tracking-[.3em]" />
          <button type="button" @click="showNew2 = !showNew2" aria-label="Afficher le code"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            <Ic :name="showNew2 ? 'eyeSlash' : 'eye'" class="w-5 h-5" />
          </button>
        </div>
        <p v-if="errCode" class="text-xs text-accent mb-2">{{ errCode }}</p>
        <button @click="changerCode" :disabled="![4, 6].includes(nouveauCode.length) || nouveauCode !== nouveauCode2"
          class="w-full rounded-xl py-3 text-sm font-semibold text-white bg-accent disabled:opacity-40">
          Changer le code admin
        </button>
      </div>

      <p class="text-[11px] text-muted text-center leading-relaxed">
        Un membre invité peut créer son propre carnet ailleurs dans l'app —<br />c'est comme ça que Le Carnet grandit, sans rien faire.
      </p>

      <ConfirmModal :open="!!retirerDe"
        :title="'Retirer ' + (retirerDe || '') + ' ?'"
        text="Il ne verra plus ce carnet. Il peut toujours y avoir ses autres carnets."
        confirmLabel="Retirer"
        @confirm="retirer(retirerDe)" @cancel="retirerDe = null" />

      <ConfirmModal :open="popinRegen"
        title="Régénérer le lien d'invitation ?"
        text="L'ancien code et l'ancien lien ne fonctionneront plus. Les membres actuels restent membres."
        confirmLabel="Régénérer"
        @confirm="regenerer" @cancel="popinRegen = false" />
    </template>
  </div>
</template>