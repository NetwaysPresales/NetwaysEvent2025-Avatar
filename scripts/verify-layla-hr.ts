import 'dotenv/config';
import { encode } from 'next-auth/jwt';
import { db } from '../src/lib/db';
import { createDocumentVisualizationTool } from '../src/agent/tools/document-visualization';
import { downloadBlobBuffer, extractPdfPages } from '../src/lib/blob-storage';

const PROFILE_ID = '538d934e-d0ce-4ed6-bf42-55d00d3eb5e0';
const APP_URL = 'https://app-ntw-avatar-ade1b8.azurewebsites.net';

async function main() {
  const profile = await db.profile.findUnique({
    where: { id: PROFILE_ID },
    include: {
      user: { select: { id: true, email: true, name: true } },
      knowledgeFiles: { orderBy: { uploadedAt: 'asc' } },
    },
  });
  if (!profile) throw new Error('Layla HR profile not found');
  if (profile.name !== 'Layla Avatar | Human Resources') throw new Error(`Unexpected profile name: ${profile.name}`);
  if (profile.knowledgeFiles.length !== 2) throw new Error('Layla HR must have exactly two policy sources');

  const tool = createDocumentVisualizationTool(profile.userId, profile.id);
  const rawVisualization = await tool.invoke({ query: 'annual leave entitlement and approval', displaySeconds: 20 });
  const visualization = JSON.parse(String(rawVisualization)) as {
    found: boolean;
    knowledgeFileId: string;
    pageNumber: number;
    documentUrl: string;
    displayDurationMs: number;
  };
  if (!visualization.found || !visualization.pageNumber) throw new Error('Document visualizer returned no page evidence');
  if (visualization.displayDurationMs !== 20000) throw new Error('Agent-selected evidence duration was not preserved');

  const selectedFile = profile.knowledgeFiles.find((file) => file.id === visualization.knowledgeFileId);
  if (!selectedFile?.renderedPdfBlobUrl) throw new Error('Selected evidence has no rendered PDF');
  const pdfBuffer = await downloadBlobBuffer(selectedFile.renderedPdfBlobUrl);
  if (pdfBuffer.subarray(0, 4).toString() !== '%PDF') throw new Error('Rendered derivative is not a PDF');
  const pages = await extractPdfPages(pdfBuffer);
  if (visualization.pageNumber > pages.length) throw new Error('Selected evidence page is outside the PDF');

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for live route verification');
  const token = await encode({
    secret,
    maxAge: 300,
    token: {
      sub: profile.user.id,
      userId: profile.user.id,
      email: profile.user.email,
      name: profile.user.name,
    },
  });
  const headers = { Cookie: `__Secure-next-auth.session-token=${token}` };
  const sourceResponse = await fetch(`${APP_URL}/api/profiles/${profile.id}/knowledge`, { headers });
  if (!sourceResponse.ok) throw new Error(`Live source list failed (${sourceResponse.status})`);
  const sourcePayload = await sourceResponse.json() as { files: Array<{ visualizable: boolean; pageCount: number | null }> };
  if (sourcePayload.files.length !== 2 || sourcePayload.files.some((file) => !file.visualizable || !file.pageCount)) {
    throw new Error('Live source list is missing page-ready metadata');
  }
  const documentResponse = await fetch(`${APP_URL}${visualization.documentUrl}`, { headers });
  const livePdf = Buffer.from(await documentResponse.arrayBuffer());
  if (!documentResponse.ok || documentResponse.headers.get('content-type') !== 'application/pdf' || livePdf.subarray(0, 4).toString() !== '%PDF') {
    throw new Error(`Live document route failed (${documentResponse.status})`);
  }

  console.log(JSON.stringify({
    profile: profile.name,
    files: sourcePayload.files.length,
    selectedPage: visualization.pageNumber,
    pdfPages: pages.length,
    displayDurationMs: visualization.displayDurationMs,
    liveDocumentStatus: documentResponse.status,
    liveDocumentType: documentResponse.headers.get('content-type'),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
