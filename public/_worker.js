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

// ---------- Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID ES256), 100% WebCrypto ----------
const wpB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const wpB64uDec = (s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function wpHkdf(ikm, salt, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  const base = await crypto.subtle.sign("HMAC", key, new Uint8Array([...salt, ...info, 1]));
  return new Uint8Array(base.slice(0, len));
}
async function wpEncrypt(payload, p256dhB64, authB64) {
  const plaintext = new Uint8Array([...enc.encode(payload), 2]);
  const uaPublic = await crypto.subtle.importKey("raw", wpB64uDec(p256dhB64), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const serverKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublic }, serverKP.privateKey, 256));
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKP.publicKey));
  const ikm = await wpHkdf(ecdh, wpB64uDec(authB64),
    new Uint8Array([...enc.encode("WebPush: info"), 0, ...wpB64uDec(p256dhB64), ...serverPubRaw]), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await wpHkdf(ikm, salt, new Uint8Array([...enc.encode("Content-Encoding: aes128gcm"), 0]), 16);
  const nonce = await wpHkdf(ikm, salt, new Uint8Array([...enc.encode("Content-Encoding: nonce"), 0]), 12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce },
    await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]), plaintext));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return new Uint8Array([...salt, ...rs, 65, ...serverPubRaw, ...ct]);
}
async function wpVapidHeader(endpoint, privB64, pubB64) {
  const unsigned = wpB64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))) + "." +
    wpB64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:contact@le-carnet.pages.dev" })));
  const key = await crypto.subtle.importKey("pkcs8", wpB64uDec(privB64), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)));
  const int2 = (u8) => (u8[0] & 0x80 ? [2, u8.length + 1, 0, ...u8] : [2, u8.length, ...u8]);
  const ir = int2(raw.slice(0, 32)), is = int2(raw.slice(32));
  const der = new Uint8Array([0x30, ir.length + is.length, ...ir, ...is]);
  return { auth: "vapid t=" + unsigned + "." + wpB64u(der), cryptoKey: "p256ecdsa=" + pubB64 };
}
async function sendPushTo(env, db, deviceIds, payload) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !deviceIds || !deviceIds.length) return;
  const uniq = [...new Set(deviceIds)];
  const { results: subs } = await db.prepare(
    `SELECT * FROM PushSubscriptions WHERE device_id IN (${uniq.map(() => "?").join(",")})`
  ).bind(...uniq).all();
  for (const sub of subs) {
    try {
      const body = await wpEncrypt(JSON.stringify(payload), sub.p256dh, sub.auth);
      const v = await wpVapidHeader(sub.endpoint, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
      const res = await fetch(sub.endpoint, {
        method: "POST",
        headers: { TTL: "86400", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: v.auth, "Crypto-Key": v.cryptoKey },
        body,
      });
      if (res.status === 404 || res.status === 410) {
        await db.prepare(`DELETE FROM PushSubscriptions WHERE endpoint=?`).bind(sub.endpoint).run();
      }
    } catch (e) { /* une notif échouée ne doit jamais bloquer la mutation */ }
  }
}
const devicesOfCarnet = async (db, carnetId, exceptPrenom) => {
  const { results } = await db.prepare(
    `SELECT DISTINCT device_id, prenom FROM Sessions WHERE carnet_id=?`
  ).bind(carnetId).all();
  return results.filter((r) => r.prenom !== exceptPrenom).map((r) => r.device_id);
};

// Analytics minimal : chaque evenement = une ligne Events. Echec toujours silencieux.
const logEvent = (db, type, o) =>
  db.prepare(`INSERT INTO Events (type, device_id, prenom, carnet_id, meta, created_at) VALUES (?,?,?,?,?,?)`)
    .bind(type, cleanText(o.device, 64) || null, cleanText(o.prenom, 20) || null,
      cleanText(o.carnet, 64) || null, o.meta ? cleanText(JSON.stringify(o.meta), 200) : null,
      new Date().toISOString())
    .run()
    .catch(() => {});
const ensureEvents = (db) =>
  db.prepare(`CREATE TABLE IF NOT EXISTS Events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, device_id TEXT,
    prenom TEXT, carnet_id TEXT, meta TEXT, created_at TEXT NOT NULL)`)
    .run().catch(() => {});
