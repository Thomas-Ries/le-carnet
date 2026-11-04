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
    deviceId: null,
    profil: { prenom: "", avatar: null },
    carnetId: null,
    carnets: [],
    fiches: [],
    flashes: [],
    roles: {}, // { carnetId: "admin" | "member" }
  }),

  getters: {
    carnet: (s) => s.carnets.find((c) => c.id === s.carnetId) || null,
    fichesDuCarnet(s) {
      return s.fiches
        .filter((f) => f.carnets.includes(s.carnetId))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    },
    flashesDuCarnet(s) {
      const limite = Date.now() - 7 * 86400000;
      return s.flashes.filter((f) => f.carnets.includes(s.carnetId) && new Date(f.date).getTime() >= limite);
    },
  },

  actions: {
    async boot() {
      // Splash 2,5 s
      setTimeout(() => (this.splash = false), 2500);
      try {
        const p = JSON.parse(localStorage.getItem(LS.profil) || "null");
        if (p) this.profil = p;
      } catch (e) { /* ok */ }
      this.dark = localStorage.getItem(LS.theme) === "dark";
      document.documentElement.classList.toggle("dark", this.dark);
      const carnetId = localStorage.getItem(LS.carnetId);

      // Identité de l'appareil : UUID persistant, c'est lui qui authentifie
      this.deviceId = api.getDeviceId();
      const data = await api.bootstrap(this.deviceId);
      this.demoMode = api.state.demoMode;
      this.carnets = data.carnets || [];
      this.fiches = data.fiches || [];
      this.flashes = data.flashes || [];
      this.roles = data.roles || {};
      if (this.demoMode) {
        // En démo, l'identité locale = prénom du profil
        this.roles = {};
        for (const c of this.carnets) {
          if (c.admin === this.profil.prenom) this.roles[c.id] = "admin";
        }
      }
      this.carnetId = this.carnets.some((c) => c.id === carnetId) ? carnetId : this.carnets[0]?.id || null;
      this.purgerFlashesExpires();
    },

    isAdminCarnet(carnetId) {
      return this.roles[carnetId] === "admin";
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

    async creerCarnet(nom, codeInvite, codeAdmin) {
      // Le créateur choisit son code admin ; le code d'invitation peut être auto-généré.
      const r = await api.createCarnet({
        nom, codeInvite, codeAdmin,
        prenom: this.profil.prenom, deviceId: this.deviceId,
      });
      this.demoMode = api.state.demoMode;
      if (!r.carnet) return null;
      this.carnets.push(r.carnet);
      this.roles[r.carnet.id] = r.role || "admin";
      this.switchCarnet(r.carnet.id);
      return r.carnet;
    },

    async rejoindre(code) {
      const prenom = this.profil.prenom;
      const r = await api.join({ code, prenom, deviceId: this.deviceId });
      this.demoMode = api.state.demoMode;
      if (!r.carnet) return null;
      if (!this.carnets.some((c) => c.id === r.carnet.id)) this.carnets.push(r.carnet);
      else {
        const i = this.carnets.findIndex((c) => c.id === r.carnet.id);
        this.carnets[i] = r.carnet;
      }
      this.roles[r.carnet.id] = this.roles[r.carnet.id] || r.role || "member";
      this.switchCarnet(r.carnet.id);
      return r.carnet;
    },

    async verifyAdmin(carnetId, code) {
      const r = await api.verifyAdmin({ carnetId, code, deviceId: this.deviceId });
      if (r && r.ok) {
        this.roles[carnetId] = "admin";
        return true;
      }
      return false;
    },

    async regenererCodeInvitation(carnetId) {
      const r = await api.regenerateInvite({ carnetId, deviceId: this.deviceId });
      const c = this.carnets.find((x) => x.id === carnetId);
      if (c && r.code) c.code = r.code;
      return r.code || null;
    },

    async changerCodeAdmin(carnetId, newCode) {
      const r = await api.changeAdminCode({ carnetId, newCode, deviceId: this.deviceId });
      return !!(r && r.ok);
    },

    async noter(fiche) {
      const r = await api.addFiche({
        ...fiche,
        auteur: this.profil.prenom,
        date: new Date().toISOString().slice(0, 10),
        deviceId: this.deviceId,
      });
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
        deviceId: this.deviceId,
      });
      this.demoMode = api.state.demoMode;
      this.flashes.unshift(r.flash);
      return r.flash;
    },

    async completerFlash(id, patch) {
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
      if (i !== -1 && r.carnet) this.carnets[i].membres = r.carnet.membres;
      return !!r.carnet;
    },
  },
});
