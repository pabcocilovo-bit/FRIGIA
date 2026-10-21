// Carte story de fin de cuisson : la photo du plat, « Frigia », ce qui a été sauvé et le nom du plat, en 1080 × 1920.
// Même mise en page que la carte du prototype (.scard, 210 × 373), agrandie.
const W = 1080, H = 1920, K = W / 210;
const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '"Hanken Grotesk", system-ui, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Coupe un texte en lignes qui tiennent dans la largeur */
function lines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(" ")) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > width) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

async function draw(photo: string | null, badge: string, title: string, foot0: string, withPhoto: boolean): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#34503B";
  ctx.fillRect(0, 0, W, H);
  const img = withPhoto && photo ? await loadImage(photo) : null;
  if (img) {
    // object-fit: cover
    const s = Math.max(W / img.width, H / img.height);
    ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(0,0,0,.35)");
  g.addColorStop(0.3, "rgba(0,0,0,0)");
  g.addColorStop(0.45, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(30,45,34,.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.font = `italic 400 ${22 * K}px ${SERIF}`;
  ctx.fillText("Frigia", W / 2, 14 * K);

  // Bas de la carte, de bas en haut : la phrase, le nom du plat, la pastille
  ctx.textAlign = "left";
  const left = 14 * K, width = W - 28 * K, gap = 6 * K;
  let y = H - 14 * K;
  ctx.font = `400 ${11.5 * K}px ${SANS}`;
  const foot = lines(ctx, foot0, width);
  const footLh = 11.5 * K * 1.35;
  y -= foot.length * footLh;
  ctx.globalAlpha = 0.85;
  foot.forEach((l, i) => ctx.fillText(l, left, y + i * footLh));
  ctx.globalAlpha = 1;

  ctx.font = `400 ${26 * K}px ${SERIF}`;
  const tl = lines(ctx, title, width), titleLh = 26 * K * 1.02;
  y -= gap + tl.length * titleLh;
  tl.forEach((l, i) => ctx.fillText(l, left, y + i * titleLh));

  ctx.font = `600 ${12 * K}px ${SANS}`;
  const padX = 9 * K, padY = 6 * K, bh = 12 * K + padY * 2, bw = ctx.measureText(badge).width + padX * 2;
  y -= gap + bh;
  ctx.fillStyle = "#F7F1E6";
  ctx.beginPath();
  ctx.roundRect(left, y, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = "#34503B";
  ctx.fillText(badge, left + padX, y + padY);

  try {
    return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  } catch {
    return null; // photo d'un autre site sans autorisation : la carte se refait sans elle
  }
}

/** L'image de la carte (PNG). foot : la petite phrase du bas. */
export async function storyImage(photo: string | null, badge: string, title: string,
  foot = "Faite avec ce qu'il y avait dans le frigo · frigia.fr"): Promise<Blob | null> {
  await Promise.all([
    document.fonts.load(`italic 400 ${22 * K}px ${SERIF}`),
    document.fonts.load(`400 ${26 * K}px ${SERIF}`),
    document.fonts.load(`600 ${12 * K}px ${SANS}`),
  ]).catch(() => undefined);
  return (await draw(photo, badge, title, foot, true)) ?? draw(photo, badge, title, foot, false);
}

/** Partage la carte (Instagram, WhatsApp… depuis le menu du téléphone) ou l'enregistre. "saved" : téléchargée. */
export async function shareStory(blob: Blob, title: string, save: boolean): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], "frigia-story.png", { type: "image/png" });
  if (!save && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "saved";
}
