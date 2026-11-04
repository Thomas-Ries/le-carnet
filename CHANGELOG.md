# Changelog

## 0.2.0 — Identité par appareil, sécurité et récupération

- ID d'appareil unique (UUID) : l'identité repose sur l'appareil, pas sur le prénom.
- Sessions serveur (appareil × carnet) avec rôles, vérifiés sur chaque mutation.
- Code admin hashé (SHA-256 + sel), séparé du code d'invitation.
- Régénération du lien d'invitation et changement du code admin par l'admin.
- Codes affichés une seule fois à la création, avec double saisie.
- Worker : nettoyage des entrées, limites de taille, likes/demandes renvoyés par l'API.

## 0.1.0 — Scaffold V1

- Carnets par cercle (famille, amis, boulot), gouvernance type Family Album : créateur = admin, code 6 chiffres choisi par l'admin, retrait de membres.
- Fiches Adresse (chips catégories : Resto, Caviste, Bar, Fromagerie, Boulangerie…) et Recette (texte optionnel, bouton « Demander la recette »).
- Multi-carnets : une fiche peut être notée dans plusieurs carnets à la fois.
- Flash : FAB caméra + éclair, photo → carnets → stories circulaires 7 jours ; seul le créateur complète (devient fiche), les autres likent ; rappel J-6 et notif de complétion à venir.
- Likes cœur or plein, 2 états très contrastés.
- Profil : prénom, avatar photo, mode sombre (palette chaude), lien d'invitation copiable.
- Onboarding /join : prénom + code carnet ; tout invité peut créer son propre carnet.
- PWA : manifest maison, splash 2,5 s, tokens CSS light/dark Tailwind v4.
- Mode démo hors ligne (localStorage) + worker D1 (`/api/bootstrap`, `/api/mutate`) + `schema.sql`.
