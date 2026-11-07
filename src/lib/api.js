// Couche d'accès données : worker Cloudflare + D1 si déployé, sinon repli démo local.
// Identité : chaque appareil porte un ID unique (UUID) — c'est lui qui authentifie
// les sessions côté serveur, jamais le prénom seul.
import * as demo from "./demo.js";

export const state = { demoMode: false, connexionPerdue: false };

const DEVICE_KEY = "lc-device";

export function getDeviceId() {
  let id = null;
  try { id = localStorage.getItem(DEVICE_KEY); } catch (e) { /* ok */ }
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      ("d-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10));
    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) { /* ok */ }
  }
  return id;
}

async function api(path, body) {
  // V0.4.94 : timeout — un fetch qui pend (réseau iOS juste réveillé) ne doit
  // plus suspendre l'app à l'infini ; l'abort est traité comme une panne réseau
  // (statut absent) et le boot réessaie.
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
  let res;
  try {
    res = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    // Le statut et le corps d'erreur voyagent avec l'exception : la mutate()
    // distingue un REFUS serveur (4xx) d'une vraie panne réseau.
    const err = new Error(String(res.status));
    err.status = res.status;
    try { err.body = await res.json(); } catch (e) { /* pas de corps */ }
    throw err;
  }
  return res.json();
}

// V0.4.93 : le mode démo (données factices) ne s'active QU'EN DEV (Vite local).
// En prod, un échec réseau ne doit JAMAIS montrer de faux carnets : on pose le
// bandeau « connexion perdue » (récupérable au prochain refresh) et on propage
// l'erreur — l'app conserve son état réel.
const DEV_DEMO = import.meta.env.DEV;
function fallback(err) {
  if (!DEV_DEMO) {
    state.demoMode = false;
    state.connexionPerdue = true;
    throw err;
  }
  state.demoMode = true;
  etaitDemo = true;
  return demo.load();
}

// Perte de connexion en cours de session : la mutation n'a pas atteint le serveur.
// On l'indique à part du mode démo "normal" (dev local / pas de worker).
let etaitDemo = false;
function fallbackConnexion(err) {
  if (!etaitDemo) state.connexionPerdue = true;
  return fallback(err);
}

// Lecture complète : carnets de cet appareil + rôles
export async function bootstrap(deviceId) {
  try {
    const r = await api("/api/bootstrap?device=" + encodeURIComponent(deviceId));
    etaitDemo = false;
    // Le serveur vient de répondre : plus ni bandeau « connexion perdue », ni
    // mode démo résiduel. (V0.4.89 : avant, seul un MUTATE réussi effaçait le
    // bandeau — une micro-coupure pendant un import le laissait collé à vie,
    // même avec toutes les lectures suivantes en pleine santé.)
    state.demoMode = false;
    state.connexionPerdue = false;
    // Prod : purge l'éventuelle base démo locale (reliquat d'une install dev ou
    // d'une ancienne version) — elle ne doit plus jamais s'afficher.
    if (!DEV_DEMO) { try { localStorage.removeItem("lc-demo-db"); } catch (e2) { /* ok */ } }
    return r;
  } catch (e) {
    return fallback(e);
  }
}

async function mutate(action, payload) {
  try {
    const r = await api("/api/mutate", { action, deviceId: getDeviceId(), ...payload });
    // Le serveur vient de répondre : plus de bandeau « connexion perdue ».
    if (state.connexionPerdue) state.connexionPerdue = false;
    return r;
  } catch (e) {
    // 4xx = refus du serveur (validation, droits, doublon) : on remonte l'erreur à
    // l'appelant. On ne bascule JAMAIS en démo sur un refus — sinon l'action réussit
    // en local, invisible pour le carnet, avec un toast de fausse réussite.
    // 4xx = refus du serveur UNIQUEMENT si un worker a vraiment répondu.
    // En dev (Vite sans worker) /api/mutate répond 404 HTML : c'est une absence
    // de serveur, pas un refus — on bascule en démo comme au bootstrap.
    if (e && e.status >= 400 && e.status < 500 && !etaitDemo) {
      return e.body || { error: "refusé par le serveur (" + e.status + ")" };
    }
    if (!DEV_DEMO) {
      state.connexionPerdue = true;
      return { error: "Connexion au serveur perdue — réessaie quand le réseau revient." };
    }
    const db = fallbackConnexion(e);
    return demoMutate(db, action, payload);
  }
}

