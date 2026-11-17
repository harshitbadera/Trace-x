import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { demoCases } from '../shared/fixtures';
import { DEFAULT_RULES } from '../shared/analysis';
import type { AuditEvent, CaseData, RuleSettings } from '../shared/types';

export const dataDir = resolve(process.env.TRACE_DATA_DIR || 'data');
mkdirSync(dataDir, { recursive: true });
export const db = new DatabaseSync(resolve(dataDir, 'trace-x.sqlite'));
db.exec(
  'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, caseId TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, body TEXT NOT NULL)',
);
export function allCases(): CaseData[] {
  return (db.prepare('SELECT body FROM cases ORDER BY id').all() as { body: string }[]).map((r) =>
    JSON.parse(r.body),
  );
}
export function getCase(id: string): CaseData | undefined {
  const row = db.prepare('SELECT body FROM cases WHERE id = ?').get(id) as
    { body: string } | undefined;
  return row ? JSON.parse(row.body) : undefined;
}
export function saveCase(c: CaseData) {
  db.prepare(
    'INSERT INTO cases (id,body) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
  ).run(c.id, JSON.stringify(c));
}
export function audit(caseId: string, action: string, detail: string) {
  db.prepare('INSERT INTO audit(caseId,action,detail,at) VALUES (?,?,?,?)').run(
    caseId,
    action,
    detail,
    new Date().toISOString(),
  );
}
export function auditLog(caseId: string): AuditEvent[] {
  return db
    .prepare('SELECT * FROM audit WHERE caseId = ? ORDER BY id DESC LIMIT 100')
    .all(caseId) as AuditEvent[];
}
export function settings(): RuleSettings {
  const row = db.prepare('SELECT body FROM settings WHERE id = ?').get('rules') as
    { body: string } | undefined;
  return row ? JSON.parse(row.body) : DEFAULT_RULES;
}
export function saveSettings(value: RuleSettings) {
  db.prepare(
    'INSERT INTO settings(id,body) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
  ).run('rules', JSON.stringify(value));
}
if (!allCases().length) {
  for (const c of demoCases()) {
    for (const e of c.evidence)
      e.sha256 = createHash('sha256')
        .update(e.content || '')
        .digest('hex');
    saveCase(c);
    audit(c.id, 'Case created', 'Synthetic demonstration dataset seeded.');
  }
}
