import 'dotenv/config';
import { db } from '../src/lib/db';
import { Prisma } from '@prisma/client';

function clearApiKey(value: unknown): Prisma.InputJsonValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...value, apiKey: '' } as Prisma.InputJsonValue;
}

async function main() {
  const profiles = await db.profile.findMany({
    select: { id: true, speechConfig: true, openaiConfig: true },
  });
  for (const profile of profiles) {
    await db.profile.update({
      where: { id: profile.id },
      data: {
        speechConfig: clearApiKey(profile.speechConfig),
        openaiConfig: clearApiKey(profile.openaiConfig),
      },
    });
  }
  console.log(`Redacted profile API keys from ${profiles.length} profile(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
