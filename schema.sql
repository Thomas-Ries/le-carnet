-- Le Carnet — schéma D1 (Cloudflare)
-- Exécuter dans le dashboard Cloudflare : Storage & Databases > D1 > Console

CREATE TABLE IF NOT EXISTS Carnets (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,          -- code carnet 6 chiffres (invitation)
  admin TEXT NOT NULL,
  admin_code TEXT NOT NULL,           -- V1 réelle : hasher (SHA-256 + sel)
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Membres (
  carnet_id TEXT NOT NULL REFERENCES Carnets(id),
  prenom TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (carnet_id, prenom)
);

CREATE TABLE IF NOT EXISTS Fiches (
  id TEXT PRIMARY KEY,
  auteur TEXT NOT NULL,
  type TEXT NOT NULL,                -- 'adresse' | 'recette'
  cat TEXT,
  titre TEXT NOT NULL,
  lieu TEXT,
  note INTEGER NOT NULL,              -- 70-100
  com TEXT,
  photo TEXT,                         -- dataURL compressée (V1) — R2 en V2
  recette TEXT,
  created_at TEXT NOT NULL
);

-- Une fiche peut appartenir à N carnets
CREATE TABLE IF NOT EXISTS FichesCarnets (
  fiche_id TEXT NOT NULL REFERENCES Fiches(id),
  carnet_id TEXT NOT NULL REFERENCES Carnets(id),
  PRIMARY KEY (fiche_id, carnet_id)
);

CREATE TABLE IF NOT EXISTS FicheLikes (
  fiche_id TEXT NOT NULL REFERENCES Fiches(id),
  prenom TEXT NOT NULL,
  PRIMARY KEY (fiche_id, prenom)
);

CREATE TABLE IF NOT EXISTS Flashes (
  id TEXT PRIMARY KEY,
  carnet_id TEXT NOT NULL REFERENCES Carnets(id),
  auteur TEXT NOT NULL,
  photo TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL            -- +7 jours
);

CREATE TABLE IF NOT EXISTS FlashReactions (
  flash_id TEXT NOT NULL REFERENCES Flashes(id),
  prenom TEXT NOT NULL,
  PRIMARY KEY (flash_id, prenom)
);

CREATE TABLE IF NOT EXISTS DemandesRecette (
  fiche_id TEXT NOT NULL REFERENCES Fiches(id),
  prenom TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (fiche_id, prenom)
);

CREATE INDEX IF NOT EXISTS idx_liens_carnet ON FichesCarnets(carnet_id);
CREATE INDEX IF NOT EXISTS idx_flash_expiry ON Flashes(expires_at);