// ------- Mutations locales (démo) -------
function demoMutate(db, action, p) {
  switch (action) {
    case "createCarnet": {
      db.codes = db.codes || {};
      // V0.4.68 : le code de création EST le code personnel — un seul partout.
      if (db.persoCode && p.codeAdmin !== db.persoCode) return { error: "code_different" };
      db.persoCode = p.codeAdmin;
      const c = { id: demo.uid("c"), nom: p.nom, code: p.codeInvite || "carnet-" + String(Math.floor(100 + Math.random() * 900)), adminCode: p.codeAdmin, admin: p.prenom, membres: [p.prenom] };
      db.codes[c.id + "|" + p.prenom] = p.codeAdmin;
      db.carnets.push(c);
      demo.save(db);
      return { carnet: c, role: "admin" };
    }
    case "importAdresses": {
      // V0.4.72 demo : mêmes règles que le serveur (carnet privé créé à la volée,
      // note pré-remplie si avis rattaché, dédup normNom).
      let cp = db.carnets.find((x) => x.prive === "1");
      if (!cp) {
        cp = { id: demo.uid("c"), nom: "Mes adresses", code: "perso-demo", adminCode: "", admin: p.deviceId || "demo", membres: [p.deviceId || "demo"], prive: 1 };
        db.carnets.push(cp);
      }
      const nn = (t) => {
        let s = String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
        let m;
        while ((m = /^(le|la|les|l|the|el|il|lo|du|de|des|d|au|aux|a|chez)\s+/.exec(s))) s = s.slice(m[0].length);
        return s;
      };
      let importes = 0, ignores = 0;
      const seen = new Set(db.fiches.filter((f) => (f.carnets || []).includes(cp.id)).map((f) => nn(f.titre)).filter((k) => k.length >= 4));
      for (const it of (Array.isArray(p.items) ? p.items : []).slice(0, 300)) {
        const cle = nn(it && it.titre);
        if (!it || !it.titre || cle.length < 4 || seen.has(cle)) { ignores++; continue; }
        seen.add(cle);
        const nImp = Math.min(100, Math.max(0, parseInt(it.note, 10) || 0));
        db.fiches.push({ id: demo.uid("f"), auteur: p.deviceId || "demo", type: "adresse", cat: null, titre: String(it.titre).slice(0, 60), lieu: String(it.lieu || "").slice(0, 60), note: (nImp >= 70 && nImp <= 100) ? nImp : 0, com: String(it.com || "").slice(0, 500), photo: null, recette: null, demandeRecette: [], reacts: [], comments: [], date: new Date().toISOString().slice(0, 10), carnets: [cp.id] });
        importes++;
      }
      demo.save(db);
      return { importes, ignores, carnetId: cp.id };
    }
    case "rattacherAvis": {
      const cp = db.carnets.find((x) => x.prive === "1");
      if (!cp) return { error: "pas de carnet prive" };
      const nn = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
      let rattaches = 0; const orphelins = [];
      for (const av of (Array.isArray(p.items) ? p.items : []).slice(0, 500)) {
        const f = db.fiches.find((x) => (x.carnets || []).includes(cp.id) && nn(x.titre) === nn(av && av.titre));
        if (!f) { if (av && av.titre) orphelins.push(av.titre.slice(0, 60)); continue; }
        if (!f.note) f.note = Math.min(100, Math.max(70, parseInt(av.note, 10) || 0));
        if (!f.com) f.com = String(av.com || "").slice(0, 500);
        rattaches++;
      }
      demo.save(db);
      return { rattaches, orphelins: orphelins.slice(0, 20) };
    }
    case "partagerFiches": {
      const cp = db.carnets.find((x) => x.prive === "1");
      if (!cp) return { error: "pas d espace prive" };
      let partagees = 0; const ignorees = [];
      const nn = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
      for (const fid of (Array.isArray(p.ficheIds) ? p.ficheIds : []).slice(0, 100)) {
        const f = db.fiches.find((x) => x.id === fid && (x.carnets || []).includes(cp.id));
        if (!f) { ignorees.push({ titre: "?", raison: "hors espace prive" }); continue; }
        let places = [];
        for (const cid of (Array.isArray(p.carnetIds) ? p.carnetIds : []).slice(0, 10)) {
          const c = db.carnets.find((x) => x.id === cid);
          if (!c || c.prive) continue;
          const doublon = db.fiches.some((x) => (x.carnets || []).includes(cid) && nn(x.titre) === nn(f.titre));
          if (doublon) { ignorees.push({ titre: f.titre, raison: "deja note dans le carnet" }); continue; }
          if (!f.carnets.includes(cid)) f.carnets.push(cid);
          places.push(cid);
        }
        if (places.length) {
          f.carnets = f.carnets.filter((x) => x !== cp.id);
          partagees++;
        }
      }
      demo.save(db);
      return { partagees, ignorees };
    }
    case "demoPrive": {
      // Demo du demo : pas de pass requis en mode démo, on seed 4 fiches utiles.
      let cp = db.carnets.find((x) => x.prive === "1");
      if (!cp) {
        cp = { id: demo.uid("c"), nom: "Mes adresses", code: "perso-demo", adminCode: "", admin: "demo", membres: ["demo"], prive: 1 };
        db.carnets.push(cp);
      }
      const DEMO = [
        ["Météoreat", "12 rue des Marronniers, 75011 Paris", 93, "Punaise, c'était bon — le menu du soir est une leçon"],
        ["Chez Norbert", "Lyon 2e", 0, null],
        ["Café Meridian", "10 rue de la République, 69002 Lyon", 88, "Le latte du samedi matin"],
        ["Bar du Marché", "Nice", 0, null],
      ];
      let ajoutees = 0;
      for (const [titre, lieu, note, com] of DEMO) {
        if (db.fiches.some((x) => (x.carnets || []).includes(cp.id) && x.titre === titre)) continue;
        db.fiches.push({ id: demo.uid("f"), auteur: "demo", type: "adresse", cat: null, titre, lieu, note, com, photo: null, recette: null, demandeRecette: [], reacts: [], comments: [], date: new Date().toISOString().slice(0, 10), carnets: [cp.id] });
        ajoutees++;
      }
      demo.save(db);
      return { ok: true, carnetId: cp.id, ajoutees };
    }
    case "join": {
      const c = db.carnets.find((x) => x.code === String(p.code));
      if (!c) return { error: "carnet introuvable" };
      // Mêmes règles que le serveur : doublon de prénom = code de récupération,
      // et le code est obligatoire pour tout nouveau prénom (il relie le prénom à son propriétaire).
      const homonyme = (c.membres || []).find((m) => m.toLowerCase() === String(p.prenom || "").toLowerCase());
      const codeRecup = String(p.codeRecup || "").replace(/\D/g, "");
      db.codes = db.codes || {};
      if (homonyme && homonyme !== p.prenom) {
        const attendu = db.codes[c.id + "|" + homonyme];
        if (!attendu) return { error: "prenom_pris", prenom: homonyme };
        if (codeRecup !== attendu) return { error: "code_refuse", prenom: homonyme };
        p.prenom = homonyme; // reprise d'identité : le prénom est conservé
      }
      if (!/^[0-9]{4}$|^[0-9]{6}$/.test(codeRecup)) return { error: "code_manquant" };
      if (db.persoCode && codeRecup !== db.persoCode) return { error: "code_different" };
      db.persoCode = codeRecup;
      if (!c.membres.includes(p.prenom)) c.membres.push(p.prenom);
      db.codes[c.id + "|" + p.prenom] = codeRecup;
      demo.save(db);
      return { carnet: c, role: p.prenom === c.admin ? "admin" : "member" };
    }
    case "verifyAdmin": {
      const c = p.carnetId
        ? db.carnets.find((x) => x.id === p.carnetId)
        : db.carnets.find((x) => x.code === String(p.codeInvite));
      return { ok: !!c && String(c.adminCode) === String(p.code) };
    }
    case "regenerateInvite": {
      const c = db.carnets.find((x) => x.id === p.carnetId);
      if (!c) return { error: "introuvable" };
      c.code = "carnet-" + String(Math.floor(100 + Math.random() * 900));
      demo.save(db);
      return { code: c.code };
    }
    case "changeAdminCode": {
      const c = db.carnets.find((x) => x.id === p.carnetId);
      if (!c) return { error: "introuvable" };
      c.adminCode = p.newCode;
      demo.save(db);
      return { ok: true };
    }
    case "leaveCarnet": {
      const c = db.carnets.find((x) => x.id === p.carnetId);
      if (!c) return { ok: true };
      if (c.admin === p.prenom) return { error: "L'admin ne peut pas quitter son propre carnet" };
      c.membres = c.membres.filter((m) => m !== p.prenom);
      demo.save(db);
      return { ok: true };
    }
    case "rename": {
      // Même logique que le worker : doublon d'abord, renommage partout ensuite.
      const nv = String(p.nouveau || "").trim().slice(0, 20);
      const ancien = String(p.ancien || "").trim().slice(0, 20);
      if (!nv) return { error: "Prénom vide" };
      if (nv === ancien) return { error: "C'est déjà ton prénom" };
      const pris = db.carnets.filter((c) =>
        (c.membres || []).some((m) => m !== ancien && m.toLowerCase() === nv.toLowerCase())
      );
      if (pris.length) return { error: "prenom_pris", carnets: pris.map((c) => c.nom) };
      const ren = (x) => (x === ancien ? nv : x);
      for (const c of db.carnets) {
        c.membres = (c.membres || []).map(ren);
        if (c.admin === ancien) c.admin = nv;
      }
      for (const f of db.fiches) {
        f.auteur = ren(f.auteur);
        if (Array.isArray(f.reacts)) f.reacts = f.reacts.map(ren);
        if (Array.isArray(f.comments)) f.comments = f.comments.map((cm) => ({ ...cm, prenom: ren(cm.prenom) }));
        if (Array.isArray(f.demandeRecette)) f.demandeRecette = f.demandeRecette.map(ren);
      }
      for (const fl of db.flashes || []) {
        fl.auteur = ren(fl.auteur);
        if (Array.isArray(fl.reacts)) fl.reacts = fl.reacts.map(ren);
      }
      demo.save(db);
      return { ok: true, prenom: nv };
    }
    case "subscribePush":
    case "unsubscribePush":
      return { ok: true };
    case "addFiche": {
      // Anti-doublon intra-carnet (V0.4.70) : mêmes règles que le serveur.
      const nn = (t) => {
        let s = String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
        let m;
        while ((m = /^(le|la|les|l|the|el|il|lo|du|de|des|d|au|aux|a|chez)\s+/.exec(s))) s = s.slice(m[0].length);
        return s;
      };
      const cle = nn(p.fiche.titre);
      if (cle.length >= 4) {
        const d = db.fiches.find((x) =>
          (x.carnets || []).some((cid) => (p.fiche.carnets || []).includes(cid)) && nn(x.titre) === cle);
        if (d) return { error: "fiche_doublon", ficheId: d.id, titre: d.titre };
      }
      const f = { id: demo.uid("f"), reacts: [], photo: null, recette: null, demandeRecette: [], ...p.fiche };
      db.fiches.unshift(f);
      demo.save(db);
      return { fiche: f };
    }
    case "updateFiche": {
      const f = db.fiches.find((x) => x.id === p.id);
      Object.assign(f, p.patch);
      demo.save(db);
      return { fiche: f };
    }
    case "deleteFiche": {
      db.fiches = db.fiches.filter((x) => x.id !== p.id);
      demo.save(db);
      return { ok: true };
    }
    case "copierFiches": {
      // V0.4.97 (démo) : mêmes règles — on rattache la fiche, sans doublon.
      let copiees = 0;
      for (const f of db.fiches) {
        if ((p.ficheIds || []).includes(f.id) && !(f.carnets || []).includes(p.vers)) {
          f.carnets.push(p.vers); copiees++;
        }
      }
      demo.save(db);
      return { ok: true, copiees };
    }
    case "commentFlash": {
      const fl = db.flashes.find((x) => x.id === p.id);
      if (!fl) return { error: "introuvable" };
      fl.com = p.com;
      demo.save(db);
      return { ok: true, com: fl.com };
    }
    case "addFlash": {
      const fl = { id: demo.uid("fl"), reacts: [], ...p.flash };
      db.flashes.unshift(fl);
      demo.save(db);
      return { flash: fl };
    }
    case "deleteFlash": {
      db.flashes = db.flashes.filter((x) => x.id !== p.id);
      demo.save(db);
      return { ok: true };
    }
    case "react": {
      const target = (db.fiches.find((x) => x.id === p.targetId) || db.flashes.find((x) => x.id === p.targetId));
      const i = target.reacts.indexOf(p.prenom);
      if (p.on && i === -1) target.reacts.push(p.prenom);
      if (!p.on && i !== -1) target.reacts.splice(i, 1);
      demo.save(db);
      return { reacts: target.reacts };
    }
    case "demandeRecette": {
      const f = db.fiches.find((x) => x.id === p.id);
      if (!f.demandeRecette.includes(p.prenom)) f.demandeRecette.push(p.prenom);
      demo.save(db);
      return { fiche: f };
    }
    case "addComment": {
      const f = db.fiches.find((x) => x.id === p.id);
      if (!f) return { error: "introuvable" };
      const c = { id: demo.uid("cm"), prenom: p.prenom, texte: p.texte, date: new Date().toISOString() };
      (f.comments = f.comments || []).push(c);
      demo.save(db);
      return { comment: c };
    }
    case "editComment": {
      for (const f of db.fiches) {
        const c = (f.comments || []).find((x) => x.id === p.commentId);
        if (c) { c.texte = p.texte; demo.save(db); return { ok: true, texte: c.texte }; }
      }
      return { error: "introuvable" };
    }
    case "deleteComment": {
      for (const f of db.fiches) {
        if ((f.comments || []).some((x) => x.id === p.commentId)) {
          f.comments = f.comments.filter((x) => x.id !== p.commentId);
          demo.save(db);
          return { ok: true };
        }
      }
      return { ok: true };
    }
    case "setAvatar":
    case "recuperer":
      return { ok: true, carnets: db.carnets.length };
    case "go":
      return { ok: true };
    case "deleteAccount":
      // Demo : tout est deja local, l'app se reinitialise cote client.
      return { ok: true };
    case "removeMember": {
      const c = db.carnets.find((x) => x.id === p.carnetId);
      c.membres = c.membres.filter((m) => m !== p.membre);
      demo.save(db);
      return { carnet: c };
    }
    default:
      return { ok: false };
  }
}

