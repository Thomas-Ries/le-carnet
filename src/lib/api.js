// Couche d'accès données : worker Cloudflare + D1 si déployé, sinon repli démo local.
// Chaque fonction tente l'API ; en cas d'échec (404 / réseau), bascule sur la démo locale
// et lève le drapeau demoMode — l'app ne casse jamais (pattern Soirées Cavistes v1.1).
import * as demo from "./demo.js";

export const state = { demoMode: false };

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

// Lecture complète (carnets, fiches, flashes du membre)
export async function bootstrap() {
  try {
    return await api("/api/bootstrap");
  } catch (e) {
    return fallback(e);
  }
}

async function mutate(action, payload) {
  try {
    return await api("/api/mutate", { action, ...payload });
  } catch (e) {
    const db = fallback(e);
    const r = demoMutate(db, action, payload);
    return r;
  }
}

// ------- Mutations locales (démo) -------
function demoMutate(db, action, p) {
  switch (action) {
    case "createCarnet": {
      const c = { id: demo.uid("c"), nom: p.nom, code: p.code, adminCode: p.adminCode, admin: p.prenom, membres: [p.prenom] };
      db.carnets.push(c);
      demo.save(db);
      return { carnet: c };
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
      if (!f.demandeRecette.includes(p.par)) f.demandeRecette.push(p.par);
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
export const addFiche = (fiche) => mutate("addFiche", { fiche });
export const updateFiche = (id, patch) => mutate("updateFiche", { id, patch });
export const deleteFiche = (id) => mutate("deleteFiche", { id });
export const addFlash = (flash) => mutate("addFlash", { flash });
export const deleteFlash = (id) => mutate("deleteFlash", { id });
export const react = (targetId, prenom, on) => mutate("react", { targetId, prenom, on });
export const demandeRecette = (id, par) => mutate("demandeRecette", { id, par });
export const removeMember = (carnetId, membre) => mutate("removeMember", { carnetId, membre });
