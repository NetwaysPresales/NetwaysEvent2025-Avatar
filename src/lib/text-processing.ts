/** Utilities for turning streamed Markdown into natural avatar speech. */

const DOCUMENT_REFERENCES: Array<[RegExp, string]> = [
  [/Erth[_ ]Zayed[_ ]AI[_ ]Avatar[_ ]Knowledge[_ ]Base[^\n,;]*?\.json/gi, 'the Erth Zayed AI Avatar Knowledge Base'],
  [/Erth[_ ]Zayed[_ ]AI[_ ]Knowledge[_ ]Base[^\n,;]*?\.docx/gi, 'the Erth Zayed Knowledge Base'],
  [/(?:Erth Zayed[_ ]?)?HR Policy[^\n,;]*?\.docx/gi, 'the HR Policy'],
  [/SH-Erth Zayed[_ ]Finance Policy[^\n,;]*?\.docx/gi, 'the Arabic Finance Policy'],
  [/(?:Erth Zayed[_ ]?)?Finance Policy[^\n,;]*?\.docx/gi, 'the Finance Policy'],
  [/(?:Erth Zayed[_ ]?)?Accounting Policy[^\n,;]*?\.docx/gi, 'the Accounting Policy'],
  [/(?:Erth Zayed[_ ]?)?Procurement Policy[^\n,;]*?\.docx/gi, 'the Procurement Policy'],
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function friendlySourceName(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('ai_avatar_knowledge_base') || lower.includes('ai avatar knowledge base')) return 'Erth Zayed AI Avatar Knowledge Base';
  if (lower.includes('ai_knowledge_base') || lower.includes('ai knowledge base')) return 'Erth Zayed Knowledge Base';
  if (lower.includes('hr policy')) return 'HR Policy';
  if (lower.includes('finance policy')) return lower.startsWith('sh-') ? 'Arabic Finance Policy' : 'Finance Policy';
  if (lower.includes('accounting policy')) return 'Accounting Policy';
  if (lower.includes('procurement policy')) return lower.includes('arabic') ? 'Arabic Procurement Policy' : 'Procurement Policy';
  return filename
    .replace(/\.(docx|pdf|json|txt|md|markdown)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function naturalizeDocumentReferences(text: string, sourceFilenames: string[] = []): string {
  const knownNaturalized = DOCUMENT_REFERENCES.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text
  );
  return sourceFilenames.reduce((value, filename) => (
    value.replace(new RegExp(escapeRegex(filename), 'gi'), `the ${friendlySourceName(filename)}`)
  ), knownNaturalized);
}

export function formatTextForDisplay(text: string, sourceFilenames: string[] = []): string {
  let formatted = naturalizeDocumentReferences(text, sourceFilenames)
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
    .replace(/\(\s*the\s+Erth Zayed Knowledge Base\b/gi, '(Erth Zayed Knowledge Base')
    .replace(/\(\s*the\s+Erth Zayed AI Avatar Knowledge Base\b/gi, '(Erth Zayed AI Avatar Knowledge Base')
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
    )
    .replace(
      /\(Erth Zayed Knowledge Base\s*,\s*((?:p|pp|page|pages)\.?\s*[\d\s,–—-]+)\)/gi,
      (_match, pages: string) => {
        const compactPages = pages
          .replace(/^pages?\s+/i, 'pp. ')
          .replace(/^p{1,2}\.?\s*/i, (prefix) => prefix.toLowerCase().startsWith('pp') ? 'pp. ' : 'p. ')
          .replace(/[—–]/g, '-');
        return `[Erth Zayed Knowledge Base · ${compactPages.trim()}](#policy-citation)`;
      }
    )
    .replace(
      /\(Erth Zayed (?:AI )?Avatar Knowledge Base\s*,?\s*((?:p|pp|page|pages)\.?\s*[\d\s,–—-]+)?\)/gi,
      (_match, pages: string) => {
        const compactPages = pages
          ? ` · ${pages.replace(/^pages?\s+/i, 'pp. ').replace(/^p{1,2}\.?\s*/i, (prefix) => prefix.toLowerCase().startsWith('pp') ? 'pp. ' : 'p. ').replace(/[—–]/g, '-').trim()}`
          : '';
        return `[Erth Zayed AI Avatar Knowledge Base${compactPages}](#policy-citation)`;
      }
    );

  for (const filename of sourceFilenames) {
    const label = friendlySourceName(filename);
    const citationPattern = new RegExp(`\\(\\s*(?:the\\s+)?${escapeRegex(label)}\\s*(?:,\\s*((?:p|pp|page|pages)\\.?\\s*[\\d\\s,–—-]+))?\\)`, 'gi');
    formatted = formatted.replace(citationPattern, (_match, pages: string | undefined) => {
      const compactPages = pages
        ? ` · ${pages.replace(/^pages?\s+/i, 'pp. ').replace(/^p{1,2}\.?\s*/i, (prefix) => prefix.toLowerCase().startsWith('pp') ? 'pp. ' : 'p. ').replace(/[—–]/g, '-').trim()}`
        : '';
      return `[${label}${compactPages}](#policy-citation)`;
    });
  }
  return formatted;
}

export function cleanTextForTTS(text: string): string {
  const withoutCitations = naturalizeDocumentReferences(text)
    .replace(/^\s*(?:\*{0,2})?Sources?\s*:.*$/gim, '')
    .replace(/\[(?:HR|Finance|Accounting|Procurement) Policy[^\]]*]\(#policy-citation\)/gi, '')
    .replace(/\[Erth Zayed Knowledge Base[^\]]*]\(#policy-citation\)/gi, '')
    .replace(/\[[^\]]+]\(#policy-citation\)/gi, '')
    .replace(/\((?:the\s+)?(?:HR|Finance|Accounting|Procurement)(?:\s+Policy(?:\s+Framework)?)?[^)]*\)/gi, '')
    .replace(/\[(?:the\s+)?(?:HR|Finance|Accounting|Procurement)(?:\s+Policy(?:\s+Framework)?)?[^\]]*]/gi, '')
    .replace(/\((?:the\s+)?Erth Zayed Knowledge Base[^)]*\)/gi, '')
    .replace(/\[(?:the\s+)?Erth Zayed Knowledge Base[^\]]*]/gi, '');
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
