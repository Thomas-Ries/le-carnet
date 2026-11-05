import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router.js";
import "./style.css";

// Lien court /join/<mot-clé> (partagé sans #) : reconverti en route hash avant le boot.
if (location.pathname.startsWith("/join/")) {
  const code = decodeURIComponent(location.pathname.split("/")[2] || "");
  history.replaceState(null, "", "/#/join/" + encodeURIComponent(code));
}

createApp(App).use(createPinia()).use(router).mount("#app");

// Service worker : nécessaire pour recevoir les notifications push
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
  // V0.4.84 : demander la persistance du stockage quand le navigateur le permet —
  // réduit l'éviction silencieuse du localStorage (deviceId / sessions locales).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* ok */ }
}