// ------- API publiques -------
export const createCarnet = (payload) => mutate("createCarnet", payload);
export const join = (payload) => mutate("join", payload);
export const verifyAdmin = (payload) => mutate("verifyAdmin", payload);
export const superAdmin = (pass) => mutate("superAdmin", { pass });
export const regenerateInvite = (payload) => mutate("regenerateInvite", payload);
export const changeAdminCode = (payload) => mutate("changeAdminCode", payload);
export const addFiche = (fiche) => mutate("addFiche", { fiche });
export const importAdresses = (carnetId, items, deviceId) => mutate("importAdresses", { carnetId, items, deviceId });
export const rattacherAvis = (carnetId, items, deviceId) => mutate("rattacherAvis", { carnetId, items, deviceId });
export const partagerFiches = (ficheIds, carnetIds, deviceId) => mutate("partagerFiches", { ficheIds, carnetIds, deviceId });
export const copierFiches = (ficheIds, vers) => mutate("copierFiches", { ficheIds, vers });
export const demoPrive = (pass) => mutate("demoPrive", { pass });
export const updateFiche = (id, patch) => mutate("updateFiche", { id, patch });
export const deleteFiche = (id) => mutate("deleteFiche", { id });
export const setAvatar = (avatar, deviceId) => mutate("setAvatar", { avatar, deviceId });
export const recuperer = (prenom, code, deviceId) => mutate("recuperer", { prenom, code, deviceId });
export const addFlash = (flash) => mutate("addFlash", { flash });
export const commentFlash = (id, com) => mutate("commentFlash", { id, com });
export const deleteFlash = (id) => mutate("deleteFlash", { id });
export const react = (targetId, prenom, on) => mutate("react", { targetId, prenom, on });
export const addComment = (id, prenom, texte) => mutate("addComment", { id, prenom, texte });
export const editComment = (commentId, texte) => mutate("editComment", { commentId, texte });
export const deleteComment = (commentId) => mutate("deleteComment", { commentId });
export const logGo = (id) => mutate("go", { id });
export const deleteAccount = (purge) => mutate("deleteAccount", { purge });
export const demandeRecette = (id, prenom) => mutate("demandeRecette", { id, prenom });
export const removeMember = (carnetId, membre) => mutate("removeMember", { carnetId, membre });
export const leaveCarnet = (carnetId, prenom) => mutate("leaveCarnet", { carnetId, prenom });
export const rename = (ancien, nouveau) => mutate("rename", { ancien, nouveau });
export const subscribePush = (sub) => mutate("subscribePush", { sub });
export const unsubscribePush = (endpoint) => mutate("unsubscribePush", { endpoint });

// --- Notifications push : activation partagée (profil, join, accueil) ---
export async function activerNotifs() {
  const reg = await navigator.serviceWorker.ready;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, raison: "refuse" };
  const r = await fetch("/api/vapid-pub").then((x) => x.json()).catch(() => null);
  if (!r || !r.publicKey) return { ok: false, raison: "serveur" };
  const pad = "=".repeat((4 - (r.publicKey.length % 4)) % 4);
  const raw = atob((r.publicKey + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await subscribePush(sub.toJSON());
  return { ok: true };
}

export async function notifsSouscrites() {
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch (e) {
    return false;
  }
}
