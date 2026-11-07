// Le Carnet — worker Cloudflare Pages (Direct Upload), backend D1.
// Prod : sessions par appareil (device_id), rôles vérifiés sur chaque mutation,
// code admin hashé (SHA-256 + sel), codes invitation/admin séparés.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
// V0.4.98 : identité de secours par cookie serveur. Le localStorage des PWA
// WebKit (iOS + macOS) est purgé après 7 jours sans usage (ITP) — le deviceId
// disparaît et l'appareil devient un inconnu. Un cookie posé PAR LE SERVEUR
// (Set-Cookie, HttpOnly) n'est PAS soumis à cette purge : il porte l'identité
// en secours et le bootstrap adopte automatiquement si le localStorage a sauté.
let devCookie = null;
const json = (data, status = 200) => {
  const headers = { "Content-Type": "application/json", ...CORS };
  if (devCookie)
    headers["Set-Cookie"] = "lc-device=" + devCookie + "; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax";
  return new Response(JSON.stringify(data), { status, headers });
};

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
// V0.4.67 : code de récupération personnel hashé, relié au prénom dans chaque carnet.
// ALTER silencieux : no-op si la colonne existe déjà.
const ensureRecup = (db) =>
  db.prepare(`ALTER TABLE Membres ADD COLUMN code_recup TEXT`).run().catch(() => {});
// V0.4.71 « Mes adresses » : carnets privés (visibles de leur seul propriétaire)
const ensurePrive = (db) =>
  db.prepare(`ALTER TABLE Carnets ADD COLUMN prive TEXT`).run().catch(() => {});
// V0.4.78 : avatar du membre synchronisé entre appareils (avant : localStorage local).
const ensureAvatar = (db) =>
  db.prepare(`ALTER TABLE Membres ADD COLUMN avatar TEXT`).run().catch(() => {});
// V0.4.76 : zones géographiques (pays / ville) des fiches, pour le filtre.
// ALTER silencieux : no-op si les colonnes existent déjà.
const ensureZones = async (db) => {
  await db.prepare(`ALTER TABLE Fiches ADD COLUMN pays TEXT`).run().catch(() => {});
  await db.prepare(`ALTER TABLE Fiches ADD COLUMN ville TEXT`).run().catch(() => {});
};
// Pays reconnus dans une adresse Google (dernier segment après la virgule).
const PAYS_NOMS = new Set(("France, Belgique, Suisse, Luxembourg, Monaco, Allemagne, Espagne, Italie, Portugal, Pays-Bas, Royaume-Uni, Irlande, Ecosse, Angleterre, Autriche, Pologne, Tchequie, Slovaquie, Hongrie, Slovenie, Croatie, Serbie, Bosnie-Herzegovine, Montenegro, Macedoine, Grece, Bulgarie, Roumanie, Moldavie, Ukraine, Lituanie, Lettonie, Estonie, Finlande, Suede, Norvege, Danemark, Islande, Turquie, Russie, Maroc, Algerie, Tunisie, Liban, Israel, Egypte, Senegal, Cote d Ivoire, Canada, Etats-Unis, Mexique, Cuba, Republique dominicaine, Jamaque, Bresil, Argentine, Chili, Perou, Colombie, Uruguay, Chine, Japon, Coree du Sud, Inde, Thailande, Vietnam, Cambodge, Laos, Singapour, Indonesie, Malaisie, Australie, Nouvelle-Zelande, Nouvelle Zelande").split(", "));
const CODE_PAYS = { FR: "France", BE: "Belgique", CH: "Suisse", LU: "Luxembourg", MC: "Monaco", DE: "Allemagne", ES: "Espagne", IT: "Italie", PT: "Portugal", NL: "Pays-Bas", GB: "Royaume-Uni", UK: "Royaume-Uni", IE: "Irlande", AT: "Autriche", PL: "Pologne", CZ: "Tchequie", GR: "Grece", TR: "Turquie", RU: "Russie", MA: "Maroc", DZ: "Algerie", TN: "Tunisie", CA: "Canada", US: "Etats-Unis", MX: "Mexique", BR: "Bresil", AR: "Argentine", AU: "Australie", NZ: "Nouvelle-Zelande", JP: "Japon", CN: "Chine", IN: "Inde", TH: "Thailande", VN: "Vietnam" };
const normPays = (t) => cleanText(t, 40).trim()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z' -]+/g, " ").replace(/\s+/g, " ").trim();
// Lieu texte -> { pays, ville }. Ville = segment au motif "NNNNN Nom" (code postal),
// sinon l'avant-dernier segment s'il ressemble à un nom de ville.
const zonesDepuisLieu = (lieu, codePays) => {
  let pays = codePays ? (CODE_PAYS[String(codePays).toUpperCase()] || "") : "";
  let ville = "";
  const parts = cleanText(lieu, 120).split(",").map((x) => x.trim()).filter(Boolean);
  if (!pays) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const n = normPays(parts[i]);
      if (n && PAYS_NOMS.has(n)) { pays = n; parts.splice(i, 1); break; }
    }
  } else {
    const n = normPays(parts[parts.length - 1] || "");
    if (n && PAYS_NOMS.has(n)) parts.splice(parts.length - 1, 1);
  }
  for (let i = 0; i < parts.length; i++) {
    const m = /^\d{4,6}\s+(.+)$/.exec(parts[i]);
    if (m) { ville = normPays(m[1]); break; }
  }
  if (!ville && pays === "France" && parts.length >= 2) {
    const candidat = normPays(parts[parts.length - 1]);
    if (candidat && /^\d/.test(parts[parts.length - 2] || " ") === false && candidat.length <= 40) ville = candidat;
  }
  return { pays, ville };
};

// V0.4.77 : un appareil = UN seul espace privé « Mes adresses ». Les imports
// successifs créaient un carnet privé à chaque fois (bug V0.4.76) ; on fusionne
// les doublons au bootstrap : on garde le plus ancien, on y déplace les liens
// de fiches des autres, puis on supprime les doublons.
const consoliderPrive = async (db, device) => {
  if (!device) return;
  // V0.4.84 : un appareil par personne = ses espaces privés par appareil fusionnent
  // aussi (l'identité, c'est le prénom — le deviceId n'est qu'une commodité locale).
  const { results: privs } = await db.prepare(
    `SELECT id FROM Carnets WHERE prive='1' AND id IN (
       SELECT carnet_id FROM Sessions WHERE device_id=?
       UNION SELECT carnet_id FROM Membres WHERE LOWER(prenom) IN (
         SELECT LOWER(prenom) FROM Sessions WHERE device_id=?
       )
     ) ORDER BY created_at ASC`
  ).bind(device, device).all();
  if (privs.length >= 2) forMerge: {
    const garde = privs[0].id;
    for (const dup of privs.slice(1)) {
    await db.prepare(
      `INSERT OR IGNORE INTO FichesCarnets (fiche_id, carnet_id) SELECT fiche_id, ? FROM FichesCarnets WHERE carnet_id=?`
    ).bind(garde, dup.id).run();
    await db.prepare(`DELETE FROM FichesCarnets WHERE carnet_id=?`).bind(dup.id).run();
    await db.prepare(`DELETE FROM Sessions WHERE carnet_id=?`).bind(dup.id).run();
    await db.prepare(`DELETE FROM Membres WHERE carnet_id=?`).bind(dup.id).run();
      await db.prepare(`DELETE FROM Carnets WHERE id=?`).bind(dup.id).run();
    }
    logEvent(db, "fusion_prive", { device, meta: { supprimes: privs.length - 1 } });
  }
  // V0.4.88 : l'espace G-Maps suit la personne — si cet appareil a une session
  // sous le prénom P et qu'un espace privé de P existe sans session pour lui
  // (ex. espace importé sur le Mac APRÈS une récupération sur le tel), on
  // l'y rattache ici, au bootstrap : il apparaît dans la même réponse.
  for (const pv of privs) {
    const dej = await db.prepare(`SELECT 1 FROM Sessions WHERE device_id=? AND carnet_id=?`).bind(device, pv.id).first();
    if (dej) continue;
    const mb = await db.prepare(`SELECT prenom FROM Membres WHERE carnet_id=? LIMIT 1`).bind(pv.id).first();
    if (!mb || !mb.prenom) continue;
    await db.prepare(`INSERT INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`)
      .bind(device, pv.id, mb.prenom, "member", new Date().toISOString()).run();
  }
};

