/** Utilities for turning streamed Markdown into natural avatar speech. */

const DOCUMENT_REFERENCES: Array<[RegExp, string]> = [
  [/(?:Erth Zayed[_ ]?)?HR Policy[^\n,;]*?\.docx/gi, 'the HR Policy'],
  [/SH-Erth Zayed[_ ]Finance Policy[^\n,;]*?\.docx/gi, 'the Arabic Finance Policy'],
  [/(?:Erth Zayed[_ ]?)?Finance Policy[^\n,;]*?\.docx/gi, 'the Finance Policy'],
  [/(?:Erth Zayed[_ ]?)?Accounting Policy[^\n,;]*?\.docx/gi, 'the Accounting Policy'],
  [/(?:Erth Zayed[_ ]?)?Procurement Policy[^\n,;]*?\.docx/gi, 'the Procurement Policy'],
];

export function naturalizeDocumentReferences(text: string): string {
  return DOCUMENT_REFERENCES.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text
  );
}

export function formatTextForDisplay(text: string): string {
  return naturalizeDocumentReferences(text)
    .replace(
      /^\s*(?:\*{0,2})?Sources?\s*:\s*(.+?)\s*$/gim,
      (_match, rawCitation: string) => {
        const citation = rawCitation
          .replace(/\*{1,2}/g, '')
          .replace(/^\s*the\s+/i, '')
          .replace(/\b(HR|Finance|Accounting|Procurement) Policy Framework\b/gi, '$1 Policy')
          .replace(/\bpages?\s+(\d+)/gi, 'p. $1')
          .replace(/\.$/, '')
          .trim();
        return `(${citation}).`;
      }
    )
    .replace(/\(\s*the\s+(HR|Finance|Accounting|Procurement) Policy\b/gi, '($1 Policy')
    .replace(/\((HR|Finance|Accounting|Procurement) Policy Framework\b/gi, '($1 Policy')
    .replace(
      /\((HR|Finance|Accounting|Procurement) Policy\s*,\s*((?:p|pp|page|pages)\.?\s*[\d\s,–—-]+)\)/gi,
      (_match, policy: string, pages: string) => {
        const compactPages = pages
          .replace(/^pages?\s+/i, 'pp. ')
          .replace(/^p{1,2}\.?\s*/i, (prefix) => prefix.toLowerCase().startsWith('pp') ? 'pp. ' : 'p. ')
          .replace(/[—–]/g, '-');
        return `[${policy} Policy · ${compactPages.trim()}](#policy-citation)`;
      }
    );
}

export function cleanTextForTTS(text: string): string {
  const withoutCitations = naturalizeDocumentReferences(text)
    .replace(/^\s*(?:\*{0,2})?Sources?\s*:.*$/gim, '')
    .replace(/\[(?:HR|Finance|Accounting|Procurement) Policy[^\]]*]\(#policy-citation\)/gi, '')
    .replace(/\((?:the\s+)?(?:HR|Finance|Accounting|Procurement)(?:\s+Policy(?:\s+Framework)?)?[^)]*\)/gi, '')
    .replace(/\[(?:the\s+)?(?:HR|Finance|Accounting|Procurement)(?:\s+Policy(?:\s+Framework)?)?[^\]]*]/gi, '');
  const cleaned = withoutCitations
    .replace(/\[([^\]]+)]\([^\s)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/[*_`]+/g, '')
    .replace(/\bDOA\b/g, 'Delegation of Authority')
    .replace(/\bSSC\b/g, 'S S C')
    .replace(/\bEZ\b/g, 'E Z')
    .replace(/\bUAE\b/g, 'U A E')
    .replace(/\bp\.\s*(\d+)/gi, 'page $1')
    .replace(/\bv(\d+)\.(\d+)\b/gi, 'version $1 point $2')
    .replace(/\.(?:docx|pdf)\b/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?؟;:])/g, '$1')
    .trim();
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : '';
}

export function takeNextSpeechSegment(buffer: string): { segment: string; remainder: string } | null {
  const boundaryPattern = /(?:[.!?؟]+(?:["')\]]*)[ \t]+|[.!?؟]+(?:["')\]]*)\n+|:\s*\n+|\n{2,}|\n(?=\s*(?:[-•*]|\d+[.)])\s+))/g;
  let boundary: RegExpExecArray | null;
  while ((boundary = boundaryPattern.exec(buffer))) {
    const splitIndex = boundary.index + boundary[0].length;
    const candidate = buffer.slice(0, splitIndex).trim();
    if (/\b(?:p|pp|no|dr|mr|mrs|ms|vs|e\.g|i\.e)\.\s*$/i.test(candidate)) continue;
    return {
      segment: candidate,
      remainder: buffer.slice(splitIndex),
    };
  }
  return null;
}

export function speechPauseMs(text: string): number {
  const trimmed = text.trim();
  if (/^#{1,6}\s+/.test(trimmed)) return 360;
  if (/[?؟]["')\]]*$/.test(trimmed)) return 480;
  if (/!["')\]]*$/.test(trimmed)) return 420;
  if (/[:：]["')\]]*$/.test(trimmed) || /\n\s*(?:[-•*]|\d+[.)])/.test(text)) return 320;
  return 280;
}
