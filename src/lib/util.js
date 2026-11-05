export const noteLabel = (n) =>
  n >= 93 ? "Inoubliable" : n >= 86 ? "Très bon" : n >= 80 ? "Bon" : n >= 74 ? "Correct" : "Décevant";

export const CATS = ["Resto", "Caviste", "Bar à vin", "Bar", "Soins du corps", "Fromagerie", "Boulangerie", "Autre"];

export const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch (e) {
    return iso;
  }
};

/* Export JSON : partage natif iOS si dispo (Web Share API), sinon téléchargement — pattern Ma Cave. */
// Charge un fichier image -> dataURL JPEG (max côté le plus long : max px).
// objectURL plutôt que dataURL : WebKit/iOS décode parfois mal les gros data:
// en entrée d'Image — le décodage direct du fichier est fiable.
// Rejette en cas de fichier non-image ou d'échec de décodage (à toaster côté UI).
export function chargerPhoto(file, max = 900) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("format"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * k));
        canvas.height = Math.max(1, Math.round(img.height * k));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decodage"));
    };
    img.src = url;
  });
}

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

/* Invitation : message prêt à envoyer + partage WhatsApp / SMS — le lien et le code
   voyagent dans le message, plus besoin de copier-coller. */
export const texteInvitation = (prenom, carnet, lien) =>
  (prenom ? prenom + " t'invite dans" : "Tu es invité dans") +
  " le carnet « " + carnet.nom + " » sur Le Carnet — mot-clé « " + carnet.code + " ». Rejoins-le : " + lien;

export function partagerWhatsapp(texte) {
  window.open("https://wa.me/?text=" + encodeURIComponent(texte), "_blank");
}
export function partagerSms(texte) {
  location.href = "sms:?&body=" + encodeURIComponent(texte);
}