import type { Account, CaseData, Evidence, Lookup, Transaction } from './types';

const AT = '2026-11-17T04:30:00.000Z';
export function demoCases(): CaseData[] {
  const accounts: Account[] = [
    {
      id: 'SYN-V001',
      label: 'Complainant account',
      bank: 'Demo National Bank',
      role: 'victim',
      statementAvailable: true,
    },
    {
      id: 'SYN-A1042',
      label: 'Aster Trading',
      bank: 'Demo Union Bank',
      role: 'account',
      statementAvailable: true,
      upi: 'aster.collect@demo',
    },
    {
      id: 'SYN-B2081',
      label: 'Bluebird Services',
      bank: 'Demo City Bank',
      role: 'account',
      statementAvailable: true,
    },
    {
      id: 'SYN-C3096',
      label: 'Cedar Enterprises',
      bank: 'Demo Federal Bank',
      role: 'account',
      statementAvailable: true,
    },
    {
      id: 'SYN-D4418',
      label: 'Delta Commerce',
      bank: 'Demo Union Bank',
      role: 'account',
      statementAvailable: true,
    },
    {
      id: 'SYN-E5507',
      label: 'External beneficiary',
      bank: 'Bank not supplied',
      role: 'external',
      statementAvailable: false,
    },
    {
      id: 'SYN-N6001',
      label: 'Ordinary salary account',
      bank: 'Demo National Bank',
      role: 'account',
      statementAvailable: true,
    },
    {
      id: 'SYN-EMP01',
      label: 'Synthetic employer',
      bank: 'External counterparty',
      role: 'external',
      statementAvailable: false,
    },
    {
      id: 'SYN-RENT1',
      label: 'Monthly rent recipient',
      bank: 'External counterparty',
      role: 'external',
      statementAvailable: false,
    },
    ...[1, 2, 3, 4, 5].map((n) => ({
      id: `SYN-S00${n}`,
      label: `Other sender ${n}`,
      bank: 'External counterparty',
      role: 'external' as const,
      statementAvailable: false,
    })),
  ];
  const tx: Transaction[] = [];
  function add(
    id: string,
    from: string,
    to: string,
    rupees: number,
    time: string,
    utr: string,
    narration: string,
  ) {
    tx.push({
      id,
      from,
      to,
      amountPaise: rupees * 100,
      currency: 'INR',
      timestamp: new Date(time).toISOString(),
      originalTimestamp: time,
      precision: 'second',
      timezone: 'UTC+05:30',
      utr,
      narration,
      sources: [],
    });
  }
  add(
    'T01',
    'SYN-V001',
    'SYN-A1042',
    240000,
    '2026-11-16T10:02:00+05:30',
    'SYN2611160001',
    'Investment platform payment; complaint C-001',
  );
  add(
    'T02',
    'SYN-A1042',
    'SYN-B2081',
    140000,
    '2026-11-16T10:06:00+05:30',
    'SYN2611160002',
    'IMPS / Bluebird Services',
  );
  add(
    'T03',
    'SYN-A1042',
    'SYN-C3096',
    95000,
    '2026-11-16T10:08:00+05:30',
    'SYN2611160003',
    'NEFT / Cedar Enterprises',
  );
  add(
    'T04',
    'SYN-B2081',
    'SYN-D4418',
    135000,
    '2026-11-16T10:12:00+05:30',
    'SYN2611160004',
    'IMPS / Delta Commerce',
  );
  add(
    'T05',
    'SYN-C3096',
    'SYN-D4418',
    92000,
    '2026-11-16T10:14:00+05:30',
    'SYN2611160005',
    'IMPS / Delta Commerce',
  );
  add(
    'T06',
    'SYN-D4418',
    'SYN-E5507',
    225000,
    '2026-11-16T10:19:00+05:30',
    'SYN2611160006',
    'NEFT / external beneficiary',
  );
  [6000, 8000, 12000, 9000, 5000].forEach((amount, i) =>
    add(
      `T${10 + i}`,
      `SYN-S00${i + 1}`,
      'SYN-A1042',
      amount,
      `2026-11-16T09:${40 + i * 3}:00+05:30`,
      `SYN26111600${10 + i}`,
      'UPI / collection payment',
    ),
  );
  add(
    'T20',
    'SYN-A1042',
    'SYN-B2081',
    10000,
    '2026-11-16T11:10:00+05:30',
    'SYN2611160020',
    'IMPS / Bluebird Services',
  );
  add(
    'T21',
    'SYN-A1042',
    'SYN-B2081',
    10000,
    '2026-11-16T11:25:00+05:30',
    'SYN2611160021',
    'IMPS / Bluebird Services',
  );
  add(
    'T22',
    'SYN-A1042',
    'SYN-C3096',
    10000,
    '2026-11-16T11:30:00+05:30',
    'SYN2611160022',
    'NEFT / Cedar Enterprises',
  );
  add(
    'T30',
    'SYN-EMP01',
    'SYN-N6001',
    75000,
    '2026-11-01T09:00:00+05:30',
    'SYN2611010030',
    'Salary November / synthetic employer',
  );
  add(
    'T31',
    'SYN-N6001',
    'SYN-RENT1',
    18000,
    '2026-11-03T18:30:00+05:30',
    'SYN2611030031',
    'Monthly rent',
  );
  add(
    'T32',
    'SYN-S001',
    'SYN-A1042',
    100,
    '2026-09-01T12:00:00+05:30',
    'SYN2609010032',
    'Earlier observed activity',
  );
  const evidence: Evidence[] = accounts
    .filter((a) => a.statementAvailable)
    .map((a) => ({
      id: `EV-${a.id}`,
      name: `${a.id}-statement.csv`,
      kind: 'statement',
      sha256: '',
      createdAt: AT,
      summary: `Synthetic statement for ${a.label}. Original rows retained below.`,
      synthetic: true,
      content: '',
      rows: 0,
    }));
  for (const ev of evidence) {
    const account = ev.id.replace('EV-', '');
    const relevant = tx.filter((t) => t.from === account || t.to === account);
    ev.rows = relevant.length;
    const header = 'timestamp,account,counterparty,direction,amount,utr,narration';
    const lines = relevant.map((t, i) => {
      const line = [
        t.originalTimestamp,
        account,
        t.from === account ? t.to : t.from,
        t.from === account ? 'debit' : 'credit',
        t.amountPaise / 100,
        t.utr,
        t.narration,
      ].join(',');
      t.sources.push({
        evidenceId: ev.id,
        file: ev.name,
        location: `row ${i + 2}`,
        raw: line,
        statementAccount: account,
        direction: t.from === account ? 'debit' : 'credit',
      });
      if (!t.statementAccount) {
        t.statementAccount = account;
        t.direction = t.from === account ? 'debit' : 'credit';
      }
      return line;
    });
    ev.content = [header, ...lines].join('\n');
  }
  evidence.push({
    id: 'EV-C001',
    name: 'Victim complaint · C-001',
    kind: 'complaint',
    sha256: '',
    createdAt: AT,
    synthetic: true,
    summary:
      'Complaint links the reported website, displayed UPI identifier and victim transaction.',
    content:
      'SYNTHETIC HACKATHON EVIDENCE\nComplaint C-001\nReported website: aurum-invest.example\nDisplayed payment identifier: aster.collect@demo\nBeneficiary account in supplied payment receipt: SYN-A1042\nVictim account: SYN-V001\nPayment: INR 240,000\nUTR: SYN2611160001\nTimestamp: 16 November 2026, 10:02:00 IST (UTC+05:30)\nThe account-to-website association is a complainant-supplied claim supported by a synthetic receipt, not a DNS-derived identity.',
  });
  const lookups: Lookup[] = [
    {
      id: 'LK01',
      indicator: 'aurum-invest.example',
      type: 'domain',
      observedAt: '2026-11-16T05:00:00.000Z',
      mode: 'fixture',
      status: 'complete',
      fields: {
        Registrar: 'Example Registrar (synthetic)',
        Registered: '2026-11-03',
        Expiry: '2027-11-03',
        Registrant: 'Not public / not provided',
        'DNS observed': '16 Nov 2026, 10:30 IST',
        'Certificate names': 'aurum-invest.example, portal.aurum-invest.example',
      },
      records: [
        { type: 'A', value: '203.0.113.42', source: 'Synthetic passive DNS fixture' },
        { type: 'AAAA', value: '2001:db8::42', source: 'Synthetic passive DNS fixture' },
        { type: 'NS', value: 'ns1.demo-host.example', source: 'Synthetic DNS fixture' },
        { type: 'MX', value: '10 mail.aurum-invest.example', source: 'Synthetic DNS fixture' },
        { type: 'CT', value: 'portal.aurum-invest.example', source: 'Synthetic CT fixture' },
      ],
      warnings: [
        'All records here are fabricated demo fixtures; .example and documentation IP addresses are used deliberately.',
        'Shared infrastructure does not prove shared ownership.',
      ],
    },
    {
      id: 'LK02',
      indicator: '203.0.113.42',
      type: 'ip',
      observedAt: '2026-11-16T05:00:00.000Z',
      mode: 'fixture',
      status: 'complete',
      fields: {
        Network: '203.0.113.0/24 (documentation range)',
        Provider: 'Example Hosting (synthetic)',
        ASN: 'AS64496 (documentation ASN)',
        Region: 'Synthetic region: Singapore',
        'Reverse DNS': 'edge.demo-host.example',
        'VPN / proxy / Tor': 'Unknown — no classification source supplied',
      },
      records: [
        { type: 'PTR', value: 'edge.demo-host.example', source: 'Synthetic reverse DNS fixture' },
      ],
      warnings: [
        'Documentation address; no real hosting attribution is being asserted.',
        'Region is indicative in real lookups and cannot establish a person’s location.',
      ],
    },
  ];
  const main: CaseData = {
    id: 'TX-2026-001',
    title: 'Aurum investment fraud',
    description:
      'A reported investment platform payment splits across two accounts, converges at a common recipient and reaches an account with missing records.',
    createdAt: AT,
    status: 'Active',
    synthetic: true,
    victimUtr: 'SYN2611160001',
    accounts,
    transactions: tx,
    evidence,
    indicators: [
      {
        id: 'I01',
        type: 'domain',
        value: 'aurum-invest.example',
        sourceId: 'EV-C001',
        relation: 'Reported in victim complaint',
      },
      {
        id: 'I02',
        type: 'upi',
        value: 'aster.collect@demo',
        sourceId: 'EV-C001',
        relatedAccount: 'SYN-A1042',
        relation: 'Payment receipt supplied with complaint',
      },
      {
        id: 'I03',
        type: 'ip',
        value: '203.0.113.42',
        sourceId: 'EV-LK01',
        relation: 'Synthetic DNS observation',
      },
    ],
    lookups,
    notes: [],
  };
  for (const lookup of lookups)
    main.evidence.push({
      id: `EV-${lookup.id}`,
      name: `${lookup.indicator} · fixture`,
      kind: 'lookup',
      sha256: '',
      createdAt: lookup.observedAt,
      synthetic: true,
      summary: 'Synthetic infrastructure intelligence; not a live lookup.',
      content: JSON.stringify(lookup, null, 2),
    });
  const other: CaseData = {
    id: 'TX-2026-002',
    title: 'Meridian trading complaint',
    description:
      'A second synthetic complaint names the same payment identifier and external beneficiary.',
    createdAt: '2026-11-15T09:00:00.000Z',
    status: 'Review',
    synthetic: true,
    victimUtr: '',
    accounts: [{ ...accounts[5] }],
    transactions: [],
    evidence: [
      {
        id: 'EV-C002',
        name: 'Victim complaint · C-002',
        kind: 'complaint',
        sha256: '',
        createdAt: AT,
        synthetic: true,
        summary: 'A second complaint supplies a shared UPI ID and account identifier.',
        content:
          'SYNTHETIC HACKATHON EVIDENCE\nComplaint C-002\nReported website: meridian-trade.example\nDisplayed payment identifier: aster.collect@demo\nReported beneficiary: SYN-E5507\nNo bank statement supplied. These are complaint claims requiring corroboration.',
      },
    ],
    indicators: [
      { id: 'I20', type: 'domain', value: 'meridian-trade.example', sourceId: 'EV-C002' },
      {
        id: 'I21',
        type: 'upi',
        value: 'aster.collect@demo',
        sourceId: 'EV-C002',
        relatedAccount: 'SYN-E5507',
        relation: 'Reported in complaint; uncorroborated',
      },
    ],
    lookups: [],
    notes: [],
  };
  return [main, other];
}
