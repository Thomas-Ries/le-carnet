# Changelog

## V0.4.61 — allègement sélection + nav

- La coche des cards sélectionnées disparaît (accueil et modale) : seul le liseré bordeaux s'active — plus d'empètement sur la note.
- Modale inspiration : le bouton « Sélectionner » devient une simple icône de partage à droite des puces de tri.
- Splash : le tag « Pour le boulot » devient « Entre collègues ».
- Nav : encore un cran de hauteur en moins.

## V0.4.60 — sélection & partage + nav compacte

- **Sélection longue-press sur l'accueil** : appui long sur une card entre en mode sélection (vibration, coche en haut à droite), tap pour en ajouter/retirer ; une icône de partage apparaît à gauche du tri dès qu'une card est cochée. 1 card = sa carte PNG ; plusieurs = un PDF regroupé (une page par fiche, écrit à la main, zéro dépendance) pour ne pas noyer le destinataire.
- **Modale inspiration** : le fond ne scrolle plus quand elle est ouverte ; puces de tri rejoignent un bouton « Sélectionner » qui coche une ou plusieurs cards ; le CTA « Ça vous tente, je réserve ? » devient « Partager la sélection » (carte PNG ou PDF selon le nombre).
- **Nav basse compacte** façon Dégustations entre amis : icônes en trait plus épais, onglet actif accentué (bordeaux, icône plus grasse et agrandie), hauteur réduite.

## V0.4.59 — commentaires façon Instagram

- La saisie devient un champ multi-lignes : le retour à la ligne insère une vraie ligne (plus de validation accidentelle), l'envoi se fait par le bouton, le champ grandit avec le texte (plafonné).
- Affichage : prénom en gras suivi du commentaire, date discrète en fin de ligne ; le texte passe à la ligne sans jamais repousser les crayons/poubelles hors cadre.

## V0.4.58 — carte de partage : aération

- Un peu plus d'espace entre la ligne lieu + note et le commentaire sur la carte image de partage.

## V0.4.57 — édition : la note et le lieu deviennent modifiables

- L'écran d'édition d'une fiche affiche désormais le slider de note (prérempli avec la note actuelle, 70-100) et un champ lieu — on peut retourner à l'endroit et réviser son jugement. Le worker accepte la mise à jour du lieu (tronqué 80 caractères, COALESCE comme les autres champs).

## V0.4.56 — carte de partage : lieu + note

- La carte image d'une fiche affiche désormais le lieu (italique, à gauche) et la note sur 100 (or, à droite) sur une ligne sous le titre. La note n'apparaît que si elle est posée (70-100) — pas sur les fiches « à noter ».

## V0.4.55 — fix doublons des fiches multi-carnets

- Une fiche liée à plusieurs carnets (duplication Famille B → Les copains) apparaissait deux fois dans le fil : le bootstrap du worker renvoyait une ligne par lien fiche↔carnet. Toutes les jointures qui peuvent doubler passent en DISTINCT (fiches, commentaires, compteur relance J+8, purge de compte).

## V0.4.54 — Like sans la ligne des prénoms

