# Changelog

## 0.2.1 — Quitter un carnet

- Bouton « Quitter ce carnet » (visible si tu n'es pas admin) avec popin de confirmation : avertissement explicite — plus aucune notif du groupe, publications retirées du fil, aucune récupération possible, retour uniquement sur nouvelle invitation.
- Côté serveur : action `leaveCarnet` vérifie la session de l'appareil, refuse l'admin, supprime la Session (et le Membre s'il n'a plus aucun appareil). Purge locale du fil et bascule automatique sur un autre carnet.
- Disponible aussi en mode démo local.

## 0.2.0 — Identité et sécurité

- Identité par appareil (UUID local) : table Sessions (device × carnet, rôle member/admin), rôles vérifiés côté serveur sur chaque mutation.
- Code admin hashé SHA-256 + sel, séparé du code d'invitation (régénérable sans exclure les membres).
- Récupération : l'appareil de création garde la session admin ; sinon, nouveau code depuis un appareil admin actif.

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
