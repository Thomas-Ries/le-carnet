# Changelog

## V0.4.32 — Fix photo : chargement robuste + aperçu réel

- Diagnostic prod (carnet de test) : le serveur stocke et renvoie parfaitement les photos (testé de 1 Ko à 400 Ko). L'échec était côté iPhone : décodage d'une photo via dataURL en entrée d'Image, fragile sur WebKit — et **100 % silencieux** (aucun aperçu dans la vue d'ajout, aucune erreur affichée).
- Nouveau `chargerPhoto(file)` dans util.js : décodage via **objectURL** (fiable sur iOS), rejet explicite si le fichier n'est pas une image ou si le décodage échoue.
- AjouterView : **aperçu réel de la photo** (4:3) avant d'enregistrer + bouton retirer + toast « Photo illisible » en cas d'échec (plus jamais muet).
- FicheView (édition) et FlashSheet : même durcissement, même toast d'erreur.
- `e.target.value = ""` après chaque sélection : on peut re-choisir le même fichier après un échec.
- **Fix worker `deleteFiche`** : le DELETE de la fiche s'exécutait AVANT celui de ses lignes enfants, donc FOREIGN KEY constraint : toute suppression de fiche échouait en prod (vérifié en direct). Les enfants (FichesCarnets, FicheLikes, DemandesRecette) sont maintenant supprimés en premier.

## V0.4.31 — Profil allégé