- Plus de « Thomas aime ça » sous le bouton après un like : le geste du cœur suffit, le compteur reste dans la pilule (« J'aime · 2 »). La ligne des prénoms disparaît de la fiche.

## V0.4.53 — CTA discrets alignés à gauche

- « J'aime » adopte le style discret de « On y va » (fond soft, liseré hairline, texte bordeaux) et ne passe en or plein que lorsqu'il est aimé ; les deux pilules sont alignées à gauche façon Instagram au lieu d'occuper toute la largeur.

## V0.4.52 — Fix like en dev + CTA compacts

- **Fix like/unlike en mode dev** : sans worker, Vite répond 404 à /api/mutate et le garde-fou « 4xx = refus serveur » faisait échouer silencieusement le like (reacts undefined, crash de la fiche). Un 4xx n'est plus traité comme un refus quand l'app tourne en mode démo ; le store ne corrompt plus l'état local si la réponse est invalide ; la fiche affiche reacts manquant comme zéro like au lieu de planter.
- **CTA compacts côte à côte** : « J'aime » et « On y va » deviennent deux pilules arrondies sur une même ligne (façon Instagram), plus petites — moitié moins de hauteur sous la fiche.

## V0.4.51 — « On y va »

- Sur le détail d'une fiche adresse, sous le bouton « J'aime » : **« On y va »** ouvre Google Maps directement sur le lieu (requête = titre + lieu) — itinéraire, numéro de téléphone, horaires. La fiche dit quoi et pourquoi, Maps dit comment y aller.
- Chaque tap logge un événement `go` dans Events : la mesure qui dit combien de fiches se transforment en action.

## V0.4.50 — Tuiles d'action compactes

- « Noter une adresse » et « Partager une recette » passent en rendu horizontal : icône à gauche, titre et micro-sous-titre à côté — moitié moins de hauteur sur l'accueil.

## V0.4.49 — Anti-doublon + relance douce J+8

- **Anti-doublon à la note** : pendant la saisie du titre, les fiches du même type déjà notées dans le(s) carnet(s) visé(s) apparaissent sous le champ (« Déjà noté par Sophie — 92/100 ») ; un tap ouvre la fiche existante au lieu d'en recréer une. Comparaison normalisée (minuscules, sans accents ni ponctuation, inclusion dans un sens ou l'autre) à partir de 4 caractères.
- **Relance douce J+8** : un appareil qui n'a pas ouvert l'app depuis 8 jours et dont un carnet s'est rempli depuis reçoit « 3 nouvelles adresses t'attendent — dans “Les Copains”, depuis ton dernier passage ♥ ». Déclenchée par n'importe quel bootstrap (comme le rappel J-6), au plus une fois tous les 2 jours par appareil (événement `relance_j8`).

## V0.4.48 — Inspiration : « Brunch à la maison »

- L'ambiance Brunch devient **« Brunch à la maison »** — plus honnête quand la sélection pioche dans les fiches Boulangerie et Fromagerie (les ingrédients du brunch maison), en plus du thème Brunch.
- Rappel du comportement : une ambiance sans aucune fiche dans le carnet n'apparaît pas dans la modale.

## V0.4.47 — Inspiration : vraies ambiances + filtre

- **5 ambiances** dans la modale : Resto, Bar à vin, Bar, **Dégustation** (fiches Caviste, Fromagerie) et **Brunch** (thème Brunch, Boulangerie, Fromagerie). Une ambiance combine plusieurs thèmes de notation — une fiche « Caviste, Fromagerie » nourrit Dégustation et Brunch.
- **Nouveau thème de notation : Brunch** (dans la liste à la création, ligne des longs thèmes).
- **Filtre deux options** dans la sélection : « Les mieux notés » (défaut) / « Les plus aimés » — le choix survit à la navigation, comme le reste de la modale.

## V0.4.46 — Inspiration : retours d'usage

