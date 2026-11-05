export const noteLabel = (n) =>
  n >= 93 ? "Inoubliable" : n >= 86 ? "Très bon" : n >= 80 ? "Bon" : n >= 74 ? "Correct" : "Décevant";

export const CATS = ["Resto", "Caviste", "Bar à vin", "Bar", "Autre", "Brunch", "Soins du corps", "Fromagerie", "Boulangerie"];

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

/* Carte de partage d'une note : image 1080x1350 generee en canvas, dans la charte
   (creme, bordeaux, or, Georgia). Partage natif via Web Share API (fichier), sinon
   telechargement. Zéro serveur : tout se passe sur l'appareil. */
export function creerCartePartage(fiche) {
  return new Promise((resolve) => {
    const W = 1080, H = 1350;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const C = { creme: "#FAF6F1", bordeaux: "#7A2E3E", or: "#A8842C", encre: "#2B211C" };
    ctx.fillStyle = C.creme; ctx.fillRect(0, 0, W, H);

    const dessinerTexte = () => {
      let y = 0;
      if (fiche.photo) {
        const img = new Image();
        img.onload = () => {
          const zoneH = 700;
          const k = Math.max(W / img.width, zoneH / img.height);
          const dw = img.width * k, dh = img.height * k;
          ctx.save();
          ctx.beginPath(); ctx.rect(0, 0, W, zoneH); ctx.clip();
          ctx.drawImage(img, (W - dw) / 2, (zoneH - dh) / 2, dw, dh);
          ctx.restore();
          y = zoneH;
          finir(y);
        };
        img.onerror = () => finir(0);
        img.src = fiche.photo;
      } else {
        finir(0);
      }
      function finir(photoH) {
        let y = photoH + 70;
        if (!fiche.photo) {
          // pas de photo : un coeur or discret en haut de la carte
          ctx.fillStyle = C.or;
          ctx.font = "120px Georgia";
          ctx.textAlign = "center";
          ctx.fillText("♥", W / 2, 190);
          y = 280;
        }
        ctx.textAlign = "left";
        ctx.fillStyle = C.bordeaux;
        ctx.font = "bold 64px Georgia";
        const titre = fiche.titre.length > 44 ? fiche.titre.slice(0, 43) + "…" : fiche.titre;
        let line = "", lines = [];
        for (const mot of titre.split(" ")) {
          if (ctx.measureText(line + mot).width > W - 180 && line) { lines.push(line); line = mot + " "; }
          else line += mot + " ";
        }
        lines.push(line.trim());
        for (const l of lines.slice(0, 3)) { ctx.fillText(l, 90, y); y += 78; }
        // méta : lieu à gauche, note sur 100 en or à droite
        if (fiche.lieu || (fiche.note && fiche.note >= 70)) {
          y += 18;
          const baseY = y;
          if (fiche.lieu) {
            ctx.fillStyle = C.encre;
            ctx.font = "italic 42px Georgia";
            ctx.textAlign = "left";
            const lieu = fiche.lieu.length > 40 ? fiche.lieu.slice(0, 39) + "…" : fiche.lieu;
            ctx.fillText(lieu, 90, baseY);
          }
          if (fiche.note && fiche.note >= 70) {
            ctx.fillStyle = C.or;
            ctx.font = "bold 52px Georgia";
            ctx.textAlign = "right";
            ctx.fillText(fiche.note + " / 100", W - 90, baseY);
          }
          ctx.textAlign = "left";
          y = baseY + 44;
        }
        y += 44;
        if (fiche.com) {
          ctx.fillStyle = C.encre;
          ctx.font = "italic 44px Georgia";
          const com = fiche.com.length > 150 ? fiche.com.slice(0, 149) + "…" : fiche.com;
          line = "";
          for (const mot of com.split(" ")) {
            if (ctx.measureText(line + mot).width > W - 180 && line) { lines.push(line); line = mot + " "; }
            else line += mot + " ";
          }
          lines.push(line.trim());
          for (const l of lines.slice(-3)) { ctx.fillText(l, 90, y); y += 60; }
        }
        // pied : mention + coeur
        ctx.fillStyle = C.or;
        ctx.font = "46px Georgia";
        ctx.fillText("vu dans Le Carnet", 90, H - 90);
        ctx.textAlign = "right";
        ctx.fillText("♥", W - 90, H - 90);
        // trait de separation
        ctx.strokeStyle = C.or;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(90, H - 140); ctx.lineTo(W - 90, H - 140); ctx.stroke();
        cv.toBlob((blob) => resolve(blob), "image/png");
      }
    };
    dessinerTexte();
  });
}

export async function partagerFiche(fiche) {
  const blob = await creerCartePartage(fiche);
  const fichier = new File([blob], "le-carnet-" + (fiche.titre || "adresse").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 30) + ".png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: fiche.titre || "Le Carnet" });
      return "partage";
    } catch (e) { return "annule"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fichier.name;
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