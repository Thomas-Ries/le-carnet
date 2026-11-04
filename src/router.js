import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import AjouterView from "./views/AjouterView.vue";
import FicheView from "./views/FicheView.vue";
import CarnetView from "./views/CarnetView.vue";
import ProfilView from "./views/ProfilView.vue";
import JoinView from "./views/JoinView.vue";
import AdminView from "./views/AdminView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/add", name: "add", component: AjouterView },
    { path: "/fiche/:id", name: "fiche", component: FicheView },
    { path: "/carnet", name: "carnet", component: CarnetView },
    { path: "/profil", name: "profil", component: ProfilView },
    { path: "/join/:code?", name: "join", component: JoinView },
    { path: "/admin", name: "admin", component: AdminView },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
