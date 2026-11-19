// i18n FR/EN — Le Carnet. Les clés sont les chaînes françaises normalisées
// (espaces multiples repliées) ; toute clé absente du dictionnaire retombe
// en français. Ne JAMAIS traduire : titres des fiches, lieux, prénoms, noms
// de carnets, codes et mots-clés d'invitation.
import { reactive } from "vue";

const LS_KEY = "lc-lang";
const norm = (s) => String(s).replace(/\s+/g, " ").trim();

const detect = () => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch (e) { /* ok */ }
  try {
    const nav = String(navigator.language || "fr").toLowerCase();
    return nav.startsWith("fr") ? "fr" : "en";
  } catch (e) { return "fr"; }
};

export const i18n = reactive({ lang: detect() });

export const setLang = (l) => {
  if (l !== "fr" && l !== "en") return;
  i18n.lang = l;
  try { localStorage.setItem(LS_KEY, l); } catch (e) { /* ok */ }
  try { document.documentElement.lang = l; } catch (e) { /* ok */ }
};
try { document.documentElement.lang = i18n.lang; } catch (e) { /* ok */ }

const EN = {

  "(carré avec une flèche, en bas de l'écran)": "(square with an arrow, at the bottom of the screen)",
  "(obligatoire sur iPhone, pas Chrome)": "(required on iPhone, not Chrome)",
  "(toi)": "(you)",
  "1. la photo · 2. pour qui · 3. envoyé": "1. the photo · 2. who it's for · 3. sent",
  "3 champs, une note, les carnets. Sous 10 secondes.": "3 fields, a rating, the notebooks. Under 10 seconds.",
  "4 chiffres ou 6, à toi de choisir": "4 or 6 digits, your choice",
  "Action réservée à l'admin": "Admin-only action",
  "Activer": "Enable",
  "Activer les notifications": "Enable notifications",
  "Admin déverrouillé sur cet appareil": "Admin unlocked on this device",
  "Admin — «": "Admin — “",
  "Afficher le code": "Show code",
  "Agrandir": "Enlarge",
  "Aime les notes des autres": "Loves others' ratings",
  "Ajoute Le Carnet à ton écran d'accueil depuis le menu de ton navigateur (souvent ⋮ ou … puis « Ajouter à l'écran d'accueil »). Elle s'ouvrira comme une vraie app.": "Add Le Carnet to your home screen from your browser menu (usually ⋮ or … then “Add to Home Screen”). It will open like a real app.",
  "Ajoute ou retire qui tu veux. C'est ton carnet.": "Add or remove anyone you like. It's your notebook.",
  "Ajouter": "Add",
  "Annuler": "Cancel",
  "Appuie sur": "Tap",
  "Appuie sur le bouton": "Tap the button",
  "Autorisation refusée — reglages iOS de l'app, Notifications": "Permission denied — check the iOS app settings, Notifications",
  "Avatar mis à jour": "Avatar updated",
  "Bienvenue dans Le Carnet": "Welcome to Le Carnet",
  "Bienvenue. Ici, on garde les adresses et recettes qu'on a aimées,": "Welcome. Here we keep the addresses and recipes we loved,",
  "C'est noté — tu seras prévenu.": "Got it — you'll be notified.",
  "C'est parti": "Let's go",
  "C'est toi, sur un nouvel appareil ? Entre ton code admin — celui choisi à la création du carnet — pour reprendre ta place.": "Is this you, on a new device? Enter your admin code — the one chosen when the notebook was created — to take your place back.",
  "C'est ton appli à toi ? Reprends tous tes carnets": "Is this your app? Take all your notebooks back",
  "Carnet": "Notebook",
  "Carnet créé — tu es admin": "Notebook created — you're the admin",
  "Carnet repris — tu es de retour": "Notebook recovered — welcome back",
  "Carnet repris — tu es de retour en admin": "Notebook recovered — you're back as admin",
  "Ce soir, l'ambiance est plutôt…": "Tonight the vibe is more…",
  "Cet appareil quitte tous ses carnets. C'est définitif : pour revenir, il faudra refaire une demande d'invitation — et tout ce qui aura été supprimé sera perdu.": "This device leaves all its notebooks. This is final: to come back you'll need a new invitation — and anything deleted will be gone for good.",
  "Ceux qui ont aimé ce flash seront notifiés — une seule fois.": "People who liked this flash will be notified — once only.",
  "Changer de thème": "Change theme",
  "Changer le code admin": "Change admin code",
  "Changer mon code admin — 4 ou 6 chiffres": "Change my admin code — 4 or 6 digits",
  "Choisir le tri": "Choose sorting",
  "Coche une ou plusieurs adresses à partager.": "Check one or more addresses to share.",
  "Code admin": "Admin code",
  "Code admin changé — note-le": "Admin code changed — write it down",
  "Code perdu ? Il peut être changé depuis un appareil": "Lost the code? It can be changed from a device",
  "Code refusé — vérifie ton code personnel (4 ou 6 chiffres).": "Code rejected — check your personal code (4 or 6 digits).",
  "Commentaire": "Comment",
  "Commentaire ajouté — le flash finira en fiche après ses 7 jours": "Comment added — the flash becomes a card after its 7 days",
  "Commentaire modifié": "Comment edited",
  "Commentaires": "Comments",
  "Compléter ton flash": "Complete your flash",
  "Compte supprimé de cet appareil — à bientôt": "Account deleted from this device — see you soon",
  "Confirme le nouveau code": "Confirm the new code",
  "Connexion au serveur perdue — tes dernières actions restent sur cet appareil uniquement. Si ça persiste, préviens l'admin de ton carnet.": "Server connection lost — your latest actions stay on this device only. If it persists, alert your notebook's admin.",
  "Contacter le support": "Contact support",
  "Continuer": "Continue",
  "Copier": "Copy",
  "Copier le lien": "Copy link",
  "Carnet sélectionné": "Selected notebook",
  "Créer": "Create",
  "Créer mon carnet": "Create my notebook",
  "Créer un carnet": "Create a notebook",
  "Demande envoyée à": "Request sent to",
  "Demande envoyée —": "Request sent —",
  "Demander la recette à": "Ask for the recipe from",
  "Déjà noté par": "Already rated by",
  "Déverrouiller": "Unlock",
  "En faire une fiche": "Turn it into a card",
  "En famille": "Family",
  "Encore une fois pour vérifier": "Once more to confirm",
  "Enregistrer": "Save",
  "Enregistrer juste le commentaire — le flash reste 7 jours puis devient une fiche à compléter": "Save just the comment — the flash stays 7 days then becomes a card to complete",
  "Entre amis": "Friends",
  "Entre collègues": "Coworkers",
  "Entre le mot-clé du carnet qu'on t'a donné — 4 à 15 caractères.": "Enter the notebook keyword you were given — 4 to 15 characters.",
  "Entre le mot-clé que l'admin t'a donné. C'est aussi la porte de secours d'un nouvel appareil : même carnet, même prénom, tu retrouves tout.": "Enter the keyword the admin gave you. It's also the backup door for a new device: same notebook, same first name, you get everything back.",
  "Entre ton code admin — celui choisi à la création du carnet. Il est stocké chiffré : personne ne peut te le redonner.": "Enter your admin code — the one chosen when the notebook was created. It's stored encrypted: nobody can send it back to you.",
  "Envie d'inspiration ?": "Looking for ideas?",
  "Envoyer le flash": "Send the flash",
  "Espace privé de démo": "Demo private space",
  "Espace privé introuvable — recharge l'app et réessaie": "Private space not found — reload the app and try again",
  "Espace privé — visible de toi seul. Pour offrir une adresse à un carnet, sélectionne-la (appui long) dans la liste puis partage-la.": "Private space — visible to you only. To give an address to a notebook, select it (long press) in the list then share it.",
  "Export : takeout.google.com → « Maps (vos adresses) » — un seul produit contient tes lieux ET tes avis. Aucun compte Google requis.": "Export: takeout.google.com → “Maps (your places)” — a single product holds both your places AND your reviews. No Google account required.",
  "Exporter en JSON": "Export as JSON",
  "Exporter mes données": "Export my data",
  "Fais défiler la liste puis choisis": "Scroll the list then pick",
  "Famille, Les copains, Boulot…": "Family, Best friends, Work…",
  "Fiche créée — ceux qui ont aimé le flash sont notifiés": "Card created — flash likers are notified",
  "Fiche introuvable.": "Card not found.",
  "Fiche mise à jour": "Card updated",
  "Fiche supprimée": "Card deleted",
  "Fichier téléchargé — partage-le depuis ton téléphone": "File downloaded — share it from your phone",
  "Filtrer par lieu": "Filter by place",
  "Flash": "Flash",
  "Renommer le carnet": "Rename the notebook",
  "Carnet renommé": "Notebook renamed",
  "Supprimer le carnet": "Delete the notebook",
  "Carnet supprimé": "Notebook deleted",
  "Le nom du carnet…": "The notebook's name…",
  "Le carnet et toutes ses données disparaissent pour tous les membres. Aucune récupération possible. Les fiches partagées avec un autre carnet y survivent.": "The notebook and all its data disappear for every member. No recovery possible. Cards shared with another notebook survive there.",
  "Tu as quitté ce carnet": "You left this notebook",
  "Flash de": "Flash from",
  "Il vit 7 jours — aime-le, et l'auteur en fera peut-être une fiche.": "It lives for 7 days — show it some love, and its author may turn it into a card.",
  "Flash — photo éclair": "Flash — lightning photo",
  "Flashes, adresses notées, rappel J-6": "Flashes, rated addresses, D-6 reminder",
  "Flashes, adresses notées, rappel J-6. À activer une fois l'app installée en ligne — pas disponible en mode démo.": "Flashes, rated addresses, D-6 reminder. Enable once the app is installed online — not available in demo mode.",
  "Gérer et partager mes carnets": "Manage and share my notebooks",
  "Hier soir ou ce matin — quand tu y penses": "Last night or this morning — whenever you think of it",
  "Idées de sorties": "Going-out ideas",
  "Nourrir": "Fill",
  "Sélectionne des notes de tes autres carnets pour l'ouvrir avec de la matière — tes invités ne tomberont pas sur un carnet vide.": "Pick notes from your other notebooks to open it with some substance — your guests won't land on an empty notebook.",
  "Notes ajoutées au carnet": "Notes added to the notebook",
  "Supprimer ce flash": "Delete this flash",
  "Photographier": "Take a photo",
  "Choisir dans la pellicule": "Pick from the library",
  "Tape pour changer la photo": "Tap to change the photo",
  "Le flash disparaît pour tous les membres du carnet. Aucune récupération possible.": "The flash disappears for every member of the notebook. No recovery possible.",
  "Aucune note à proposer pour l'instant — note ta première adresse, ou retrouve tes carnets depuis Profil si tu viens de changer d'appareil.": "Nothing to suggest yet — add your first note, or recover your notebooks from the Profile page if you switched devices.",
  "Ajouter la sélection": "Add selection",
  "Adresse": "Address",
  "Recette": "Recipe",
  "Il devient le code admin de ce carnet. Ne le donne à personne.": "It becomes this notebook's admin code. Don't give it to anyone.",
  "Image enregistrée — partage-la comme une photo": "Image saved — share it like a photo",
  "Import d'autres fichiers": "Import other files",
  "Importer mes lieux et avis Google Maps — touche pour ouvrir.": "Import my Google Maps places and reviews — tap to open.",
  "Importer mes lieux, notes et commentaires Google Maps — visible de toi seul.": "Import my Google Maps places, ratings and comments — visible to you only.",
  "Impossible d'activer les notifications": "Couldn't enable notifications",
  "Impossible pour l'instant — vérifie ta connexion.": "Not possible right now — check your connection.",
  "Installation lancée — à tout de suite sur ton écran d'accueil": "Installation started — see you on your home screen",
  "Installer l'app": "Install the app",
  "Installer sur mon écran d'accueil": "Install on my home screen",
  "Installée sur cet appareil — tu peux la fermer et la rouvrir depuis ton écran d'accueil.": "Installed on this device — you can close it and reopen it from your home screen.",
  "Inviter": "Invite",
  "Fermer": "Close",
  "Étape 1 sur 2 — ton prénom": "Step 1 of 2 — your first name",
  "Étape 2 sur 2 — le carnet et ton code": "Step 2 of 2 — the notebook and your code",
  "Inviter dans ce carnet": "Invite into this notebook",
  "Invité ? Tu peux créer le tien aussi — c'est comme ça que ça grandit.": "A guest? You can create your own too — that's how it grows.",
  "J'ai déjà mes carnets sur un autre appareil": "I already have my notebooks on another device",
  "L'admin du carnet ajoute ou retire qui il veut.": "The notebook's admin adds or removes whoever they want.",
  "La recette de": "The recipe from",
  "La recette, si tu veux la partager tout de suite (optionnel)…": "The recipe, if you want to share it right away (optional)…",
  "Langue": "Language",
  "Le": "The",
  "Le Carnet": "Le Carnet",
  "Le Carnet s'installe comme une vraie app : icône sur l'écran d'accueil, plein écran, notifications.": "Le Carnet installs like a real app: home-screen icon, full screen, notifications.",
  "Le Carnet — support": "Le Carnet — support",
  "Les fiches quittent ton espace privé pour rejoindre le ou les carnets choisis. Tes notes et commentaires suivent.": "The cards leave your private space to join the chosen notebook(s). Your ratings and comments follow.",
  "Les garder dans les carnets": "Keep them in the notebooks",
  "Les notifications sont actives une fois l'app installée en ligne — pas en mode démo": "Notifications work once the app is installed online — not in demo mode",
  "Lien copié": "Link copied",
  "Lien copié — envoie-le à qui tu veux": "Link copied — send it to whoever you like",
  "Lieu — adresse, ville, quartier": "Place — address, city, area",
  "Membres": "Members",
  "Membres (": "Members (",
  "Mes carnets": "My notebooks",
  "Mes carnets (": "My notebooks (",
  "Mes contributions": "My contributions",
  "Mode démo — tout reste sur cet appareil": "Demo mode — everything stays on this device",
  "Mode sombre": "Dark mode",
  "Moments — pas encore notés": "Moments — not rated yet",
  "Mon G-Maps": "My G-Maps",
  "Mon activité": "My activity",
  "Mon profil": "My profile",
  "Mot-clé d'invitation": "Invitation keyword",
  "Mot-clé d'invitation :": "Invitation keyword:",
  "Mot-clé d'invitation — 4 à 15 caractères": "Invitation keyword — 4 to 15 characters",
  "Mémorise bien ce code : il te servira à créer tes propres carnets et à retrouver tes carnets si tu changes de téléphone.": "Memorize this code: you'll use it to create your own notebooks and to recover them if you change phones.",
  "Nom du carnet": "Notebook name",
  "Note les adresses que tu aimes": "Rate the addresses you love",
  "Noter une adresse": "Rate an address",
  "Notifications": "Notifications",
  "Notifications activées": "Notifications enabled",
  "Notifications activées sur cet appareil": "Notifications enabled on this device",
  "Notifications désactivées": "Notifications disabled",
  "Notifications indisponibles côté serveur": "Notifications unavailable on the server",
  "Notifications indisponibles pour l'instant — réessaie plus tard depuis ton Profil.": "Notifications unavailable right now — try again later from your Profile.",
  "Nouveau carnet": "New notebook",
  "Nouveau code": "New code",
  "Nouveauté": "What's new",
  "Obligatoire pour un nouveau prénom — et si tu reprends le tien sur un nouvel appareil, c'est lui qui le prouve.": "Required for a new first name — and if you reclaim yours on a new device, it's what proves it's you.",
  "On cherche quoi ? Un resto, un vin, une recette…": "What are we looking for? A restaurant, a wine, a recipe…",
  "On y va": "Let's go",
  "Ouvre Le Carnet dans": "Open Le Carnet in",
  "Ouvrir Mon G-Maps dans mon profil →": "Open My G-Maps in my profile →",
  "Partage ce lien — ou le code": "Share this link — or the code",
  "Partager": "Share",
  "Partager dans quel carnet ?": "Share into which notebook?",
  "Partager la sélection": "Share selection",
  "Partager tes fiches privées ?": "Share your private cards?",
  "Partager une recette": "Share a recipe",
  "Partager une sélection": "Share a selection",
  "Pas de mot de passe. Juste ton prénom et le mot-clé du carnet.": "No password. Just your first name and the notebook keyword.",
  "Pas encore d'adresse ici — note la première.": "No address here yet — rate the first one.",
  "Pas grave — tu pourras les activer plus tard dans Profil, Réglages.": "No worries — you can enable them later in Profile, Settings.",
  "Pass super-admin": "Super-admin pass",
  "Personne ne pourra te le renvoyer — un seul code, pour tous tes carnets.": "Nobody can send it back to you — one code, for all your notebooks.",
  "Personne ne t'a donné de code ? Crée ton carnet": "Nobody gave you a code? Create your notebook",
  "Photo illisible — essaie une autre image": "Unreadable photo — try another image",
  "Phrase de passe du créateur — elle restaure tes droits d'admin sur tous les carnets, sur n'importe quel appareil. Elle ne quitte jamais ton téléphone en clair.": "Creator's passphrase — it restores your admin rights on all notebooks, on any device. It never leaves your phone in plain text.",
  "Pioche un thème — on te sort les adresses les mieux notées du carnet, à ouvrir ou à partager.": "Pick a theme — we'll pull the notebook's top-rated addresses, to open or share.",
  "Plus tard": "Later",
  "Pour désinstaller l'app : iPhone — maintiens l'icône Le Carnet, puis « Retirer l'app » · Android — appui long sur l'icône, puis « Désinstaller ».": "To uninstall the app: iPhone — press and hold the Le Carnet icon, then “Remove app” · Android — long press the icon, then “Uninstall”.",
  "Pour ne rien rater": "So you don't miss a thing",
  "Pour offrir une adresse à un carnet : appui long sur une fiche dans la liste, puis « Partager ».": "To give an address to a notebook: long press a card in the list, then “Share”.",
  "Pour quel(s) carnet(s) ? — plusieurs choix possibles": "For which notebook(s)? — multiple choices allowed",
  "Pour qui ?": "For whom?",
  "Prénom + code personnel (4 ou 6 chiffres) : cet appareil retrouve tout seul tes carnets et ton espace G-Maps — même après une réinstallation ou un changement de téléphone.": "First name + personal code (4 or 6 digits): this device finds your notebooks and your G-Maps space on its own — even after a reinstall or a phone change.",
  "Prénom mis à jour dans tous tes carnets": "First name updated in all your notebooks",
  "Préparation de la carte…": "Preparing the map…",
  "Punaise, c'était bon !": "Wow, that was good!",
  "Quitter ce carnet": "Leave this notebook",
  "Rejoindre": "Join",
  "Rejoindre un carnet": "Join a notebook",
  "Reprendre ma place": "Take my place back",
  "Reprendre mes carnets": "Recover my notebooks",
  "Reprendre mon carnet": "Recover my notebook",
  "Retirer": "Remove",
  "Retrouvé — tes carnets sont de retour": "Found — your notebooks are back",
  "Rien pour ça — tu peux le noter en premier.": "Nothing for that — you can be the first to rate it.",
  "Réglages & données": "Settings & data",
  "Réglages &amp; données": "Settings & data",
  "Régénérer le lien d'invitation": "Regenerate the invitation link",
  "SMS": "SMS",
  "Safari": "Safari",
  "Session admin active sur cet appareil": "Admin session active on this device",
  "Sois celui qui note le premier.": "Be the first to rate it.",
  "Sois prévenu des nouvelles notes": "Get notified of new ratings",
  "Super-admin : entre ton pass pour créer « Mes adresses » avec des fiches de démonstration.": "Super-admin: enter your pass to create “My addresses” with demo cards.",
  "Supprimer": "Delete",
  "Supprimer mon compte": "Delete my account",
  "Supprimer mon compte ?": "Delete my account?",
  "Sur iPhone, l'installation se fait depuis Safari — 4 étapes :": "On iPhone, install from Safari — 4 steps:",
  "Sélection — tape les cards, partage en haut": "Selection — tap the cards, share at the top",
  "Ta note": "Your rating",
  "Ta phrase de passe": "Your passphrase",
  "Tape ici pour photographier": "Tap here to take a photo",
  "Tes adresses Google Maps": "Your Google Maps addresses",
  "Tes carnets ne sont pas repris automatiquement d'un appareil à l'autre. Sur un nouvel écran : rouvre l'app, entre ton": "Your notebooks aren't carried over automatically from one device to another. On a new screen: reopen the app, enter your",
  "Tes données t'appartiennent : export à tout moment, aussi depuis le profil.": "Your data is yours: export anytime, also from the profile.",
  "Tes données t'appartiennent — export disponible à tout moment.": "Your data is yours — export available anytime.",
  "Ton code personnel": "Your personal code",
  "Ton code personnel — 4 ou 6 chiffres": "Your personal code — 4 or 6 digits",
  "Ton export takeout.google.com (« Maps (vos adresses) ») — tout seul ou tout le zip : on détecte ce qui est dedans. Les avis deviennent des fiches avec ta note ★ et ton commentaire ; les listes deviennent des fiches « à noter ».": "Your takeout.google.com export (“Maps (your places)”) — alone or the whole zip: we detect what's inside. Reviews become cards with your ★ rating and comment; lists become “to rate” cards.",
  "Ton prénom": "Your first name",
  "Tous les pays": "All countries",
  "Tous tes carnets sont repris — tu es admin": "All your notebooks recovered — you're the admin",
  "Tout désélectionner": "Clear selection",
  "Tout supprimer": "Delete everything",
  "Toutes": "All",
  "Tu as quitté ce carnet": "You left this notebook",
  "Tu n'as pas encore écrit la recette — tu peux l'ajouter en éditant la fiche.": "You haven't written the recipe yet — you can add it by editing the card.",
  "Tu n'es membre d'aucun autre carnet pour l'instant.": "You're not a member of any other notebook yet.",
  "Tu pourras le compléter en fiche notée — badge éclair en attendant.": "You can complete it into a rated card — lightning badge in the meantime.",
  "Tu seras prévenu quand quelqu'un note une adresse": "You'll be notified when someone rates an address",
  "Un after-work, un tête à tête… Laisse-toi guider": "An after-work, a one-on-one… Let yourself be guided",
  "Un membre invité peut créer son propre carnet ailleurs dans l'app —": "An invited member can create their own notebook elsewhere in the app —",
  "Un mot ? (optionnel — il garde le flash et en fait une note après 7 jours)": "A word? (optional — it keeps the flash and turns it into a card after 7 days)",
  "Un mot sur le moment ? (optionnel)": "A word about the moment? (optional)",
  "Un par cercle : famille, copains, boulot…": "One per circle: family, friends, work…",
  "Un souci avec l'app ?": "Trouble with the app?",
  "Une alerte quand quelqu'un partage une adresse aimée ou un flash.": "An alert when someone shares a loved address or a flash.",
  "Une bouteille, un plat, une ambiance — ça part en 5 secondes": "A bottle, a dish, a vibe — sent in 5 seconds",
  "Valider": "Confirm",
  "Ville, quartier…": "City, area…",
  "Villes": "Cities",
  "Visible seulement par les membres que tu invites.": "Visible only to members you invite.",
  "WhatsApp": "WhatsApp",
  "admin": "admin",
  "adresse(s) aimée(s)": "loved address(es)",
  "adresses aimées": "loved addresses",
  "adresses aimées · moments partagés": "loved addresses · shared moments",
  "bug, question, suggestion — le support répond vite": "bug, question, suggestion — support replies fast",
  "c'est comme ça que Le Carnet grandit, sans rien faire.": "that's how Le Carnet grows, effortlessly.",
  "code personnel": "personal code",
  "défaut": "default",
  "elles restent visibles, signées de mon prénom": "they stay visible, signed with my first name",
  "entre gens qu'on connaît.": "among people we know.",
  "et invite les tiens — c'est gratuit.": "and invite yours — it's free.",
  "ex. famille-A ou spice-girls (auto si vide)": "e.g. family-A or spice-girls (auto if empty)",
  "ex. les-copains": "e.g. best-friends",
  "famille-A ou spice-girls": "family-A or spice-girls",
  "fichier JSON du carnet, à tout moment": "notebook JSON file, anytime",
  "la partagera bientôt.": "will share it soon.",
  "le bandeau d'inspiration sur l'accueil": "the inspiration banner on the home page",
  "le tiramisu de Chetto…": "Chetto's tiramisu…",
  "lieu importé": "place imported",
  "lieux importés": "places imported",
  "membre(s) · code :": "member(s) · code:",
  "mes notes, likes, commentaires et flashes disparaissent des carnets": "my ratings, likes, comments and flashes disappear from the notebooks",
  "où la session admin est encore active.": "where the admin session is still active.",
  "prénom": "first name",
  "puis «": "then “",
  "remet tout en place, y compris ton espace G-Maps. Ou rejoins-les un par un avec un mot-clé ci-dessous.": "puts everything back, including your G-Maps space. Or rejoin them one by one with a keyword below.",
  "resto, caviste, bar… un lieu que tu aimes": "restaurant, wine shop, bar… a place you love",
  "résultat(s) dans «": "result(s) in “",
  "« Sur l'écran d'accueil »": "“Add to Home Screen”",
  "» — ton": "” — your",
  "À donner aux personnes que tu invites — plus facile à retenir qu'un numéro. Généré automatiquement si tu laisses vide.": "To give to the people you invite — easier to remember than a number. Auto-generated if you leave it empty.",
  "Éclair = à noter (7 jours). Les autres likent ; toi seul complètes.": "Lightning = to rate (7 days). Others like it; only you complete it.",
  "à la main. Toute personne invitée peut aussi créer son propre carnet.": "by hand. Anyone invited can also create their own notebook.",
  "— c'est fait, l'icône est sur ton écran et les notifications marchent": "— done, the icon is on your screen and notifications work",
  "— importe-les depuis ton profil (« Mon G-Maps »), puis offre celles que tu veux au carnet.": "— import them from your profile (“My G-Maps”), then give the ones you want to the notebook.",
  "— le carnet te propose une sortie par thème, à partager.": "— the notebook suggests an outing per theme, to share.",
  "— resto, caviste, bar… avec une note sur 100 et une photo.": "— restaurant, wine shop, bar… with a rating out of 100 and a photo.",
  "— son auteur reçoit un petit signe, et tu peux commenter.": "— its author gets a little sign, and you can comment.",
  "— une alerte quand quelqu'un partage une adresse ou un flash.": "— an alert when someone shares an address or a flash.",
  "— une photo éclair à faire aimer en 7 jours, avant de la noter en fiche.": "— a lightning photo to be loved within 7 days, before you rate it as a card.",
  "— à donner à la main ou via le lien.": "— to give by hand or via the link.",
  "← Tous les pays": "← All countries",
  "Action réservée à l'admin.": "Admin-only action.",
  "Carnet introuvable — vérifie le mot-clé qui t'a été donné.": "Notebook not found — check the keyword you were given.",
  "Ce n'est pas ton code personnel — utilise le même que dans tes autres carnets.": "That isn't your personal code — use the same one as in your other notebooks.",
  "Choisis ton code personnel — 4 ou 6 chiffres, il relie le prénom à toi.": "Choose your personal code — 4 or 6 digits, it ties the name to you.",
  "Code incorrect pour ce carnet.": "Wrong code for this notebook.",
  "Code personnel refusé — vérifie les 4 ou 6 chiffres.": "Personal code refused — check the 4 or 6 digits.",
  "Code personnel refusé — vérifie les chiffres.": "Personal code refused — check the digits.",
  "Le code admin doit être saisi deux fois à l'identique.": "The admin code must be entered twice, identically.",
  "Le mot-clé d'invitation doit faire 4 à 15 caractères (lettres sans accents, chiffres, tirets).": "The invite keyword must be 4 to 15 characters (letters without accents, digits, hyphens).",
  "Les deux codes ne sont pas identiques (4 ou 6 chiffres).": "The two codes don't match (4 or 6 digits).",
  "Ton prénom est manquant — renseigne-le dans Profil, puis reviens créer ton carnet.": "Your name is missing — fill it in Profile, then come back to create your notebook.",
  "indispo": "unavailable",
  "Importer mes fichiers Google Maps": "Import my Google Maps files",
  "Bar": "Bar",
  "Bar à vin": "Wine bar",
  "Brunch à la maison": "Home brunch",
  "De A à Z": "A to Z",
  "Dégustation": "Tasting",
  "Envie de": "Feel like",
  "Exporter «": "Export “",
  "Fais défiler pour découvrir les": "Scroll to discover the",
  "Fichier JSON du carnet «": "JSON file of the notebook “",
  "Importe ton export takeout.google.com (« Maps (vos adresses) ») : chaque lieu devient une fiche, et tes avis apportent la note ★ et ton commentaire. Tout arrive dans ton espace privé « Mon G-Maps » — rien n'est partagé sans ton geste.": "Import your takeout.google.com export (“Maps (your places)”): each place becomes a card, and your reviews bring the ★ rating and your comment. Everything lands in your private space “My G-Maps” — nothing is shared without your action.",
  "Le carnet «": "The notebook “",
  "Le plus aimé": "Most loved",
  "Le plus récent": "Most recent",
  "Les mieux notés": "Highest rated",
  "Les plus aimés": "Most loved",
  "Non précisé": "Not specified",
  "Noter": "Add",
  "Ouvrir Mon G-Maps": "Open My G-Maps",
  "Profil": "Profile",
  "Resto": "Restaurant",
  "Tes adresses Google Maps, dans Le Carnet": "Your Google Maps addresses, in Le Carnet",
  "Tu vas partager tes fiches privées avec : ": "You're about to share your private cards with: ",
  "adresses du carnet…": "addresses in the notebook…",
  "adresses notées": "places rated",
  "amour reçu": "love received",
  "attend sa première adresse aimée.": "awaits its first loved address.",
  "avis rattachés": "reviews linked",
  "carnets": "notebooks",
  "doublons ignorés": "duplicates skipped",
  "en JSON": "as JSON",
  "est à toi aussi, maintenant.": "is yours now too.",
  "et": "and",
  "fiches, notes et commentaires. Sur iPhone, la feuille de partage natif s'ouvre.": "cards, ratings and comments. On iPhone, the native share sheet opens.",
  "flashes en vie": "live flashes",
  "importés": "imported",
  "recettes partagées": "recipes shared",
  "tape pour le voir au lieu d'en recréer une fiche": "tap to open it instead of creating a new card",
  "à": "to",
  "Il ne verra plus ce carnet. Il garde ses autres carnets.": "They'll no longer see this notebook. They keep their other notebooks.",
  "Il ne verra plus ce carnet. Il peut toujours y avoir ses autres carnets.": "They'll no longer see this notebook. They still keep their other notebooks.",
  "L'ancien code et l'ancien lien ne fonctionneront plus. Les membres actuels restent membres.": "The old code and old link will stop working. Current members stay members.",
  "Quitter": "Leave",
  "Régénérer": "Regenerate",
  "Régénérer le lien d'invitation ?": "Regenerate the invite link?",
  "Tu ne recevras plus rien de ce carnet et toutes ses publications disparaissent de ton fil. Aucune récupération possible — pour revenir, il faudra une nouvelle invitation.": "You'll no longer receive anything from this notebook and all its posts disappear from your feed. No recovery possible — to come back, you'll need a new invitation.",
  "Ça l'enlève de tous les carnets. Pas de retour arrière.": "This removes it from every notebook. No going back.",
  "Nom du lieu…": "Name of the place…",
  "Nom du plat ou du cocktail…": "Name of the dish or cocktail…",
  "un cocktail, le tiramisu de Chetto…": "a cocktail, Chetto's tiramisu…",
  "Cocktail": "Cocktail",
  "Cocktails": "Cocktails",
  "Adresses": "Places",
  "Tous": "All",
  "Recettes": "Recipes",
  "Afficher": "Show",
  "Trier": "Sort",
  "Nom du cocktail…": "Cocktail name…",
  "Nom du plat…": "Dish name…",
  "Connexion au serveur perdue — tes carnets sont intacts. Touche ici pour réessayer.": "Connection to the server lost — your notebooks are safe. Tap here to retry.",
  "Tes carnets arrivent…": "Your notebooks are on their way…",
  "Une petite seconde — on retrouve tes adresses aimées.": "Just a second — fetching your loved addresses.",
  "Tu aimes": "You like it",
  "J'aime": "I like it",
};