const ensureComments = (db) =>
  db.prepare(`CREATE TABLE IF NOT EXISTS FicheComments (
    id TEXT PRIMARY KEY, fiche_id TEXT NOT NULL, prenom TEXT NOT NULL,
    texte TEXT NOT NULL, created_at TEXT NOT NULL)`)
    .run().catch(() => {});

const isCode = (c) => /^([0-9]{4}|[0-9]{6})$/.test(String(c || ""));
const cleanPrenom = (p) => String(p || "").trim().slice(0, 20);
const cleanText = (t, n) => String(t == null ? "" : t).slice(0, n);

// Invitation : MOT-CLÉ 4-15 caractères, minuscules sans accents, chiffres et tirets.
// « Pâques 2027 » -> « paques-2027 ». Retourne "" si invalide.
function cleanInvite(v) {
  if (typeof v !== "string") return "";
  let s = v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 15);
  return /^[a-z0-9-]{4,15}$/.test(s) ? s : "";
}
// Mot-clé d'invitation auto : syllabes prononçables, ex. « mira-liso-42 »
function newInviteMot() {
  const syl = ["ba","de","fa","gi","lo","mi","na","pa","ra","so","ta","vi","za","lu","ke","mo","ri","sa","to","vi","ne","la"];
  let m = "";
  for (let i = 0; i < 3; i++) m += syl[Math.floor(Math.random() * syl.length)];
  m += "-" + String(Math.floor(100 + Math.random() * 900));
  return m.slice(0, 15);
}
function newInviteCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    // ---------- Statiques ----------
    // Lien court d'invitation : /join/<mot-clé> sert l'app (index.html).
    // Le client convertit le chemin en route hash au démarrage (main.js).
    if (request.method === "GET" && url.pathname.startsWith("/join/")) {
      return env.ASSETS.fetch(new Request(new URL("/", url), request));
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (!env.DB) return json({ error: "binding DB absent" }, 500);
    const db = env.DB;

    // ---------- Lecture ----------
    if (url.pathname === "/api/bootstrap" && request.method === "GET") {
      try {
        const device = cleanText(url.searchParams.get("device"), 64);
        await ensureEvents(db);
        await ensureComments(db);
        logEvent(db, "open", { device });
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
        const bindIds = () => (carnetIds.length ? carnetIds : []);
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
        const { results: coms } = await db.prepare(
          `SELECT c.id, c.fiche_id, c.prenom, c.texte, c.created_at FROM FicheComments c
           JOIN FichesCarnets l ON l.fiche_id = c.fiche_id
           WHERE l.carnet_id IN ${inClause(carnetIds.length)} ORDER BY c.created_at ASC`
        ).bind(...bindIds()).all();
        // Flashes expirés : commentés -> fiche "en attente" (note 0), sinon purge
        const { results: expiresRaw } = await db.prepare(
          `SELECT * FROM Flashes WHERE expires_at <= datetime('now')`
        ).all();
        for (const fl of expiresRaw) {
          if (fl.com) {
            const fid = "conv-" + fl.id;
            await db.prepare(
              `INSERT OR IGNORE INTO Fiches (id, auteur, type, cat, titre, lieu, note, com, photo, recette, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
            ).bind(fid, fl.auteur, "adresse", null, fl.com.slice(0, 60), "", 0, fl.com.slice(0, 500), fl.photo || "", null, fl.created_at).run();
            await db.prepare(`INSERT OR IGNORE INTO FichesCarnets (fiche_id, carnet_id) VALUES (?,?)`).bind(fid, fl.carnet_id).run();
            await db.prepare(`INSERT OR IGNORE INTO FicheLikes (fiche_id, prenom) SELECT ?, prenom FROM FlashReactions WHERE flash_id=?`).bind(fid, fl.id).run();
          }
          await db.prepare(`DELETE FROM FlashReactions WHERE flash_id=?`).bind(fl.id).run();
          await db.prepare(`DELETE FROM Flashes WHERE id=?`).bind(fl.id).run();
        }
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
        const comsByFiche = {};
        for (const c of coms) (comsByFiche[c.fiche_id] = comsByFiche[c.fiche_id] || [])
          .push({ id: c.id, prenom: c.prenom, texte: c.texte, date: c.created_at });
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
          comments: comsByFiche[f.id] || [],
        }));
        // Rappel J-6 : flash qui expire sous 24h, pas encore rappelé -> notification à son auteur
        if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
          const { results: dues } = await db.prepare(
            `SELECT * FROM Flashes WHERE reminded_at IS NULL AND expires_at <= datetime('now', '+1 day') AND expires_at > datetime('now')`
          ).all();
          for (const fl of dues) {
            const { results: mes } = await db.prepare(
              `SELECT DISTINCT device_id FROM Sessions WHERE carnet_id=? AND prenom=?`
            ).bind(fl.carnet_id, fl.auteur).all();
            sendPushTo(env, db, mes.map((m) => m.device_id), {
              title: "Ton flash expire demain",
              body: "Il ne reste qu’un jour pour le noter en fiche — ou pour le faire aimer ♥",
              url: "/",
            }).catch(() => {});
            await db.prepare(`UPDATE Flashes SET reminded_at=? WHERE id=?`).bind(new Date().toISOString(), fl.id).run();
          }
        }
        const flashes = flashesRaw.map((fl) => ({
          id: fl.id, carnets: [fl.carnet_id], auteur: fl.auteur, photo: fl.photo, com: fl.com || null,
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

    // ---------- Clé publique push ----------
    if (url.pathname === "/api/vapid-pub" && request.method === "GET") {
      return json({ publicKey: env.VAPID_PUBLIC_KEY || null });
    }

    // ---------- Écriture ----------
    if (url.pathname === "/api/mutate" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const { action, payload } = body || {};
      // Tolérant aux deux formats : payload imbriqué OU champs à plat (les bundles
      // client en cache envoient { action, deviceId, ...champs } sans enveloppe payload).
      const p = payload || (action ? body : {});
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
            if (!nom) return json({ error: "Le nom du carnet est manquant." }, 400);
            if (!prenom) return json({ error: "Ton prénom est manquant — renseigne-le dans Profil, puis recrée ton carnet." }, 400);
            if (!isCode(p.codeAdmin)) return json({ error: "Le code admin doit contenir 4 ou 6 chiffres." }, 400);
            let code = cleanInvite(p.codeInvite);
            if (String(p.codeInvite || "").trim() && !code)
              return json({ error: "Le mot-clé d'invitation doit faire 4 à 15 caractères (lettres sans accents, chiffres, tirets)." }, 400);
            if (!code) code = newInviteMot();
            for (let i = 0; i < 5; i++) {
              const dup = await db.prepare(`SELECT id FROM Carnets WHERE code=?`).bind(code).first();
              if (!dup) break;
              code = newInviteMot();
            }
            if (p.codeAdmin === code) return json({ error: "Le code admin doit être différent du mot-clé d'invitation — sinon n'importe quel invité pourrait reprendre le carnet en admin." }, 400);
            const id = crypto.randomUUID();
            const hash = await hashCode(p.codeAdmin);
            await db.prepare(
              `INSERT INTO Carnets (id, nom, code, admin, admin_code_hash, created_at) VALUES (?,?,?,?,?,?)`
            ).bind(id, nom, code, prenom, hash, now).run();
            await db.prepare(`INSERT INTO Membres (carnet_id, prenom) VALUES (?,?)`).bind(id, prenom).run();
            await db.prepare(
              `INSERT INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
            ).bind(device, id, prenom, "admin", now).run();
            logEvent(db, "create_carnet", { device, prenom, carnet: id });
            return json({ carnet: { id, nom, code, admin: prenom, membres: [prenom] }, role: "admin" });
          }

          case "join": {
            const prenom = cleanPrenom(p.prenom);
            if (!prenom) return json({ error: "Ton prénom est manquant — renseigne-le dans Profil." }, 400);
            const invite = cleanInvite(p.code);
            if (!invite) return json({ error: "Le mot-clé du carnet doit faire 4 à 15 caractères (lettres sans accents, chiffres, tirets)." }, 400);
            const c = await db.prepare(`SELECT * FROM Carnets WHERE code=?`).bind(invite).first();
            if (!c) return json({ error: "carnet introuvable" }, 404);
            // Doublon de prénom dans le carnet (insensible à la casse) : refus, sauf retour
            // d'un appareil qui porte déjà ce prénom là (changement d'appareil du même membre).
            const maSession = await sessionOf(c.id);
            const homonyme = await db.prepare(
              `SELECT prenom FROM Membres WHERE carnet_id=? AND LOWER(prenom)=LOWER(?)`
            ).bind(c.id, prenom).first();
            if (homonyme && (!maSession || maSession.prenom.toLowerCase() !== prenom.toLowerCase())) {
              return json({ error: "prenom_pris", prenom: homonyme.prenom }, 409);
            }
            const deja = await db.prepare(`SELECT 1 FROM Membres WHERE carnet_id=? AND prenom=?`).bind(c.id, prenom).first();
            if (!deja) await db.prepare(`INSERT INTO Membres (carnet_id, prenom) VALUES (?,?)`).bind(c.id, prenom).run();
            await db.prepare(
              `INSERT OR REPLACE INTO Sessions (device_id, carnet_id, prenom, role, created_at)
               VALUES (?,?,?, COALESCE((SELECT role FROM Sessions WHERE device_id=? AND carnet_id=?), 'member'), ?)`
            ).bind(device, c.id, prenom, device, c.id, now).run();
            const { results: membres } = await db.prepare(`SELECT prenom FROM Membres WHERE carnet_id=?`).bind(c.id).all();
            logEvent(db, "join", { device, prenom, carnet: c.id });
            return json({ carnet: { id: c.id, nom: c.nom, code: c.code, admin: c.admin, membres: membres.map((m) => m.prenom) }, role: "member" });
          }

          case "verifyAdmin": {
            // Identification par id (appareil qui voit déjà le carnet) OU par code
            // d'invitation (récupération admin sur un nouvel appareil, après réinstallation).
            if (!isCode(p.code)) return json({ error: "code admin invalide — 4 ou 6 chiffres." }, 400);
            const c = p.carnetId
              ? await db.prepare(`SELECT * FROM Carnets WHERE id=?`).bind(p.carnetId).first()
              : cleanInvite(p.codeInvite)
                ? await db.prepare(`SELECT * FROM Carnets WHERE code=?`).bind(cleanInvite(p.codeInvite)).first()
                : null;
            if (!c) return json({ error: "carnet introuvable" }, 404);
            if (!(await verifyCode(p.code, c.admin_code_hash))) return json({ ok: false }, 200);
            const s = await sessionOf(c.id);
            // Prénom de la session : l'existante, sinon celui envoyé, sinon le nom de l'admin du carnet.
            await db.prepare(
              `INSERT OR REPLACE INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
            ).bind(device, c.id, s ? s.prenom : (cleanPrenom(p.prenom) || c.admin), "admin", now).run();
            const { results: membres } = await db.prepare(`SELECT prenom FROM Membres WHERE carnet_id=?`).bind(c.id).all();
            return json({
              ok: true, role: "admin",
              carnet: { id: c.id, nom: c.nom, code: c.code, admin: c.admin, membres: membres.map((m) => m.prenom) },
            });
          }

          case "regenerateInvite": {
            if (!(await isAdminOf(p.carnetId))) return json({ error: "réservé à l'admin" }, 403);
            let code = newInviteMot();
            for (let i = 0; i < 5; i++) {
              const dup = await db.prepare(`SELECT id FROM Carnets WHERE code=? AND id<>?`).bind(code, p.carnetId).first();
              if (!dup) break;
              code = newInviteMot();
            }
            await db.prepare(`UPDATE Carnets SET code=? WHERE id=?`).bind(code, p.carnetId).run();
            return json({ code });
          }

          case "changeAdminCode": {
            if (!isCode(p.newCode)) return json({ error: "Le nouveau code admin doit contenir 4 ou 6 chiffres." }, 400);
            const carnetCode = (await db.prepare(`SELECT code FROM Carnets WHERE id=?`).bind(p.carnetId).first()) || {};
            if (p.newCode === carnetCode.code) return json({ error: "Le code admin doit être différent du mot-clé d.invitation." }, 400);
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
            // Plusieurs themes possibles (tableau client) -> texte unique, max 4, virgules.
            const catVal = Array.isArray(f.cat)
              ? f.cat.filter(Boolean).slice(0, 4).join(", ")
              : f.cat;
            await db.prepare(
              `INSERT INTO Fiches (id, auteur, type, cat, titre, lieu, note, com, photo, recette, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`
            ).bind(id, cleanPrenom(f.auteur), cleanText(f.type, 10), cleanText(catVal, 60),
              cleanText(f.titre, 60), cleanText(f.lieu, 60), note, cleanText(f.com, 500),
              typeof f.photo === "string" ? f.photo.slice(0, 400000) : null,
              cleanText(f.recette, 4000), now).run();
            for (const cid of (Array.isArray(f.carnets) ? f.carnets : []).slice(0, 20)) {
              const membre = await sessionOf(cid);
              if (membre) await db.prepare(`INSERT INTO FichesCarnets (fiche_id, carnet_id) VALUES (?,?)`).bind(id, cid).run();
            }
            (async () => {
              const dests = new Set();
              for (const cid of (Array.isArray(f.carnets) ? f.carnets : []).slice(0, 20)) {
                for (const d of await devicesOfCarnet(db, cid, s.prenom)) dests.add(d);
              }
              sendPushTo(env, db, [...dests], {
                title: s.prenom + " a noté une adresse aimée",
                body: "« " + cleanText(f.titre, 60) + " » — une nouvelle adresse à découvrir dans ton carnet ♥",
                url: "/fiche/" + id,
              }).catch(() => {});
            })().catch(() => {});
            logEvent(db, "note", { device, prenom: s.prenom, carnet: f.carnets && f.carnets[0], meta: { titre: cleanText(f.titre, 60) } });
            return json({ fiche: { id, auteur: f.auteur, type: f.type, cat: catVal, titre: f.titre, lieu: f.lieu,
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
              `UPDATE Fiches SET titre=COALESCE(?,titre), com=COALESCE(?,com), recette=COALESCE(?,recette), note=COALESCE(?,note), photo=COALESCE(?,photo) WHERE id=?`
            ).bind(patch.titre != null ? cleanText(patch.titre, 60) : null,
              patch.com != null ? cleanText(patch.com, 500) : null,
              patch.recette != null ? cleanText(patch.recette, 4000) : null,
              patch.note != null ? Math.min(100, Math.max(70, parseInt(patch.note, 10) || 80)) : null,
              patch.photo !== undefined ? String(patch.photo).slice(0, 400000) : null,
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
            // Enfants d'abord : la cle etrangere bloque sinon le DELETE de Fiches
            await db.prepare(`DELETE FROM FichesCarnets WHERE fiche_id=?`).bind(p.id).run();
            await db.prepare(`DELETE FROM FicheLikes WHERE fiche_id=?`).bind(p.id).run();
            await db.prepare(`DELETE FROM DemandesRecette WHERE fiche_id=?`).bind(p.id).run();
            await db.prepare(`DELETE FROM FicheComments WHERE fiche_id=?`).bind(p.id).run();
            await db.prepare(`DELETE FROM Fiches WHERE id=?`).bind(p.id).run();
            return json({ ok: true });
          }

          case "addFlash": {
            const fl = p.flash || {};
            const s = await sessionOf(fl.carnetId);
            if (!s) return json({ error: "pas membre" }, 403);
            const id = crypto.randomUUID();
            const expires = new Date(Date.now() + 7 * 864e5).toISOString();
            await db.prepare(
              `INSERT INTO Flashes (id, carnet_id, auteur, photo, com, created_at, expires_at) VALUES (?,?,?,?,?,?,?)`
            ).bind(id, fl.carnetId, s.prenom, typeof fl.photo === "string" ? fl.photo.slice(0, 400000) : "",
              typeof fl.com === "string" ? fl.com.slice(0, 500) : null, now, expires).run();
            const cnom = await db.prepare(`SELECT nom FROM Carnets WHERE id=?`).bind(fl.carnetId).first();
            devicesOfCarnet(db, fl.carnetId, s.prenom).then((devs) =>
              sendPushTo(env, db, devs, {
                title: s.prenom + " a flashé",
                body: "Nouveau flash dans « " + (cnom ? cnom.nom : "un carnet") + " » — 7 jours pour l’aimer ♥",
                url: "/",
              })
            ).catch(() => {});
            logEvent(db, "flash", { device, prenom: s.prenom, carnet: fl.carnetId });
            return json({ flash: { id, carnets: [fl.carnetId], auteur: s.prenom, photo: fl.photo, com: fl.com || null, date: now, reacts: [] } });
          }

          case "commentFlash": {
            const fl = await db.prepare(`SELECT * FROM Flashes WHERE id=?`).bind(p.id).first();
            if (!fl) return json({ error: "introuvable" }, 404);
            const s = await sessionOf(fl.carnet_id);
            if (!s || s.prenom !== fl.auteur) return json({ error: "seul l'auteur peut commenter" }, 403);
            const com = typeof p.com === "string" ? p.com.slice(0, 500) : null;
            await db.prepare(`UPDATE Flashes SET com=? WHERE id=?`).bind(com, p.id).run();
            return json({ ok: true, com });
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
            const onFiche = await db.prepare(`SELECT * FROM Fiches WHERE id=?`).bind(p.targetId).first();
            const onFlash = await db.prepare(`SELECT id, carnet_id FROM Flashes WHERE id=?`).bind(p.targetId).first();
            let prenom = cleanPrenom(p.prenom);
            if (onFiche) {
              const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(p.targetId).all();
              let ok = false;
              for (const l of liens) { if (await sessionOf(l.carnet_id)) { ok = true; break; } }
              if (!ok) return json({ error: "pas membre" }, 403);
              let likeNouveau = false;
              if (p.on) {
                const r = await db.prepare(`INSERT OR IGNORE INTO FicheLikes (fiche_id, prenom) VALUES (?,?)`).bind(p.targetId, prenom).run();
                likeNouveau = !!(r.meta && r.meta.changes);
                if (likeNouveau) logEvent(db, "like", { device, prenom, carnet: liens[0] && liens[0].carnet_id, meta: { fiche: p.targetId } });
                // Boucle sociale : prevenir l'auteur qu'on aime son adresse (pas si c'est lui-meme)
                if (likeNouveau && onFiche.auteur && onFiche.auteur !== prenom) {
                  (async () => {
                    const devAuteur = [];
                    for (const l of liens) {
                      const { results } = await db.prepare(
                        `SELECT DISTINCT device_id FROM Sessions WHERE carnet_id=? AND prenom=?`
                      ).bind(l.carnet_id, onFiche.auteur).all();
                      for (const x of results) devAuteur.push(x.device_id);
                    }
                    await sendPushTo(env, db, [...new Set(devAuteur)], {
                      title: prenom + " a aimé ton adresse",
                      body: "« " + cleanText(onFiche.titre, 60) + " » — ça plaît dans le carnet ♥",
                      url: "/fiche/" + p.targetId,
                    });
                  })().catch(() => {});
                }
              } else {
                await db.prepare(`DELETE FROM FicheLikes WHERE fiche_id=? AND prenom=?`).bind(p.targetId, prenom).run();
              }
              const { results: likes } = await db.prepare(`SELECT prenom FROM FicheLikes WHERE fiche_id=?`).bind(p.targetId).all();
              return json({ reacts: likes.map((l) => l.prenom) });
            }
            if (onFlash) {
              const s = await sessionOf(onFlash.carnet_id);
              if (!s) return json({ error: "pas membre" }, 403);
              if (p.on) {
                const r = await db.prepare(`INSERT OR IGNORE INTO FlashReactions (flash_id, prenom) VALUES (?,?)`).bind(p.targetId, s.prenom).run();
                if (r.meta && r.meta.changes) {
                  logEvent(db, "like", { device, prenom: s.prenom, carnet: onFlash.carnet_id, meta: { flash: p.targetId } });
                  if (onFlash.auteur && onFlash.auteur !== s.prenom) {
                    (async () => {
                      const { results } = await db.prepare(
                        `SELECT DISTINCT device_id FROM Sessions WHERE carnet_id=? AND prenom=?`
                      ).bind(onFlash.carnet_id, onFlash.auteur).all();
                      await sendPushTo(env, db, results.map((x) => x.device_id), {
                        title: s.prenom + " a aimé ton flash",
                        body: "Ton flash plaît — pense à le noter en fiche ♥",
                        url: "/",
                      });
                    })().catch(() => {});
                  }
                }
              } else {
                await db.prepare(`DELETE FROM FlashReactions WHERE flash_id=? AND prenom=?`).bind(p.targetId, s.prenom).run();
              }
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

          case "addComment": {
            const f = await db.prepare(`SELECT * FROM Fiches WHERE id=?`).bind(p.id).first();
            if (!f) return json({ error: "introuvable" }, 404);
            const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(p.id).all();
            let sess = null;
            for (const l of liens) { const x = await sessionOf(l.carnet_id); if (x) { sess = x; break; } }
            if (!sess) return json({ error: "pas membre" }, 403);
            const texte = cleanText(p.texte, 500).trim();
            if (!texte) return json({ error: "commentaire vide" }, 400);
            const id = crypto.randomUUID();
            await ensureComments(db);
            await db.prepare(
              `INSERT INTO FicheComments (id, fiche_id, prenom, texte, created_at) VALUES (?,?,?,?,?)`
            ).bind(id, p.id, sess.prenom, texte, now).run();
            logEvent(db, "comment", { device, prenom: sess.prenom, carnet: liens[0] && liens[0].carnet_id, meta: { fiche: p.id } });
            // Boucle sociale : l'auteur de la fiche apprend qu'on en parle (pas si c'est lui-meme)
            if (f.auteur && f.auteur !== sess.prenom) {
              (async () => {
                const devAuteur = [];
                for (const l of liens) {
                  const { results } = await db.prepare(
                    `SELECT DISTINCT device_id FROM Sessions WHERE carnet_id=? AND prenom=?`
                  ).bind(l.carnet_id, f.auteur).all();
                  for (const x of results) devAuteur.push(x.device_id);
                }
                await sendPushTo(env, db, [...new Set(devAuteur)], {
                  title: sess.prenom + " a commenté ton adresse",
                  body: "« " + cleanText(f.titre, 60) + " » — ça discute dans ton carnet ♥",
                  url: "/fiche/" + p.id,
                });
              })().catch(() => {});
            }
            return json({ comment: { id, prenom: sess.prenom, texte, date: now } });
          }

          case "editComment": {
            const c = await db.prepare(`SELECT * FROM FicheComments WHERE id=?`).bind(p.commentId).first();
            if (!c) return json({ error: "introuvable" }, 404);
            const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(c.fiche_id).all();
            let autorise = false;
            for (const l of liens) {
              const sess = await sessionOf(l.carnet_id);
              if (sess && (sess.prenom === c.prenom || sess.role === "admin")) { autorise = true; break; }
            }
            if (!autorise) return json({ error: "réservé à l'auteur ou l'admin" }, 403);
            const texte = cleanText(p.texte, 500).trim();
            if (!texte) return json({ error: "commentaire vide" }, 400);
            await db.prepare(`UPDATE FicheComments SET texte=? WHERE id=?`).bind(texte, p.commentId).run();
            return json({ ok: true, texte });
          }

          case "deleteComment": {
            const c = await db.prepare(`SELECT * FROM FicheComments WHERE id=?`).bind(p.commentId).first();
            if (!c) return json({ ok: true });
            const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(c.fiche_id).all();
            let autorise = false;
            for (const l of liens) {
              const sess = await sessionOf(l.carnet_id);
              if (sess && (sess.prenom === c.prenom || sess.role === "admin")) { autorise = true; break; }
            }
            if (!autorise) return json({ error: "réservé à l'auteur ou l'admin" }, 403);
            await db.prepare(`DELETE FROM FicheComments WHERE id=?`).bind(p.commentId).run();
            return json({ ok: true });
          }

          case "deleteAccount": {
            // RGPD : l'appareil quitte tous ses carnets. Deux modes :
            // - purge : ses notes, likes, commentaires et flashes sont supprimés
            // - keep : ils restent dans les carnets (l'auteur garde son prénom)
            // Définitif : pour revenir il faut refaire une demande d'invitation.
            const { results: sess } = await db.prepare(
              `SELECT carnet_id, prenom, role FROM Sessions WHERE device_id=?`
            ).bind(device).all();
            const purger = p.purge !== false;
            for (const se of sess) {
              if (purger) {
                const { results: mesFiches } = await db.prepare(
                  `SELECT f.id FROM Fiches f JOIN FichesCarnets l ON l.fiche_id = f.id WHERE l.carnet_id=? AND f.auteur=?`
                ).bind(se.carnet_id, se.prenom).all();
                for (const f of mesFiches) {
                  await db.prepare(`DELETE FROM FichesCarnets WHERE fiche_id=?`).bind(f.id).run();
                  await db.prepare(`DELETE FROM FicheLikes WHERE fiche_id=?`).bind(f.id).run();
                  await db.prepare(`DELETE FROM DemandesRecette WHERE fiche_id=?`).bind(f.id).run();
                  await db.prepare(`DELETE FROM FicheComments WHERE fiche_id=?`).bind(f.id).run();
                  await db.prepare(`DELETE FROM Fiches WHERE id=?`).bind(f.id).run();
                }
                await db.prepare(
                  `DELETE FROM FicheLikes WHERE prenom=? AND fiche_id IN (SELECT fiche_id FROM FichesCarnets WHERE carnet_id=?)`
                ).bind(se.prenom, se.carnet_id).run();
                await db.prepare(
                  `DELETE FROM FicheComments WHERE prenom=? AND fiche_id IN (SELECT fiche_id FROM FichesCarnets WHERE carnet_id=?)`
                ).bind(se.prenom, se.carnet_id).run();
                await db.prepare(
                  `DELETE FROM FlashReactions WHERE prenom=? AND flash_id IN (SELECT id FROM Flashes WHERE carnet_id=?)`
                ).bind(se.prenom, se.carnet_id).run();
                await db.prepare(`DELETE FROM Flashes WHERE carnet_id=? AND auteur=?`).bind(se.carnet_id, se.prenom).run();
              }
              // Membre sans plus aucune session -> retiré de la liste (comme leaveCarnet).
              // L'admin du carnet reste membre : le carnet doit survivre à son départ.
              const c = await db.prepare(`SELECT admin FROM Carnets WHERE id=?`).bind(se.carnet_id).first();
              if (!c || se.prenom !== c.admin) {
                const autre = await db.prepare(
                  `SELECT 1 FROM Sessions WHERE carnet_id=? AND prenom=? AND device_id<>?`
                ).bind(se.carnet_id, se.prenom, device).first();
                if (!autre) await db.prepare(
                  `DELETE FROM Membres WHERE carnet_id=? AND prenom=?`
                ).bind(se.carnet_id, se.prenom).run();
              }
            }
            await db.prepare(`DELETE FROM Sessions WHERE device_id=?`).bind(device).run();
            await db.prepare(`DELETE FROM PushSubscriptions WHERE device_id=?`).bind(device).run();
            logEvent(db, "delete_account", { device, meta: { purge: purger } });
            return json({ ok: true });
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

          case "subscribePush": {
            const sub = p.sub || {};
            if (!device || !sub.endpoint || !sub.keys) return json({ error: "abonnement invalide" }, 400);
            await db.prepare(
              `INSERT OR REPLACE INTO PushSubscriptions (device_id, endpoint, p256dh, auth, created_at) VALUES (?,?,?,?,?)`
            ).bind(device, cleanText(sub.endpoint, 500), cleanText(sub.keys.p256dh, 200),
              cleanText(sub.keys.auth, 100), now).run();
            logEvent(db, "notifs_on", { device });
            return json({ ok: true });
          }

          case "unsubscribePush": {
            await db.prepare(`DELETE FROM PushSubscriptions WHERE endpoint=?`).bind(cleanText(p.endpoint, 500)).run();
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

          case "superAdmin": {
            // Créateur de l'app : une phrase de passe LONGUE, dont seul le SHA-256
            // existe côté serveur (variable d'environnement SUPER_ADMIN_HASH).
            // Restaure des sessions admin sur TOUS les carnets, tout appareil.
            const attendu = String(env.SUPER_ADMIN_HASH || "");
            if (!attendu) return json({ error: "super admin non configuré" }, 404);
            const pass = String(p.pass || "");
            if (pass.length < 8 || (await sha256hex(pass)) !== attendu)
              return json({ ok: false }, 200);
            const { results: tous } = await db.prepare(`SELECT * FROM Carnets`).all();
            const roles = {};
            const carnets = [];
            for (const c of tous) {
              await db.prepare(
                `INSERT OR REPLACE INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
              ).bind(device, c.id, c.admin, "admin", now).run();
              roles[c.id] = "admin";
              const { results: membres } = await db.prepare(`SELECT prenom FROM Membres WHERE carnet_id=?`).bind(c.id).all();
              carnets.push({ id: c.id, nom: c.nom, code: c.code, admin: c.admin, membres: membres.map((m) => m.prenom) });
            }
            return json({ ok: true, carnets, roles });
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