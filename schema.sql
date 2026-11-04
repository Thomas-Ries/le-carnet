DROP TABLE IF EXISTS PushSubscriptions;
DROP TABLE IF EXISTS DemandesRecette;
DROP TABLE IF EXISTS FlashReactions;
DROP TABLE IF EXISTS Flashes;
DROP TABLE IF EXISTS FicheLikes;
DROP TABLE IF EXISTS FichesCarnets;
DROP TABLE IF EXISTS Fiches;
DROP TABLE IF EXISTS Sessions;
DROP TABLE IF EXISTS Membres;
DROP TABLE IF EXISTS Carnets;

CREATE TABLE IF NOT EXISTS Carnets (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  admin TEXT NOT NULL,
  admin_code_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Membres (
  carnet_id TEXT NOT NULL REFERENCES Carnets(id),
  prenom TEXT NOT NULL,
  PRIMARY KEY (carnet_id, prenom)
);

CREATE TABLE IF NOT EXISTS Sessions (
  device_id TEXT NOT NULL,
  carnet_id TEXT NOT NULL REFERENCES Carnets(id),
  prenom TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL,
  PRIMARY KEY (device_id, carnet_id)
);

CREATE TABLE IF NOT EXISTS Fiches (
  id TEXT PRIMARY KEY,
  auteur TEXT NOT NULL,
  type TEXT NOT NULL,
  cat TEXT,
  titre TEXT NOT NULL,
  lieu TEXT,
  note INTEGER NOT NULL,
  com TEXT,
  photo TEXT,
  recette TEXT,
  created_at TEXT NOT NULL
);

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
  com TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  reminded_at TEXT
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

CREATE TABLE IF NOT EXISTS PushSubscriptions (
  device_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_liens_carnet ON FichesCarnets(carnet_id);
CREATE INDEX IF NOT EXISTS idx_flash_expiry ON Flashes(expires_at);
CREATE INDEX IF NOT EXISTS idx_session_device ON Sessions(device_id);
