import 'dotenv/config';
import sharp from 'sharp';
import { db } from '../src/lib/db';
import { CONTAINERS, deleteAsset, uploadAsset } from '../src/lib/blob-storage';

const PROFILE_ID = '6402f32f-17b6-4ccc-9054-d45a610ec2f9';
const SOURCE_URL = 'https://upload.wikimedia.org/wikipedia/commons/5/59/Mountains_of_Wadi_Shawka_denoised.jpg';

async function main() {
  const profile = await db.profile.findUnique({
    where: { id: PROFILE_ID },
    select: { id: true, userId: true, backgroundBlobUrl: true },
  });
  if (!profile) throw new Error('Erth Zayed profile not found');

  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Background download failed (${response.status})`);
  const source = Buffer.from(await response.arrayBuffer());
  const background = await sharp(source)
    .resize(2400, 1350, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 0.82, saturation: 0.82 })
    .jpeg({ quality: 88, progressive: true })
    .toBuffer();
  const blobUrl = await uploadAsset(background, {
    userId: profile.userId,
    profileId: profile.id,
    filename: 'erth-zayed-wadi-shawka-cc-by-sa-4.jpg',
    contentType: 'image/jpeg',
    container: CONTAINERS.AVATAR_ASSETS,
  });
  await db.profile.update({
    where: { id: profile.id },
    data: { backgroundBlobUrl: blobUrl },
  });
  if (profile.backgroundBlobUrl && profile.backgroundBlobUrl !== blobUrl) {
    await deleteAsset(profile.backgroundBlobUrl).catch((error) => {
      console.warn('The previous background could not be deleted:', error);
    });
  }
  console.log('Erth Zayed background updated.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
