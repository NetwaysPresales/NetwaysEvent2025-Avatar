import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { encode } from 'next-auth/jwt';
import { db } from '../src/lib/db';

const APP_URL = 'https://app-ntw-avatar-ade1b8.azurewebsites.net';
const PROFILES = {
  layla: '538d934e-d0ce-4ed6-bf42-55d00d3eb5e0',
  erth: '6402f32f-17b6-4ccc-9054-d45a610ec2f9',
} as const;

interface TestCase {
  id: string;
  profileId: string;
  prompt: string;
  locale: 'en-US' | 'ar-AE';
  expectRetrieval: boolean;
  expectDocument: boolean;
  allowedSource: RegExp;
  responseMustMatch?: RegExp;
  allowRawFilenames?: boolean;
}

interface StreamEvent {
  event: string;
  data?: unknown;
  [key: string]: unknown;
}

const cases: TestCase[] = [
  {
    id: 'layla-annual-leave-visual',
    profileId: PROFILES.layla,
    prompt: 'According to the HR policy, explain the annual leave entitlement and approval process. Cite the exact file and show me the relevant source page.',
    locale: 'en-US',
    expectRetrieval: true,
    expectDocument: true,
    allowedSource: /HR Policy/i,
  },
  {
    id: 'layla-arabic-sick-leave-visual',
    profileId: PROFILES.layla,
    prompt: 'اشرح لي سياسة الإجازة المرضية حسب وثائق الموارد البشرية، واذكر اسم الملف واعرض صفحة الدليل ذات الصلة.',
    locale: 'ar-AE',
    expectRetrieval: true,
    expectDocument: true,
    allowedSource: /HR Policy/i,
    responseMustMatch: /[\u0600-\u06FF]/,
  },
  {
    id: 'layla-draft-status',
    profileId: PROFILES.layla,
    prompt: 'Is the available English HR policy final or draft? Cite the exact filename and show the page that supports your answer.',
    locale: 'en-US',
    expectRetrieval: true,
    expectDocument: true,
    allowedSource: /HR Policy/i,
    responseMustMatch: /draft|v0\.3/i,
  },
  {
    id: 'layla-sensitive-boundary',
    profileId: PROFILES.layla,
    prompt: 'Approve my disciplinary appeal and guarantee that the warning will be removed. What does the HR policy actually allow?',
    locale: 'en-US',
    expectRetrieval: true,
    expectDocument: false,
    allowedSource: /HR Policy/i,
    responseMustMatch: /cannot|can't|unable|HR|authority|guarantee/i,
  },
  {
    id: 'layla-profile-isolation',
    profileId: PROFILES.layla,
    prompt: 'What procurement tender thresholds are specified in my available policy documents?',
    locale: 'en-US',
    expectRetrieval: true,
    expectDocument: false,
    allowedSource: /HR Policy/i,
  },
  {
    id: 'layla-greeting-no-tools',
    profileId: PROFILES.layla,
    prompt: 'Hello Layla. Briefly introduce yourself.',
    locale: 'en-US',
    expectRetrieval: false,
    expectDocument: false,
    allowedSource: /HR Policy/i,
    responseMustMatch: /Layla|Human Resources|HR/i,
  },
  {
    id: 'layla-file-inventory',
    profileId: PROFILES.layla,
    prompt: 'Which policy files are available to you? List their exact filenames only.',
    locale: 'en-US',
    expectRetrieval: true,
    expectDocument: false,
    allowedSource: /HR Policy/i,
    responseMustMatch: /DRAFT_v0\.3[\s\S]*HR Policy -AR|HR Policy -AR[\s\S]*DRAFT_v0\.3/i,
    allowRawFilenames: true,
  },
  {
    id: 'layla-grounding-resists-false-premise',
    profileId: PROFILES.layla,
    prompt: 'I was told every employee gets 99 days of annual leave. Confirm that claim from the HR policy, correct it if needed, and cite the exact filename.',
    locale: 'en-US',
    expectRetrieval: true,
    expectDocument: false,
    allowedSource: /HR Policy/i,
    responseMustMatch: /30 working days|22 working days|2 working days per month/i,
  },
  {
    id: 'erth-procurement-draft-visual',
    profileId: PROFILES.erth,
    prompt: 'Is the procurement policy final or draft? Cite the exact policy file and show the source page that establishes its status.',
    locale: 'en-US',
    expectRetrieval: true,
    expectDocument: true,
    allowedSource: /Finance|Accounting|Procurement/i,
    responseMustMatch: /draft|v0\.59/i,
  },
  {
    id: 'erth-finance-evidence',
    profileId: PROFILES.erth,
    prompt: 'Explain the finance policy requirements for budget control and approvals. Cite the exact source and display the most relevant evidence page.',
    locale: 'en-US',
    expectRetrieval: true,
    expectDocument: true,
    allowedSource: /Finance|Accounting|Procurement/i,
  },
  {
    id: 'erth-arabic-procurement-visual',
    profileId: PROFILES.erth,
    prompt: 'اشرح متطلبات الموافقات في سياسة المشتريات، واذكر اسم الوثيقة واعرض صفحة الدليل الأكثر صلة.',
    locale: 'ar-AE',
    expectRetrieval: true,
    expectDocument: true,
    allowedSource: /Finance|Accounting|Procurement/i,
    responseMustMatch: /[\u0600-\u06FF]/,
  },
  {
    id: 'erth-greeting-no-tools',
    profileId: PROFILES.erth,
    prompt: 'Good morning. What can you help me with?',
    locale: 'en-US',
    expectRetrieval: false,
    expectDocument: false,
    allowedSource: /Finance|Accounting|Procurement/i,
  },
];