- Suppression de la section « Inviter dans un carnet » du profil : redondante avec le partage intégré dans la vue Carnet (WhatsApp / SMS / Copier par carnet).
- Nettoyage du script associé (select, lien, texte d'invitation, imports inutilisés).

## 0.4.30 — Lisibilité : toasts opaques, icônes de partage, photo plein cadre, profil réordonné

- Toasts : fond opaque (surface) + liseré or — plus de transparence, « Carnet créé » se lit parfaitement sur tout fond.
- Partage : bulle WhatsApp redessinée (points bien inscrits dans la bulle) et vraie icône SMS (bulle carrée de message) au lieu du smartphone.
- Photo d'une note : cadre 4:3 plein tapé moins tronqué, et tap = visionneuse plein écran (tap à nouveau pour fermer).
- Profil : « Mes carnets » remonte juste sous Mon activité avec un bouton « Gérer et partager mes carnets » ; l'invitation suit juste après ; une fois la PWA installée, sa carte descend en bas des réglages.

## 0.4.29 — Super admin : reprise globale par phrase de passe

- Écran d'accueil : lien discret « C'est ton appli à toi ? Reprends tous tes carnets » → la phrase de passe du créateur restaure des sessions admin sur TOUS les carnets, sur n'importe quel appareil (même après un drop de base ou un téléphone neuf).
- Sécurité : seul le SHA-256 de la phrase vit côté serveur, dans la variable d'environnement Pages SUPER_ADMIN_HASH (à définir dans le dashboard, jamais en clair). Phrase obligatoirement longue (≥ 8, recommandé 12+). Le mot de passe ne transite jamais en clair dans l'app au-delà de la requête.
- Vérification refusée silencieusement (ok:false) sans distinction d'origine.

## 0.4.28 — UI codes : masquage, placeholders discrets, badge de confirmation pastel

- Le code admin est masqué à la saisie (champ mot de passe) avec une icône œil pour l'afficher — création, confirmation, déverrouillage admin, changement de code et reprise sur nouvel appareil.
- Placeholders plus petits et plus discrets partout (capés à 15 px, sans tracking large). Exemples d'invitation : « famille-A ou spice-girls ».
- Les toasts deviennent un badge de confirmation pastel : coche SVG, fond doux charte, animation d'entrée (carnet créé, code changé, note créée, changements sauvegardés…).
- Corrections de cohérence 4/6 chiffres : boutons « Reprendre mon carnet », « Déverrouiller » et « Changer le code » acceptent désormais les codes de 4 chiffres.

## 0.4.27 — Invitation par mot-clé + code admin 4 ou 6 chiffres

- L'invitation devient un MOT-CLÉ de 4 à 15 caractères (minuscules, sans accents, chiffres et tirets ; « Pâques 2027 » → « paques-2027 »), plus mémorisable et partageable à l'oral qu'un numéro. Auto-généré en syllabes prononçables si vide ; unique entre carnets.
- Le code admin passe à 4 OU 6 chiffres (au choix), obligatoirement différent du mot-clé d'invitation, à la création comme au changement.
- Join, création, récupération admin, régénération d'invitation, liens WhatsApp/SMS et messages alignés partout.
- ⚠️ Migration : les anciens carnets en 6 chiffres ne matchent plus le validateur côté join — à recréer sur une base propre (DROP + schema.sql), comme prévu.

## 0.4.26 — Sécurité codes + fil rafraîchi au retour au premier plan

- Le code admin doit être différent du code d'invitation (refus côté serveur à la création ET au changement de code, message explicite côté client). Sinon tout détenteur du lien d'invitation peut reprendre le carnet en admin.
- Fix « la personne ne voit pas ma note » : une PWA iOS reste en mémoire des jours sans recharger — l'app relance maintenant un bootstrap silencieux quand on la rouvre après >15 s en arrière-plan (et au retour du réseau). Plus besoin de force-quit pour voir les notes des autres.

## 0.4.25 — Splash aligné sur l'icône : cœur riesling dans le badge

- Le cœur du trio du splash passe en riesling (#D9C589), identique à l'icône PWA ; la fourchette et le verre restent blancs.
- (0.4.24b) PNG 192/512 régénérés : cœur entier, motif ×1,10 centré — le bug de rognage est corrigé.

## 0.4.24 — Trio final : fourchette · verre · petit cœur
- Décision de Thomas : l'icône et le splash remplacent le couteau par un cœur plein (riesling dans l'icône, blanc dans le splash) — fourchette · verre · petit cœur.
- logo.svg + PNG 192/512 régénérés dans ce motif (carré plein opaque, motif recentré, zone de sécurité maskable) — PNG livrés dans le canvas.
- Splash (App.vue) : le badge affiche fork · glass · heart(filled).

## 0.4.23 — Nouvelle icône : cœur + fourchette
- Décision produit de Thomas après exploration (livre = religieux, verre seul = Ma Cave, assiette illisible, cœur seul = rencontre) : **fourchette penchée (10°) + cœur riesling** sur badge bordeaux — « l'amour de la table à partager ».
- logo.svg refait dans ce motif ; PNG 192/512 régénérés (carré plein opaque, motif dans la zone de sécurité maskable) — livrés dans le canvas de livraison (le connecteur GitHub corrompt les binaires).

## 0.4.22 — Fix icône iOS : carré plein opaque
- Les PNG 192/512 précédents avaient des coins arrondis TRANSPARENTS : iOS ne supporte pas la transparence sur les icônes d'écran d'accueil (remplacée par du blanc) et rognait le motif. PNG régénérés en carré PLEIN OPAQUE bordeaux bord à bord (iOS arrondit lui-même), motif ramené dans la zone de sécurité maskable (cercle interne 80 %).
- index.html : apple-touch-icon passe du SVG (ignoré par iOS pour l'écran d'accueil) à /icons/icon-192.png.

## 0.4.21 — Récupération admin sur un nouvel appareil (réinstallation)
- Problème : désinstaller/réinstaller la PWA (ou effacer les données) donne un nouvel UUID appareil — rejoindre son propre carnet avec son prénom est refusé (doublon, règle V0.4.13) et l'écran admin ne montre rien (aucun carnet lié au nouvel appareil) : l'admin perdait l'accès sans récupération possible.
- Worker verifyAdmin : identification par code d'invitation en plus de l'id de carnet ; renvoie le carnet complet ; prénom de session = existant, sinon celui envoyé, sinon le nom admin du carnet.
- JoinView : sur « prénom déjà pris », bloc « C'est toi, sur un nouvel appareil ? » — code d'invitation (déjà saisi) + code admin → session admin restaurée.
- Mode démo : même résolution par code d'invitation.

## 0.4.20 — Invitation partageable WhatsApp / SMS
- Les cartes d'invitation (Mes carnets + Profil) passent de l'unique « Copier le lien » à trois boutons : WhatsApp, SMS, Copier.
- Le message part prêt à envoyer : « [Prénom] t'invite dans le carnet « [Nom] » sur Le Carnet — code 123456. Rejoins-le : [lien] » — lien et code voyagent dans le message.
- Helpers texteInvitation/partagerWhatsapp/partagerSms dans util.js ; icônes chat et phone ajoutées (style Heroicons, zéro emoji).

## 0.4.19 — Icône PWA alignée sur le splashscreen
- logo.svg refait au motif exact du splash : badge bordeaux à dégradé (140deg #7A2E3E→#5E2230, coins 27/86), fourchette · verre · couteau en traits blancs, verre plus grand (36/86), gap 2px — mêmes icônes Heroicons que le splash.
- PNG icon-192/512 : à ré-exporter par Thomas depuis logo.svg (le connecteur GitHub corrompt les binaires).

## 0.4.18 — Fix mutations client : format de payload
- BUG RACINE (rendu visible par V0.4.16/V0.4.17) : le client envoyait les champs à plat (`{ action, deviceId, ... }`) alors que le worker lisait `body.payload` → TOUTES les mutations du client échouaient en 400 et basculaient en démo avant V0.4.16. Symptôme : « Le nom du carnet est manquant » alors que le nom était saisi.
- Worker : accepte les deux formats (`payload` imbriqué ou champs à plat) — couvre aussi les vieux bundles PWA encore en cache service worker.

## 0.4.17 — Messages d'erreur explicites sur createCarnet/join
- Worker : le 400 générique « champs invalides » est remplacé par un message qui nomme le champ fautif (nom du carnet, prénom manquant, code admin/invitation invalide) — typiquement après un effacement des données du site, le prénom du profil est vide et bloquait la création sans explication.
- CarnetView : garde-fou client — si le prénom du profil est vide, message clair au lieu d'un appel serveur condamné.

## 0.4.16 — Plus de fausse réussite locale sur un refus serveur

- Un refus du serveur (4xx : validation, droits, doublon de prénom ou de code) remonte maintenant à l'interface avec son message réel — il ne bascule plus jamais silencieusement en mode démo avec un toast de réussite. Seule une vraie panne réseau fait basculer en local.
- Le bandeau « connexion perdue » disparaît dès qu'une mutation atteint à nouveau le serveur.

## 0.4.15 — Correctif création de carnet (V0.2 enfin complète côté UI)

- L'écran « Créer un carnet » était resté V0.1 : un seul champ code envoyé comme codeAdmin manquant → 400 « champs invalides » → bandeau « connexion perdue » + bascule démo, le carnet n'était créé que sur l'appareil. Mise à jour au design V0.2 : code d'invitation (optionnel, généré si vide) + code admin à double saisie. En démo, un code d'invitation est généré si le champ est vide.

## 0.4.14 — Correctif prod : bootstrap en erreur 500 (mode démo forcé)

- Bug D1 : pour un appareil sans session (tout nouvel utilisateur), la requête `IN (NULL)` attendait 0 binding mais le code en passait 1 (« __none__ ») → D1_ERROR « Wrong number of parameter bindings » → /api/bootstrap renvoyait 500 → l'app basculait en mode démo, même en prod. Correction : aucune session = aucun binding. `IN (NULL)` ne retourne aucune ligne, comme prévu.

## 0.4.13 — Prénoms en doublon bloqués

- Un prénom déjà pris dans un carnet est refusé à l'inscription (message sous le champ, retour à l'étape prénom, suggestion d'ajouter une initiale « ex. Sophie M. ») — le doublon ne passe pas tant qu'il n'est pas résolu. Même garde-fou sur le renommage dans le profil, et en mode démo.
- Côté serveur, le contrôle est insensible à la casse et laisse passer le retour d'un appareil qui porte déjà ce prénom (changement d'appareil du même membre). Raison d'être : le retrait de membre par l'admin cible le prénom — deux homonymes seraient partis ensemble.

## 0.4.12 — Splash : trio de couverts plus grand et resserré

- Le badge bordeaux passe à 86 px : verre 36 px, fourchette et couteau 23 px, collés au verre (gap 2 px). Le trio domine le splash comme un vrai logo.

## 0.4.11 — Couverts du splash et du logo ajustés

- Les couverts sont un peu plus grands et plus rapprochés du verre, sur le splash (badge 72 px) comme sur le logo PWA — le trio fourchette/verre/couteau respire mieux. PNG 192/512 à ré-exporter depuis logo.svg.

## 0.4.10 — Splash & PWA : couverts autour du verre

- La barre horizontale du haut du verre est retirée. Le splash et le logo PWA affichent désormais la fourchette, le verre et le couteau — de gauche à droite — pour marquer le côté food : « Le Carnet » parle de restos, cavistes, bars, fromageries… autant que de vins. Nouvelles icônes fork et knife. PNG 192/512 à ré-exporter depuis logo.svg.

## 0.4.9 — Icône de tri + verre de vin

- Le CTA de tri devient une icône seule (barres de tri, entourée d'un rond) — plus compact, s'illumine en bordeaux dès qu'un tri autre que « récent » est actif.
- Le splash troque le livre pour un verre de vin (même tracé que Dégustations entre amis), toujours avec bulles riesling et cœur or. Le logo PWA (logo.svg) adopte le même verre : crème, verre bordeaux, vin riesling, liseré or — à ré-exporter en PNG 192/512.

## 0.4.8 — Accueil : CTA de tri façon e-commerce

- Les pastilles font place à un CTA « Trier : » qui ouvre un menu de choix : Le plus récent (défaut), Le plus aimé, De A à Z (titre, insensible à la casse et aux accents). Le titre de section suit le tri.

## 0.4.7 — Profil : invitation remontée

- La carte « Inviter dans un carnet » remonte juste sous l'installation de l'app, au-dessus de « Réglages & données » : le partage du carnet est le geste de croissance nº1, il doit rester visible en haut du profil.

## 0.4.6 — Accueil : tri Récents / Aimés

- Le filtre « Les préférés d'un proche » laisse place à un toggle de tri en pastilles (pattern Ma Cave) : « Récents » (défaut) ou « Aimés » (cœurs décroissants, égalité au plus récent). Le titre de la section suit le tri.

## 0.4.5 — Profil : réglages en accordéons

- Le profil gagne un bloc unique « Réglages & données » : Notifications, Exporter mes données et Contacter le support deviennent trois accordéons natifs (details/summary, zéro JavaScript) avec état visible même replié (« activées / désactivées ») et chevron qui pivote.
- La page passe de 8 blocs empilés à 6 — environ un écran de défilement gagné. Support toujours réservé aux admins.

## 0.4.4 — Vrai correctif icône active + splash 3,5 s

- Icônes actives : un seul `<path>` par icône (au lieu de chemins découpés) pour que le fill-rule evenodd fonctionne réellement — le rond du pin et l'objectif de la caméra restent des trous une fois l'icône remplie.
- Splashscreen à 3,5 secondes (une de plus pour profiter des animations).

## 0.4.3 — Splash animé

- Splashscreen repensé, fun et animé : carnet bordeaux qui pop, bulles riesling qui montent, petit cœur or qui s'échappe, titre en cascade, les trois cercles (En famille / Entre amis / Pour le boulot), barre riesling qui glisse et la phrase fondatrice « Punaise, c'était bon ! » en or penché.

## 0.4.2 — Bandeau perte de connexion + carte support

- Bandeau bordeaux « Connexion au serveur perdue » si une action n'atteint plus le serveur en cours de session (les actions restent locales, l'app bascule en démo).
- Carte « Contacter le support » dans le profil, réservée aux admins : bouton qui ouvre un email pré-rempli (l'adresse n'est jamais affichée en clair dans l'app).

## 0.4.0 — Notifications push + finitions

- Notifications web push (VAPID, crypto maison aes128gcm/ES256 dans le worker, zéro dépendance) : nouveau flash dans un carnet, adresse notée, rappel J-6 à l'auteur d'un flash qui expire.
- Gestion dans le profil : carte « Notifications » avec interrupteur, réglage propre à chaque appareil (désactivable à tout moment).
- Service worker (sw.js) pour recevoir les notifications ; abonnements stockés en base (PushSubscriptions), purgés automatiquement si l'appareil a désinstallé.
- Tuiles d'accueil explicites : « Noter une adresse » et « Partager une recette ».
- Photo de fiche affichée en médaillon rond cerclé riesling sur les cards de l'accueil.
- Réparations silencieuses détectées : leaveCarnet absent du worker/store/api (V0.2.1 incomplète en prod), photo en édition absente du worker (V0.2.2), et deviceId non transmis sur certaines mutations qui basculait l'app en mode démo — tout est corrigé.
- Schéma : table PushSubscriptions + colonne Flashes.reminded_at → rejouer schema.sql (base vide).
- Backup : workflow GitHub Actions hebdomadaire d'export D1 vers un bucket R2 (voir .github/workflows/backup-d1.yml).

## 0.3.1 — Badges d'activité + finitions

- Profil : section « Mon activité » — adresses notées, recettes partagées, flashes en vie, amour reçu (icônes SVG, zéro emoji).
- Le numéro de version du pied de page du profil suit désormais package.json automatiquement.
- Édition d'une fiche : le bouton « J'aime » est masqué pendant l'édition (on ne like pas sa propre note en train d'être modifiée).

## 0.3.0 — Commentaire sur un flash, bascule en note

- Un flash peut recevoir un commentaire optionnel, dès la prise de vue ou plus tard (seul l'auteur, via « Enregistrer juste le commentaire »).
- Le commentaire s'affiche sur le cercle flash et dans la complétion (il préremplit le futur commentaire de la fiche).
- Règle de vie : flash sans commentaire = 7 jours puis disparition (comme avant) ; flash commenté = 7 jours en flash, puis il devient automatiquement une fiche « en attente » — titre repris du commentaire, note à mettre par l'auteur (badge « à noter »).
- Les likes du flash sont reportés sur la fiche convertie ; les flashes expirés non commentés sont purgés de la base.
- Schéma : colonne `com` sur Flashes. Si ta base D1 contient déjà des données, exécute simplement `ALTER TABLE Flashes ADD COLUMN com TEXT;` au lieu de rejouer schema.sql.

## 0.2.2 — Photo ajoutable en édition

- Le mode édition d'une fiche permet d'ajouter une photo après coup (ou d'en changer / retirer une existante) : même capture que la création (redimensionnement 900 px, JPEG 0,72).
- Côté serveur, `updateFiche` accepte le champ photo (limite 400 ko, chaîne vide = retrait).

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