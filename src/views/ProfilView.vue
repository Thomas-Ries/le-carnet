<script setup>
import { ref, computed, inject } from "vue";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import Avatar from "../components/Avatar.vue";

const store = useCarnetStore();
const toast = inject("toast");
const prenom = ref(store.profil.prenom);

const lien = computed(() => store.carnet ? location.origin + location.pathname + "#/join/" + store.carnet.code : "");

function savePrenom() {
  if (!prenom.value.trim()) return;
  store.setPrenom(prenom.value.trim());
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
          class="w-full rounded-xl px-3 py-2.5 text-sm bg-bg border border-hairline outline-none" />
        <button v-if="prenom.trim() && prenom !== store.profil.prenom" @click="savePrenom"
          class="mt-2 text-xs font-semibold text-accent">Enregistrer</button>
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

    <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline">
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Mes carnets ({{ store.carnets.length }})</p>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="c in store.carnets" :key="c.id" class="rounded-full px-3 py-1.5 text-xs font-medium bg-soft text-accent">{{ c.nom }}</span>
      </div>
    </div>

    <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline">
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">Inviter dans « {{ store.carnet?.nom }} »</p>
      <button @click="navigator.clipboard?.writeText(lien); toast('Lien copié')"
        class="w-full rounded-xl py-3 text-sm font-semibold text-accent bg-soft flex items-center justify-center gap-1.5">
        <Ic name="share" class="w-4 h-4" /> Copier le lien
      </button>
    </div>

    <p class="text-[11px] text-muted text-center leading-relaxed">
      Tes données t'appartiennent — export JSON disponible depuis le carnet.<br />
      Le Carnet · V0.1.0
    </p>
  </div>
</template>