// V0.4.78 « Mon G-Maps » : renommage des espaces privés + DEDUP des fiches.
// Après la fusion V0.4.77, un appareil qui avait importé 3 fois (3 espaces)
// se retrouve avec 3 copies de chaque lieu DANS le carnet gardé. Ici on
// regroupe par titre normalisé et on ne garde qu'une fiche : en priorité
// celle partagée dans un autre carnet, sinon la plus complète (note, com,
// photo), sinon la plus ancienne. Les copies de trop sont retirées de
// l'espace privé ; si elles n'appartiennent à aucun autre carnet, elles
// sont supprimées avec leurs enfants.
const renommerEtDedupPrive = async (db, device) => {
  if (!device) return;
  const { results: privs } = await db.prepare(
    `SELECT id FROM Carnets WHERE prive='1' AND id IN (SELECT carnet_id FROM Sessions WHERE device_id=?)`
  ).bind(device).all();
  for (const cp of privs) {
    await db.prepare(`UPDATE Carnets SET nom='Mon G-Maps' WHERE id=?`).bind(cp.id).run();
    const { results: fs } = await db.prepare(
      `SELECT f.id, f.titre, f.note, f.com, f.photo, f.created_at,
        (SELECT COUNT(*) FROM FichesCarnets l WHERE l.fiche_id=f.id AND l.carnet_id<>?) AS autres
       FROM Fiches f JOIN FichesCarnets fc ON fc.fiche_id=f.id WHERE fc.carnet_id=?`
    ).bind(cp.id, cp.id).all();
    const groupes = {};
    for (const f of fs) {
      const cle = normNom(f.titre);
      if (cle.length < 4) continue;
      (groupes[cle] = groupes[cle] || []).push(f);
    }
    let supprimes = 0;
    for (const cle of Object.keys(groupes)) {
      const g = groupes[cle];
      if (g.length < 2) continue;
      g.sort((a, b) =>
        (b.autres - a.autres) ||
        ((b.note > 0) - (a.note > 0)) ||
        ((b.com ? 1 : 0) - (a.com ? 1 : 0)) ||
        ((b.photo ? 1 : 0) - (a.photo ? 1 : 0)) ||
        (a.created_at < b.created_at ? -1 : 1));
      for (const d of g.slice(1)) {
        await db.prepare(`DELETE FROM FichesCarnets WHERE fiche_id=? AND carnet_id=?`).bind(d.id, cp.id).run();
        if (!d.autres) {
          await db.prepare(`DELETE FROM FicheLikes WHERE fiche_id=?`).bind(d.id).run();
          await db.prepare(`DELETE FROM DemandesRecette WHERE fiche_id=?`).bind(d.id).run();
          await db.prepare(`DELETE FROM FicheComments WHERE fiche_id=?`).bind(d.id).run();
          await db.prepare(`DELETE FROM Fiches WHERE id=?`).bind(d.id).run();
        }
        supprimes++;
      }
    }
    if (supprimes) logEvent(db, "dedup_prive", { device, carnet: cp.id, meta: { supprimes } });
  }
};
const ensureComments = (db) =>
  db.prepare(`CREATE TABLE IF NOT EXISTS FicheComments (
    id TEXT PRIMARY KEY, fiche_id TEXT NOT NULL, prenom TEXT NOT NULL,
    texte TEXT NOT NULL, created_at TEXT NOT NULL)`)
    .run().catch(() => {});

const isCode = (c) => /^([0-9]{4}|[0-9]{6})$/.test(String(c || ""));
const cleanPrenom = (p) => String(p || "").trim().slice(0, 20);
const cleanText = (t, n) => String(t == null ? "" : t).slice(0, n);

