import type {
  AccountRisk,
  CaseData,
  CrossLink,
  RuleSettings,
  TraceResult,
  Transaction,
} from './types';

export const DEFAULT_RULES: RuleSettings = {
  rapidMinutes: 15,
  rapidPercent: 80,
  fanInSenders: 5,
  roundMultipleRupees: 10000,
  roundCount: 3,
  repeatCount: 3,
  dormancyDays: 30,
};
const sum = (rows: Transaction[]) => rows.reduce((n, t) => n + t.amountPaise, 0);

export function analyseAccounts(
  c: CaseData,
  settings: RuleSettings = DEFAULT_RULES,
): AccountRisk[] {
  return c.accounts
    .map((account) => {
      const incoming = c.transactions.filter((t) => t.to === account.id);
      const outgoing = c.transactions.filter((t) => t.from === account.id);
      const all = [...incoming, ...outgoing].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const rules: AccountRisk['rules'] = [];
      // Each rule contributes once. Scores are prioritisation heuristics, not probabilities.
      if (account.role !== 'victim') {
        const rapid = incoming
          .filter((t) => t.precision !== 'day')
          .map((credit) => {
            const start = Date.parse(credit.timestamp);
            const forwards = outgoing.filter(
              (t) =>
                t.precision !== 'day' &&
                Date.parse(t.timestamp) > start &&
                Date.parse(t.timestamp) - start <= settings.rapidMinutes * 60000,
            );
            return { credit, forwards, ratio: sum(forwards) / credit.amountPaise };
          })
          .filter((x) => x.ratio >= settings.rapidPercent / 100)
          .sort((a, b) => b.credit.amountPaise - a.credit.amountPaise || b.ratio - a.ratio)[0];
        if (rapid)
          rules.push({
            id: 'rapid',
            title: 'Rapid onward transfers',
            points: 35,
            description: `Outgoing transfers total INR ${(sum(rapid.forwards) / 100).toLocaleString('en-IN')} within ${settings.rapidMinutes} minutes after a credit of INR ${(rapid.credit.amountPaise / 100).toLocaleString('en-IN')}. This is temporal proximity, not proof of allocation.`,
            transactionIds: [rapid.credit.id, ...rapid.forwards.map((t) => t.id)],
          });
        // Rolling 24h windows prevent unrelated months of activity from being treated as fan-in.
        const fan =
          incoming
            .map((t) =>
              incoming.filter(
                (x) =>
                  Date.parse(x.timestamp) >= Date.parse(t.timestamp) &&
                  Date.parse(x.timestamp) <= Date.parse(t.timestamp) + 86400000,
              ),
            )
            .sort(
              (a, b) => new Set(b.map((t) => t.from)).size - new Set(a.map((t) => t.from)).size,
            )[0] || [];
        const senders = new Set(fan.map((t) => t.from)).size;
        if (senders >= settings.fanInSenders)
          rules.push({
            id: 'fanin',
            title: 'Many incoming counterparties',
            points: 25,
            description: `${senders} distinct sender identifiers in a 24-hour window. Identities and relationships between senders are not established.`,
            transactionIds: fan.map((t) => t.id),
          });
        const round = outgoing.filter(
          (t) => t.amountPaise % (settings.roundMultipleRupees * 100) === 0,
        );
        if (round.length >= settings.roundCount)
          rules.push({
            id: 'round',
            title: 'Repeated round-figure transfers',
            points: 15,
            description: `${round.length} outgoing transfers are multiples of INR ${settings.roundMultipleRupees.toLocaleString('en-IN')} in the available records.`,
            transactionIds: round.map((t) => t.id),
          });
        const repeats =
          [...new Set(outgoing.map((t) => t.to))]
            .map((id) => outgoing.filter((t) => t.to === id))
            .sort((a, b) => b.length - a.length)[0] || [];
        if (repeats.length >= settings.repeatCount)
          rules.push({
            id: 'repeat',
            title: 'Repeated counterparty',
            points: 10,
            description: `${repeats.length} transfers to ${repeats[0].to}. Recurrence alone can reflect ordinary business activity.`,
            transactionIds: repeats.map((t) => t.id),
          });
        const gap = all.findIndex(
          (t, i) =>
            i > 0 &&
            Date.parse(t.timestamp) - Date.parse(all[i - 1].timestamp) >=
              settings.dormancyDays * 86400000,
        );
        if (account.statementAvailable && gap > 0 && all.length - gap >= 3)
          rules.push({
            id: 'dormant',
            title: 'Activity after an observed gap',
            points: 15,
            description: `At least ${settings.dormancyDays} days between available transactions, followed by ${all.length - gap} records. Statement coverage must be checked before inferring dormancy.`,
            transactionIds: [all[gap - 1].id, ...all.slice(gap).map((t) => t.id)],
          });
      }
      const score = Math.min(
        100,
        rules.reduce((n, r) => n + r.points, 0),
      );
      return {
        accountId: account.id,
        score,
        level: score >= 60 ? 'High' : score >= 30 ? 'Elevated' : 'Low',
        incomingPaise: sum(incoming),
        outgoingPaise: sum(outgoing),
        rules,
        timedTransactions: all.filter((t) => t.precision !== 'day').length,
        totalTransactions: all.length,
      } as AccountRisk;
    })
    .sort((a, b) => b.score - a.score);
}

