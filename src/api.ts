import { demoCases } from '../shared/fixtures';
import { analyseAccounts, traceFunds, crossCaseLinks, DEFAULT_RULES } from '../shared/analysis';
import type { CaseData, RuleSettings } from '../shared/types';

export const offline = import.meta.env.MODE === 'submission';
const key = 'trace-x-submission-v1';
function offlineState(): { cases: CaseData[]; rules: RuleSettings } {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { cases: demoCases(), rules: DEFAULT_RULES };
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (offline) {
    const state = offlineState();
    const segments = path.split('?')[0].split('/').filter(Boolean);
    const method = options.method || 'GET';
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
    let out: unknown;
    const c = state.cases.find((c) => c.id === segments[2]);
    if (path === '/api/cases' && method === 'GET') out = state.cases;
    else if (path === '/api/settings') {
      if (method === 'PUT') state.rules = body;
      out = state.rules;
    } else if (path === '/api/cases' && method === 'POST') {
      const fresh: CaseData = {
        ...body,
        id: `TX-PREVIEW-${Date.now().toString().slice(-5)}`,
        createdAt: new Date().toISOString(),
        status: 'Active',
        synthetic: true,
        accounts: [],
        transactions: [],
        evidence: [],
        indicators: [],
        lookups: [],
        notes: [],
      };
      state.cases.push(fresh);
      out = fresh;
    } else if (c && segments[3] === 'analysis') {
      const utr = new URLSearchParams(path.split('?')[1]).get('utr') || c.victimUtr;
      out = {
        risks: analyseAccounts(c, state.rules),
        trace: traceFunds(c, utr),
        links: crossCaseLinks(c, state.cases),
        rules: state.rules,
      };
    } else if (c && segments[3] === 'audit')
      out = [
        {
          id: 1,
          caseId: c.id,
          action: 'Standalone preview',
          detail: 'Synthetic fixture loaded. Preview changes stay in this browser.',
          at: c.createdAt,
        },
      ];
    else if (c && segments[3] === 'notes' && method === 'POST') {
      c.notes.push({
        id: String(Date.now()),
        text: body.text,
        createdAt: new Date().toISOString(),
      });
      out = c;
    } else if (c && segments[3] === 'evidence' && method === 'POST') {
      const id = `EV-PREVIEW-${Date.now()}`;
      c.evidence.push({
        id,
        name: body.name,
        kind: body.kind,
        content: body.content,
        sha256: '',
        createdAt: new Date().toISOString(),
        summary: body.content.slice(0, 180),
        synthetic: true,
      });
      if (body.indicator)
        c.indicators.push({ id: `I-${Date.now()}`, sourceId: id, ...body.indicator });
      out = c;
    } else if (c && segments.length === 3) {
      if (method === 'PATCH') Object.assign(c, body);
      out = c;
    } else
      throw new Error(
        'This action requires the local application. Run npm run dev to enable uploads, live lookups and generated exports.',
      );
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
    return structuredClone(out) as T;
  }
  const response = await fetch(path, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    let error = 'Request failed.';
    try {
      error = (await response.json()).error || error;
    } catch {}
    throw new Error(error);
  }
  return response.json();
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export function saveText(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function download(path: string, name: string) {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || 'Download failed.');
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