// Anti-doublon : clé de similitude d'un nom de lieu — minuscules, sans accents
// ni ponctuation, article initial retiré (« Le Météoreat » ≡ « Météoreat »).
const normNom = (t) => {
  let s = cleanText(t, 200).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  let m;
  while ((m = /^(le|la|les|l|the|el|il|lo|du|de|des|d|au|aux|a|chez)\s+/.exec(s))) s = s.slice(m[0].length);
  return s;
};

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
        // V0.4.98 : résolution d'identité — payload vs cookie de secours.
        const cookieDev = (String(request.headers.get("Cookie") || "").match(/(?:^|;\s*)lc-device=([A-Za-z0-9-]{8,64})/) || [])[1] || null;
        let device = cleanText(url.searchParams.get("device"), 64);
        if (cookieDev && cookieDev !== device) {
          const rC = await db.prepare(`SELECT COUNT(*) AS n FROM Sessions WHERE device_id=?`).bind(cookieDev).first();
          const rD = await db.prepare(`SELECT COUNT(*) AS n FROM Sessions WHERE device_id=?`).bind(device).first();
          // Le localStorage a été purgé (nouveau UUID inconnu) mais le cookie
          // porte encore un appareil connu -> on adopte l'identité du cookie.
          if (rC && rC.n > 0 && rD && rD.n === 0) device = cookieDev;
        }
        devCookie = device;
        await ensureEvents(db);
        await ensureComments(db);
        await ensurePrive(db);
        await ensureZones(db);
        // V0.4.77 : fusion des espaces privés en doublon (avant le backfill,
        // pour que les fiches déplacées soient requalifiées dans la foulée).
        await consoliderPrive(db, device);
        await ensureAvatar(db);
        await renommerEtDedupPrive(db, device);
        // Backfill zones : les fiches créées avant V0.4.76 sont requalifiées depuis leur adresse.
        {
          const { results: sansZone } = await db.prepare(
            `SELECT id, lieu FROM Fiches WHERE (pays IS NULL OR pays='') AND lieu<>'' LIMIT 500`
          ).all();
          for (const f of sansZone) {
            const z = zonesDepuisLieu(f.lieu);
            await db.prepare(`UPDATE Fiches SET pays=?, ville=? WHERE id=?`)
              .bind(z.pays || "", z.ville || "", f.id).run();
          }
        }
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
          `SELECT carnet_id, prenom, avatar FROM Membres WHERE carnet_id IN ${inClause(carnetIds.length)}`
        ).bind(...bindIds()).all();
        const { results: fichesRaw } = await db.prepare(
          `SELECT DISTINCT f.* FROM Fiches f JOIN FichesCarnets l ON l.fiche_id = f.id
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
          `SELECT DISTINCT c.id, c.fiche_id, c.prenom, c.texte, c.created_at FROM FicheComments c
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
        // V0.4.83 : avatar par prénom — l'app l'affiche partout où un badge de profil paraît.
        const avatarsByPrenom = {};
        for (const m of membres) if (m.avatar) avatarsByPrenom[m.prenom] = m.avatar;

        const fiches = fichesRaw.map((f) => ({
          id: f.id, auteur: f.auteur, type: f.type, cat: f.cat, titre: f.titre, lieu: f.lieu,
          note: f.note, com: f.com, photo: f.photo, recette: f.recette,
          pays: f.pays || "", ville: f.ville || "",
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
        // Relance douce J+8 : un appareil qui n'a pas ouvert l'app depuis 8 jours
        // et dont un carnet s'est rempli depuis -> une petite notif pour le ramener.
        // Declenchee par n'importe quel bootstrap (comme le rappel J-6), au plus
        // une fois tous les 2 jours par appareil (event relance_j8 dans Events).
        if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
          const avant = new Date(Date.now() - 8 * 864e5).toISOString();
          const { results: absents } = await db.prepare(
            `SELECT device_id, MAX(created_at) AS dernier FROM Events WHERE type='open' GROUP BY device_id HAVING dernier <= ?`
          ).bind(avant).all();
          const throttle = new Date(Date.now() - 2 * 864e5).toISOString();
          for (const ab of absents) {
            const deja = await db.prepare(
              `SELECT 1 FROM Events WHERE type='relance_j8' AND device_id=? AND created_at > ?`
            ).bind(ab.device_id, throttle).first();
            if (deja) continue;
            const { results: ses } = await db.prepare(
              `SELECT carnet_id FROM Sessions WHERE device_id=?`
            ).bind(ab.device_id).all();
            let meilleur = null;
            for (const se of ses) {
              const r = await db.prepare(
                `SELECT COUNT(DISTINCT f.id) AS n FROM Fiches f JOIN FichesCarnets l ON l.fiche_id = f.id
                 WHERE l.carnet_id=? AND f.created_at > ?`
              ).bind(se.carnet_id, ab.dernier).first();
              if (r.n && (!meilleur || r.n > meilleur.n)) {
                const c = await db.prepare(`SELECT nom FROM Carnets WHERE id=?`).bind(se.carnet_id).first();
                meilleur = { n: r.n, nom: c ? c.nom : "", id: se.carnet_id };
              }
            }
            if (meilleur) {
              sendPushTo(env, db, [ab.device_id], {
                title: meilleur.n > 1 ? meilleur.n + " nouvelles adresses t'attendent" : "Une nouvelle adresse t'attend",
                body: "dans « " + cleanText(meilleur.nom, 24) + " », depuis ton dernier passage ♥",
                url: "/",
              }).catch(() => {});
              logEvent(db, "relance_j8", { device: ab.device_id, carnet: meilleur.id, meta: { n: meilleur.n } });
            }
          }
        }
        const flashes = flashesRaw.map((fl) => ({
          id: fl.id, carnets: [fl.carnet_id], auteur: fl.auteur, photo: fl.photo, com: fl.com || null,
          date: fl.created_at, reacts: reactsByFlash[fl.id] || [],
        }));

        const carnetsOut = carnets.map((c) => ({
          id: c.id, nom: c.nom, code: c.code, admin: c.admin,
          prive: c.prive || "0",
          membres: membresByCarnet[c.id] || [],
        }));

        // V0.4.78 : avatar serveur du membre (sync entre appareils)
        let avatarMoi = null;
        // V0.4.98 : prénom du membre — restaure le profil après une purge ITP.
        let prenomMoi = null;
        {
          const { results: av } = await db.prepare(
            `SELECT m.avatar FROM Membres m JOIN Sessions s ON s.carnet_id=m.carnet_id AND s.prenom=m.prenom
             WHERE s.device_id=? AND m.avatar IS NOT NULL AND m.avatar<>'' LIMIT 1`
          ).bind(device).all();
          if (av.length) avatarMoi = av[0].avatar;
          const pr = await db.prepare(`SELECT prenom FROM Sessions WHERE device_id=? LIMIT 1`).bind(device).first();
          if (pr) prenomMoi = pr.prenom;
        }
        return json({ device, prenom: prenomMoi, carnets: carnetsOut, fiches, flashes, roles, avatar: avatarMoi, avatars: avatarsByPrenom });
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
      // V0.4.98 : rafraîchit le cookie d'identité de secours à chaque mutation.
      if (device) devCookie = device;

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
      // Code personnel connu de cet appareil (n'importe lequel de ses carnets).
      // V0.4.68 : un seul code partout — join et création doivent le respecter.
      const knownCodeOf = async (device) => {
        const r = await db.prepare(
          `SELECT m.code_recup AS code FROM Sessions s
           JOIN Membres m ON m.carnet_id=s.carnet_id AND m.prenom=s.prenom
           WHERE s.device_id=? AND m.code_recup IS NOT NULL LIMIT 1`
        ).bind(device).first();
        return (r && r.code) || null;
      };

      try {
        switch (action) {
          case "createCarnet": {
            const nom = cleanText(p.nom, 24).trim();
            const prenom = cleanPrenom(p.prenom);
            if (!nom) return json({ error: "Le nom du carnet est manquant." }, 400);
            if (!prenom) return json({ error: "Ton prénom est manquant — renseigne-le dans Profil, puis recrée ton carnet." }, 400);
            if (!isCode(p.codeAdmin)) return json({ error: "Le code admin doit contenir 4 ou 6 chiffres." }, 400);
            // V0.4.68 : le code saisi à la création EST le code personnel — si l'appareil
            // en connaît déjà un (autre carnet), il doit retaper le même.
            const connuCreate = await knownCodeOf(device);
            if (connuCreate && !(await verifyCode(p.codeAdmin, connuCreate)))
              return json({ error: "code_different" }, 401);
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
            // V0.4.68 : le code du carnet créé est aussi le code personnel du créateur.
            await db.prepare(`INSERT INTO Membres (carnet_id, prenom, code_recup) VALUES (?,?,?)`).bind(id, prenom, hash).run();
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
            await ensureRecup(db);
            await ensurePrive(db);
            const c = await db.prepare(`SELECT * FROM Carnets WHERE code=?`).bind(invite).first();
            if (!c) return json({ error: "carnet introuvable" }, 404);
            if (c.prive === "1") return json({ error: "carnet prive" }, 403);
            const codeRecup = String(p.codeRecup || "").replace(/\D/g, "");
            // Doublon de prénom dans le carnet (insensible à la casse) : refus, SAUF
            // - retour d'un appareil qui porte déjà ce prénom là (rejoin du même membre), ou
            // - reprise d'identité par le code de récupération (nouvel appareil) :
            //   les sessions de l'ancien appareil sont révoquées, le rôle est conservé.
            const maSession = await sessionOf(c.id);
            const homonyme = await db.prepare(
              `SELECT prenom, code_recup FROM Membres WHERE carnet_id=? AND LOWER(prenom)=LOWER(?)`
            ).bind(c.id, prenom).first();
            if (homonyme && (!maSession || maSession.prenom.toLowerCase() !== prenom.toLowerCase())) {
              if (!isCode(codeRecup)) return json({ error: "prenom_pris", prenom: homonyme.prenom }, 409);
              const roleRecup = prenom === c.admin ? "admin" : "member";
              // V0.4.86 : un prénom vit maintenant sur plusieurs appareils (Mac + tel).
              // Reprise d'identité = ajouter CET appareil, sans révoquer les autres.
              if (homonyme.code_recup) {
                if (!(await verifyCode(codeRecup, homonyme.code_recup))) return json({ error: "code_refuse", prenom: homonyme.prenom }, 401);
              } else {
                // Membre d'avant la V0.4.67, sans code : on le rattache à son
                // propriétaire via son code personnel connu ailleurs ; s'il n'en a
                // nulle part, celui tapé ici devient son code (premier posé).
                const { results: refs } = await db.prepare(
                  `SELECT code_recup FROM Membres WHERE LOWER(prenom)=LOWER(?) AND code_recup IS NOT NULL AND carnet_id<>?`
                ).bind(prenom, c.id).all();
                let ok = true;
                if (refs.length) {
                  ok = false;
                  for (const rf of refs) { if (await verifyCode(codeRecup, rf.code_recup)) { ok = true; break; } }
                }
                if (!ok) return json({ error: "code_refuse", prenom: homonyme.prenom }, 401);
                await db.prepare(`UPDATE Membres SET code_recup=? WHERE carnet_id=? AND LOWER(prenom)=LOWER(?)`)
                  .bind(await hashCode(codeRecup), c.id, prenom).run();
              }
              await db.prepare(
                `INSERT OR REPLACE INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
              ).bind(device, c.id, prenom, roleRecup, now).run();
              const { results: membresRecup } = await db.prepare(`SELECT prenom FROM Membres WHERE carnet_id=?`).bind(c.id).all();
              logEvent(db, "join_recup", { device, prenom, carnet: c.id });
              return json({ carnet: { id: c.id, nom: c.nom, code: c.code, admin: c.admin, membres: membresRecup.map((m) => m.prenom) }, role: roleRecup });
            }
            // Nouveau prénom : le code de récupération est obligatoire — il relie
            // le prénom à son propriétaire et permet de le reprendre plus tard.
            if (!isCode(codeRecup)) return json({ error: "code_manquant" }, 400);
            // V0.4.68 : un seul code personnel — s'il en connaît déjà un, il doit retaper le même.
            const connuJoin = await knownCodeOf(device);
            if (connuJoin && !(await verifyCode(codeRecup, connuJoin)))
              return json({ error: "code_different" }, 401);
            const deja = await db.prepare(
              `SELECT prenom, code_recup FROM Membres WHERE carnet_id=? AND prenom=?`
            ).bind(c.id, prenom).first();
            if (!deja) {
              await db.prepare(`INSERT INTO Membres (carnet_id, prenom, code_recup) VALUES (?,?,?)`)
                .bind(c.id, prenom, await hashCode(codeRecup)).run();
            } else if (!deja.code_recup) {
              // membre d'avant la feature, reconnu par son propre appareil : on pose son code
              await db.prepare(`UPDATE Membres SET code_recup=? WHERE carnet_id=? AND prenom=?`)
                .bind(await hashCode(codeRecup), c.id, prenom).run();
            }
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
            // Anti-doublon INTRA-carnet (V0.4.70) : même lieu écrit différemment =>
            // refus explicite. Chaque carnet reste indépendant : la vérification
            // ne porte que sur les carnets destinataires, jamais sur les autres.
            const cleNom = normNom(f.titre);
            if (cleNom.length >= 4) {
              const deja = [];
              for (const cid of (Array.isArray(f.carnets) ? f.carnets : []).slice(0, 20)) {
                if (!(await sessionOf(cid))) continue;
                const { results: existantes } = await db.prepare(
                  `SELECT f.id, f.titre FROM Fiches f JOIN FichesCarnets fc ON fc.fiche_id=f.id WHERE fc.carnet_id=?`
                ).bind(cid).all();
                const m = existantes.find((x) => normNom(x.titre) === cleNom);
                if (m) deja.push({ id: m.id, titre: m.titre });
              }
              if (deja.length) return json({ error: "fiche_doublon", ficheId: deja[0].id, titre: deja[0].titre }, 409);
            }
            const id = crypto.randomUUID();
            const note = Math.min(100, Math.max(70, parseInt(f.note, 10) || 80));
            // Plusieurs themes possibles (tableau client) -> texte unique, max 4, virgules.
            const catVal = Array.isArray(f.cat)
              ? f.cat.filter(Boolean).slice(0, 4).join(", ")
              : f.cat;
            const zone = zonesDepuisLieu(f.lieu, f.country_code);
            await db.prepare(
              `INSERT INTO Fiches (id, auteur, type, cat, titre, lieu, note, com, photo, recette, pays, ville, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
            ).bind(id, cleanPrenom(f.auteur), cleanText(f.type, 10), cleanText(catVal, 60),
              cleanText(f.titre, 60), cleanText(f.lieu, 60), note, cleanText(f.com, 500),
              typeof f.photo === "string" ? f.photo.slice(0, 400000) : null,
              cleanText(f.recette, 4000), zone.pays, zone.ville, now).run();
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
            return json({ fiche: { id, auteur: f.auteur, type: f.type, cat: catVal, titre: f.titre, lieu: f.lieu, pays: zone.pays, ville: zone.ville,
              note, com: f.com, photo: f.photo || null, recette: f.recette || null, date: now,
              carnets: f.carnets || [], reacts: [], demandeRecette: [] } });
          }

          // V0.4.72 « Mes adresses » : import dans le carnet PRIVÉ uniquement, créé à la
          // volée au premier import (plus d'auto-création au boot). item.note = note
          // pré-remplie (avis Google rattaché côté client), sinon 0 = « à noter ».
          case "importAdresses": {
            let carnetPriveId = p.carnetId || null;
            if (carnetPriveId) {
              const s = await sessionOf(carnetPriveId);
              if (!s) return json({ error: "pas membre" }, 403);
              const cible = await db.prepare(`SELECT prive FROM Carnets WHERE id=?`).bind(carnetPriveId).first();
              if (!cible || cible.prive !== "1") return json({ error: "carnet non prive" }, 403);
            } else {
              // V0.4.84 : l'espace privé suit la PERSONNE — on le réutilise par prénom
              // (importe sur le Mac, le tel le voit aussi), pas seulement par appareil.
              const { results: sessDev } = await db.prepare(
                `SELECT prenom FROM Sessions WHERE device_id=? AND prenom IS NOT NULL LIMIT 1`
              ).bind(device).all();
              const prenomImp = cleanPrenom(p.prenom) || (sessDev.length ? cleanPrenom(sessDev[0].prenom) : "");
              const dejaLa = await db.prepare(
                `SELECT id FROM Carnets WHERE prive='1' AND id IN (
                   SELECT carnet_id FROM Sessions WHERE device_id=?
                   UNION SELECT carnet_id FROM Membres WHERE prenom<>'' AND LOWER(prenom)=LOWER(?)
                 ) ORDER BY created_at ASC LIMIT 1`
              ).bind(device, prenomImp).first();
              if (dejaLa) {
                carnetPriveId = dejaLa.id;
              } else {
              // pas encore d'espace privé : on le crée (V0.4.72 — à la demande)
              const { results: sess } = await db.prepare(`SELECT prenom FROM Sessions WHERE device_id=? AND prenom IS NOT NULL LIMIT 1`).bind(device).all();
              const prenomPrive = sess.length ? cleanPrenom(sess[0].prenom) : cleanPrenom(p.prenom);
              if (!prenomPrive) return json({ error: "prenom manquant" }, 400);
              const pid = crypto.randomUUID();
              const codePrive = "perso-" + Math.random().toString(36).slice(2, 8);
              await db.prepare(
                `INSERT INTO Carnets (id, nom, code, admin, admin_code_hash, prive, created_at) VALUES (?,?,?,?,?,?,?)`
              ).bind(pid, "Mon G-Maps", codePrive, prenomPrive, "", "1", now).run();
              await db.prepare(`INSERT INTO Membres (carnet_id, prenom) VALUES (?,?)`).bind(pid, prenomPrive).run();
              // V0.4.84 : l'espace privé reçoit le même code personnel hashé que les
              // autres carnets du membre — il devient récupérable sur un nouvel appareil.
              {
                const { results: srcCode } = await db.prepare(
                  `SELECT code_recup FROM Membres WHERE prenom=? AND code_recup IS NOT NULL AND carnet_id<>? LIMIT 1`
                ).bind(prenomPrive, pid).all();
                if (srcCode.length)
                  await db.prepare(`UPDATE Membres SET code_recup=? WHERE carnet_id=? AND prenom=?`)
                    .bind(srcCode[0].code_recup, pid, prenomPrive).run();
              }
              await db.prepare(
                `INSERT INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
              ).bind(device, pid, prenomPrive, "member", now).run();
              carnetPriveId = pid;
              logEvent(db, "create_prive", { device, prenom: prenomPrive, carnet: pid });
              }
            }
            let s = await sessionOf(carnetPriveId);
            if (!s && !p.carnetId) {
              // V0.4.88 : même personne, autre appareil — l'espace G-Maps est trouvé
              // par prénom (dejaLa), mais CET appareil n'a pas encore de session
              // dedans. On la rattache : le prenom de ses sessions doit correspondre
              // au membre de l'espace, sinon refus.
              const { results: sessDev2 } = await db.prepare(
                `SELECT prenom FROM Sessions WHERE device_id=? AND prenom IS NOT NULL LIMIT 1`
              ).bind(device).all();
              const prenomSess = sessDev2.length ? cleanPrenom(sessDev2[0].prenom) : cleanPrenom(p.prenom);
              const mb = await db.prepare(
                `SELECT prenom FROM Membres WHERE carnet_id=? AND LOWER(prenom)=LOWER(?)`
              ).bind(carnetPriveId, prenomSess).first();
              if (!mb) return json({ error: "pas membre" }, 403);
              await db.prepare(
                `INSERT OR REPLACE INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
              ).bind(device, carnetPriveId, mb.prenom, "member", now).run();
              s = await sessionOf(carnetPriveId);
            }
            const { results: existantes } = await db.prepare(
              `SELECT f.titre FROM Fiches f JOIN FichesCarnets fc ON fc.fiche_id=f.id WHERE fc.carnet_id=?`
            ).bind(carnetPriveId).all();
            const vues = new Set(existantes.map((x) => normNom(x.titre)).filter((k) => k.length >= 4));
            let importes = 0, ignores = 0;
            const seen = new Set();
            for (const it of (Array.isArray(p.items) ? p.items : []).slice(0, 300)) {
              const titre = cleanText(it && it.titre, 60).trim();
              const cle = normNom(titre);
              if (!titre || cle.length < 4 || vues.has(cle) || seen.has(cle)) { ignores++; continue; }
              seen.add(cle);
              const noteImp = Math.min(100, Math.max(0, parseInt(it && it.note, 10) || 0));
              const zone = zonesDepuisLieu(it && it.lieu, it && it.country_code);
              const id = crypto.randomUUID();
              await db.prepare(
                `INSERT INTO Fiches (id, auteur, type, cat, titre, lieu, note, com, photo, recette, pays, ville, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
              ).bind(id, s.prenom, "adresse", null, titre, cleanText(it && it.lieu, 60),
                (noteImp >= 70 && noteImp <= 100) ? noteImp : 0,
                cleanText(it && it.com, 500), null, null, zone.pays, zone.ville, now).run();
              await db.prepare(`INSERT INTO FichesCarnets (fiche_id, carnet_id) VALUES (?,?)`).bind(id, carnetPriveId).run();
              importes++;
            }
            logEvent(db, "import_adresses", { device, prenom: s.prenom, carnet: carnetPriveId, meta: { importes, ignores } });
            return json({ importes, ignores, carnetId: carnetPriveId });
          }

          // V0.4.72 : rattacher les avis Google (fichier optionnel, ajoutable plus tard)
          // aux fiches déjà importées — par nom normalisé. Ne touche QUE le carnet privé.
          case "rattacherAvis": {
            const s = await sessionOf(p.carnetId);
            if (!s) return json({ error: "pas membre" }, 403);
            const cible = await db.prepare(`SELECT prive FROM Carnets WHERE id=?`).bind(p.carnetId).first();
            if (!cible || cible.prive !== "1") return json({ error: "carnet non prive" }, 403);
            const { results: fichesPrivees } = await db.prepare(
              `SELECT f.id, f.titre, f.note FROM Fiches f JOIN FichesCarnets fc ON fc.fiche_id=f.id WHERE fc.carnet_id=?`
            ).bind(p.carnetId).all();
            let rattaches = 0;
            const orphelins = [];
            for (const av of (Array.isArray(p.items) ? p.items : []).slice(0, 500)) {
              const cle = normNom(av && av.titre);
              const f = fichesPrivees.find((x) => normNom(x.titre) === cle);
              if (!f) { if (cle.length >= 4) orphelins.push(cleanText(av.titre, 60)); continue; }
              const noteAv = Math.min(100, Math.max(70, parseInt(av.note, 10) || 0));
              await db.prepare(`UPDATE Fiches SET note=?, com=CASE WHEN com IS NULL OR com='' THEN ? ELSE com END WHERE id=?`)
                .bind(f.note ? f.note : noteAv, cleanText(av.com, 500), f.id).run();
              rattaches++;
            }
            logEvent(db, "rattacher_avis", { device, prenom: s.prenom, meta: { rattaches } });
            return json({ rattaches, orphelins: orphelins.slice(0, 20) });
          }

          // V0.4.72 : TRANSFERT des fiches privées vers un ou plusieurs carnets.
          // La fiche garde son id (likes/commentaires suivent) ; le lien privé est
          // retiré. Les doublons dans un carnet ciblé sont ignorés avec leur raison.
          case "partagerFiches": {
            const ficheIds = (Array.isArray(p.ficheIds) ? p.ficheIds : []).slice(0, 100);
            const carnetIds = (Array.isArray(p.carnetIds) ? p.carnetIds : []).slice(0, 10);
            if (!ficheIds.length || !carnetIds.length) return json({ error: "rien a partager" }, 400);
            const cp = await db.prepare(`SELECT id FROM Carnets WHERE prive='1' AND id IN (SELECT carnet_id FROM Sessions WHERE device_id=?)`).bind(device).first();
            if (!cp) return json({ error: "pas d espace prive" }, 403);
            for (const cid of carnetIds) {
              if (!(await sessionOf(cid))) return json({ error: "pas membre de " + cid }, 403);
              const cPriv = await db.prepare(`SELECT prive FROM Carnets WHERE id=?`).bind(cid).first();
              if (cPriv && cPriv.prive === "1") return json({ error: "carnet prive" }, 403);
            }
            let partagees = 0;
            const ignorees = [];
            for (const fid of ficheIds) {
              const f = await db.prepare(`SELECT id, titre FROM Fiches WHERE id=?`).bind(fid).first();
              if (!f) { ignorees.push({ titre: "?", raison: "fiche introuvable" }); continue; }
              const { results: liensF } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(fid).all();
              if (!liensF.some((l) => l.carnet_id === cp.id)) { ignorees.push({ titre: f.titre, raison: "hors espace prive" }); continue; }
              let places = [];
              for (const cid of carnetIds) {
                const { results: existantes } = await db.prepare(
                  `SELECT f2.titre FROM Fiches f2 JOIN FichesCarnets fc ON fc.fiche_id=f2.id WHERE fc.carnet_id=?`
                ).bind(cid).all();
                const doublon = existantes.find((x) => normNom(x.titre) === normNom(f.titre));
                if (doublon) { ignorees.push({ titre: f.titre, raison: "deja note dans le carnet" }); continue; }
                await db.prepare(`INSERT OR IGNORE INTO FichesCarnets (fiche_id, carnet_id) VALUES (?,?)`).bind(fid, cid).run();
                places.push(cid);
              }
              if (places.length) {
                await db.prepare(`DELETE FROM FichesCarnets WHERE fiche_id=? AND carnet_id=?`).bind(fid, cp.id).run();
                partagees++;
              }
            }
            // Notif push aux membres des carnets destinataires (une par carnet, si au moins 1 fiche)
            (async () => {
              const sP = await sessionOf(cp.id);
              if (sP && partagees > 0) {
                const dests = new Set();
                for (const cid of carnetIds) for (const d of await devicesOfCarnet(db, cid, sP.prenom)) dests.add(d);
                await sendPushTo(env, db, [...dests], {
                  title: sP.prenom + " partage une adresse aimée",
                  body: partagees + " adresse" + (partagees > 1 ? "s" : "") + " nouvellement recommandée" + (partagees > 1 ? "s" : "") + " dans ton carnet ♥",
                  url: "/",
                }).catch(() => {});
              }
            })().catch(() => {});
            logEvent(db, "partager_fiches", { device, meta: { partagees, ignorees: ignorees.length, carnets: carnetIds.length } });
            return json({ partagees, ignorees });
          }

          // V0.4.72 : espace privé de DÉMO pour le super-admin (Thomas) — pass vérifié
          // comme superAdmin (SHA-256 vs SUPER_ADMIN_HASH). Crée l'espace + 10 fiches.
          case "demoPrive": {
            const attendu = String(env.SUPER_ADMIN_HASH || "");
            if (!attendu) return json({ error: "super admin non configure" }, 404);
            const pass = String(p.pass || "");
            if (pass.length < 8 || (await sha256hex(pass)) !== attendu) return json({ ok: false }, 200);
            let cp = await db.prepare(
              `SELECT id FROM Carnets WHERE prive='1' AND id IN (SELECT carnet_id FROM Sessions WHERE device_id=?)`
            ).bind(device).first();
            let carnetId = cp && cp.id;
            if (!carnetId) {
              const { results: sess } = await db.prepare(`SELECT prenom FROM Sessions WHERE device_id=? AND prenom IS NOT NULL LIMIT 1`).bind(device).all();
              const prenomPrive = sess.length ? cleanPrenom(sess[0].prenom) : "Demo";
              carnetId = crypto.randomUUID();
              const codePrive = "perso-" + Math.random().toString(36).slice(2, 8);
              await db.prepare(
                `INSERT INTO Carnets (id, nom, code, admin, admin_code_hash, prive, created_at) VALUES (?,?,?,?,?,?,?)`
              ).bind(carnetId, "Mes adresses", codePrive, prenomPrive, "", "1", now).run();
              await db.prepare(`INSERT INTO Membres (carnet_id, prenom) VALUES (?,?)`).bind(carnetId, prenomPrive).run();
              await db.prepare(
                `INSERT INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
              ).bind(device, carnetId, prenomPrive, "member", now).run();
            }
            const { results: deja } = await db.prepare(
              `SELECT f.titre FROM Fiches f JOIN FichesCarnets fc ON fc.fiche_id=f.id WHERE fc.carnet_id=?`
            ).bind(carnetId).all();
            const vues = new Set(deja.map((x) => normNom(x.titre)));
            const DEMO = [
              ["Météoreat", "12 rue des Marronniers, 75011 Paris", 93, "Punaise, c'était bon — le menu du soir est une leçon"],
              ["L'Arpège", "84 rue de Varenne, 75007 Paris", 100, "Le repas d'une vie"],
              ["Chez Norbert", "Lyon 2e", 0, null],
              ["Le Petit Bistrot", "Bordeaux", 85, "Bistrot comme on les aime"],
              ["Boulangerie Dupont", "Strasbourg", 0, null],
              ["Café Meridian", "10 rue de la République, 69002 Lyon", 88, "Le latte du samedi matin"],
              ["La Petite Chaise", "36 rue de Grenelle, 75007 Paris", 77, "Brasserie classique, un peu daté"],
              ["Bar du Marché", "Nice", 0, null],
              ["Trattoria Rossi", "4 rue Sainte-Catherine, 33000 Bordeaux", 90, "Les pâtes fraîches du mardi"],
              ["Fruits et Légumes Chez Malika", "Montreuil", 0, null],
            ];
            let ajoutees = 0;
            for (const [titre, lieu, note, com] of DEMO) {
              const cle = normNom(titre);
              if (vues.has(cle)) continue;
              vues.add(cle);
              const id = crypto.randomUUID();
              await db.prepare(
                `INSERT INTO Fiches (id, auteur, type, cat, titre, lieu, note, com, photo, recette, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`
              ).bind(id, "Demo", "adresse", null, titre, lieu, note, com, null, null, now).run();
              await db.prepare(`INSERT INTO FichesCarnets (fiche_id, carnet_id) VALUES (?,?)`).bind(id, carnetId).run();
              ajoutees++;
            }
            logEvent(db, "demo_prive", { device, meta: { ajoutees } });
            return json({ ok: true, carnetId, ajoutees });
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
              `UPDATE Fiches SET titre=COALESCE(?,titre), com=COALESCE(?,com), recette=COALESCE(?,recette), note=COALESCE(?,note), photo=COALESCE(?,photo), lieu=COALESCE(?,lieu) WHERE id=?`
            ).bind(patch.titre != null ? cleanText(patch.titre, 60) : null,
              patch.com != null ? cleanText(patch.com, 500) : null,
              patch.recette != null ? cleanText(patch.recette, 4000) : null,
              patch.note != null ? Math.min(100, Math.max(70, parseInt(patch.note, 10) || 80)) : null,
              patch.photo !== undefined ? String(patch.photo).slice(0, 400000) : null,
              patch.lieu != null ? cleanText(patch.lieu, 80) : null,
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

          // V0.4.78 : avatar synchronisé — chaque appareil du même membre le reçoit au bootstrap.
          case "setAvatar": {
            if (typeof p.avatar !== "string" || p.avatar.length > 150000)
              return json({ error: "avatar invalide" }, 400);
            const { results: sessMoi } = await db.prepare(
              `SELECT carnet_id, prenom FROM Sessions WHERE device_id=?`
            ).bind(device).all();
            let n = 0;
            for (const sess of sessMoi) {
              await db.prepare(`UPDATE Membres SET avatar=? WHERE carnet_id=? AND prenom=?`)
                .bind(p.avatar, sess.carnet_id, sess.prenom).run();
              n++;
            }
            return json({ ok: true, carnets: n });
          }

          // V0.4.84 « Retrouver mes carnets » : prénom + code personnel (le même
          // partout, hashé dans Membres.code_recup) et cet appareil récupère TOUT —
          // carnets ET espace privé G-Maps. Un appareil qui perd son stockage local
          // (purge iOS, réinstallation, nouveau téléphone) ne retape plus rien.
          case "recuperer": {
            const prenomR = cleanPrenom(p.prenom);
            const codeR = String(p.code || "").replace(/\D/g, "");
            if (!prenomR || ![4, 6].includes(codeR.length)) return json({ error: "code_invalide" }, 400);
            const { results: mbs } = await db.prepare(
              `SELECT carnet_id, code_recup FROM Membres WHERE LOWER(prenom)=LOWER(?)`
            ).bind(prenomR).all();
            // V0.4.86 : la référence = un code qui vérifie. Les membres sans code
            // (d'avant la V0.4.67, ex. famille-b) sont rattachés avec ce hash au
            // lieu d'être ignorés — sinon le carnet restait invisible à la récup.
            let refHash = null;
            for (const m of mbs) {
              if (m.code_recup && (await verifyCode(codeR, m.code_recup))) { refHash = m.code_recup; break; }
            }
            if (!refHash) return json({ error: "code_refuse" });
            let retrouves = 0;
            for (const m of mbs) {
              if (!m.code_recup)
                await db.prepare(`UPDATE Membres SET code_recup=? WHERE carnet_id=? AND LOWER(prenom)=LOWER(?)`)
                  .bind(refHash, m.carnet_id, prenomR).run();
              const cn = await db.prepare(`SELECT admin FROM Carnets WHERE id=?`).bind(m.carnet_id).first();
              const role = cn && cn.admin === prenomR ? "admin" : "member";
              const dej = await db.prepare(
                `SELECT 1 FROM Sessions WHERE device_id=? AND carnet_id=?`
              ).bind(device, m.carnet_id).first();
              if (!dej)
                await db.prepare(
                  `INSERT INTO Sessions (device_id, carnet_id, prenom, role, created_at) VALUES (?,?,?,?,?)`
                ).bind(device, m.carnet_id, prenomR, role, now).run();
              retrouves++;
            }
            // G-Maps suit la personne : l'espace privé récupéré hérite du code
            // personnel (hash copié tel quel — le même code vérifie pareil).
            {
              const { results: srcCode } = await db.prepare(
                `SELECT code_recup FROM Membres WHERE LOWER(prenom)=LOWER(?) AND code_recup IS NOT NULL LIMIT 1`
              ).bind(prenomR).all();
              if (srcCode.length) {
                const { results: privSansCode } = await db.prepare(
                  `SELECT m.carnet_id, m.prenom FROM Membres m JOIN Carnets c ON c.id=m.carnet_id
                   WHERE c.prive='1' AND LOWER(m.prenom)=LOWER(?) AND m.code_recup IS NULL`
                ).bind(prenomR).all();
                for (const pv of privSansCode)
                  await db.prepare(`UPDATE Membres SET code_recup=? WHERE carnet_id=? AND prenom=?`)
                    .bind(srcCode[0].code_recup, pv.carnet_id, pv.prenom).run();
              }
            }
            logEvent(db, "recuperer", { device, prenom: prenomR, meta: { retrouves } });
            return json({ ok: true, carnets: retrouves });
          }

          case "addFlash": {
            // V0.4.97 : le client envoie carnets: [ids] (multi-carnet) — un flash
            // par carnet en base (schéma : carnet_id unique par ligne Flashes).
            const fl = p.flash || {};
            const carnetIds = (Array.isArray(fl.carnets) ? fl.carnets : []).filter(Boolean);
            if (!carnetIds.length && fl.carnetId) carnetIds.push(fl.carnetId);
            if (!carnetIds.length) return json({ error: "aucun carnet" }, 400);
            const expires = new Date(Date.now() + 7 * 864e5).toISOString();
            const created = [];
            for (const cid of carnetIds) {
              const s = await sessionOf(cid);
              if (!s) continue; // pas membre de ce carnet : on l'ignore, pas d'échec global
              const id = crypto.randomUUID();
              await db.prepare(
                `INSERT INTO Flashes (id, carnet_id, auteur, photo, com, created_at, expires_at) VALUES (?,?,?,?,?,?,?)`
              ).bind(id, cid, s.prenom, typeof fl.photo === "string" ? fl.photo.slice(0, 400000) : "",
                typeof fl.com === "string" ? fl.com.slice(0, 500) : null, now, expires).run();
              created.push({ id, carnets: [cid], auteur: s.prenom, photo: fl.photo, com: fl.com || null, date: now, reacts: [] });
              const cnom = await db.prepare(`SELECT nom FROM Carnets WHERE id=?`).bind(cid).first();
              devicesOfCarnet(db, cid, s.prenom).then((devs) =>
                sendPushTo(env, db, devs, {
                  title: s.prenom + " a flashé",
                  body: "Nouveau flash dans « " + (cnom ? cnom.nom : "un carnet") + " » — 7 jours pour l’aimer ♥",
                  url: "/",
                })
              ).catch(() => {});
            }
            if (!created.length) return json({ error: "pas membre" }, 403);
            logEvent(db, "flash", { device, prenom: created[0].auteur, carnet: carnetIds.join(",") });
            return json({ flashes: created, flash: created[0] });
          }

          case "copierFiches": {
            // V0.4.97 : nourrir un carnet fraîchement créé avec des fiches existantes.
            // On ajoute des LIENS fiche↔carnet (INSERT OR IGNORE idempotent) — la
            // fiche reste dans son carnet d'origine, c'est la même fiche partagée
            // (modifications et likes communs), pas une copie.
            const ficheIds = (Array.isArray(p.ficheIds) ? p.ficheIds : []).slice(0, 100);
            const vers = String(p.vers || "");
            if (!ficheIds.length || !vers) return json({ error: "rien a copier" }, 400);
            const sVers = await sessionOf(vers);
            if (!sVers) return json({ error: "pas membre" }, 403);
            const vPriv = await db.prepare(`SELECT prive FROM Carnets WHERE id=?`).bind(vers).first();
            if (vPriv && vPriv.prive === "1") return json({ error: "carnet prive" }, 403);
            let copiees = 0;
            for (const fid of ficheIds) {
              const { results: liens } = await db.prepare(`SELECT carnet_id FROM FichesCarnets WHERE fiche_id=?`).bind(fid).all();
              if (!liens.length) continue;
              // Droit : l'appareil doit être membre d'au moins un carnet qui contient la fiche.
              let autorise = false;
              for (const l of liens) { if (await sessionOf(l.carnet_id)) { autorise = true; break; } }
              if (!autorise) continue;
              await db.prepare(`INSERT OR IGNORE INTO FichesCarnets (fiche_id, carnet_id) VALUES (?,?)`).bind(fid, vers).run();
              copiees++;
            }
            logEvent(db, "copier_fiches", { device, prenom: sVers.prenom, carnet: vers, meta: { n: copiees } });
            return json({ ok: true, copiees });
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
                  `SELECT DISTINCT f.id FROM Fiches f JOIN FichesCarnets l ON l.fiche_id = f.id WHERE l.carnet_id=? AND f.auteur=?`
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

          case "rename": {
            // Changer de prénom : le serveur vérifie les doublons dans TOUS les carnets
            // de l'appareil (casse indifférente), puis renomme partout — membres,
            // sessions, notes, likes, commentaires, demandes, flashes, admin.
            const nvP = cleanPrenom(p.nouveau);
            const ancienP = cleanPrenom(p.ancien);
            if (!nvP) return json({ error: "Prénom vide" }, 400);
            if (nvP === ancienP) return json({ error: "C'est déjà ton prénom" }, 400);
            const { results: sesRename } = await db.prepare(
              `SELECT carnet_id, prenom FROM Sessions WHERE device_id=?`
            ).bind(device).all();
            if (!sesRename.length) return json({ error: "aucune session" }, 404);
            // Conflit : un AUTRE membre porte déjà ce prénom dans un de mes carnets
            const conflits = [];
            for (const se of sesRename) {
              if (se.prenom === nvP) continue;
              const { results: mm } = await db.prepare(
                `SELECT prenom FROM Membres WHERE carnet_id=? AND prenom<>? AND lower(prenom)=lower(?)`
              ).bind(se.carnet_id, se.prenom, nvP).all();
              if (mm.length) {
                const c = await db.prepare(`SELECT nom FROM Carnets WHERE id=?`).bind(se.carnet_id).first();
                conflits.push(c ? c.nom : "?");
              }
            }
            if (conflits.length) return json({ error: "prenom_pris", carnets: conflits });
            for (const se of sesRename) {
              if (se.prenom === nvP) continue;
              const old = se.prenom;
              const fichesC = `SELECT fiche_id FROM FichesCarnets WHERE carnet_id=?`;
              await db.prepare(`INSERT OR IGNORE INTO Membres (carnet_id, prenom) VALUES (?,?)`).bind(se.carnet_id, nvP).run();
              await db.prepare(`DELETE FROM Membres WHERE carnet_id=? AND prenom=?`).bind(se.carnet_id, old).run();
              await db.prepare(`UPDATE Sessions SET prenom=? WHERE device_id=? AND carnet_id=?`).bind(nvP, device, se.carnet_id).run();
              await db.prepare(`UPDATE Carnets SET admin=? WHERE id=? AND admin=?`).bind(nvP, se.carnet_id, old).run();
              await db.prepare(`UPDATE Fiches SET auteur=? WHERE auteur=? AND id IN (${fichesC})`).bind(nvP, old, se.carnet_id).run();
              await db.prepare(`INSERT OR IGNORE INTO FicheLikes (fiche_id, prenom) SELECT fiche_id, ? FROM FicheLikes WHERE prenom=? AND fiche_id IN (${fichesC})`).bind(nvP, old, se.carnet_id).run();
              await db.prepare(`DELETE FROM FicheLikes WHERE prenom=? AND fiche_id IN (${fichesC})`).bind(old, se.carnet_id).run();
              await db.prepare(`UPDATE FicheComments SET prenom=? WHERE prenom=? AND fiche_id IN (${fichesC})`).bind(nvP, old, se.carnet_id).run();
              await db.prepare(`INSERT OR IGNORE INTO DemandesRecette (fiche_id, prenom, created_at) SELECT fiche_id, ?, created_at FROM DemandesRecette WHERE prenom=? AND fiche_id IN (${fichesC})`).bind(nvP, old, se.carnet_id).run();
              await db.prepare(`DELETE FROM DemandesRecette WHERE prenom=? AND fiche_id IN (${fichesC})`).bind(old, se.carnet_id).run();
              await db.prepare(`UPDATE Flashes SET auteur=? WHERE auteur=? AND carnet_id=?`).bind(nvP, old, se.carnet_id).run();
              await db.prepare(`INSERT OR IGNORE INTO FlashReactions (flash_id, prenom) SELECT flash_id, ? FROM FlashReactions WHERE prenom=? AND flash_id IN (SELECT id FROM Flashes WHERE carnet_id=?)`).bind(nvP, old, se.carnet_id).run();
              await db.prepare(`DELETE FROM FlashReactions WHERE prenom=? AND flash_id IN (SELECT id FROM Flashes WHERE carnet_id=?)`).bind(old, se.carnet_id).run();
            }
            logEvent(db, "rename", { device, prenom: nvP });
            return json({ ok: true, prenom: nvP });
          }

          case "go": {
            // Mesure H1-H4 : la fiche se transforme en action (bouton On y va -> Maps).
            logEvent(db, "go", { device, meta: { fiche: cleanText(p.id, 64) } });
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
