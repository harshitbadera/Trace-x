export type EvidenceRef = {
  evidenceId: string;
  file: string;
  location: string;
  raw?: string;
  statementAccount?: string;
  direction?: 'debit' | 'credit';
  balancePaise?: number;
};
export type Transaction = {
  id: string;
  from: string;
  to: string;
  amountPaise: number;
  currency: 'INR';
  timestamp: string;
  originalTimestamp: string;
  precision: 'second' | 'minute' | 'day';
  timezone: string;
  utr: string;
  narration: string;
  balancePaise?: number;
  statementAccount?: string;
  direction?: 'debit' | 'credit';
  sources: EvidenceRef[];
};
export type Account = {
  id: string;
  label: string;
  bank: string;
  role: 'victim' | 'account' | 'external';
  statementAvailable: boolean;
  upi?: string;
};
export type Evidence = {
  id: string;
  name: string;
  kind: 'statement' | 'complaint' | 'lookup' | 'note';
  sha256: string;
  createdAt: string;
  summary: string;
  content?: string;
  synthetic: boolean;
  storedFile?: string;
  rows?: number;
};
export type Indicator = {
  id: string;
  value: string;
  type: 'domain' | 'ip' | 'upi' | 'phone';
  sourceId: string;
  relatedAccount?: string;
  relation?: string;
};
export type Lookup = {
  id: string;
  indicator: string;
  type: 'domain' | 'ip';
  observedAt: string;
  mode: 'fixture' | 'live';
  status: 'complete' | 'partial' | 'unavailable';
  fields: Record<string, string>;
  records: { type: string; value: string; source: string }[];
  warnings: string[];
};
export type CaseData = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  status: 'Active' | 'Review';
  synthetic: boolean;
  victimUtr: string;
  accounts: Account[];
  transactions: Transaction[];
  evidence: Evidence[];
  indicators: Indicator[];
  lookups: Lookup[];
  notes: { id: string; text: string; createdAt: string }[];
};
export type RiskRule = {
  id: string;
  title: string;
  points: number;
  description: string;
  transactionIds: string[];
};
export type AccountRisk = {
  accountId: string;
  score: number;
  level: 'High' | 'Elevated' | 'Low';
  incomingPaise: number;
  outgoingPaise: number;
  rules: RiskRule[];
  timedTransactions: number;
  totalTransactions: number;
};
export type RuleSettings = {
  rapidMinutes: number;
  rapidPercent: number;
  fanInSenders: number;
  roundMultipleRupees: number;
  roundCount: number;
  repeatCount: number;
  dormancyDays: number;
};
export type TraceResult = {
  root?: Transaction;
  transactions: Transaction[];
  accountIds: string[];
  depth: number;
  warnings: string[];
};
export type CrossLink = {
  caseId: string;
  caseTitle: string;
  kind: string;
  value: string;
  explanation: string;
};
export type Analysis = {
  risks: AccountRisk[];
  trace: TraceResult;
  links: CrossLink[];
  rules: RuleSettings;
};
export type ImportRow = {
  row: number;
  location: string;
  raw: Record<string, string>;
  transaction?: Transaction;
  errors: string[];
  warnings: string[];
  excluded?: boolean;
};
export type ImportPreview = {
  id: string;
  name: string;
  sha256: string;
  columns: string[];
  rows: ImportRow[];
  warnings: string[];
  account: string;
  timezone: string;
  mapping: Record<string, string>;
  evidenceId: string;
};
export type AuditEvent = { id: number; caseId: string; action: string; detail: string; at: string };
