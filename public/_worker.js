// Le Carnet — worker Cloudflare Pages (Direct Upload), backend D1.
// Deux routes seulement : bootstrap (lecture) et mutate (écriture).
// Le schéma D1 est dans schema.sql à la racine du repo.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    if (url.pathname === "/api/bootstrap" && request.method === "GET") {
      const { results: carnets } = await env.DB.prepare(
        `SELECT * FROM Carnets`
      ).all();
      const { results: membres } = await env.DB.prepare(
        `SELECT carnet_id, prenom, role FROM Membres`
      ).all();
      const { results: fiches } = await env.DB.prepare(
        `SELECT * FROM Fiches ORDER BY created_at DESC`
      ).all();
      const { results: liens } = await env.DB.prepare(
        `SELECT fiche_id, carnet_id FROM FichesCarnets`
      ).all();
      const { results: flashes } = await env.DB.prepare(
        `SELECT * FROM Flashes WHERE expires_at > datetime('now')`
      ).all();
      const { results: reacts } = await env.DB.prepare(
        `SELECT flash_id, prenom FROM FlashReactions`
      ).all();
      const { results: likes } = await env.DB.prepare(
        `SELECT fiche_id, prenom FROM FicheLikes`
      ).all();
      return json({ carnets, membres, fiches, liens, flashes, reacts, likes });
    }

    if (url.pathname === "/api/mutate" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const { action, payload } = body || {};
      const db = env.DB;
      const now = new Date().toISOString();

      try {
        switch (action) {
          case "createCarnet": {
            // NOTE SÉCURITÉ V1 : le code admin doit être hashé (SHA-256 + sel) côté serveur.
            const { id, nom, code, adminCode, admin } = payload;
            await db.prepare(`INSERT INTO Carnets (id, nom, code, admin, admin_code, created_at) VALUES (?,?,?,?,?,?)`)
              .bind(id, nom, code, admin, adminCode, now).run();
            await db.prepare(`INSERT INTO Membres (carnet_id, prenom, role) VALUES (?,?,?)`)
              .bind(id, admin, "admin").run();
            return json({ ok: true, id });
          }
          case "addFiche": {
            const f = payload;
            await db.prepare(
              `INSERT INTO Fiches (id, auteur, type, cat, titre, lieu, note, com, photo, recette, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`
            ).bind(f.id, f.auteur, f.type, f.cat, f.titre, f.lieu, f.note, f.com, f.photo, f.recette, now).run();
            for (const cid of f.carnets) {
              await db.prepare(`INSERT INTO FichesCarnets (fiche_id, carnet_id) VALUES (?,?)`).bind(f.id, cid).run();
            }
            return json({ ok: true, id: f.id });
          }
          case "updateFiche": {
            const { id, patch } = payload;
            const f = patch;
            await db.prepare(
              `UPDATE Fiches SET titre=COALESCE(?,titre), com=COALESCE(?,com), recette=COALESCE(?,recette), note=COALESCE(?,note) WHERE id=?`
            ).bind(f.titre ?? null, f.com ?? null, f.recette ?? null, f.note ?? null, id).run();
            return json({ ok: true });
          }
          case "deleteFiche": {
            await db.prepare(`DELETE FROM Fiches WHERE id=?`).bind(payload.id).run();
            await db.prepare(`DELETE FROM FichesCarnets WHERE fiche_id=?`).bind(payload.id).run();
            await db.prepare(`DELETE FROM FicheLikes WHERE fiche_id=?`).bind(payload.id).run();
            return json({ ok: true });
          }
          case "addFlash": {
            const fl = payload;
            const expires = new Date(Date.now() + 7 * 864e5).toISOString();
            await db.prepare(
              `INSERT INTO Flashes (id, carnet_id, auteur, photo, created_at, expires_at) VALUES (?,?,?,?,?,?)`
            ).bind(fl.id, fl.carnetId, fl.auteur, fl.photo, now, expires).run();
            return json({ ok: true });
          }
          case "deleteFlash": {
            await db.prepare(`DELETE FROM Flashes WHERE id=?`).bind(payload.id).run();
            await db.prepare(`DELETE FROM FlashReactions WHERE flash_id=?`).bind(payload.id).run();
            return json({ ok: true });
          }
          case "react": {
            const { flashId, prenom, on } = payload;
            if (on) await db.prepare(`INSERT OR IGNORE INTO FlashReactions (flash_id, prenom) VALUES (?,?)`).bind(flashId, prenom).run();
            else await db.prepare(`DELETE FROM FlashReactions WHERE flash_id=? AND prenom=?`).bind(flashId, prenom).run();
            return json({ ok: true });
          }
          case "demandeRecette": {
            const { ficheId, prenom } = payload;
            await db.prepare(`INSERT OR IGNORE INTO DemandesRecette (fiche_id, prenom, created_at) VALUES (?,?,?)`)
              .bind(ficheId, prenom, now).run();
            return json({ ok: true });
          }
          case "removeMember": {
            const { carnetId, prenom } = payload;
            await db.prepare(`DELETE FROM Membres WHERE carnet_id=? AND prenom=?`).bind(carnetId, prenom).run();
            return json({ ok: true });
          }
          default:
            return json({ error: "unknown action" }, 400);
        }
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
