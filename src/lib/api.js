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
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
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

function fallback(err) {
  state.demoMode = true;
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
    return r;
  } catch (e) {
    etaitDemo = true;
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
    const db = fallbackConnexion(e);
    return demoMutate(db, action, payload);
  }
}

// ------- Mutations locales (démo) -------
function demoMutate(db, action, p) {
  switch (action) {
    case "createCarnet": {
      const c = { id: demo.uid("c"), nom: p.nom, code: p.codeInvite || "carnet-" + String(Math.floor(100 + Math.random() * 900)), adminCode: p.codeAdmin, admin: p.prenom, membres: [p.prenom] };
      db.carnets.push(c);
      demo.save(db);
      return { carnet: c, role: "admin" };
    }
    case "join": {
      const c = db.carnets.find((x) => x.code === String(p.code));
      if (!c) return { error: "carnet introuvable" };
      // Pas de doublon de prénom dans un carnet (même règle que le serveur)
      const homonyme = (c.membres || []).find((m) => m.toLowerCase() === String(p.prenom || "").toLowerCase());
      if (homonyme && homonyme !== p.prenom) return { error: "prenom_pris", prenom: homonyme };
      if (!c.membres.includes(p.prenom)) c.membres.push(p.prenom);
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
    case "subscribePush":
    case "unsubscribePush":
      return { ok: true };
    case "addFiche": {
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
export const updateFiche = (id, patch) => mutate("updateFiche", { id, patch });
export const deleteFiche = (id) => mutate("deleteFiche", { id });
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