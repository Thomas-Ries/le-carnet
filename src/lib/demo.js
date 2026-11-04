// Mode démo local : si le backend (Cloudflare _worker.js) n'est pas déployé,
// toutes les données vivent dans localStorage. Même mécanique que Soirées Cavistes v1.1.
const KEY = "lc-demo-db";

export const seed = () => ({
  carnets: [
    { id: "famille", nom: "Famille", code: "102030", adminCode: "246810", admin: "Thomas", membres: ["Thomas", "Maman", "Papa", "Julie"] },
    { id: "amis", nom: "La bande", code: "735791", adminCode: "135791", admin: "Thomas", membres: ["Thomas", "Sophie", "Chetto", "Mamat", "Tib"] },
    { id: "boulot", nom: "Boulot", code: "465319", adminCode: "975319", admin: "Thomas", membres: ["Thomas", "Karim", "Léa"] },
  ],
  fiches: [
    { id: "f1", carnets: ["famille"], type: "adresse", cat: "Fromagerie", titre: "Chez Jean-Marie", lieu: "Colmar, centre", note: 92, auteur: "Maman", date: "2026-09-12", com: "Le munster fermier est incroyable. Prends le morceau affiné, pas le jeune !", reacts: ["Papa", "Julie"], photo: null, recette: null, demandeRecette: [] },
    { id: "f2", carnets: ["famille"], type: "adresse", cat: "Boulangerie", titre: "Au four du Coin", lieu: "Colmar, Krutenau", note: 84, auteur: "Papa", date: "2026-10-03", com: "La tarte aux quetsches du samedi matin.", reacts: ["Thomas"], photo: null, recette: null, demandeRecette: [] },
    { id: "f3", carnets: ["famille"], type: "recette", cat: "Recette", titre: "Tarte aux quetsches de Mamie", lieu: "", note: 95, auteur: "Maman", date: "2026-09-01", com: "Pâte sablée, quetsches entières, aucune épice.", reacts: ["Julie", "Papa", "Thomas"], photo: null, recette: "Pâte : 250 g farine, 125 g beurre, 1 jaune, 50 g sucre. Quetsches dénoyautées debout sur le fond. 35 min à 180°C. Sucrer à la sortie, jamais avant.", demandeRecette: [] },
    { id: "f4", carnets: ["amis"], type: "adresse", cat: "Resto", titre: "Le Comptoir du Marché", lieu: "Strasbourg, Krutenau", note: 88, auteur: "Sophie", date: "2026-10-18", com: "Punaise, la planche de la semaine. Y aller avant 19h30, petit salon.", reacts: ["Chetto", "Mamat"], photo: null, recette: null, demandeRecette: [] },
    { id: "f5", carnets: ["amis"], type: "adresse", cat: "Caviste", titre: "Cave Sainte-Croix", lieu: "Strasbourg", note: 90, auteur: "Thomas", date: "2026-10-05", com: "Le riesling Grand Cru qu'on a bu chez moi. Demander Aurélien.", reacts: ["Sophie", "Tib"], photo: null, recette: null, demandeRecette: [] },
    { id: "f6", carnets: ["amis"], type: "adresse", cat: "Bar", titre: "Bar 1925", lieu: "Strasbourg, Gare", note: 78, auteur: "Tib", date: "2026-10-21", com: "Bien mais bondé après 22h. Les cocktails changent chaque mois.", reacts: [], photo: null, recette: null, demandeRecette: [] },
    { id: "f7", carnets: ["boulot"], type: "adresse", cat: "Resto", titre: "Chez Fatou", lieu: "Presqu'île, Lyon", note: 87, auteur: "Karim", date: "2026-10-14", com: "Le poulet yassa du midi, formule imbattable.", reacts: ["Léa", "Thomas"], photo: null, recette: null, demandeRecette: [] },
    { id: "f8", carnets: ["amis"], type: "recette", cat: "Recette", titre: "Tiramisu de Chetto", lieu: "", note: 93, auteur: "Chetto", date: "2026-10-02", com: "Le secret : mascarpone + amaretti écrasés dedans.", reacts: ["Thomas", "Sophie", "Mamat"], photo: null, recette: null, demandeRecette: [] },
  ],
  flashes: [],
});

export const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* premier lancement */ }
  const db = seed();
  save(db);
  return db;
};

export function save(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

let seq = Date.now();
export const uid = (p) => `${p}${++seq}`;
