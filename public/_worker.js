// Le Carnet — worker Cloudflare Pages (Direct Upload), backend D1.
// Prod : sessions par appareil (device_id), rôles vérifiés sur chaque mutation,
// code admin hashé (SHA-256 + sel), codes invitation/admin séparés.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

const enc = new TextEncoder();
async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashCode(code) {
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return salt + "$" + (await sha256hex(salt + code));
}
async function verifyCode(code, stored) {
  const [salt] = String(stored || "").split("$");
  if (!salt) return false;
  return salt + "$" + (await sha256hex(salt + code)) === stored;
}

const isCode = (c) => /^[0-9]{6}$/.test(String(c || ""));
const cleanPrenom = (p) => String(p || "").trim().slice(0, 20);
const cleanText = (t, n) => String(t == null ? "" : t).slice(0, n);

function newInviteCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    // ---------- Statiques ----------
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (!env.DB) return json({ error: "binding DB absent" }, 500);
    const db = env.DB;

    // ---------- Lecture ----------
    if (url.pathname === "/api/bootstrap" && request.method === "GET") {
      try {
        const device = cleanText(url.searchParams.get("device"), 64);
        const roles = {};
        let carnetIds = [];
        if (device) {
          const { results: sess } = await db.prepare(
            `SELECT carnet_id, role FROM Sessions WHERE device_id=?`
          ).bind(device).all();
          carnetIds = sess.map((s) => s.carnet_id);
          for (const s of sess) roles[s.carnet_id] = s.role;
        }
        const inClause = (n) => (n ? `(${carnetIds.map(() => "?").join(",")})` : "(NULL)");
        const bindIds = () => (carnetIds.length ? carnetIds : ["__none__"]);
        const { results: carnets } = await db.prepare(
          `SELECT * FROM Carnets WHERE id IN ${inClause(carnetIds.length)}`
        ).bind(...bindIds()).all();
        const { results: membres } = await db.prepare(
          `SELECT carnet_id, prenom FROM Membres WHERE carnet_id IN ${inClause(carnetIds.length)}`
        ).bind(...bindIds()).all();
        const { results: fichesRaw } = await db.prepare(
          `SELECT f.* FROM Fiches f JOIN FichesCarnets l ON l.fiche_id = f.id
           WHERE l.carnet_id IN ${inClause(carnetIds.length)} ORDER BY f.created_at DESC`
        ).bind(...bindIds()).all();
        const { results: liens } = await db.prepare(
          `SELECT fiche_id, carnet_id FROM FichesCarnets WHERE carnet_id IN ${inClause(carnetIds.length)}`
        ).bind(...bindIds()).all();
        const { results: likes } = await db.prepare(
          `SELECT fiche_id, prenom FROM FicheLikes`
        ).all();
        const { results: demandes } = await db.prepare(
          `SELECT fiche_id, prenom FROM DemandesRecette`
        ).all();
        const { results: flashesRaw } = await db.prepare(
          `SELECT * FROM Flashes WHERE carnet_id IN ${inClause(carnetIds.length)} AND expires_at > datetime('now')`
        ).bind(...bindIds()).all();
        const { results: reacts } = await db.prepare(
          `SELECT flash_id, prenom FROM FlashReactions`
        ).all();

        const likesByFiche = {};
        for (const l of likes) (likesByFiche[l.fiche_id] = likesByFiche[l.fiche_id] || []).push(l.prenom);
        const demByFiche = {};
        for (const d of demandes) (demByFiche[d.fiche_id] = demByFiche[d.fiche_id] || []).push(d.prenom);
        const reactsByFlash = {};
        for (const r of reacts) (reactsByFlash[r.flash_id] = reactsByFlash[r.flash_id] || []).push(r.prenom);
        const carnetsByFiche = {};
        for (const l of liens) (carnetsByFiche[l.fiche_id] = carnetsByFiche[l.fiche_id] || []).push(l.carnet_id);
        const membresByCarnet = {};
        for (const m of membres) (membresByCarnet[m.carnet_id] = membresByCarnet[m.carnet_id] || []).push(m.prenom);

        const fiches = fichesRaw.map((f) => ({
          id: f.id, auteur: f.auteur, type: f.type, cat: f.cat, titre: f.titre, lieu: f.lieu,
          note: f.note, com: f.com, photo: f.photo, recette: f.recette,
          date: f.created_at, carnets: carnetsByFiche[f.id] || [],
          reacts: likesByFiche[f.id] || [], demandeRecette: demByFiche[f.id] || [],
        }));
        const flashes = flashesRaw.map((fl) => ({
          id: fl.id, carnets: [fl.carnet_id], auteur: fl.auteur, photo: fl.photo,
          date: fl.created_at, reacts: reactsByFlash[fl.id] || [],
        }));

        const carnetsOut = carnets.map((c) => ({
          id: c.id, nom: c.nom, code: c.code, admin: c.admin,
          membres: membresByCarnet[c.id] || [],
        }));

        return json({ carnets: carnetsOut, fiches, flashes, roles });
      } catch (e) {
        return json({ error: "bootstrap: " + String((e && e.message) || e) }, 500);
      }
    }

    // ---------- Écriture ----------
    if (url.pathname === "/api/mutate" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const { action, payload } = body || {};
      const p = payload || {};
      const now = new Date().toISOString();
      const device = cleanText(p.deviceId, 64);

      const sessionOf = async (carnetId) => {
        const r = await db.prepare(
          `SELECT prenom, role FROM Sessions WHERE carnet_id=? AND device_id=?`
        ).bind(carnetId, device).all();
        return r.results[0] || null;
      };
      const isAdminOf = async (carnetId) => {
        const s = await sessionOf(carnetId);
        return !!s && s.role === "admin";
      };

      try {
        switch (action) {
          case "createCarnet": {
            const nom = cleanText(p.nom, 24).trim();
            const prenom = cleanPrenom(p.prenom);
            if (!nom || !prenom || !isCode(p.codeAdmin)) return json({ error: "champs invalides" }, 400);
            let code = isCode(p.codeInvite) ? p.codeInvite : newInviteCode();
            for (let i = 0; i < 5; i++) {
              const dup = await db.prepare(`SELECT id FROM Carnets WHERE code=?`).bind(code).first();
              if (!dup) break;
              code = newInviteCode();
            }
            const id = crypto.randomUUID();
            const hash = await hashCode(p.codeAdmin);
            await db.prepare(
              `INSERT INTO Carnets (id, nom, code, admin, admin_code_hash, created_at) VALUES (?,?,?,?,?,?)`
            ).bind(id, nom, code, prenom, hash, now).run();
            await db.prepare(`INSERT INTO Membres (carnet_id, prenom) VALUES (?,?)`).bind(id, prenom).run();
            await db.prepare(
              `INSERT INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
            ).bind(device, id, prenom, "admin", now).run();
            return json({ carnet: { id, nom, code, admin: prenom, membres: [prenom] }, role: "admin" });
          }

          case "join": {
            const prenom = cleanPrenom(p.prenom);
            if (!prenom || !isCode(p.code)) return json({ error: "champs invalides" }, 400);
            const c = await db.prepare(`SELECT * FROM Carnets WHERE code=?`).bind(p.code).first();
            if (!c) return json({ error: "carnet introuvable" }, 404);
            const deja = await db.prepare(`SELECT 1 FROM Membres WHERE carnet_id=? AND prenom=?`).bind(c.id, prenom).first();
            if (!deja) await db.prepare(`INSERT INTO Membres (carnet_id, prenom) VALUES (?,?)`).bind(c.id, prenom).run();
            await db.prepare(
              `INSERT OR REPLACE INTO Sessions (device_id, carnet_id, prenom, role, created_at)
               VALUES (?,?,?, COALESCE((SELECT role FROM Sessions WHERE device_id=? AND carnet_id=?), 'member'), ?)`
            ).bind(device, c.id, prenom, device, c.id, now).run();
            const { results: membres } = await db.prepare(`SELECT prenom FROM Membres WHERE carnet_id=?`).bind(c.id).all();
            return json({ carnet: { id: c.id, nom: c.nom, code: c.code, admin: c.admin, membres: membres.map((m) => m.prenom) }, role: "member" });
          }

          case "verifyAdmin": {
            if (!isCode(p.code)) return json({ error: "code invalide" }, 400);
            const c = await db.prepare(`SELECT * FROM Carnets WHERE id=?`).bind(p.carnetId).first();
            if (!c) return json({ error: "carnet introuvable" }, 404);
            if (!(await verifyCode(p.code, c.admin_code_hash))) return json({ ok: false }, 200);
            const s = await sessionOf(c.id);
            await db.prepare(
              `INSERT OR REPLACE INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
            ).bind(device, c.id, s ? s.prenom : cleanPrenom(p.prenom), "admin", now).run();
            return json({ ok: true, role: "admin" });
          }

          case "regenerateInvite": {
            if (!(await isAdminOf(p.carnetId))) return json({ error: "réservé à l'admin" }, 403);
            let code = newInviteCode();
            for (let i = 0; i < 5; i++) {
              const dup = await db.prepare(`SELECT id FROM Carnets WHERE code=? AND id<>?`).bind(code, p.carnetId).first();
              if (!dup) break;
              code = newInviteCode();
            }
            await db.prepare(`UPDATE Carnets SET code=? WHERE id=?`).bind(code, p.carnetId).run();
            return json({ code });
          }

          case "changeAdminCode": {
            if (!isCode(p.newCode)) return json({ error: "code invalide" }, 400);
            if (!(await isAdminOf(p.carnetId))) return json({ error: "réservé à l'admin" }, 403);
            await db.prepare(`UPDATE Carnets SET admin_code_hash=? WHERE id=?`)
              .bind(await hashCode(p.newCode), p.carnetId).run();
            return json({ ok: true });
          }

          case "addFiche": {
            const f = p.fiche || {};
            const s = await sessionOf(f.carnets && f.carnets[0]);
            if (!s) return json({ error: "pas membre" }, 403);
            const id = crypto.randomUUID();
            const note = Math.min(100, Math.max(70, parseInt(f.note, 10) || 80));
            await db.prepare(
              `INSERT INTO Fiches (id, auteur, type, cat, titre, lieu, note, com, photo, recette, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`
            ).bind(id, cleanPrenom(f.auteur), cleanText(f.type, 10), cleanText(f.cat, 20),
              cleanText(f.titre, 60), cleanText(f.lieu, 60), note, cleanText(f.com, 500),
              typeof f.photo === "string" ? f.photo.slice(0, 400000) : null,
              cleanText(f.recette, 4000), now).run();
            for (const cid of (Array.isArray(f.carnets) ? f.carnets : []).slice(0, 20)) {
              const membre = await sessionOf(cid);
              if (membre) await db.prepare(`INSERT INTO FichesCarnets (fiche_id, carnet_id) VALUES (?,?)`).bind(id, cid).run();
            }
            return json({ fiche: { id, auteur: f.auteur, type: f.type, cat: f.cat, titre: f.titre, lieu: f.lieu,
              note, com: f.com, photo: f.photo || null, recette: f.recette || null, date: now,
              carnets: f.carnets || [], reacts: [], demandeRecette: [] } });
          }

          case "updateFiche": {
            const f = await db.prepare(`SELECT * FROM Fiches WHERE id=?`).bind(p.id).first();
            if (!f) return json({ error: "introuvable" }, 404);
            const patch = p.patch || {};
            const adminNimporte = await (async () => {
              const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(p.id).all();
              for (const l of liens) if (await isAdminOf(l.carnet_id)) return true;
              return false;
            })();
            const s = f.auteur ? await (async () => {
              const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(p.id).all();
              for (const l of liens) {
                const sess = await sessionOf(l.carnet_id);
                if (sess && sess.prenom === f.auteur) return sess;
              }
              return null;
            })() : null;
            if (!adminNimporte && !s) return json({ error: "réservé à l'auteur ou l'admin" }, 403);
            await db.prepare(
              `UPDATE Fiches SET titre=COALESCE(?,titre), com=COALESCE(?,com), recette=COALESCE(?,recette), note=COALESCE(?,note) WHERE id=?`
            ).bind(patch.titre != null ? cleanText(patch.titre, 60) : null,
              patch.com != null ? cleanText(patch.com, 500) : null,
              patch.recette != null ? cleanText(patch.recette, 4000) : null,
              patch.note != null ? Math.min(100, Math.max(70, parseInt(patch.note, 10) || 80)) : null,
              p.id).run();
            return json({ ok: true });
          }

          case "deleteFiche": {
            const f = await db.prepare(`SELECT * FROM Fiches WHERE id=?`).bind(p.id).first();
            if (!f) return json({ ok: true });
            const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(p.id).all();
            let autorise = false;
            for (const l of liens) {
              const sess = await sessionOf(l.carnet_id);
              if (sess && (sess.role === "admin" || sess.prenom === f.auteur)) { autorise = true; break; }
            }
            if (!autorise) return json({ error: "réservé à l'auteur ou l'admin" }, 403);
            await db.prepare(`DELETE FROM Fiches WHERE id=?`).bind(p.id).run();
            await db.prepare(`DELETE FROM FichesCarnets WHERE fiche_id=?`).bind(p.id).run();
            await db.prepare(`DELETE FROM FicheLikes WHERE fiche_id=?`).bind(p.id).run();
            await db.prepare(`DELETE FROM DemandesRecette WHERE fiche_id=?`).bind(p.id).run();
            return json({ ok: true });
          }

          case "addFlash": {
            const fl = p.flash || {};
            const s = await sessionOf(fl.carnetId);
            if (!s) return json({ error: "pas membre" }, 403);
            const id = crypto.randomUUID();
            const expires = new Date(Date.now() + 7 * 864e5).toISOString();
            await db.prepare(
              `INSERT INTO Flashes (id, carnet_id, auteur, photo, created_at, expires_at) VALUES (?,?,?,?,?,?)`
            ).bind(id, fl.carnetId, s.prenom, typeof fl.photo === "string" ? fl.photo.slice(0, 400000) : "", now, expires).run();
            return json({ flash: { id, carnets: [fl.carnetId], auteur: s.prenom, photo: fl.photo, date: now, reacts: [] } });
          }

          case "deleteFlash": {
            const fl = await db.prepare(`SELECT * FROM Flashes WHERE id=?`).bind(p.id).first();
            if (!fl) return json({ ok: true });
            const s = await sessionOf(fl.carnet_id);
            if (!s || (s.role !== "admin" && s.prenom !== fl.auteur)) return json({ error: "réservé à l'auteur ou l'admin" }, 403);
            await db.prepare(`DELETE FROM Flashes WHERE id=?`).bind(p.id).run();
            await db.prepare(`DELETE FROM FlashReactions WHERE flash_id=?`).bind(p.id).run();
            return json({ ok: true });
          }

          case "react": {
            const onFiche = await db.prepare(`SELECT id FROM Fiches WHERE id=?`).bind(p.targetId).first();
            const onFlash = await db.prepare(`SELECT id, carnet_id FROM Flashes WHERE id=?`).bind(p.targetId).first();
            let prenom = cleanPrenom(p.prenom);
            if (onFiche) {
              const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(p.targetId).all();
              let ok = false;
              for (const l of liens) { if (await sessionOf(l.carnet_id)) { ok = true; break; } }
              if (!ok) return json({ error: "pas membre" }, 403);
              if (p.on) await db.prepare(`INSERT OR IGNORE INTO FicheLikes (fiche_id, prenom) VALUES (?,?)`).bind(p.targetId, prenom).run();
              else await db.prepare(`DELETE FROM FicheLikes WHERE fiche_id=? AND prenom=?`).bind(p.targetId, prenom).run();
              const { results: likes } = await db.prepare(`SELECT prenom FROM FicheLikes WHERE fiche_id=?`).bind(p.targetId).all();
              return json({ reacts: likes.map((l) => l.prenom) });
            }
            if (onFlash) {
              const s = await sessionOf(onFlash.carnet_id);
              if (!s) return json({ error: "pas membre" }, 403);
              if (p.on) await db.prepare(`INSERT OR IGNORE INTO FlashReactions (flash_id, prenom) VALUES (?,?)`).bind(p.targetId, s.prenom).run();
              else await db.prepare(`DELETE FROM FlashReactions WHERE flash_id=? AND prenom=?`).bind(p.targetId, s.prenom).run();
              const { results: rs } = await db.prepare(`SELECT prenom FROM FlashReactions WHERE flash_id=?`).bind(p.targetId).all();
              return json({ reacts: rs.map((r) => r.prenom) });
            }
            return json({ error: "cible introuvable" }, 404);
          }

          case "demandeRecette": {
            const f = await db.prepare(`SELECT * FROM Fiches WHERE id=?`).bind(p.id).first();
            if (!f) return json({ error: "introuvable" }, 404);
            const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(p.id).all();
            let prenom = null;
            for (const l of liens) {
              const s = await sessionOf(l.carnet_id);
              if (s) { prenom = s.prenom; break; }
            }
            if (!prenom) return json({ error: "pas membre" }, 403);
            await db.prepare(`INSERT OR IGNORE INTO DemandesRecette (fiche_id, prenom, created_at) VALUES (?,?,?)`)
              .bind(p.id, prenom, now).run();
            const { results: dem } = await db.prepare(`SELECT prenom FROM DemandesRecette WHERE fiche_id=?`).bind(p.id).all();
            return json({ fiche: { demandeRecette: dem.map((d) => d.prenom) } });
          }

          case "leaveCarnet": {
            const c = await db.prepare(`SELECT * FROM Carnets WHERE id=?`).bind(p.carnetId).first();
            if (!c) return json({ ok: true });
            const s = await sessionOf(c.id);
            if (!s) return json({ error: "tu n'es pas dans ce carnet" }, 404);
            if (s.role === "admin" || s.prenom === c.admin) {
              return json({ error: "L'admin ne peut pas quitter son propre carnet" }, 403);
            }
            await db.prepare(`DELETE FROM Sessions WHERE carnet_id=? AND device_id=?`).bind(c.id, device).run();
            const autre = await db.prepare(`SELECT 1 FROM Sessions WHERE carnet_id=? AND prenom=?`).bind(c.id, s.prenom).first();
            if (!autre) await db.prepare(`DELETE FROM Membres WHERE carnet_id=? AND prenom=?`).bind(c.id, s.prenom).run();
            return json({ ok: true });
          }

          case "removeMember": {
            const c = await db.prepare(`SELECT * FROM Carnets WHERE id=?`).bind(p.carnetId).first();
            if (!c) return json({ error: "introuvable" }, 404);
            if (!(await isAdminOf(p.carnetId))) return json({ error: "réservé à l'admin" }, 403);
            const membre = cleanPrenom(p.membre);
            if (membre === c.admin) return json({ error: "impossible de retirer l'admin" }, 403);
            await db.prepare(`DELETE FROM Membres WHERE carnet_id=? AND prenom=?`).bind(p.carnetId, membre).run();
            await db.prepare(`DELETE FROM Sessions WHERE carnet_id=? AND prenom=?`).bind(p.carnetId, membre).run();
            const { results: membres } = await db.prepare(`SELECT prenom FROM Membres WHERE carnet_id=?`).bind(p.carnetId).all();
            return json({ carnet: { id: c.id, nom: c.nom, code: c.code, admin: c.admin, membres: membres.map((m) => m.prenom) } });
          }

          default:
            return json({ error: "unknown action" }, 400);
        }
      } catch (e) {
        return json({ error: "mutate: " + String((e && e.message) || e) }, 500);
      }
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
