import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outputDir = path.join(
  process.env.LOCALAPPDATA || 'C:\\Users\\abdullah\\AppData\\Local',
  'Temp',
  'opencode',
  'erth-zayed-demo-assets'
);

async function main() {
  await mkdir(outputDir, { recursive: true });

  const logoResponse = await fetch('https://erthzayed.ae/assets/images/homepage-logo-big.svg');
  if (!logoResponse.ok) throw new Error(`Logo download failed: ${logoResponse.status}`);
  const logoSvg = Buffer.from(await logoResponse.arrayBuffer());
  const logoPath = path.join(outputDir, 'erth-zayed-logo.png');
  await sharp(logoSvg).resize({ width: 1200, withoutEnlargement: false }).png().toFile(logoPath);

  const backgroundSvg = `
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fbfaf6"/>
          <stop offset="0.52" stop-color="#f4efe3"/>
          <stop offset="1" stop-color="#e8ddc8"/>
        </linearGradient>
        <radialGradient id="glow" cx="72%" cy="42%" r="62%">
          <stop offset="0" stop-color="#d9c49c" stop-opacity="0.55"/>
          <stop offset="0.55" stop-color="#bda172" stop-opacity="0.12"/>
          <stop offset="1" stop-color="#897044" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#d8c49d"/>
          <stop offset="0.5" stop-color="#a98d5d"/>
          <stop offset="1" stop-color="#6f5836"/>
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="42"/></filter>
        <pattern id="dots" width="42" height="42" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#897044" fill-opacity="0.15"/>
        </pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#base)"/>
      <rect width="1920" height="1080" fill="url(#glow)"/>
      <rect x="1010" width="910" height="1080" fill="url(#dots)" opacity="0.55"/>
      <circle cx="1630" cy="190" r="330" fill="#bda172" fill-opacity="0.08" filter="url(#blur)"/>
      <circle cx="1470" cy="650" r="470" fill="none" stroke="url(#gold)" stroke-width="2" stroke-opacity="0.38"/>
      <circle cx="1470" cy="650" r="370" fill="none" stroke="#897044" stroke-width="1" stroke-opacity="0.24"/>
      <circle cx="1470" cy="650" r="270" fill="none" stroke="#bda172" stroke-width="1" stroke-opacity="0.26"/>
      <path d="M1110 1080 C1210 790 1420 720 1920 635" fill="none" stroke="url(#gold)" stroke-width="6" stroke-opacity="0.35"/>
      <path d="M1240 1080 C1320 845 1505 785 1920 735" fill="none" stroke="#897044" stroke-width="2" stroke-opacity="0.26"/>
      <path d="M1540 1080 C1500 855 1550 560 1785 310" fill="none" stroke="#bda172" stroke-width="3" stroke-opacity="0.32"/>
      <g fill="#897044" fill-opacity="0.48">
        <circle cx="1247" cy="936" r="5"/><circle cx="1368" cy="814" r="4"/>
        <circle cx="1515" cy="761" r="6"/><circle cx="1680" cy="710" r="4"/>
        <circle cx="1785" cy="594" r="5"/><circle cx="1608" cy="430" r="4"/>
      </g>
      <rect x="0" y="0" width="18" height="1080" fill="url(#gold)"/>
      <rect x="76" y="930" width="390" height="2" fill="url(#gold)" opacity="0.42"/>
      <text x="76" y="975" fill="#6f5836" fill-opacity="0.72" font-family="Arial, sans-serif" font-size="18" letter-spacing="5">PRIVATE CONCEPT DEMONSTRATION</text>
    </svg>`;
  const backgroundPath = path.join(outputDir, 'erth-zayed-background.png');
  await sharp(Buffer.from(backgroundSvg)).png().toFile(backgroundPath);
  await writeFile(path.join(outputDir, 'README.txt'), 'Private concept-demo assets. Confirm official brand approval before external distribution.\n');

  console.log(JSON.stringify({ logoPath, backgroundPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