export function t(s) {
  if (i18n.lang === "fr") return norm(s);
  const k = norm(s);
  const v = EN[k];
  return v === undefined ? k : v;
}<<<FILE:package.json>>>
{
  "name": "le-carnet",
  "private": true,
  "version": "0.4.112",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "pinia": "^3.0.0",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-vue": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^7.0.0",
    "vite-plugin-pwa": "^1.3.0"
  }
}<<<FILE:CHANGELOG.md>>>
0.4.90 — Switch de langue FR / EN sur toute l'app
- Nouveau `src/lib/i18n.js` : langue détectée automatiquement au premier lancement (navigator.language), mémorisée en localStorage (`lc-lang`), ~296 traductions FR→EN.
- Toutes les chaînes d'interface passent par `t("…")` : textes des templates, attributs placeholder/title/aria-label, toasts et messages d'erreur. Re-rendu instantané au switch, sans recharger.
- Toggle FR/EN dans le Profil (pastilles actives), à côté du bouton thème. Icône « globe » ajoutée (icons.js).
- Jamais traduit : noms des carnets, prénoms, pays/villes, titres des fiches, commentaires, mots-clés.
- Server-side (worker) et notifications restent en français pour l'instant.
0.4.91 — Troisième type « Cocktail » + filtre dans le tri
- Nouveau type de fiche « cocktail » (icône verre, comme le splash) à côté d'adresse et recette — placeholder dédié, la zone recette s'affiche aussi.
- Menu de tri de l'accueil : nouvelle section « Afficher » (Tous / Adresses / Recettes / Cocktails) au-dessus du tri ; le filtre se réinitialise au changement de carnet.
- FicheRow : icône verre pour les cocktails.
- Migration des fiches existantes : UPDATE Fiches SET type='cocktail' WHERE titre IN ('Negroni Automne','Old Fashioned','Michelada');
0.4.92 — Fix notifications jamais livrées après purge du stockage
- Diagnostic : le profil affiche « Activées » (l'abonnement navigateur survit), mais la ligne PushSubscriptions en base reste sous l'ancien device_id quand iOS purge le stockage → le serveur ne trouve aucun abonnement pour les device_ids courants → notifs perdues en silence.
- Fix : à chaque bootstrap réussi, l'app renvoie l'abonnement push existant au serveur (upsert par endpoint UNIQUE) — la ligne se répare toute seule, aucun geste des membres.
0.4.93 — Le mode démo ne s'active plus en production
- Incident : une testeuse hors réseau a vu les carnets factices du mode démo (Famille / La bande / Boulot) — inacceptable au lancement.
- La démo (données locales seedées) ne s'active plus qu'en dev (import.meta.env.DEV). En prod, un échec réseau garde l'état réel et affiche le bandeau « Connexion au serveur perdue — touche ici pour réessayer » (cliquable → refresh).
- Les mutations en échec réseau retournent une erreur explicite au lieu d'une fausse réussite locale.
- La base démo (lc-demo-db) est purgée du navigateur au premier bootstrap réussi en prod.
- Popin « pass super-admin » du Profil réservée au mode démo.
0.4.94 — Loader « verre qui se remplit » au premier chargement
- Incident : au lancement, la PWAiOS affichait « connexion au serveur perdue » avec zéro notes, puis tout apparaissait ~10 s plus tard (réseau pas prêt au réveil, refresh déclenché par l'événement online).
- Le boot réessaie maintenant 3 fois (1,2 s puis 3 s d'attente) avant de déclarer une panne ; pendant ce temps : loader plein écran (verre bordeaux qui se remplit, « Tes carnets arrivent… »).
- Le bandeau « connexion perdue » ne se pose qu'après l'échec des 3 essais.
- Timeout 8 s sur chaque requête API (plus de fetch qui pend indéfiniment).
0.4.95 — Fix : la recette s'affiche aussi pour les cocktails
- Après la migration en type « cocktail », la fiche n'affichait plus le bloc recette (condition résiduelle type==='recette') — la donnée était intacte, simplement cachée.
- Le lien Maps n'apparaît plus pour les cocktails (pas de lieu).
- Bouton « J'aime / Tu aimes » traduit (i18n oublié).
0.4.96 — Fix : texte du bouton « Idées de sorties » aligné à gauche
- Le texte du toggle héritait de l'alignement centré par défaut des <button> ; quand le sous-titre passait sur deux lignes, l'effet était « quasi centré ».
- Le span texte reçoit le même pattern que le bloc Notifications (flex-1 text-left leading-tight) ; les boutons « Mode sombre » et « Langue » blindés avec text-left par précaution.
0.4.97 — Fix flash multi-carnet + nourrir un carnet créé avec des notes existantes
- BUG : l'envoi d'un flash échouait (refusé par le serveur) depuis la sélection multi-carnets — le client envoyait carnets: [ids], le worker lisait fl.carnetId (indéfini) → pas de session → 403. Le worker crée désormais un flash par carnet (schéma 1 ligne = 1 carnet) et renvoie flashes: [...] ; le store insère la liste.
- Après la création d'un carnet, une popin propose de sélectionner des notes des autres carnets pour l'alimenter — les invités ne tombent pas sur un carnet vide (plan de lancement : jamais d'invitation dans un carnet vierge). Rattachement par liens fiche↔carnet (INSERT OR IGNORE) : c'est la même fiche partagée, pas une copie.
- Nouvelle mutation copierFiches (worker + démo) : vérifie la session sur le carnet cible et sur un carnet source de chaque fiche, refuse l'espace privé.
0.4.98 — Identité insensible à la purge ITP (cookie HttpOnly de secours)
- Problème récurrent : WebKit (iOS + macOS) purge le stockage scriptable des PWA après 7 jours sans usage — le deviceId (localStorage) disparaît et l'appareil redevient un inconnu (« perdu mes carnets »).
- Fix structurel : le worker pose un cookie lc-device HttpOnly (1 an, posé PAR le serveur — donc non soumis à la purge ITP des cookies scriptés). Au bootstrap, si le device du payload est inconnu mais que le cookie porte un appareil avec des sessions, on adopte l'identité du cookie : les carnets reviennent tout seuls, sans code à retaper.
- Le bootstrap renvoie désormais device + prenom : le client re-persiste le vrai device et restaure le prénom du profil (lui aussi purgé) automatiquement.
- Première installation d'une app déjà perdue : toujours une seule fois « J'ai déjà mes carnets sur un autre appareil » (prénom + code personnel) — ensuite, plus jamais.
0.4.99 — Visionneuse de flash (photo grand format + agrandissement) + verrou de scroll des overlays
- Taper un flash ouvre désormais une visionneuse : photo en 4:3 comme les fiches, badge « Agrandir » et plein écran au tap, auteur, commentaire, bouton cœur (like) — et « En faire une fiche notée » pour l'auteur (la complétion reste dans sa sheet, avec la photo en grand au lieu des 24 px de haut d'avant).
- Auparavant, toucher le flash d'un autre ne faisait qu'un like à l'aveugle : aucune façon de voir la photo.
- Verrou de scroll : quand une sheet/visionneuse est ouverte (flash, complétion, prise de flash, zoom photo d'une fiche), la page derrière ne scrolle plus (body overflow hidden, compteur de référence lockScroll dans util.js).
0.4.100 — Sheets mobiles : CTA visibles au-dessus de la nav + scroll verrouillé (popin « Nourrir »)
- Toutes les sheets en bas d'écran (popin Nourrir, visionneuse flash, prise de flash, complétion) remontent au-dessus de la nav de base : marge basse = hauteur nav + safe-area + 16 px (desktop inchangé).
- La popin « Nourrir » verrouille maintenant aussi le scroll de la page derrière (lockScroll).
0.4.101 — Gestion des carnets (renommer / supprimer / quitter) + journal des envois push
- Sur chaque carte de carnet de la liste : icône crayon et poubelle pour l'admin, croix pour quitter quand on n'est qu'un membre. Confirmations obligatoires pour les actes définitifs.
- Nouvelles mutations worker : renameCarnet (admin, UPDATE Carnets) et deleteCarnet (admin ; les fiches partagées avec un autre carnet y survivent, seules celles exclusives au carnet sont purgées avec likes/commentaires/demandes ; flashes, sessions et membres supprimés).
- Diagnostic notifs : chaque envoi push est désormais journalisé dans Events (type push : cible / abonnements trouvés / envoyés / échoués / purgés) — après un flash sans notif, SELECT * FROM Events WHERE type='push' ORDER BY id DESC LIMIT 5 ; dit exactement ce qui s'est passé (abonnement absent = l'appareil n'a pas rouvert l'app depuis la V0.4.92, échec = endpoint invalide).
0.4.102 — La popin « Nourrir » s'ouvre toujours après création d'un carnet
- Cause du « disparition » : sur un appareil aux fiches vides (identité purgée — le cas du Mac, ou appareil neuf), la condition autres.length gardait la popin fermée sans aucune erreur. Le carnet se créait, mais rien ne s'ouvrait.
- La popin s'ouvre désormais à CHAQUE création de carnet ; si aucune note n'est à proposer, elle affiche un état vide explicatif (« note ta première adresse, ou retrouve tes carnets depuis Profil »).
- Garde défensive (f.carnets || []) sur les deux filtres (creer + seedPossibles) : une fiche sans liens ne peut plus faire planter l'ouverture.
0.4.103 — L'auteur peut supprimer son flash
- Dans la visionneuse, un bouton poubelle apparaît sous les actions (visible seulement de l'auteur) : confirmation obligatoire, le flash disparaît pour tous les membres du carnet.
- Côté worker, la mutation deleteFlash existait déjà (utilisée après complétion) et vérifie auteur OU admin du carnet — purge des réactions avec le flash.
0.4.104 — Libellé raccourci : « En faire une fiche »
- Le bouton de la visionneuse et le titre de la sheet de complétion disaient « En faire une fiche notée » — trop long sur un bouton. Raccourci en « En faire une fiche ».
0.4.105 — Flash : photographier OU choisir dans la pellicule
- La prise de flash forçait l'appareil photo (capture="environment") — impossible de partir d'une photo existante. Deux boutons côte à côte désormais : « Photographier » (appareil) et « Choisir dans la pellicule » (sélecteur du système).
- Tap sur l'aperçu = recharger la photo depuis la pellicule. Nouvelle icône « image » (style Heroicons, toujours zéro emoji).
0.4.106 — Popin de confirmation au-dessus de la nav (suppression d'un flash)
- La confirmation « Supprimer ce flash » restait coincée derrière la nav : la popin (z-80) est un enfant de la sheet flash (z-50) — un z-index dans un parent positionné ne compte que dans son contexte, et la nav (z-50, plus tardive dans le DOM) gagnait le duel. ConfirmModal est désormais téléportée au <body> (Teleport) : elle s'affiche au-dessus de tout, quel que soit l'endroit d'où elle est ouverte.
0.4.107 — Appui long fiabilisé (partage de fiches)
- Le mode sélection ne dépendait plus que d'un timer de 450 ms : le moindre tremblement du doigt (>10 px) ou un pointercancel de scroll l'annulait en silence. Deux déclencheurs désormais : le timer ET l'événement contextmenu natif (celui que l'appui long iOS/Android déclenche tout seul, et le clic droit sur desktop). Tolérance de mouvement portée à 12 px, menu contextuel du navigateur bloqué.
0.4.108 — Invitation depuis la popin du crayon
- Ouvrir le crayon d'un carnet permettait seulement de le renommer — l'invitation restait introuvable pour qui cherchait « partager » ici. La popin propose désormais, sous le renommage : le mot-clé d'invitation lisible, et les boutons WhatsApp / SMS / Copier le lien (même texte d'invitation que la section admin).
0.4.109 — Fini la fausse sélection : « Mon G-Maps » ne paraît plus actif en permanence
- Le bouton Mon G-Maps portait TOUJOURS la bordure riesling, sélectionné ou non : il semblait rester sélectionné en permanence et masquait l'état réel de la liste. Bordure hairline par défaut, accent uniquement quand c'est lui le carnet courant (comme les autres cartes).
- La section de détail s'ouvre désormais sous une étiquette « Carnet sélectionné » : explicite que membres/invitation/export suivent le carnet choisi dans la liste.
0.4.110 — Une fiche ne se modifie que par son créateur
- Avant, l'admin du carnet pouvait modifier la fiche de quelqu'un d'autre, et l'UI montrait le crayon à tout le monde. Désormais : crayon visible uniquement du créateur ; côté serveur, updateFiche refuse quiconque n'est pas l'auteur (session vérifiée, 403) — pas même l'admin. La suppression d'une fiche reste possible à l'auteur OU à l'admin (gouvernance). Même règle en mode démo.
0.4.111 — Message d'invitation explicatif
- « Thomas t'invite... Rejoins-le : lien » ne disait rien du déroulé. Le message WhatsApp/SMS explique désormais ce qu'est Le Carnet, puis les 3 étapes : ouvrir le lien, prénom + code personnel (à retenir), accepter l'installation sur l'écran d'accueil — et rappelle le mot-clé du carnet.
0.4.112 — Joindre un carnet, enfin guidé
- Progression visible sur l'écran d'inscription (points + « Étape 1 sur 2 — ton prénom » / « Étape 2 sur 2 — le carnet et ton code ») : on sait où on en est avant même de lire les champs.
- Bouton « Inviter » (icône partage) directement sur chaque carte de carnet, visible de TOUS les membres : popin avec mot-clé + WhatsApp / SMS / Copier le lien. Mêmes boutons partagés que la popin du crayon de l'admin.
0.4.84 — Identité ancrée : « J'ai déjà mes carnets »
- Diagnostic : iOS purge le stockage local des PWA → le deviceId (localStorage) disparaissait et il fallait retaper ses carnets ; l'espace G-Maps était par appareil, pas par personne.
- Nouvelle action `recuperer` (worker) : prénom + code personnel → vérification contre Membres.code_recup, INSERT Sessions sur tous les carnets du prénom, backfill du code sur les espaces privés qui n'en avaient pas.
- Fusion des espaces privés par prénom (plus par appareil) : l'import G-Maps fait sur le Mac apparaît sur le tel, fiches dédupliquées.
- JoinView : lien « J'ai déjà mes carnets sur un autre appareil » + encart prénom/code → tout revient (carnets + G-Maps).
- main.js : `navigator.storage.persist()` au boot pour réduire l'éviction silencieuse.
- Encart multi-appareils (CarnetView) réécrit autour de la nouvelle porte.
## V0.4.83 — Avatars partout où un badge de profil paraît

- Le bootstrap diffuse l'avatar de chaque membre ; il s'affiche désormais dans la liste des membres d'un carnet, devant chaque commentaire d'une fiche, et sur les cards (auteur + cœurs reçus) à la place de la seule initiale.

## V0.4.82 — Filtre sobre, Mes carnets clarifié

- Filtre pays/ville : plus d'emoji — les noms de pays seuls, sobres et lisibles.
- L'espace « Mon G-Maps » n'apparaît plus dans la liste des carnets : sa carte dédiée en tête suffit (il n'est pas un cercle).
- « Mes carnets » explique que les carnets ne sont pas repris automatiquement d'un appareil à l'autre, et comment les retrouver : mot-clé d'invitation + code personnel via « Rejoindre un carnet ».

## V0.4.81 — Popin « Nouveauté » pour les gros ajouts

- Quand une grosse feature sort, les comptes existants voient une petite popin élégante (une seule fois) qui dit où elle est et ce qu'elle permet — première édition : l'import Google Maps.
- CTA « Ouvrir Mon G-Maps dans mon profil » qui ouvre directement la section repliée ; « Plus tard » referme sans reparaître.
- Les nouveaux ne la voient jamais (onboarding non pollué) : la modale Bienvenue présente désormais aussi l'import Google Maps.

## V0.4.80 — Filtre lieu façon menu de tri

- Le filtre pays/ville troque ses chips e-commerce contre un bouton pilule discret « Lieu » à côté du bouton de tri, qui ouvre un menu en deux niveaux : pays (drapeaux + comptes), puis villes du pays choisi. Même langage visuel que le menu de tri.

## V0.4.79 — Finitions d'après test réel (PWA + desktop)

- CTA d'import : « Importer mes fichiers Google Maps ».
- Mot-clé d'invitation : espacement des lettres normal (il était taillé pour des codes chiffrés).
- Le bouton flash disparaît dans l'espace G-Maps — il n'y a rien à y raconter en flash, et il ne masque plus le bandeau de partage.
- Sur ordi, tous les popins et feuilles (partage, confirmation, flash, démo) s'affichent en modales centrées au lieu de feuilles collées en bas.

## V0.4.78 — « Mon G-Maps », section repliable, avatar synchronisé, dédoublonnage

- L'espace privé s'appelle désormais « Mon G-Maps » (renommage automatique des espaces existants).
- La section d'import du profil est repliée par défaut : une ligne discrète « Mon G-Maps · N lieux importés », on touche pour ouvrir.
- Avatar synchronisé entre appareils : stocké côté serveur (Membres.avatar), envoyé à chaque changement, reçu par tous les appareils du membre au chargement.
- Dédoublonnage automatique des fiches de l'espace privé : après la fusion V0.4.77, les imports répétés laissaient plusieurs copies de chaque lieu ; on ne garde que la meilleure (partagée ailleurs > plus complète > plus ancienne), les copies sont retirées — et supprimées si elles n'appartiennent à aucun autre carnet.

## V0.4.77 — Un seul espace Google Maps, réparable et toujours trouvable

- FIX doublons « Mes adresses » : l'import réutilise l'espace privé existant de l'appareil au lieu d'en créer un nouveau ; les doublons existants sont fusionnés automatiquement au premier chargement (on garde le plus ancien, les fiches sont déplacées, les doublons supprimés).
- Un seul CTA après l'import : « Ouvrir mon espace Google Maps » ; le bouton permanent disparaît pendant l'écran de résultat.
- « Mon espace Google Maps » épinglé en tête de « Mes carnets » — toujours trouvable, avec compte d'adresses.
- FIX bandeau de partage caché sous la navbar : il flotte désormais au-dessus.
- Section d'import plus visible : titre agréci, bordure accent.
- Réimport autant de fois que voulu : les fiches déjà présentes (dans l'espace ou partagées) ne sont jamais écrasées, seules les nouvelles sont ajoutées.

## V0.4.76 — Filtre par pays et ville

- Colonnes `pays` / `ville` sur les fiches (migration auto) + backfill des fiches existantes au premier chargement.
- Détection centrale côté serveur (pays reconnu dans l'adresse ou code pays Takeout, ville via segment code postal) ; l'UI retombe sur une détection locale pour les fiches non encore qualifiées.
- Chips de filtre dans la liste : pays (drapeaux + compte), puis villes du pays choisi ; « Non précisé » est un groupe à part, compté dans « Tous ». N'apparaissent que si le carnet touche au moins 2 pays.
- Le filtre s'applique au tri et à la sélection ; réinitialisé au changement de carnet.

## V0.4.75 — Fix « Voir mes adresses » silencieux + section import visible + curseurs desktop

- **Bug** : après import, « Voir mes adresses » ne faisait RIEN (sans erreur console). Cause : le bootstrap du worker ne renvoyait pas la colonne `prive` des carnets → `store.mesAdresses` restait null → le clic retournait silencieusement. Fix : `carnetsOut` inclut désormais `prive`. Filet de sécurité : `ouvrirMesAdresses` rafraîchit depuis le serveur si l'espace manque, et affiche un toast explicite plutôt que rien.
- **Section import plus visible** : titre « Importer mes lieux, notes et commentaires Google Maps » en serif avec pastille icône, sous-titre « Ton réservoir privé "Mes adresses" — N lieux · visible de toi seul… ».
- **Desktop (Mac/PC)** : `style.css` — curseur pointeur au survol des boutons/liens/labels/summary (media `hover: hover`), `not-allowed` sur les boutons désactivés, léger assombrissement au survol des boutons.

## V0.4.74 — Un seul import : bouton multi-fichiers avec détection automatique

- Simplification demandée par Thomas : plus de deux slots. **Un seul bouton « Choisir mes fichiers d'export »** (sélection multiple possible, on peut balancer tout le contenu du dossier Takeout).
- Détection automatique par contenu : JSON d'avis (note ★ + lieu) → fiches complètes ; listes CSV / KML / JSON → fiches « à noter ». Chaque fichier choisi apparaît dans la liste avec son type, son compte, et un bouton pour le retirer.
- Si les deux types sont fournis : lieux importés puis avis rattachés (comportement inchangé). Anti-doublons serveur inchangé (réimport = 0 importé, tout ignoré).

## V0.4.73b — Sortie de flow : l'import envoie vers l'espace privé

- Après un import, le CTA principal devient **« Voir mes adresses (N) → »** (bascule sur le carnet privé et ouvre la liste) — plus de cul-de-sac « Import d'autres fichiers ». Rappel du partage sous le CTA (« appui long sur une fiche, puis Partager »), « Import d'autres fichiers » passe en lien discret.
- Anti-doublons confirmé (retour de test réel de Thomas) : le serveur compare chaque titre (clé normNom) aux fiches déjà présentes de l'espace privé ET au sein du fichier — un réimport du même JSON n'importé rien (« N doublons ignorés »).

## V0.4.73 — Import avis-seuls : le JSON d'avis suffit pour créer les fiches

- **Réel constaté** (export Takeout « Maps (vos adresses) » de Thomas) : parfois le zip ne contient AUCUN fichier de listes, seulement le JSON d'avis (GeoJSON FeatureCollection, `properties.location.name/address`, `five_star_rating_published`, `review_text_published`).
- parseAvis extrait désormais **nom du lieu, adresse, note ★ et commentaire** de chaque avis (lieu imbriqué `location` géré) ; un avis sans lieu identifié (« Aucune information de localisation ») est ignoré et **compté** (`sansLieu`, affiché dans le résumé).
- Flow : soit fichier suffit — avis seuls → chaque avis devient une fiche complète dans « Mes adresses » ; listes seules → fiches note 0 « à noter » ; les deux → lieux importés puis avis rattachés (inchangé). Slot 1 « Tes listes de lieux — optionnel », slot 2 « Tes avis Google (JSON) — suffit seul ».
- Libellés Takeout « Maps (vos adresses) » dans les messages d'erreur du parser (certains remplacements V0.4.72d n'avaient pas pris : apostrophes typographiques — piège consigné).

## V0.4.72d — Textes import : le produit Takeout s'appelle « Maps (vos adresses) »

- Libellés réels de Google Takeout vérifiés avec Thomas : le produit à cocher est **« Maps (vos adresses) »** (« Enregistrements de vos lieux favoris et de vos avis sur les lieux ») — un seul produit contient les listes ET les avis. Les anciens libellés (« Maps → Enregistrés », « Mes avis ») n'existent plus dans l'interface.
- Mise à jour de la carte d'import (slot 1, ligne d'aide, messages d'erreur du parser).

## V0.4.72c — Fix : `_worker.js` tronqué à la V0.4.72 (build wrangler en échec)

- Le `_worker.js` poussé en V0.4.72 était coupé au milieu du `case "rename"` : `wrangler pages deploy` échouait avec « Unexpected end of file ». Reconstitué intégralement (V0.4.71 complète + blocs V0.4.72) et re-validé en syntaxe ESM stricte.
- Règle de validation ajoutée pour les fichiers ESM : `node --check --input-type=module` (le simple `node --check fichier.js` ne reporte pas les erreurs de syntaxe sur les modules — faux positif).

## V0.4.72b — Astuce import : Le Carnet est aussi un site web (Mac / PC)

- Carte d'import « Mes adresses » (Profil) : encart « Plus simple sur ordi » avant les slots — l'adresse du site s'affiche (`location.origin`), l'utilisateur est invité à rejoindre ses carnets avec ses codes et à faire l'import Takeout au clavier. Les adresses partagées se retrouvent sur tous les écrans.

## V0.4.72 — Mes adresses : import Google complet (lieux + avis), partage-transfert par sélection

- **Import Google Maps à 2 fichiers** (Profil) : lieux enregistrés Takeout (.kml / .csv / .json selon le compte) + avis Google en JSON optionnel. Parsing 100 % local, espace privé « Mes adresses » créé à la volée au premier import (plus d'auto-création au boot).
- **Avis rattachés** par nom (normNom) : notes ★→{70, 78, 85, 93, 100} et commentaires. Un avis ne remplace jamais une note ou un commentaire existant. Ajoutable plus tard (« Plus tard »).
- **Partage = transfert** : sélection longue-press dans « Mes adresses » → bandeau d'action au-dessus de la nav → chips de carnets (multi-sélection, bordure active) → modale de confirmation → les fiches quittent l'espace privé, likes et commentaires suivent (même id).
- **Échecs toujours expliqués** : doublon déjà noté dans le carnet cible, fiche hors espace privé — toast par fiche ignorée.
- **Espace privé** : bloc « Inviter » masqué (pas d'invitation possible), le join serveur refuse les carnets privés. Le bloc de partage fiche-par-fiche V0.4.71 est retiré au profit du flux de sélection.
- **Super-admin** : appui long (600 ms) sur la version au pied du Profil → popin pass → espace privé de démo avec 10 fiches (pass vérifié contre SUPER_ADMIN_HASH côté serveur).
- Pas de recherche dans la liste : scroll infini seul, comme validé en preview.

## V0.4.71 — « Mes adresses » : carnet privé + import Google Maps

- Nouveau carnet privé **« Mes adresses »**, créé automatiquement au boot : visible de son seul propriétaire, invisible aux autres, mot-clé inutilisable (le serveur refuse le join d'un carnet privé).
- **Profil → Importer depuis Google Maps (.kml)** : parsing local du fichier (rien ne quitte l'appareil), import en batches vers « Mes adresses » — note laissée à « à noter », doublons ignorés (même normalisation que l'anti-doublon).
- **Partage volontaire** : depuis une adresse importée, « Partager dans un carnet » → choix du carnet, note (slider, suggestion modifiable) et commentaire. Le partage crée une vraie fiche via addFiche : l'anti-doublon V0.4.70 s'applique, et l'import ne pollue jamais un carnet partagé.
- Rien n'est partagé sans geste explicite ; les carnets restent indépendants.
## V0.4.70 — anti-doublon de fiches dans un même carnet

- Refus serveur à l'ajout si un lieu au nom identique (normalisé : minuscules, sans accents ni ponctuation, article initial retiré — « Le Météoreat » ≡ « Météoreat ») existe déjà dans un des carnets destinataires. Erreur `fiche_doublon` avec la fiche existante.
- La vérification ne porte QUE sur les carnets destinataires : les carnets restent indépendants, le même lieu peut vivre dans deux carnets différents.
- Message client explicite : ouvre la fiche existante ou précise le titre (ville, quartier). L'indice live pendant la saisie détecte maintenant aussi les articles.
- Mode démo : mêmes règles.
## V0.4.69 — mémorisation du code personnel

- Au premier choix du code (onboarding, rejoindre, création), message renforcé : « Mémorise bien ce code : il te servira à créer tes propres carnets et à retrouver tes carnets si tu changes de téléphone. Personne ne pourra te le renvoyer. » — phrase clé en gras.
## V0.4.68 — un seul code personnel, partout

- Le code de récupération devient le **code personnel** : un seul pour tous les carnets.
- Créer un carnet = taper son code personnel (double saisie inchangée) : il devient le code admin du carnet créé ET reste le code personnel du créateur.
- Si l'appareil connaît déjà un code (sessions en base), le même est imposé au join comme à la création (`code_different` sinon) — fini la confusion des deux codes.
- Textes client alignés : « Ton code personnel » partout (onboarding, Mes carnets, création).
## V0.4.67 — code de récupération personnel + reprise d'identité

- Nouveau : chaque membre choisit un code de récupération (4 ou 6 chiffres, hashé SHA-256+sel) au moment de rejoindre — obligatoire, il relie le prénom à son propriétaire.
- Réinstaller ou changer de téléphone ne bloque plus : rejoindre avec le même prénom + son code de récupération transfère l'identité (les sessions de l'ancien appareil sont révoquées, le rôle est conservé).
- Un homonyme sans le code reste refusé. Les membres d'avant cette version (sans code) : reprise via le code admin (bloc « C'est toi ? » dans Mes carnets et dans l'onboarding), ou retrait par un admin puis rejoin.

## V0.4.66 — Rejoindre un carnet depuis « Mes carnets »

- La vue n'offrait que la création : impossible de rejoindre avec un mot-clé une fois l'onboarding passé. Nouveau panneau « Rejoindre un carnet » (icône users, même style que Créer) — c'est aussi la porte de secours d'un nouvel appareil pour retrouver un carnet.

## V0.4.65 — changer de prénom, pour de vrai

- Le changement de prénom n'était que local : le serveur ne savait pas, les likes et commentaires restaient sous l'ancien nom. Nouvelle action « rename » : le serveur vérifie les doublons dans tous les carnets de l'appareil (casse indifférente) puis renomme partout — membres, sessions, admin, notes, likes, commentaires, demandes, flashes.
- Profil : message rouge sous le champ en cas de conflit (avec les carnets concernés), CTA de validation, pastille verte de confirmation après succès.

## V0.4.64 — nav PWA : centrage sur toute la barre

- En PWA installée (viewport-fit=cover), la safe-area iPhone (~34px de barre d'accueil) s'ajoutait SOUS la rangée de 50px : barre visuellement grande, icônes collées en haut. La rangée inclut maintenant la safe-area dans sa hauteur et le contenu se centre sur toute la barre — padding identique haut/bas, navigateur comme PWA.

## V0.4.63 — fix crash au join

- Rejoindre avec un mot-clé erroné (ou tout refus serveur) faisait crasher l'écran : l'objet d'erreur passait pour un succès et le toast lisait le carnet inexistant. Chaque erreur affiche maintenant son message clair.

## V0.4.62 — nav : centrage vertical

- La rangée de la nav a une hauteur fixe (50px) et le contenu (icône + label) s'y centre verticalement — padding identique en haut et en bas, quel que soit l'onglet actif.

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