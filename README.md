# Le Carnet

Le carnet d'adresses aimées, partagé par cercles privés (famille, copains, boulot). On y note après coup — « punaise, c'était bon » — les restos, cavistes, bars, fromageries et recettes qu'on a aimés, pour les retrouver au moment de choisir.

PWA · Vue 3 + Vite 7 + Pinia 3 + Tailwind v4 · Backend Cloudflare D1 · Mode démo hors ligne inclus.

## Démarrer

```bash
npm install
npm run dev
```

Sans backend configuré, l'app démarre automatiquement en **mode démo** (données en `localStorage`, 3 carnets seedés : famille, copains, boulot). Tout est testable : fiches, flashes, likes, admin, invitation.

## Structure

```
src/
  main.js, router.js, style.css        # entrée, routes, tokens charte (light/dark)
  stores/carnet.js                      # Pinia : état, actions, boot 2,5 s
  lib/  api.js demo.js icons.js util.js
  components/  Ic, Avatar, NoteBadge, FicheRow, FlashSheet, CompleteFlashSheet
  views/  Home, Ajouter, Fiche, Carnet, Profil, Join, Admin
public/
  _worker.js        # worker Pages : GET /api/bootstrap, POST /api/mutate
  manifest.webmanifest, logo.svg
schema.sql            # schéma D1 à exécuter dans le dashboard Cloudflare
```

## Déploiement (Cloudflare, plan gratuit)

1. **D1** : dashboard Cloudflare → Storage & Databases → D1 → Create database (ex. `le-carnet`), puis Console → coller/exécuter `schema.sql`.
2. **Pages** : Create project → **Direct Upload** → uploader le contenu de `dist/` (après `npm run build`).
3. **Binding** : projet Pages → Settings → Bindings → D1 database, nom de la variable **`DB`**.
4. Ajouter `public/icons/icon-192.png` et `icon-512.png` (exportés depuis `public/logo.svg`).

L'app détecte l'API seule : si `/api/bootstrap` répond, elle quitte le mode démo.

## Points d'attention V1 réelle (avant mise en prod publique)

- **Hasher le code admin** côté worker (SHA-256 + sel) — en démo il est en clair.
- **Purger les flashes expirés** : le worker filtre déjà à la lecture (`expires_at`), ajouter un cron de nettoyage.
- **R2 pour les photos** : les images sont en dataURL compressée (900px, q0.72) dans D1 en V1 ; basculer sur R2 dès que le trafic monte.
- **Push VAPID** : le rappel J-6 des flashes et la notif de complétion sont prévus côté produit, à brancher sur Web Push.
- **RGPD** : export JSON du carnet + suppression de compte à prévoir.

## Charte

Crème `#FAF6F1` · bordeaux `#7A2E3E` · or `#A8842C` · riesling `#D9C589` · vert `#4A7856` · serif Georgia · zéro emoji en UI (SVG outline) · splash 2,5 s · notes 70-100.

## Licence

Projet personnel — Thomas Ries.

## Identité, sécurité et récupération des codes (V0.2)

- **Pas de compte, pas de mot de passe** : chaque appareil génère un ID unique (UUID, `localStorage`) au premier lancement. C'est lui — pas le prénom — qui identifie les sessions côté serveur (table `Sessions`).
- **Sessions par appareil** : chaque (appareil, carnet) a un rôle (`member`/`admin`). Le worker vérifie les droits sur **chaque** mutation : un simple membre ne peut ni retirer quelqu'un, ni régénérer un lien, ni éditer la fiche d'un autre.
- **Deux codes séparés** : le **code d'invitation** (6 chiffres, partageable, régénérable par l'admin — l'ancien lien meurt, les membres restent) et le **code admin** (personnel, choisi à la création avec double saisie).
- **Code admin hashé** côté serveur : SHA-256 + sel aléatoire (format `sel$hash` dans `Carnets.admin_code_hash`). Jamais en clair, jamais renvoyé par l'API.
- **Récupération** : l'appareil de création garde une session admin permanente — tu n'y tapes jamais le code. Pour devenir admin sur un autre appareil : code admin (une fois par appareil). **Si tu perds le code admin** : change-le depuis n'importe quel appareil où la session admin est encore active (Admin → « Changer mon code admin »). Si tu perds à la fois le code ET tous les appareils admin → pas de récupération en V1 (assumé : c'est un carnet familial, pas une banque).
