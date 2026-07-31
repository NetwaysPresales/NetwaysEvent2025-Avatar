import 'dotenv/config';
import sharp from 'sharp';
import { db } from '../src/lib/db';
import { downloadBlobBuffer } from '../src/lib/blob-storage';
import { uploadProfileAsset } from '../src/lib/profile-service';

const profiles = [
  {
    id: '6402f32f-17b6-4ccc-9054-d45a610ec2f9',
    name: 'Zayd | Finance & Supply Chain',
    description: 'Bilingual guidance grounded in Erth Zayed finance, accounting, procurement, supply chain, and organizational policy.',
  },
  {
    id: '538d934e-d0ce-4ed6-bf42-55d00d3eb5e0',
    name: 'Layla | Human Resources',
    description: 'Bilingual guidance grounded in Erth Zayed human resources, employee lifecycle, and organizational policy.',
  },
];

async function makeBackgroundTransparent(source: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const minimum = Math.min(red, green, blue);
    const maximum = Math.max(red, green, blue);
    if (minimum >= 245) {
      data[offset + 3] = 0;
    } else if (minimum > 205 && maximum - minimum < 18) {
      data[offset + 3] = Math.min(data[offset + 3], Math.round(((245 - minimum) / 40) * 255));
    }
  }
  return sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 1200, withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function main() {
  const sourceProfile = await db.profile.findUnique({
    where: { id: profiles[0].id },
    select: { logoBlobUrl: true },
  });
  if (!sourceProfile?.logoBlobUrl) throw new Error('Source logo is missing');
  const transparentLogo = await makeBackgroundTransparent(await downloadBlobBuffer(sourceProfile.logoBlobUrl));

  for (const config of profiles) {
    const profile = await db.profile.findUnique({ where: { id: config.id } });
    if (!profile) throw new Error(`Profile not found: ${config.id}`);
    await uploadProfileAsset(
      profile.userId,
      profile.id,
      'logo',
      transparentLogo,
      'erth-zayed-logo-transparent.png',
      'image/png'
    );
    await db.profile.update({
      where: { id: profile.id },
      data: {
        name: config.name,
        appTitle: config.name,
        appDescription: config.description,
        logoShowContainer: false,
      },
    });
    console.log(`Updated ${config.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