- **Bandeau compact** : deux lignes seulement — « Envie d'inspiration ? / Un after-work, un tête à tête… Laisse-toi guider ».
- **Ambiances limitées aux vraies sorties** : Resto, Bar, Bar à vin uniquement — pas de caviste pour un tête à tête.
- **Retour dans le fil** : tap sur une card de la sélection → détail ; en revenant, la modale rouvre à l'étape d'avant (l'état vit dans le store, il survit à la navigation).
- **Icône de partage unifiée** : les trois points connectés (icône universelle Android/WhatsApp) partout où l'on partage — fiche, export JSON, sélection d'inspiration. Plus de flèche ambiguë.
- **Réglage profil** : toggle « Idées de sorties » pour masquer le bandeau d'inspiration (persistant par appareil).

## V0.4.45 — Modale Bienvenue à la première connexion

- Après le tout premier join (prénom + mot-clé du carnet), une modale « Bienvenue dans Le Carnet » présente les quatre gestes de l'app : noter une adresse, flasher (7 jours), aimer et commenter, piocher une inspiration.
- Elle propose d'activer les notifications (« Pour ne rien rater ») en CTA explicite — ce premier passage remplace le prompt silencieux ; les joins suivants gardent le prompt silencieux habituel. Refus ou indisponibilité : message doux, tout se rattrape depuis le Profil.
- Un seul affichage par appareil (drapeau `lc-bienvenue` en localStorage).

## V0.4.44 — Inspiration de sortie + fiche des carnets

- **« Envie d'inspiration ? »** : bandeau sous les deux tuiles de l'accueil (après-work, tête à tête…). Clic → modale « Ce soir, l'ambiance est plutôt… » avec les thèmes réellement présents dans le carnet (compteur par puce), puis les 5 adresses les mieux notées du thème — cartes cliquables (détail + partage), et bouton « Ça vous tente, je réserve ? » qui partage la sélection en texte (feuille native, sinon WhatsApp). Zéro serveur : tout vient des fiches déjà notées.
- **Fiche des carnets** : « code les-copains » → « code : les-copains » (deux points sur toutes les cards).

## V0.4.43 — Suppression de compte + ergonomie

- **Supprimer mon compte** : bouton tout en bas du profil → modale qui explique comment désinstaller la PWA et propose le choix : supprimer aussi ses notes, likes, commentaires et flashes, ou les garder dans les carnets. Définitif : pour revenir il faut refaire une demande d'invitation. Worker `deleteAccount` (purge ou conservation), l'admin du carnet reste membre — le carnet survit à son départ.
- **FAB flash uniquement sur l'accueil** : il ne gênait plus le bouton d'envoi d'un commentaire sur le détail d'une fiche.
- **Icône de partage explicite** : flèche qui sort d'un carré (code iOS), plus l'« undo » ambigu — sur le partage d'une note et l'export JSON.
- **Partage masqué pendant l'édition d'une fiche** : on modifie ou on supprime, pas de partage à ce moment-là.
- Placeholder du champ commentaire : simplement « Commentaire ».
- **Thèmes réordonnés** pour tenir sur deux lignes à la création (Resto, Caviste, Bar à vin, Bar, Autre puis les trois longs : Soins du corps, Fromagerie, Boulangerie).

## V0.4.42 — Commentaires + partage d'une note en jolie carte

- **Commentaires sur les notes** : chacun peut commenter une adresse dans le carnet. L'auteur d'un commentaire peut le modifier ou le supprimer ; l'admin du carnet peut supprimer n'importe quel commentaire. Table `FicheComments` créée paresseusement au bootstrap (aucune console D1 à lancer), purgée avec la fiche.
- **Boucle sociale** : quand quelqu'un commente, l'auteur de la fiche reçoit une notif push « X a commenté ton adresse » (sauf s'il s'agit de lui-même). Événement `comment` loggé pour les mesures H1-H4.
- **Partager une note en jolie fiche** : bouton partage sur chaque fiche → carte image 1080x1350 générée sur l'appareil (charte crème/bordeaux/or, photo, titre, commentaire, « vu dans Le Carnet ») → feuille de partage native iOS (WhatsApp, SMS…). Sans Web Share, l'image est téléchargée. Zéro serveur.

## V0.4.41 — Retours d'usage : thèmes multiples, FAB discret

- **Plusieurs thèmes par adresse** : un caviste qui fait bar à vin se note « Caviste + Bar à vin ». Sélection multiple à puces (au moins un requis, max 4 côté serveur), stockée en texte « Caviste, Bar à vin » — aucune migration D1.
- **Nouveaux thèmes** : « Bar à vin » et « Soins du corps » (liste : Resto, Caviste, Bar à vin, Bar, Soins du corps, Fromagerie, Boulangerie, Autre).
- **FAB flash masqué pendant l'édition d'une fiche** : si je modifie, je ne vais pas flasher. Flag `ficheEnEdition` dans le store, posé/levé par FicheView (annuler, enregistrer, sortie de page).

## V0.4.40 — Scroll infini sur l'accueil

- Le fil des notes passe en **scroll infini façon feed** : rendu par tranches de 20, la tranche suivante charge quand on approche du bas (500 px de marge, listener passif).
- **Bug corrigé au passage** : l'accueil n'affichait que les 8 premières fiches — les notes suivantes étaient invisibles, sans aucun moyen de les voir.
- Ligne discrète « Fais défiler pour découvrir les X adresses » quand il reste du contenu plus bas ; tri et changement de carnet réinitialisent au début de la liste.

## V0.4.39 — Boucle sociale + analytics minimal

- **« X a aimé ton adresse »** : quand quelqu'un aime une fiche ou un flash, son auteur reçoit une notification push (sauf s'il s'agit de lui-même). Uniquement au like NOUVEAU (INSERT OR IGNORE + meta.changes) — pas de spam au re-like. La boucle noter -> réaction -> retour est fermée.
- **Analytics minimal (H1-H4)** : table Events créée paresseusement au bootstrap (aucune console D1 à lancer). Événements loggés côté worker, zéro changement client : open (chaque bootstrap = proxy des ouvertures), join, create_carnet, note, flash, like, notifs_on. Requêtes de mesure fournies dans le KNOWLEDGE.
- schema.sql : table Events ajoutée.

## V0.4.38 — Liens d'invitation courts

- Le lien partagé (WhatsApp / SMS / Copier) passe de `.../#/join/famille-a` à `https://le-carnet-adresses-animees.pages.dev/join/famille-a` — plus propre, sans dièse.
- Worker : les chemins `/join/<mot-clé>` servent l'app (index.html). Client : le chemin est reconverti en route hash au démarrage (main.js), les anciens liens `#/join/...` restent valides.
- Le mot-clé du carnet joue le rôle de nom dans l'URL (ex. `famille-a`, `paques-2027`).

## V0.4.37 — Flash : texte de l'appât photo

- « Assiette, verre, salle — c'est parti en 5 secondes » -> « Une bouteille, un plat, une ambiance — ça part en 5 secondes » (préférence de Thomas).

## V0.4.36 — Notif note : nouvelle tournure

- Thomas n'aimait pas « va voir, aime-la si tu la fréquentes » -> corps de la notif d'une nouvelle note : « X » — une nouvelle adresse à découvrir dans ton carnet ♥.

## V0.4.35 — Notifications : signature cœur

- Le logo de l'app est déjà attaché à chaque notif (sw.js : icon/badge icon-192.png ; iOS affiche l'icône de l'app installée). Ce qui manquait : la chaleur du texte.
- Corps des trois notifications (note créée, flash envoyé, rappel J-6) terminés par un cœur ♥ — signature discrète, en accord avec le trio du logo, hors du périmètre « zéro emoji dans l'app ».

## V0.4.34 — Flash : « Pour qui ? » au-dessus du commentaire

- FlashSheet : le sélecteur de carnets (« Pour qui ? ») remonte AU-DESSUS du champ commentaire, pour une lecture dans l'ordre : photo, pour qui, mot optionnel, envoyé. Aide-étape mise à jour (1. la photo · 2. pour qui · 3. envoyé).

## V0.4.33 — Rétention : avertissement flash + adoption des notifications

- **FlashSheet** : avertissement visible AVANT l'envoi — « Sans retouche sous 7 jours, ce flash disparaît. Un commentaire le garde et en fait une note. » (avant : seulement un toast après coup).
- **Notifs au join** : la demande de permission est présentée juste après avoir rejoint un carnet (pic d'envie), silencieuse en cas de refus ; toast de confirmation si acceptée.
- **Carte « Sois prévenu des nouvelles notes »** sur l'accueil tant que l'appareil n'a pas souscrit ; cachée si la permission iOS a été refusée (denied, plus redemandable) ou en mode démo.
- Déduplication : `activerNotifs()` / `notifsSouscrites()` dans api.js, utilisées par le profil, le join et l'accueil (le profil ne porte plus sa copie maison).

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