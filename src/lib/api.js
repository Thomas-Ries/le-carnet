// Couche d'accès données : worker Cloudflare + D1 si déployé, sinon repli démo local.
// Identité : chaque appareil porte un ID unique (UUID) — c'est lui qui authentifie
// les sessions côté serveur, jamais le prénom seul.
import * as demo from "./demo.js";

export const state = { demoMode: false };

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
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function fallback(err) {
  state.demoMode = true;
  return demo.load();
}

// Lecture complète : carnets de cet appareil + rôles
export async function bootstrap(deviceId) {
  try {
    return await api("/api/bootstrap?device=" + encodeURIComponent(deviceId));
  } catch (e) {
    return fallback(e);
  }
}

async function mutate(action, payload) {
  try {
    return await api("/api/mutate", { action, ...payload });
  } catch (e) {
    const db = fallback(e);
    return demoMutate(db, action, payload);
  }
}

// ------- Mutations locales (démo) -------
function demoMutate(db, action, p) {
  switch (action) {
    case "createCarnet": {
      const c = { id: demo.uid("c"), nom: p.nom, code: p.codeInvite || p.code, adminCode: p.codeAdmin, admin: p.prenom, membres: [p.prenom] };
      db.carnets.push(c);
      demo.save(db);
      return { carnet: c, role: "admin" };
    }
    case "join": {
      const c = db.carnets.find((x) => x.code === String(p.code));
      if (!c) return { error: "carnet introuvable" };
      if (!c.membres.includes(p.prenom)) c.membres.push(p.prenom);
      demo.save(db);
      return { carnet: c, role: p.prenom === c.admin ? "admin" : "member" };
    }
    case "verifyAdmin": {
      const c = db.carnets.find((x) => x.id === p.carnetId);
      return { ok: !!c && String(c.adminCode) === String(p.code) };
    }
    case "regenerateInvite": {
      const c = db.carnets.find((x) => x.id === p.carnetId);
      if (!c) return { error: "introuvable" };
      c.code = String(Math.floor(100000 + Math.random() * 900000));
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
export const regenerateInvite = (payload) => mutate("regenerateInvite", payload);
export const changeAdminCode = (payload) => mutate("changeAdminCode", payload);
export const addFiche = (fiche) => mutate("addFiche", { fiche });
export const updateFiche = (id, patch) => mutate("updateFiche", { id, patch });
export const deleteFiche = (id) => mutate("deleteFiche", { id });
export const addFlash = (flash) => mutate("addFlash", { flash });
export const commentFlash = (id, com) => mutate("commentFlash", { id, com });
export const deleteFlash = (id) => mutate("deleteFlash", { id });
export const react = (targetId, prenom, on) => mutate("react", { targetId, prenom, on });
export const demandeRecette = (id, prenom) => mutate("demandeRecette", { id, prenom });
export const removeMember = (carnetId, membre) => mutate("removeMember", { carnetId, membre });
