export const noteLabel = (n) =>
  n >= 93 ? "Inoubliable" : n >= 86 ? "Très bon" : n >= 80 ? "Bon" : n >= 74 ? "Correct" : "Décevant";

export const CATS = ["Resto", "Caviste", "Bar", "Fromagerie", "Boulangerie", "Autre"];

export const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch (e) {
    return iso;
  }
};

/* Export JSON : partage natif iOS si dispo (Web Share API), sinon téléchargement — pattern Ma Cave. */
export async function exporterFichierJSON(nomFichier, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const fichier = new File([blob], nomFichier, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try { await navigator.share({ files: [fichier] }); return "partage"; }
    catch { return "annule"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return "telecharge";
}