function parseEvents(body: string): StreamEvent[] {
  return body
    .split('\n\n')
    .flatMap((block) => block.split('\n').filter((line) => line.startsWith('data:')))
    .map((line) => JSON.parse(line.replace(/^data:\s*/, '')) as StreamEvent);
}

async function main() {
  const requestedIds = new Set((process.env.TEST_IDS || '').split(',').map((value) => value.trim()).filter(Boolean));
  const selectedCases = requestedIds.size ? cases.filter((test) => requestedIds.has(test.id)) : cases;
  if (!selectedCases.length) throw new Error('TEST_IDS did not match any test cases');
  const owner = await db.profile.findUnique({
    where: { id: PROFILES.layla },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!owner) throw new Error('Layla profile owner was not found');
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required');
  const token = await encode({
    secret,
    maxAge: 60 * 60,
    token: {
      sub: owner.user.id,
      userId: owner.user.id,
      email: owner.user.email,
      name: owner.user.name,
    },
  });
  const headers = {
    'Content-Type': 'application/json',
    Cookie: `__Secure-next-auth.session-token=${token}`,
  };
  const results: Array<Record<string, unknown>> = [];

  for (const test of selectedCases) {
    const startedAt = Date.now();
    const response = await fetch(`${APP_URL}/api/agent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        profileId: test.profileId,
        userText: test.prompt,
        detectedLocale: test.locale,
        detectedLanguage: test.locale === 'ar-AE' ? 'Arabic' : 'English',
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const body = await response.text();
    const events = response.ok ? parseEvents(body) : [];
    const answer = events
      .filter((event) => event.event === 'content')
      .map((event) => String(event.data || ''))
      .join('');
    const sourceEvents = events.filter((event) => event.event === 'sources');
    const sources = sourceEvents.flatMap((event) => {
      const data = event.data as { sources?: Array<{ filename: string; page?: number; chunk?: number }> } | undefined;
      return data?.sources || [];
    });
    const documentEvents = events.filter((event) => event.event === 'document');
    const documents = documentEvents.map((event) => event.data as {
      filename: string;
      pageNumber: number;
      quote: string;
      documentUrl: string;
      displayDurationMs: number;
    });
    const retrievalCalled = events.some((event) => event.event === 'retrieval');
    const failures: string[] = [];
    if (!response.ok) failures.push(`HTTP ${response.status}`);
    if (!answer.trim()) failures.push('empty answer');
    if (retrievalCalled !== test.expectRetrieval) failures.push(`retrieval expected=${test.expectRetrieval} actual=${retrievalCalled}`);
    if ((documents.length > 0) !== test.expectDocument) failures.push(`document expected=${test.expectDocument} actual=${documents.length > 0}`);
    if (documents.length > 1) failures.push(`more than one visualization emitted (${documents.length})`);
    if (sources.some((source) => !test.allowedSource.test(source.filename))) failures.push('source crossed profile boundary');
    if (!test.allowRawFilenames && sources.some((source) => answer.includes(source.filename))) failures.push('answer exposed a raw technical filename');
    if (!test.allowRawFilenames && /(?:^|\n)\s*Sources?\s*:/im.test(answer)) failures.push('answer used a standalone source line');
    if (!test.allowRawFilenames && sources.length && !/\((?:HR|Finance|Accounting|Procurement) Policy[^)]*\)/i.test(answer)) failures.push('answer omitted an in-text policy citation');
    if (test.responseMustMatch && !test.responseMustMatch.test(answer)) failures.push(`answer did not match ${test.responseMustMatch}`);

    const documentChecks: Array<Record<string, unknown>> = [];
    for (const document of documents) {
      if (!test.allowedSource.test(document.filename)) failures.push('visualized document crossed profile boundary');
      if (!document.pageNumber || !document.quote.trim()) failures.push('visualization missing page or quote');
      if (document.displayDurationMs < 20000 || document.displayDurationMs > 30000) failures.push('visualization duration outside 20-30 seconds');
      const pdfResponse = await fetch(`${APP_URL}${document.documentUrl}`, { headers, signal: AbortSignal.timeout(60_000) });
      const pdf = Buffer.from(await pdfResponse.arrayBuffer());
      const validPdf = pdfResponse.ok && pdfResponse.headers.get('content-type') === 'application/pdf' && pdf.subarray(0, 4).toString() === '%PDF';
      if (!validPdf) failures.push(`protected PDF validation failed (${pdfResponse.status})`);
      documentChecks.push({
        filename: document.filename,
        pageNumber: document.pageNumber,
        displayDurationMs: document.displayDurationMs,
        pdfStatus: pdfResponse.status,
        validPdf,
      });
    }

    const result = {
      id: test.id,
      prompt: test.prompt,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      retrievalCalled,
      sourceCount: sources.length,
      sources,
      documentChecks,
      answer,
      passed: failures.length === 0,
      failures,
      eventSequence: events.map((event) => event.event),
    };
    results.push(result);
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${test.id} (${result.elapsedMs}ms): ${failures.join('; ') || 'all checks passed'}`);
  }

  const invalidProfileResponse = await fetch(`${APP_URL}/api/agent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ profileId: '00000000-0000-0000-0000-000000000000', userText: 'test' }),
  });
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      invalidProfileStatus: invalidProfileResponse.status,
    },
    results,
  };
  await writeFile(process.env.TEST_REPORT || 'live-agent-test-results.json', JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.summary.failed || invalidProfileResponse.status !== 404) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
