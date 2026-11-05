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

/* Nav masquée sur l'onboarding ; FAB flash sur l'accueil uniquement (pas sur le détail d'une fiche : il gênait le bouton d'envoi des commentaires) */
const showNav = computed(() => route.name !== "join");
const showFab = computed(() => route.path === "/" && !store.splash);

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
  // PWA : l'app reste en mémoire des jours. Au retour au premier plan après une
  // absence, on recharge le carnet en silence pour voir les notes des autres.
  let cachéeDepuis = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cachéeDepuis = Date.now();
    else if (cachéeDepuis && Date.now() - cachéeDepuis > 15000) store.refresh();
  });
  window.addEventListener("online", () => store.refresh());
});
</script>

<template>
  <!-- Splash 3,5 s — fun et animé : fourchette · verre · petit cœur qui pop, bulles riesling,
       cœur or qui s'échappe, mots du titre en cascade, les trois cercles, phrase finale penchée -->
  <div v-if="store.splash" class="lc-splash">
    <div class="sp-badge">
      <div class="flex items-center gap-0.5">
        <Ic name="fork" class="w-[23px] h-[23px]" :sw="1.8" />
        <Ic name="glass" class="w-9 h-9" :sw="1.7" />
        <Ic name="heart" class="w-[23px] h-[23px] text-[#D9C589]" :sw="1.8" filled />
      </div>
      <span class="sp-bub b1"></span><span class="sp-bub b2"></span><span class="sp-bub b3"></span>
      <Ic name="heart" class="sp-heart" :sw="2" filled />
    </div>
    <h1 class="sp-title"><span class="sp-w">Le</span> <span class="sp-w sp-w2">Carnet</span></h1>
    <div class="sp-sub">adresses aimées · moments partagés</div>
    <div class="sp-tags"><span>En famille</span><span>Entre amis</span><span>Pour le boulot</span></div>
    <div class="sp-bar"><i></i></div>
    <div class="sp-cheers">Punaise, c'était bon !</div>
  </div>

  <template v-else>
    <!-- Bandeau mode démo -->
    <div v-if="store.demoMode && store.connexionPerdue" class="w-full py-2 px-4 text-center text-[11px] leading-relaxed sticky top-0 z-30"
      :style="{ background: '#7A2E3E', color: '#fff' }">
      Connexion au serveur perdue — tes dernières actions restent sur cet appareil uniquement.
      Si ça persiste, préviens l'admin de ton carnet.
    </div>
    <div v-else-if="store.demoMode" class="w-full py-1.5 text-center text-[10px] uppercase tracking-widest sticky top-0 z-30"
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
          class="flex-1 flex flex-col items-center gap-[2px] py-1.5 transition-transform"
          :style="{ color: route.path === n.to ? 'var(--c-accent)' : 'var(--c-muted)' }">
          <Ic :name="n.icon" :filled="route.path === n.to" :sw="route.path === n.to ? 2.3 : 2"
            class="w-6 h-6 transition-transform" :class="route.path === n.to ? 'scale-110' : ''" />
          <span class="text-[10px]" :class="route.path === n.to ? 'font-semibold' : 'font-medium'">{{ n.label }}</span>
        </router-link>
      </div>
    </nav>

    <FlashSheet v-if="flashOpen" @close="flashOpen = false" />

    <!-- Toasts maison -->
    <div class="fixed left-1/2 -translate-x-1/2 z-[60] space-y-2 w-max max-w-[90vw] pointer-events-none"
      style="bottom: calc(var(--lc-nav-h) + var(--lc-safe-b) + 76px)">
      <p v-for="t in toasts" :key="t.id" class="lc-toast">
        <Ic name="check" class="w-4 h-4 shrink-0" /> {{ t.msg }}
      </p>
    </div>
  </template>
</template>