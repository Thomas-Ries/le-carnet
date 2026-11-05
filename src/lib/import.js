// V0.4.72 — Parsing LOCAL des exports Google (l'app « Google Maps » n'a pas
// d'export : tout passe par takeout.google.com, formats .kml / .csv / .json).
// Aucune donnée ne quitte l'appareil avant que l'utilisateur valide l'import.
// Tolérant par conception : les colonnes/clés de Takeout varient selon les comptes.

const valk = (obj, mots) => {
  for (const k of Object.keys(obj || {})) {
    if (mots.some((m) => k.toLowerCase() === m || k.toLowerCase().includes(m))) {
      const v = obj[k];
      if (v && typeof v !== "object") return v;
    }
  }
  return undefined;
};

const champ = (obj, mots) => {
  for (const k of Object.keys(obj || {})) {
    if (mots.some((m) => k.toLowerCase().includes(m))) {
      const v = obj[k];
      if (v && typeof v !== "object") return String(v).trim();
    }
  }
  return "";
};

// ---- Lieux : KML / CSV / JSON ----------------------------------------------

export function parseLieux(nomFichier, texte) {
  const t = String(texte || "");
  if (!t.trim()) return { erreur: "Fichier vide." };
  const n = (nomFichier || "").toLowerCase();
  if (n.endsWith(".kml") || n.endsWith(".xml") || t.includes("<kml") || t.includes("<Placemark")) return parseKML(t);
  if (n.endsWith(".json") || t.trim().startsWith("{") || t.trim().startsWith("[")) return parseLieuxJSON(t);
  return parseCSV(t);
}

function parseKML(t) {
  const doc = new DOMParser().parseFromString(t, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) return { erreur: "KML illisible." };
  const items = [...doc.getElementsByTagName("Placemark")].map((pm) => ({
    titre: (pm.getElementsByTagName("name")[0]?.textContent || "").trim().slice(0, 60),
    lieu: (pm.getElementsByTagName("address")[0]?.textContent
      || pm.getElementsByTagName("description")[0]?.textContent || "").trim().slice(0, 60),
  })).filter((x) => x.titre);
  if (!items.length) return { erreur: "Aucun lieu trouvé dans ce KML — exporte « Maps (vos adresses) » depuis takeout.google.com." };
  return { items: items.slice(0, 300) };
}

function parseCSV(t) {
  const lignes = t.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lignes.length < 2) return { erreur: "CSV trop court — vérifie que c'est l'export Takeout « Maps (vos adresses) »." };
  const sep = lignes[0].includes(";") ? ";" : lignes[0].includes("\t") ? "\t" : ",";
  const split = (l) => {
    const out = [];
    let cur = "", q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === sep && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };
  const head = split(lignes[0]).map((h) => h.toLowerCase());
  const idxNom = head.findIndex((h) => /(title|titre|name|nom|place|lieu)/.test(h));
  const idxAddr = head.findIndex((h) => /(address|adresse|note|url|comment)/.test(h));
  const items = [];
  for (const l of lignes.slice(1, 301)) {
    const cols = split(l);
    const titre = (cols[idxNom >= 0 ? idxNom : 0] || "").slice(0, 60);
    if (!titre) continue;
    let lieu = (cols[idxAddr >= 0 ? idxAddr : 1] || "").slice(0, 60);
    let note = 0;
    // Colonne « Note/Rating » : si c'est un simple 1-5, c'est une note d'etoiles.
    if (idxAddr >= 0 && /(note|rating|star)/.test(head[idxAddr]) && /^[1-5]$/.test((cols[idxAddr] || "").trim())) {
      note = NOTE_DES_ETOILES[Number(cols[idxAddr])] || 0;
      lieu = "";
    }
    items.push({ titre, lieu, note });
  }
  if (!items.length) return { erreur: "Aucune ligne exploitable dans ce CSV — vérifie les colonnes." };
  return { items };
}

// Prend le premier tableau d'objets trouvé, quel que soit l'habillage JSON.
function premierTableau(v, prof) {
  if (prof > 4) return null;
  if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
  if (v && typeof v === "object") {
    for (const k of Object.keys(v)) {
      const r = premierTableau(v[k], prof + 1);
      if (r) return r;
    }
  }
  return null;
}

function parseLieuxJSON(t) {
  let data;
  try { data = JSON.parse(t); } catch (e) { return { erreur: "JSON illisible." }; }
  const arr = premierTableau(data, 0);
  if (!arr) return { erreur: "Aucune liste de lieux dans ce JSON." };
  const items = arr.map((o) => {
    const apl = { ...(o.properties || o.details || {}), ...o };
    return ({
    titre: champ(apl, ["title", "titre", "name", "nom", "label", "place"]).slice(0, 60),
    lieu: champ(apl, ["address", "adresse", "vicinity", "formattedaddress", "snippet"]).slice(0, 60),
  });}).filter((x) => x.titre);
  if (!items.length) return { erreur: "Aucun lieu reconnu dans ce JSON (champs inattendus)." };
  return { items: items.slice(0, 300) };
}

// ---- Avis : JSON (optionnel) ----------------------------------------------

const NOTE_DES_ETOILES = { 1: 70, 2: 78, 3: 85, 4: 93, 5: 100 };

export function parseAvis(nomFichier, texte) {
  const t = String(texte || "");
  if (!t.trim()) return { erreur: "Fichier vide." };
  let data;
  try { data = JSON.parse(t); } catch (e) { return { erreur: "JSON illisible — vérifie que c'est l'export Takeout « Maps (vos adresses) » (fichier d'avis)." }; }
  const aviss = [];
  const visite = (v, prof) => {
    if (prof > 5) return;
    if (Array.isArray(v)) { v.forEach((x) => visite(x, prof + 1)); return; }
    if (!v || typeof v !== "object") return;
    const note = Number(valk(v, ["rating", "stars", "note", "starrating", "score"]) ?? NaN);
    const com = champ(v, ["text", "comment", "review", "contenu", "avis"]);
    const titre = champ(v, ["title", "titre", "name", "nom", "place", "location"]);
    if (!Number.isNaN(note) && note >= 1 && note <= 5 && (titre || com)) {
      aviss.push({
        titre: titre.slice(0, 60),
        note: NOTE_DES_ETOILES[Math.round(note)] || 85,
        com: com.slice(0, 500),
      });
    }
    Object.values(v).forEach((x) => visite(x, prof + 1));
  };
  visite(data, 0);
  if (!aviss.length) return { erreur: "Aucun avis exploitable dans ce fichier (note ★ + nom de lieu attendus). Vos lieux sont quand même importables sans lui." };
  return { items: aviss.slice(0, 500) };
}
