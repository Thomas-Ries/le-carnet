import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router.js";
import "./style.css";

createApp(App).use(createPinia()).use(router).mount("#app");

// Service worker : nécessaire pour recevoir les notifications push
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
