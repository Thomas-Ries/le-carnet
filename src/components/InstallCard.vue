<script setup>
import { t } from "../lib/i18n.js";
import { ref, computed } from "vue";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "./Ic.vue";
import { inject } from "vue";

const store = useCarnetStore();
const toast = inject("toast");

// Déjà installée ? (PWA lancée hors navigateur)
const standalone = (typeof window !== "undefined") &&
  (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);

// iPhone / iPad : pas d'API d'installation — seul le pas-à-pas manuel existe
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const busy = ref(false);
const installed = ref(false);

async function installer() {
  const ev = store.installEvent;
  if (!ev || busy.value) return;
  busy.value = true;
  try {
    await ev.prompt();
    const choix = await ev.userChoice;
    if (choix && choix.outcome === "accepted") {
      installed.value = true;
      toast(t("Installation lancée — à tout de suite sur ton écran d'accueil"));
    }
  } finally {
    busy.value = false;
    store.installEvent = null;
  }
}
</script>

<template>
  <div class="rounded-2xl p-4 mb-3 bg-surface border border-hairline">
    <p class="text-[10px] uppercase tracking-widest text-muted mb-2">{{ t("Installer l'app") }}</p>

    
    <div v-if="standalone || installed" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-soft">
      <Ic name="check" class="w-4 h-4 text-accent" />
      <p class="text-sm">{{ t("Installée sur cet appareil — tu peux la fermer et la rouvrir depuis ton écran d'accueil.") }}</p>
    </div>

    
    <div v-else-if="store.installEvent">
      <p class="text-[11px] text-muted mb-2.5 leading-relaxed">
        {{ t("Le Carnet s'installe comme une vraie app : icône sur l'écran d'accueil, plein écran, notifications.") }}
      </p>
      <button @click="installer" :disabled="busy"
        class="w-full rounded-xl py-3 text-sm font-semibold text-white active:scale-[.99] transition disabled:opacity-50"
        style="background: var(--c-accent)">
        {{ t("Installer sur mon écran d'accueil") }}
      </button>
    </div>

    
    <div v-else-if="isIOS">
      <p class="text-[11px] text-muted mb-3 leading-relaxed">
        {{ t("Sur iPhone, l'installation se fait depuis Safari — 4 étapes :") }}
      </p>
      <div class="space-y-2">
        <div class="flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-soft">
          <span class="text-xs font-semibold text-accent shrink-0 w-4">1.</span>
          <p class="text-[12px] leading-relaxed">{{ t("Ouvre Le Carnet dans") }} <span class="font-semibold">{{ t("Safari") }}</span> {{ t("(obligatoire sur iPhone, pas Chrome)") }}</p>
        </div>
        <div class="flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-soft">
          <span class="text-xs font-semibold text-accent shrink-0 w-4">2.</span>
          <p class="text-[12px] leading-relaxed">{{ t("Appuie sur le bouton") }} <span class="font-semibold">{{ t("Partager") }}</span> <span class="text-muted">{{ t("(carré avec une flèche, en bas de l'écran)") }}</span></p>
        </div>
        <div class="flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-soft">
          <span class="text-xs font-semibold text-accent shrink-0 w-4">3.</span>
          <p class="text-[12px] leading-relaxed">{{ t("Fais défiler la liste puis choisis") }} <span class="font-semibold">{{ t("« Sur l'écran d'accueil »") }}</span></p>
        </div>
        <div class="flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-soft">
          <span class="text-xs font-semibold text-accent shrink-0 w-4">4.</span>
          <p class="text-[12px] leading-relaxed">{{ t("Appuie sur") }} <span class="font-semibold">{{ t("Ajouter") }}</span> {{ t("— c'est fait, l'icône est sur ton écran et les notifications marchent") }}</p>
        </div>
      </div>
    </div>

    
    <div v-else>
      <p class="text-[11px] text-muted leading-relaxed">
        {{ t("Ajoute Le Carnet à ton écran d'accueil depuis le menu de ton navigateur         (souvent ⋮ ou … puis « Ajouter à l'écran d'accueil »). Elle s'ouvrira comme une vraie app.") }}
      </p>
    </div>
  </div>
</template>
