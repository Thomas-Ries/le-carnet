<script setup>
import { ref, computed, onMounted, provide } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCarnetStore } from "./stores/carnet.js";
import Ic from "./components/Ic.vue";
import FlashSheet from "./components/FlashSheet.vue";

const route = useRoute();
const router = useRouter();
const store = useCarnetStore();
const flashOpen = ref(false);
const toasts = ref([]);
let tid = 0;

function showToast(msg) {
  const id = ++tid;
  toasts.value.push({ id, msg });
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 2600);
}
provide("toast", showToast);

/* Nav masquée sur l'onboarding ; FAB sur accueil et fiche, jamais pendant le splash */
const showNav = computed(() => route.name !== "join");
const showFab = computed(() => (route.path === "/" || route.name === "fiche") && !store.splash);

const NAV = [
  { to: "/", icon: "pin", label: "Carnet" },
  { to: "/add", icon: "plus", label: "Noter" },
  { to: "/carnet", icon: "book", label: "Mes carnets" },
  { to: "/profil", icon: "user", label: "Profil" },
];

onMounted(async () => {
  // L'événement d'installation Android/Chrome peut partir avant la navigation vers le profil :
  // on le capture dès le lancement pour que la carte "Installer l'app" puisse l'utiliser.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    store.installEvent = e;
  });
  window.addEventListener("appinstalled", () => { store.installEvent = null; });
  await store.boot();
  if (!store.profil.prenom) router.push("/join");
});
</script>

<template>
  <!-- Splash 2,5 s : livre bordeaux, barre riesling -->
  <div v-if="store.splash" class="fixed inset-0 z-[70] flex flex-col items-center justify-center px-8" style="background: var(--c-bg)">
    <div class="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style="background: var(--c-soft); color: var(--c-accent)">
      <Ic name="book" class="w-8 h-8" :sw="1.6" />
    </div>
    <p class="text-3xl font-serif leading-none" style="color: var(--c-accent)">Le Carnet</p>
    <p class="text-[10px] uppercase tracking-[.35em] mt-2" style="color: var(--c-muted)">adresses aimées</p>
    <div class="w-32 h-1 rounded-full overflow-hidden mt-6" style="background: var(--c-hairline)">
      <div class="h-full rounded-full" style="background: var(--c-riesling); animation: lcbar 2.1s ease-out forwards" />
    </div>
  </div>

  <template v-else>
    <!-- Bandeau mode démo -->
    <div v-if="store.demoMode" class="w-full py-1.5 text-center text-[10px] uppercase tracking-widest sticky top-0 z-30"
      :style="{ background: 'var(--c-soft)', color: 'var(--c-accent)' }">
      Mode démo — tout reste sur cet appareil
    </div>

    <!-- Colonne app : téléphone sur mobile, colonne généreuse centrée sur iPad / ordi -->
    <main class="lc-shell" :class="showNav ? 'pb-nav' : 'pb-8'">
      <router-view />
    </main>

    <!-- Bottom nav : fixe, colonne centrée, safe-area iPhone -->
    <nav v-if="showNav" class="fixed bottom-0 inset-x-0 z-50 lc-nav">
      <div class="lc-nav-in relative">
        <!-- FAB Flash : caméra + éclair or, accroché à la nav (suit sa hauteur réelle) -->
        <button v-if="showFab" @click="flashOpen = true" title="Flash — photo éclair"
          class="absolute w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition"
          style="bottom: calc(100% + 14px); right: 16px;
                 background: linear-gradient(140deg, #7A2E3E, #5E2230);
                 box-shadow: 0 8px 20px rgba(122,46,62,.45), 0 2px 6px rgba(43,35,32,.25);
                 border: 2px solid var(--c-bg)">
          <span class="absolute -top-1 -right-1 rounded-full p-1 text-white"
            style="background: var(--c-gold); border: 1.5px solid var(--c-bg)">
            <Ic name="bolt" class="w-2.5 h-2.5" />
          </span>
          <Ic name="camera" class="w-6 h-6 text-white" />
        </button>
        <router-link v-for="n in NAV" :key="n.to" :to="n.to"
          class="flex-1 flex flex-col items-center gap-0.5 py-2.5"
          :style="{ color: route.path === n.to ? 'var(--c-accent)' : 'var(--c-muted)' }">
          <Ic :name="n.icon" :filled="route.path === n.to" class="w-6 h-6" />
          <span class="text-[10px] font-medium">{{ n.label }}</span>
        </router-link>
      </div>
    </nav>

    <FlashSheet v-if="flashOpen" @close="flashOpen = false" />

    <!-- Toasts maison -->
    <div class="fixed left-1/2 -translate-x-1/2 z-[60] space-y-2 w-max max-w-[90vw] pointer-events-none"
      style="bottom: calc(var(--lc-nav-h) + var(--lc-safe-b) + 76px)">
      <p v-for="t in toasts" :key="t.id"
        class="rounded-full px-4 py-2.5 text-sm text-white text-center"
        style="background: rgba(43,35,32,.92); box-shadow: 0 6px 18px rgba(43,35,32,.3)">
        {{ t.msg }}
      </p>
    </div>
  </template>
</template>
