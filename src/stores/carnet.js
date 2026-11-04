import { defineStore } from "pinia";
import * as api from "../lib/api.js";

const LS = {
  profil: "lc-profil",
  carnetId: "lc-carnet",
  theme: "lc-theme",
};

export const useCarnetStore = defineStore("carnet", {
  state: () => ({
    splash: true,
    dark: false,
    demoMode: false,
    profil: { prenom: "", avatar: null },
    carnetId: null,
    carnets: [],
    fiches: [],
    flashes: [],
  }),

  getters: {
    carnet: (s) => s.carnets.find((c) => c.id === s.carnetId) || null,
    fichesDuCarnet(s) {
      return s.fiches
        .filter((f) => f.carnets.includes(s.carnetId))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    },
    flashesDuCarnet(s) {
      // 7 jours de vie : expirés filtrés côté affichage + purge au boot
      const limite = Date.now() - 7 * 86400000;
      return s.flashes.filter((f) => f.carnets.includes(s.carnetId) && new Date(f.date).getTime() >= limite);
    },
    isAdmin(state) {
      // En V1 : admin du carnet = créateur ; le code est vérifié à l'écran Admin
      return (membre) => state.carnet && state.profil.prenom === membre;
    },
  },

  actions: {
    async boot() {
      // Splash 2,5 s (2,1 s de barre + fondu 0,4 s)
      setTimeout(() => (this.splash = false), 2500);
      try {
        const p = JSON.parse(localStorage.getItem(LS.profil) || "null");
        if (p) this.profil = p;
      } catch (e) { /* ok */ }
      this.dark = localStorage.getItem(LS.theme) === "dark";
      document.documentElement.classList.toggle("dark", this.dark);
      const carnetId = localStorage.getItem(LS.carnetId);
      const data = await api.bootstrap();
      this.demoMode = api.state.demoMode;
      this.carnets = data.carnets || [];
      this.fiches = data.fiches || [];
      this.flashes = data.flashes || [];
      this.carnetId = this.carnets.some((c) => c.id === carnetId) ? carnetId : this.carnets[0]?.id || null;
      this.purgerFlashesExpires();
    },

    purgerFlashesExpires() {
      const limite = Date.now() - 7 * 86400000;
      const expires = this.flashes.filter((f) => new Date(f.date).getTime() < limite);
      expires.forEach((f) => api.deleteFlash(f.id));
      this.flashes = this.flashes.filter((f) => !expires.includes(f));
    },

    switchCarnet(id) {
      this.carnetId = id;
      localStorage.setItem(LS.carnetId, id);
    },

    setProfil(prenom, avatar) {
      this.profil = { prenom, avatar: avatar ?? this.profil.avatar };
      localStorage.setItem(LS.profil, JSON.stringify(this.profil));
    },

    setPrenom(prenom) { this.setProfil(prenom); },
    setAvatar(avatar) { this.setProfil(this.profil.prenom, avatar); },
    setDark() { this.toggleDark(); },

    toggleDark() {
      this.dark = !this.dark;
      localStorage.setItem(LS.theme, this.dark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", this.dark);
    },

    async creerCarnet(nom, code) {
      // Le créateur choisit son code 6 chiffres : il sert de code carnet (invitation)
      // ET de code admin (connexion sur un autre appareil).
      const prenom = this.profil.prenom;
      const r = await api.createCarnet({ nom, code, adminCode: code, prenom });
      this.demoMode = api.state.demoMode;
      this.carnets.push(r.carnet);
      this.carnetId = r.carnet.id;
      localStorage.setItem(LS.carnetId, this.carnetId);
      return r.carnet;
    },

    async rejoindre(code) {
      const prenom = this.profil.prenom;
      const c = this.carnets.find((x) => x.code.toUpperCase() === String(code).toUpperCase());
      if (c) {
        if (!c.membres.includes(prenom)) c.membres.push(prenom);
        this.switchCarnet(c.id);
      }
      return c || null;
    },

    async noter(fiche) {
      const r = await api.addFiche({ ...fiche, auteur: this.profil.prenom, date: new Date().toISOString().slice(0, 10) });
      this.demoMode = api.state.demoMode;
      this.fiches.unshift(r.fiche);
      return r.fiche;
    },

    async majFiche(id, patch) {
      const r = await api.updateFiche(id, patch);
      const i = this.fiches.findIndex((f) => f.id === id);
      if (i !== -1) this.fiches[i] = { ...this.fiches[i], ...patch };
      return r;
    },

    async supprimerFiche(id) {
      await api.deleteFiche(id);
      this.fiches = this.fiches.filter((f) => f.id !== id);
    },

    async flasher(carnetIds, photo) {
      const r = await api.addFlash({
        carnets: carnetIds,
        photo,
        auteur: this.profil.prenom,
        date: new Date().toISOString(),
      });
      this.demoMode = api.state.demoMode;
      this.flashes.unshift(r.flash);
      return r.flash;
    },

    async completerFlash(id, patch) {
      // Le flash devient fiche, puis il s'efface (badge éclair retiré)
      const fl = this.flashes.find((f) => f.id === id);
      const fiche = await this.noter({ ...patch, carnets: fl.carnets, photo: fl.photo });
      await api.deleteFlash(id);
      this.flashes = this.flashes.filter((f) => f.id !== id);
      return fiche;
    },

    async liker(targetId, on) {
      const r = await api.react(targetId, this.profil.prenom, on);
      const maj = (arr) => {
        const t = arr.find((x) => x.id === targetId);
        if (t) t.reacts = r.reacts;
      };
      maj(this.fiches);
      maj(this.flashes);
    },

    async demanderRecette(id) {
      const r = await api.demandeRecette(id, this.profil.prenom);
      const i = this.fiches.findIndex((f) => f.id === id);
      if (i !== -1) this.fiches[i].demandeRecette = r.fiche.demandeRecette;
    },

    async retirerMembre(carnetId, membre) {
      const r = await api.removeMember(carnetId, membre);
      const i = this.carnets.findIndex((c) => c.id === carnetId);
      if (i !== -1) this.carnets[i].membres = r.carnet.membres;
    },
  },
});
