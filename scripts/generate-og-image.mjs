import sharp from 'sharp';
import { readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Génère l'image de partage social par défaut : `public/assets/images/og-moze.jpg`, en 1200x630.
 *
 * Le site n'en avait aucune — seuls les articles de blog exposaient une `og:image`, dérivée de
 * leur couverture. Partagées sur LinkedIn ou WhatsApp, les autres pages n'affichaient donc pas
 * de vignette du tout.
 *
 * Le traitement reprend celui des articles sans couverture (`article-card.component.scss`) :
 * dégradé de la couleur primaire vers la couleur d'interaction, logo en blanc au centre. Rien
 * d'inventé, et rien de textuel — une image générée qui imiterait une composition graphique
 * vieillirait mal. À remplacer par un visuel dessiné le jour où il en existe un : le chemin de
 * sortie ne change pas, le code qui la référence non plus.
 *
 * Format : JPEG et non WebP, que le crawler LinkedIn refuse. Poids visé bien en deçà des ~300 Ko
 * au-delà desquels WhatsApp abandonne l'aperçu.
 *
 * Usage : `node scripts/generate-og-image.mjs`
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const logoPath = resolve(__dirname, '../public/assets/icons/MozeLogo.svg');
const outPath = resolve(__dirname, '../public/assets/images/og-moze.jpg');

/** Dimensions attendues par tous les réseaux (ratio 1.91:1). */
const WIDTH = 1200;
const HEIGHT = 630;

/** Le logo occupe un peu plus de la moitié de la largeur : lisible en vignette réduite. */
const LOGO_WIDTH = 620;

// Le logo est monochrome, peint en `--primary-color` via une classe CSS interne. On le repasse
// en blanc pour qu'il ressorte sur le dégradé.
const logoSvg = readFileSync(logoPath, 'utf8').replace(/#145775/gi, '#ffffff');

const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#145775"/>
      <stop offset="100%" stop-color="#0297d8"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fond)"/>
</svg>`;

const logo = await sharp(Buffer.from(logoSvg))
  .resize({ width: LOGO_WIDTH })
  .png()
  .toBuffer();

await sharp(Buffer.from(background))
  .composite([{ input: logo, gravity: 'centre' }])
  .jpeg({ quality: 88, progressive: true })
  .toFile(outPath);

const { size } = statSync(outPath);
const { width, height } = await sharp(outPath).metadata();
console.log(`✓ ${outPath}`);
console.log(`  ${width}x${height} — ${(size / 1024).toFixed(1)} Ko`);