export function traceFunds(c: CaseData, utr: string, maxHops = 5): TraceResult {
  if (!utr.trim())
    return {
      transactions: [],
      accountIds: [],
      depth: 0,
      warnings: ['Enter a non-empty transaction reference to choose the starting payment.'],
    };
  const roots = c.transactions.filter((t) => t.utr.toLowerCase() === utr.trim().toLowerCase());
  if (roots.length !== 1)
    return {
      transactions: [],
      accountIds: [],
      depth: 0,
      warnings: [
        roots.length
          ? 'This reference matches multiple distinct transfers. Select a unique starting reference.'
          : 'No transaction matches this UTR. Import the relevant statement or check the reference.',
      ],
    };
  const root = roots[0];
  const found = new Map([[root.id, root]]);
  const reach = new Map<string, { time: number; hop: number }>([
    [root.to, { time: Date.parse(root.timestamp), hop: 1 }],
  ]);
  let depth = 1;
  // Chronological traversal supports splits, convergence and cycles without summing funds across hops.
  const ordered = [...c.transactions].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (let pass = 0; pass < maxHops; pass++) {
    let changed = false;
    for (const t of ordered) {
      const parent = reach.get(t.from);
      if (
        !parent ||
        parent.hop >= maxHops ||
        Date.parse(t.timestamp) < parent.time ||
        t.id === root.id
      )
        continue;
      if (!found.has(t.id)) {
        found.set(t.id, t);
        changed = true;
        depth = Math.max(depth, parent.hop + 1);
      }
      const next = reach.get(t.to);
      if (
        !next ||
        Date.parse(t.timestamp) < next.time ||
        (Date.parse(t.timestamp) === next.time && parent.hop + 1 < next.hop)
      )
        reach.set(t.to, { time: Date.parse(t.timestamp), hop: parent.hop + 1 });
    }
    if (!changed) break;
  }
  const transactions = [...found.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const warnings = [
    'Edges show documented transactions. Onward attribution to the victim is a candidate path; commingled funds are not allocated.',
    `Traversal is limited to ${maxHops} hops and the available statement period.`,
  ];
  if (transactions.some((t) => t.precision === 'day'))
    warnings.push(
      'Date-only records have uncertain intra-day ordering and cannot establish rapid transfers.',
    );
  return {
    root,
    transactions,
    accountIds: [...new Set(transactions.flatMap((t) => [t.from, t.to]))],
    depth,
    warnings,
  };
}

export function crossCaseLinks(c: CaseData, all: CaseData[]): CrossLink[] {
  const out: CrossLink[] = [];
  for (const other of all.filter((x) => x.id !== c.id)) {
    for (const a of c.accounts)
      if (other.accounts.some((b) => b.id === a.id))
        out.push({
          caseId: other.id,
          caseTitle: other.title,
          kind: 'Account identifier',
          value: a.id,
          explanation:
            'Exact account identifier appears in both case datasets. This establishes a shared identifier, not common criminal control.',
        });
    for (const i of c.indicators)
      if (
        other.indicators.some(
          (j) => j.type === i.type && j.value.toLowerCase() === i.value.toLowerCase(),
        )
      )
        out.push({
          caseId: other.id,
          caseTitle: other.title,
          kind: i.type.toUpperCase(),
          value: i.value,
          explanation:
            'Exact indicator match across submitted evidence. Inspect both sources before drawing an operational link.',
        });
  }
  return out;
}

export function transferKey(t: Transaction): string {
  return JSON.stringify([
    t.from,
    t.to,
    t.amountPaise,
    t.currency,
    t.timestamp,
    t.precision,
    t.utr.trim().toUpperCase(),
    t.utr ? '' : t.id,
  ]);
}
export function mergeTransactions(existing: Transaction[], incoming: Transaction[]) {
  const map = new Map(existing.map((t) => [transferKey(t), structuredClone(t)]));
  let added = 0,
    duplicates = 0;
  for (const t of incoming) {
    const key = transferKey(t);
    const prior = map.get(key);
    if (prior) {
      duplicates++;
      for (const s of t.sources)
        if (!prior.sources.some((p) => p.evidenceId === s.evidenceId && p.location === s.location))
          prior.sources.push(s);
    } else {
      map.set(key, t);
      added++;
    }
  }
  return { transactions: [...map.values()], added, duplicates };
}
