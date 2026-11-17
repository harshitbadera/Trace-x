import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseAccounts,
  crossCaseLinks,
  DEFAULT_RULES,
  mergeTransactions,
  traceFunds,
} from '../shared/analysis';
import { demoCases } from '../shared/fixtures';
import { requestDraft } from '../shared/requests';

test('planted chain is found, pre-payment credits and benign activity are excluded', () => {
  const c = demoCases()[0];
  const trail = traceFunds(c, c.victimUtr);
  assert.equal(trail.root?.amountPaise, 24000000);
  assert.equal(trail.depth, 4);
  assert.deepEqual(
    trail.transactions.map((t) => t.id),
    ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T20', 'T21', 'T22'],
  );
  assert.ok(!trail.accountIds.includes('SYN-N6001'));
  assert.ok(trail.warnings.some((w) => w.includes('commingled')));
});
test('hop cap and transaction time prevent backwards tracing', () => {
  const c = demoCases()[0];
  const one = traceFunds(c, c.victimUtr, 1);
  assert.deepEqual(
    one.transactions.map((t) => t.id),
    ['T01'],
  );
  const two = traceFunds(c, c.victimUtr, 2);
  assert.ok(two.transactions.every((t) => t.from === 'SYN-V001' || t.from === 'SYN-A1042'));
  assert.ok(!two.transactions.some((t) => t.id === 'T04'));
});
test('UTR collisions are surfaced rather than choosing an arbitrary starting transfer', () => {
  const c = demoCases()[0];
  c.transactions.push({ ...c.transactions[0], id: 'conflict', amountPaise: 100 });
  const result = traceFunds(c, c.victimUtr);
  assert.equal(result.root, undefined);
  assert.match(result.warnings[0], /multiple/);
  assert.equal(traceFunds(c, 'missing').transactions.length, 0);
});
test('an empty reference never silently selects an unreferenced transfer', () => {
  const c = demoCases()[0];
  c.transactions = [{ ...c.transactions[0], utr: '' }];
  assert.equal(traceFunds(c, '').root, undefined);
});
test('explainable scoring identifies planted mule indicators and leaves benign salary account unflagged', () => {
  const risks = analyseAccounts(demoCases()[0]);
  const a = risks.find((r) => r.accountId === 'SYN-A1042')!;
  assert.equal(a.score, 100);
  assert.deepEqual(
    a.rules.map((r) => r.id),
    ['rapid', 'fanin', 'round', 'repeat', 'dormant'],
  );
  assert.equal(risks.find((r) => r.accountId === 'SYN-N6001')?.score, 0);
  assert.equal(risks.find((r) => r.accountId === 'SYN-V001')?.score, 0);
  assert.ok(a.rules.every((r) => r.transactionIds.length > 0));
});
test('date-only records never trigger rapid-transfer rule', () => {
  const c = demoCases()[0];
  c.transactions = c.transactions.map((t) => ({ ...t, precision: 'day' }));
  assert.ok(analyseAccounts(c).every((r) => r.rules.every((rule) => rule.id !== 'rapid')));
  assert.ok(traceFunds(c, c.victimUtr).warnings.some((w) => w.includes('Date-only')));
});
test('fan-in uses a rolling 24-hour window, not the entire statement period', () => {
  const c = demoCases()[0];
  c.transactions = c.transactions
    .filter((t) => t.to === 'SYN-A1042')
    .map((t, i) => ({ ...t, timestamp: new Date(Date.UTC(2026, 10, i + 1)).toISOString() }));
  const r = analyseAccounts(c).find((r) => r.accountId === 'SYN-A1042')!;
  assert.ok(!r.rules.some((rule) => rule.id === 'fanin'));
});
test('matching debit/credit observations merge provenance without doubling the amount', () => {
  const c = demoCases()[0];
  const first = c.transactions[0];
  const duplicate = {
    ...first,
    id: 'other-side',
    sources: [{ evidenceId: 'other-file', file: 'b.csv', location: 'row 2' }],
  };
  const result = mergeTransactions([first], [duplicate]);
  assert.equal(result.added, 0);
  assert.equal(result.duplicates, 1);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].amountPaise, 24000000);
  assert.ok(result.transactions[0].sources.some((s) => s.evidenceId === 'other-file'));
});
test('missing UTR does not merge indistinguishable transfers from different source rows', () => {
  const t = demoCases()[0].transactions[0];
  const result = mergeTransactions(
    [{ ...t, utr: '' }],
    [{ ...t, id: 'second-without-reference', utr: '' }],
  );
  assert.equal(result.transactions.length, 2);
});
test('same reference with conflicting amount is retained as a distinct transaction', () => {
  const t = demoCases()[0].transactions[0];
  const result = mergeTransactions(
    [t],
    [{ ...t, id: 'conflict', amountPaise: t.amountPaise + 100 }],
  );
  assert.equal(result.transactions.length, 2);
});
test('cross-case links identify exact account and UPI matches', () => {
  const cases = demoCases();
  const links = crossCaseLinks(cases[0], cases);
  assert.deepEqual(links.map((l) => l.value).sort(), ['SYN-E5507', 'aster.collect@demo'].sort());
  assert.ok(links.every((l) => l.caseId === 'TX-2026-002'));
});
test('raising thresholds changes findings deterministically', () => {
  const c = demoCases()[0];
  const risks = analyseAccounts(c, {
    ...DEFAULT_RULES,
    fanInSenders: 100,
    roundCount: 100,
    repeatCount: 100,
    dormancyDays: 3650,
    rapidMinutes: 1,
  });
  assert.equal(risks.find((r) => r.accountId === 'SYN-A1042')?.score, 0);
});
test('request drafts populate known transaction times without substituting lookup times', () => {
  const c = demoCases()[0];
  const bank = requestDraft(c, 'Bank compliance', 'SYN-E5507');
  assert.match(bank, /2026-11-16T04:49:00.000Z/);
  assert.match(bank, /SYN2611160006/);
  const ip = requestDraft(c, 'Provider compliance', '203.0.113.42');
  assert.match(ip, /NOT a subscriber login\/access event timestamp/);
  assert.match(ip, /Exact transaction\/event timestamp: \[Select/);
});
