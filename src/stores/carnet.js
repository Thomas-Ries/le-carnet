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
    ficheEnEdition: false, // masque le FAB flash pendant l'edition d'une fiche
    dark: false,
    demoMode: false,
    deviceId: null,
    profil: { prenom: "", avatar: null },
    carnetId: null,
    carnets: [],
    fiches: [],
    flashes: [],
    roles: {}, // { carnetId: "admin" | "member" }
    installEvent: null, // événement beforeinstallprompt (Android/Chrome) — capturé par App.vue
    connexionPerdue: false, // true = une mutation n'a pas atteint le serveur (bascule démo en cours de session)
    inspir: { open: false, theme: null, tri: "note" }, // modale inspiration : survit à la navigation (retour du détail)
    inspirOn: true, // réglage profil : bandeau idées de sorties visible ou non
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
      // Splash 3,5 s
      setTimeout(() => (this.splash = false), 3500);
      try {
        const p = JSON.parse(localStorage.getItem(LS.profil) || "null");
        if (p) this.profil = p;
      } catch (e) { /* ok */ }
      this.dark = localStorage.getItem(LS.theme) === "dark";
      this.inspirOn = localStorage.getItem("lc-inspir") !== "off";
      document.documentElement.classList.toggle("dark", this.dark);
      const carnetId = localStorage.getItem(LS.carnetId);

      // Identité de l'appareil : UUID persistant, c'est lui qui authentifie
      this.deviceId = api.getDeviceId();
      const data = await api.bootstrap(this.deviceId);
      this.demoMode = api.state.demoMode;
      this.connexionPerdue = api.state.connexionPerdue;
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

    async refresh() {
      // Recharge silencieuse (retour au premier plan) : pas de splash, écran intact.
      // Une PWA iOS reste en mémoire des jours — sans ça, les notes des autres
      // n'apparaissent qu'après un force-quit de l'app.
      if (this._refreshing) return;
      this._refreshing = true;
      try {
        const data = await api.bootstrap(this.deviceId);
        this.demoMode = api.state.demoMode;
        this.connexionPerdue = api.state.connexionPerdue;
        this.carnets = data.carnets || [];
        this.fiches = data.fiches || [];
        this.flashes = data.flashes || [];
        this.roles = data.roles || {};
        if (this.demoMode) {
          this.roles = {};
          for (const c of this.carnets) {
            if (c.admin === this.profil.prenom) this.roles[c.id] = "admin";
          }
        }
        if (!this.carnets.some((c) => c.id === this.carnetId)) this.carnetId = this.carnets[0]?.id || null;
      } catch (e) { /* réseau KO : on retentera au prochain retour au premier plan */ }
      finally { this._refreshing = false; }
    },

    isAdminCarnet(carnetId) {
      return this.roles[carnetId] === "admin";
    },

    async purgerFlashesExpires() {
      const limite = Date.now() - 7 * 86400000;
      const expires = this.flashes.filter((f) => new Date(f.date).getTime() < limite);
      for (const f of expires) {
        // Flash commenté -> fiche "en attente" (note 0, à titrer/noter par l'auteur)
        if (f.com) {
          try {
            const r = await api.addFiche({
              carnets: f.carnets, type: "adresse", cat: null, titre: f.com.slice(0, 60),
              lieu: "", note: 0, com: f.com, photo: f.photo, recette: null,
              auteur: f.auteur, date: f.date, demandeRecette: [],
            });
            if (r && r.fiche) this.fiches.unshift(r.fiche);
          } catch (e) { /* réseau KO : le flash restera, nouvelle tentative au boot suivant */ }
        }
        api.deleteFlash(f.id).catch(() => null);
      }
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

    setInspirOn(v) {
      this.inspirOn = !!v;
      if (!v) this.inspir = { open: false, theme: null, tri: "note" };
      try { localStorage.setItem("lc-inspir", v ? "on" : "off"); } catch (e) { /* ok */ }
    },

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
      this.connexionPerdue = api.state.connexionPerdue;
      if (!r.carnet) return r; // { error: "prenom_pris", ... } remonte jusqu'à JoinView
      this.carnets.push(r.carnet);
      this.roles[r.carnet.id] = r.role || "admin";
      this.switchCarnet(r.carnet.id);
      return r.carnet;
    },

    async rejoindre(code) {
      const prenom = this.profil.prenom;
      const r = await api.join({ code, prenom, deviceId: this.deviceId });
      this.demoMode = api.state.demoMode;
      this.connexionPerdue = api.state.connexionPerdue;
      if (!r.carnet) return r; // { error: "prenom_pris", ... } remonte jusqu'à JoinView
      if (!this.carnets.some((c) => c.id === r.carnet.id)) this.carnets.push(r.carnet);
      else {
        const i = this.carnets.findIndex((c) => c.id === r.carnet.id);
        this.carnets[i] = r.carnet;
      }
      this.roles[r.carnet.id] = this.roles[r.carnet.id] || r.role || "member";
      this.switchCarnet(r.carnet.id);
      return r.carnet;
    },

    async recupererSuperAdmin(pass) {
      // Créateur de l'app : phrase de passe globale -> sessions admin sur tous les carnets.
      const r = await api.superAdmin(pass);
      if (!r || !r.ok) return r || { error: "Phrase de passe refusée." };
      for (const c of r.carnets || []) {
        if (!this.carnets.some((x) => x.id === c.id)) this.carnets.push(c);
        this.roles[c.id] = "admin";
      }
      if (r.carnets && r.carnets.length) this.switchCarnet(r.carnets[0].id);
      return r;
    },

    async recupererAdmin(codeInvite, codeAdmin, prenom) {
      // Admin sur un nouvel appareil (réinstallation) : le code d'invitation + le code
      // admin restaurent la session admin. Le serveur renvoie le carnet complet.
      const r = await api.verifyAdmin({ codeInvite, code: codeAdmin, prenom, deviceId: this.deviceId });
      if (!r || !r.ok) return r || { error: "Code admin refusé." };
      if (r.carnet) {
        if (!this.carnets.some((c) => c.id === r.carnet.id)) this.carnets.push(r.carnet);
        this.roles[r.carnet.id] = "admin";
        this.switchCarnet(r.carnet.id);
      }
      return r;
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
      this.connexionPerdue = api.state.connexionPerdue;
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

    async flasher(carnetIds, photo, com) {
      const r = await api.addFlash({
        carnets: carnetIds,
        photo,
        com: com || null,
        auteur: this.profil.prenom,
        date: new Date().toISOString(),
        deviceId: this.deviceId,
      });
      this.demoMode = api.state.demoMode;
      this.connexionPerdue = api.state.connexionPerdue;
      this.flashes.unshift(r.flash);
      return r.flash;
    },

    async quitterCarnet(carnetId) {
      const r = await api.leaveCarnet(carnetId, this.profil.prenom);
      if (r && r.error) return r;
      // Le carnet et tout son contenu disparaissent du fil de cet appareil
      this.carnets = this.carnets.filter((c) => c.id !== carnetId);
      delete this.roles[carnetId];
      this.fiches = this.fiches
        .map((f) => ({ ...f, carnets: f.carnets.filter((cid) => cid !== carnetId) }))
        .filter((f) => f.carnets.length > 0);
      this.flashes = this.flashes
        .map((f) => ({ ...f, carnets: f.carnets.filter((cid) => cid !== carnetId) }))
        .filter((f) => f.carnets.length > 0);
      if (this.carnetId === carnetId) {
        const suivant = this.carnets[0]?.id || null;
        this.carnetId = suivant;
        if (suivant) localStorage.setItem(LS.carnetId, suivant);
      }
      return { ok: true };
    },

    async commenterFlash(id, com) {
      const r = await api.commentFlash(id, com);
      const fl = this.flashes.find((f) => f.id === id);
      if (fl && !(r && r.error)) fl.com = r.com !== undefined ? r.com : com;
      return r;
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
      // Garde-fou : un refus serveur ne doit jamais corrompre l'état local
      // (reacts undefined faisait crasher la fiche à l'affichage).
      if (!r || r.error || !Array.isArray(r.reacts)) return r || { error: "refusé" };
      const maj = (arr) => {
        const t = arr.find((x) => x.id === targetId);
        if (t) t.reacts = r.reacts;
      };
      maj(this.fiches);
      maj(this.flashes);
    },

    async ajouterCommentaire(ficheId, texte) {
      const r = await api.addComment(ficheId, this.profil.prenom, texte);
      if (r && r.comment) {
        const f = this.fiches.find((x) => x.id === ficheId);
        if (f) (f.comments = f.comments || []).push(r.comment);
      }
      return r;
    },

    async modifierCommentaire(ficheId, commentId, texte) {
      const r = await api.editComment(commentId, texte);
      const f = this.fiches.find((x) => x.id === ficheId);
      const c = f && (f.comments || []).find((x) => x.id === commentId);
      if (c && r && !r.error) c.texte = r.texte !== undefined ? r.texte : texte;
      return r;
    },

    async supprimerCommentaire(ficheId, commentId) {
      const r = await api.deleteComment(commentId);
      const f = this.fiches.find((x) => x.id === ficheId);
      if (f) f.comments = (f.comments || []).filter((x) => x.id !== commentId);
      return r;
    },

    async supprimerCompte(purge) {
      const r = await api.deleteAccount(purge);
      if (r && r.error) return r;
      // Retour à l'état d'origine : plus de prénom, plus de carnets, plus de données.
      this.profil = { prenom: "", avatar: null };
      this.carnets = [];
      this.fiches = [];
      this.flashes = [];
      this.roles = {};
      this.carnetId = null;
      try {
        localStorage.removeItem("lc-profil");
        localStorage.removeItem("lc-carnet");
      } catch (e) { /* ok */ }
      return { ok: true };
    },

    async noterGo(id) {
      // Fire-and-forget : la mesure ne doit jamais ralentir l'ouverture de Maps.
      api.logGo(id).catch(() => {});
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