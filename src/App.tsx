import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Files,
  FileText,
  Fingerprint,
  FolderOpen,
  Globe2,
  GitBranch,
  LayoutDashboard,
  Link2,
  Menu,
  Network,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  Upload,
  Wallet,
  X,
  Play,
  Pause,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';
import type { Analysis, CaseData, RuleSettings } from '../shared/types';
import { analyseAccounts, traceFunds, crossCaseLinks, DEFAULT_RULES } from '../shared/analysis';
import { api, offline, post, download, saveText } from './api';
import {
  Badge,
  Button,
  Empty,
  LinkButton,
  Loading,
  Modal,
  Notice,
  SectionTitle,
  Stat,
  Toast,
  money,
  time,
} from './components';
import { MoneyGraph } from './Graph';
import { Statements } from './Statements';
import { Overview } from './Overview';
import { Intelligence } from './Intelligence';
import { Connections, EvidenceView, Reports, Rules } from './WorkspaceViews';
import type { Selection, View, WorkspaceProps } from './workspace';

const NAV: { id: View; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Case overview', icon: LayoutDashboard },
  { id: 'statements', label: 'Statements', icon: Files },
  { id: 'trail', label: 'Money trail', icon: GitBranch },
  { id: 'accounts', label: 'Account analysis', icon: Building2 },
  { id: 'intelligence', label: 'Infrastructure', icon: Globe2 },
  { id: 'connections', label: 'Cross-case links', icon: Link2 },
  { id: 'evidence', label: 'Evidence & notes', icon: Fingerprint },
  { id: 'reports', label: 'Reports & requests', icon: FileText },
];
export default function App() {
  const [cases, setCases] = useState<CaseData[]>([]),
    [rules, setRules] = useState<RuleSettings>(DEFAULT_RULES),
    [activeId, setActiveId] = useState('TX-2026-001'),
    [view, setView] = useState<View>('overview'),
    [loading, setLoading] = useState(true),
    [fatal, setFatal] = useState('');
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null),
    [selection, setSelection] = useState<Selection>(null),
    [newCase, setNewCase] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState(''),
    [mobileNav, setMobileNav] = useState(false);
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const refresh = useCallback(async () => {
    const [all, settings] = await Promise.all([
      api<CaseData[]>('/api/cases'),
      api<RuleSettings>('/api/settings'),
    ]);
    setCases(all);
    setRules(settings);
  }, []);
  useEffect(() => {
    refresh()
      .catch((e) => setFatal(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const c = cases.find((c) => c.id === activeId) || cases[0];
  const analysis: Analysis = useMemo(
    () =>
      c
        ? {
            risks: analyseAccounts(c, rules),
            trace: traceFunds(c, c.victimUtr),
            links: crossCaseLinks(c, cases),
            rules,
          }
        : {
            risks: [],
            trace: { transactions: [], accountIds: [], depth: 0, warnings: [] },
            links: [],
            rules,
          },
    [c, cases, rules],
  );
  const navigate = (v: View) => {
    setView(v);
    setSelection(null);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const selectCase = (id: string) => {
    setActiveId(id);
    setSelection(null);
    setView('overview');
  };
  const props: WorkspaceProps = {
    c,
    analysis,
    allCases: cases,
    refresh,
    notify,
    navigate,
    inspect: setSelection,
    selectCase,
  };
  if (loading) return <Loading />;
  if (fatal || !c)
    return (
      <main className="fatal">
        <div className="brand-mark">X</div>
        <h1>Let’s connect your workspace.</h1>
        <p>{fatal || 'No case data is available.'}</p>
        <p>
          Start the local application with <code>npm run dev</code>, then reload this page.
        </p>
        <Button onClick={() => location.reload()}>Reload workspace</Button>
      </main>
    );
  const findings = analysis.risks.filter((r) => r.score >= 30).length;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('overview');
          }}
        >
          <span className="brand-mark">
            <Network size={24} />
          </span>
          <span>
            trace<span className="brand-x">-x</span>
            <small>INVESTIGATION INTELLIGENCE</small>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switch" onClick={() => setNewCase(true)}>
          <span className="workspace-avatar">TX</span>
          <span>
            Investigation desk<small>Local workspace</small>
          </span>
          <Plus size={15} />
        </button>
        <div className="nav-label">INVESTIGATE</div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === 'connections' && analysis.links.length > 0 && (
                <b>{analysis.links.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={18} />
            <strong>Evidence stays local</strong>
            <p>Public lookups send only the indicator to intelligence providers.</p>
          </div>
          <button
            className={`settings-nav ${view === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Settings2 size={18} />
            Analysis rules
          </button>
          <div className="profile">
            <span className="profile-avatar">IN</span>
            <div>
              Investigator<small>Local analyst · Demo workspace</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      {mobileNav && <div className="nav-backdrop" onClick={() => setMobileNav(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigation"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            Workspace <ChevronRight size={14} />
            <span>{NAV.find((n) => n.id === view)?.label || 'Analysis rules'}</span>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              <span>Search this case</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="local-status">
              <span className="online-dot" />
              {offline ? 'Offline preview' : 'Local workspace'}
            </span>
            <span className="top-avatar">IN</span>
          </div>
        </header>
        {offline && (
          <div className="preview-banner">
            Interactive submission preview · Synthetic data · Uploads, live lookups and generated
            files are available in the local application.
          </div>
        )}
        <main className="main-content">
          <div className="case-bar">
            <div className="case-selector">
              <FolderOpen size={16} />
              <select
                aria-label="Active case"
                value={c.id}
                onChange={(e) => selectCase(e.target.value)}
              >
                {cases.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.id} · {x.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
            <div className="case-meta">
              <Badge tone="teal">
                <span className="tiny-dot" />
                {c.status}
              </Badge>
              <Badge>Synthetic case</Badge>
              <button className="text-button" onClick={() => setNewCase(true)}>
                <Plus size={15} />
                New case
              </button>
            </div>
          </div>
          {view === 'overview' && <Overview {...props} />}
          {view === 'statements' && <Statements {...props} />}
          {view === 'trail' && <Trail {...props} />}
          {view === 'accounts' && <Accounts {...props} />}
          {view === 'intelligence' && <Intelligence {...props} />}
          {view === 'connections' && <Connections {...props} />}
          {view === 'evidence' && <EvidenceView {...props} />}
          {view === 'reports' && <Reports {...props} />}
          {view === 'settings' && <Rules {...props} />}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={13} />
              Trace-X · Evidence-first investigations
            </span>
            <span>
              Synthetic data only <i /> All displayed times IST unless labelled
            </span>
          </footer>
        </main>
      </div>
      {selection && (
        <Inspector {...props} selection={selection} onClose={() => setSelection(null)} />
      )}
      {newCase && (
        <NewCase
          onClose={() => setNewCase(false)}
          onCreated={async (created) => {
            await refresh();
            selectCase(created.id);
            setNewCase(false);
            notify('Case created. Add your synthetic statements to begin.');
          }}
          notify={notify}
        />
      )}
      {searchOpen && (
        <Modal title="Search this case" onClose={() => setSearchOpen(false)}>
          <div className="modal-body">
            <label className="search-input large">
              <Search size={19} />
              <input
                aria-label="Search case records"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Account, UTR, narration, domain or evidence…"
              />
            </label>
            <div className="search-results">
              {!search && <p className="muted">Try “Aster”, “SYN2611160001” or “aurum”.</p>}
              {search &&
                c.accounts
                  .filter((a) =>
                    `${a.id} ${a.label} ${a.upi || ''}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .slice(0, 8)
                  .map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSelection({ kind: 'account', id: a.id });
                        setSearchOpen(false);
                      }}
                    >
                      <Building2 size={18} />
                      <span>
                        {a.label}
                        <small>{a.id}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
              {search &&
                c.transactions
                  .filter((t) =>
                    `${t.utr} ${t.narration}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .slice(0, 8)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelection({ kind: 'transaction', id: t.id });
                        setSearchOpen(false);
                      }}
                    >
                      <ArrowUpRight size={18} />
                      <span>
                        {t.utr || t.id}
                        <small>
                          {money(t.amountPaise)} · {t.narration}
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
              {search &&
                c.indicators
                  .filter((i) => i.value.toLowerCase().includes(search.toLowerCase()))
                  .map((i) => (
                    <button
                      key={i.id}
                      onClick={() => {
                        navigate('intelligence');
                        setSearchOpen(false);
                      }}
                    >
                      <Globe2 size={18} />
                      <span>
                        {i.value}
                        <small>{i.type}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
              {search &&
                c.evidence
                  .filter((e) =>
                    `${e.name} ${e.summary}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .slice(0, 5)
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setSelection({ kind: 'evidence', id: e.id });
                        setSearchOpen(false);
                      }}
                    >
                      <FileText size={18} />
                      <span>
                        {e.name}
                        <small>{e.kind}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
              {search &&
                !JSON.stringify([
                  c.accounts,
                  c.transactions,
                  c.indicators,
                  c.evidence.map((e) => ({ name: e.name, summary: e.summary })),
                ])
                  .toLowerCase()
                  .includes(search.toLowerCase()) && (
                  <Empty
                    title="No matching records"
                    description="Try another identifier or import the missing evidence."
                  />
                )}
            </div>
          </div>
        </Modal>
      )}
      <Toast message={toast} onClose={clearToast} />
    </div>
  );
}

function Trail(p: WorkspaceProps) {
  const { c, analysis, inspect, notify, refresh } = p;
  const [utr, setUtr] = useState(c.victimUtr),
    [activeUtr, setActiveUtr] = useState(c.victimUtr),
    [hops, setHops] = useState(5),
    [step, setStep] = useState(999),
    [playing, setPlaying] = useState(false),
    [minAmount, setMinAmount] = useState('');
  useEffect(() => {
    setUtr(c.victimUtr);
    setActiveUtr(c.victimUtr);
    setStep(999);
  }, [c.id, c.victimUtr]);
  const trace = useMemo(() => traceFunds(c, activeUtr, hops), [c, activeUtr, hops]);
  const times = useMemo(
    () => [...new Set(trace.transactions.map((t) => t.timestamp))].sort(),
    [trace],
  );
  const effective = Math.min(step, Math.max(0, times.length - 1));
  const visible = useMemo(
    () =>
      trace.transactions.filter(
        (t) =>
          t.timestamp <= (times[effective] || '') && t.amountPaise >= Number(minAmount || 0) * 100,
      ),
    [trace, times, effective, minAmount],
  );
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () =>
        setStep((s) => {
          if (s >= times.length - 1) {
            setPlaying(false);
            return s;
          }
          return s + 1;
        }),
      1000,
    );
    return () => clearInterval(id);
  }, [playing, times.length]);
  async function start() {
    setActiveUtr(utr);
    setStep(999);
    setPlaying(false);
    const result = traceFunds(c, utr, hops);
    if (result.root) {
      try {
        await api(`/api/cases/${c.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ victimUtr: utr.trim() }),
        });
        await refresh();
      } catch (e) {
        notify((e as Error).message, true);
      }
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FOLLOW THE FUNDS</div>
          <h1>Money trail</h1>
          <p>Trace documented transfers, then examine the evidence behind each hop.</p>
        </div>
        <Badge tone="teal">Interactive investigation</Badge>
      </div>
      <section className="panel">
        <div className="trace-controls">
          <label className="field grow">
            <span>Starting transaction / UTR</span>
            <input
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="Enter the victim’s transaction reference"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void start();
              }}
            />
          </label>
          <label className="field small">
            <span>Maximum hops</span>
            <select value={hops} onChange={(e) => setHops(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 8].map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </label>
          <label className="field small">
            <span>Minimum INR</span>
            <input
              type="number"
              min="0"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="0"
            />
          </label>
          <Button variant="primary" onClick={() => void start()}>
            <GitBranch size={17} />
            Trace funds
          </Button>
        </div>
        {trace.root ? (
          <>
            <MoneyGraph
              accounts={c.accounts}
              transactions={visible}
              risks={analysis.risks}
              onAccount={(id) => inspect({ kind: 'account', id })}
              onTransaction={(id) => inspect({ kind: 'transaction', id })}
            />
            <div className="timeline-control">
              <button
                className="play-button"
                aria-label={playing ? 'Pause timeline' : 'Play timeline'}
                onClick={() => {
                  if (playing) setPlaying(false);
                  else {
                    setStep(0);
                    setPlaying(true);
                  }
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div className="timeline-range">
                <div>
                  <strong>Transaction timeline</strong>
                  <span>{times[effective] ? time(times[effective]) : 'No events'} IST</span>
                </div>
                <input
                  aria-label="Transaction timeline"
                  type="range"
                  min="0"
                  max={Math.max(0, times.length - 1)}
                  value={effective}
                  onChange={(e) => {
                    setPlaying(false);
                    setStep(Number(e.target.value));
                  }}
                />
              </div>
              <Badge>{visible.length} transfers</Badge>
            </div>
          </>
        ) : (
          <Empty title="Choose a starting transaction" description={trace.warnings[0]} />
        )}
      </section>
      <Notice>{trace.warnings.join(' ')}</Notice>
      <section className="panel">
        <SectionTitle
          title="Transfers in view"
          description="Amounts are shown per transfer. Adding all hops would double-count circulating funds."
        />
        <TransactionTable c={c} transactions={visible} inspect={inspect} />
      </section>
    </>
  );
}

export function TransactionTable({
  c,
  transactions,
  inspect,
}: {
  c: CaseData;
  transactions: CaseData['transactions'];
  inspect: WorkspaceProps['inspect'];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time · IST</th>
            <th>From → To</th>
            <th>Amount</th>
            <th>Reference</th>
            <th>Evidence</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} onClick={() => inspect({ kind: 'transaction', id: t.id })}>
              <td>
                <strong>
                  {t.precision === 'day' ? t.originalTimestamp.split(/[T ]/)[0] : time(t.timestamp)}
                </strong>
                <small>
                  {t.precision === 'day'
                    ? 'Date only'
                    : 'UTC' + (t.timezone.startsWith('UTC') ? t.timezone.slice(3) : '')}
                </small>
              </td>
              <td>
                <strong>{c.accounts.find((a) => a.id === t.from)?.label || t.from}</strong>
                <small>→ {c.accounts.find((a) => a.id === t.to)?.label || t.to}</small>
              </td>
              <td className="amount">{money(t.amountPaise)}</td>
              <td className="mono">{t.utr || 'Not supplied'}</td>
              <td>
                <Badge>
                  {t.sources.length} source{t.sources.length !== 1 ? 's' : ''}
                </Badge>
              </td>
              <td>
                <button className="icon-button" aria-label={`Inspect transfer ${t.utr || t.id}`}>
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
          {!transactions.length && (
            <tr>
              <td colSpan={6} className="table-empty">
                No transfers match the current selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Accounts(p: WorkspaceProps) {
  const { c, analysis, inspect, navigate } = p;
  const [filter, setFilter] = useState('All'),
    [search, setSearch] = useState('');
  const rows = analysis.risks.filter(
    (r) =>
      (filter === 'All' || r.level === filter) &&
      `${r.accountId} ${c.accounts.find((a) => a.id === r.accountId)?.label}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EXPLAINABLE ANALYSIS</div>
          <h1>Accounts worth a closer look</h1>
          <p>Rules surface patterns. Source records explain why they were flagged.</p>
        </div>
        <Button onClick={() => navigate('settings')}>
          <SlidersHorizontal size={16} />
          Configure rules
        </Button>
      </div>
      <Notice>
        Scores are review priorities, not probabilities of fraud. “Low” means few configured rules
        triggered in the available records.
      </Notice>
      <section className="panel">
        <div className="table-toolbar">
          <div className="tabs">
            {['All', 'High', 'Elevated', 'Low'].map((f) => (
              <button className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} key={f}>
                {f}
              </button>
            ))}
          </div>
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Filter accounts"
              placeholder="Search accounts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Priority</th>
                <th>Incoming</th>
                <th>Outgoing</th>
                <th>Signals</th>
                <th>Coverage</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const a = c.accounts.find((a) => a.id === r.accountId)!;
                return (
                  <tr key={a.id} onClick={() => inspect({ kind: 'account', id: a.id })}>
                    <td>
                      <div className="account-cell">
                        <span className="account-icon">
                          <Building2 size={18} />
                        </span>
                        <div>
                          <strong>{a.label}</strong>
                          <small className="mono">{a.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="risk-cell">
                        <Badge
                          tone={
                            r.level === 'High'
                              ? 'red'
                              : r.level === 'Elevated'
                                ? 'amber'
                                : 'neutral'
                          }
                        >
                          {r.level}
                        </Badge>
                        <strong>{r.score}</strong>
                      </div>
                      <div className="risk-bar">
                        <span style={{ width: `${r.score}%` }} className={r.level.toLowerCase()} />
                      </div>
                    </td>
                    <td className="amount">{money(r.incomingPaise)}</td>
                    <td className="amount">{money(r.outgoingPaise)}</td>
                    <td>
                      <strong>{r.rules.length} triggered</strong>
                      <small>{r.rules[0]?.title || 'No configured signal'}</small>
                    </td>
                    <td>
                      <Badge tone={a.statementAvailable ? 'teal' : 'amber'}>
                        {a.statementAvailable ? 'Statement' : 'Missing'}
                      </Badge>
                    </td>
                    <td>
                      <button className="icon-button" aria-label={`Inspect ${a.label}`}>
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No accounts match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Inspector(p: WorkspaceProps & { selection: NonNullable<Selection>; onClose: () => void }) {
  const { c, selection, onClose, inspect, analysis, notify } = p;
  const account =
    selection.kind === 'account' ? c.accounts.find((a) => a.id === selection.id) : undefined;
  const transaction =
    selection.kind === 'transaction'
      ? c.transactions.find((t) => t.id === selection.id)
      : undefined;
  const evidence =
    selection.kind === 'evidence' ? c.evidence.find((e) => e.id === selection.id) : undefined;
  const risk = account ? analysis.risks.find((r) => r.accountId === account.id) : undefined;
  return (
    <Modal
      title={account ? 'Account evidence' : transaction ? 'Transfer evidence' : 'Source evidence'}
      onClose={onClose}
      wide
    >
      {account && (
        <div className="modal-body">
          <div className="inspector-title">
            <span className="large-icon">
              <Building2 size={25} />
            </span>
            <div>
              <h2>{account.label}</h2>
              <p className="mono">
                {account.id} · {account.bank}
              </p>
            </div>
            {risk && (
              <Badge
                tone={
                  risk.level === 'High' ? 'red' : risk.level === 'Elevated' ? 'amber' : 'neutral'
                }
              >
                {risk.score}/100 · {risk.level}
              </Badge>
            )}
          </div>
          <div className="detail-grid">
            <div>
              <span>Incoming observed</span>
              <strong>{money(risk?.incomingPaise || 0)}</strong>
            </div>
            <div>
              <span>Outgoing observed</span>
              <strong>{money(risk?.outgoingPaise || 0)}</strong>
            </div>
            <div>
              <span>Statement coverage</span>
              <strong>
                {account.statementAvailable ? 'Statement supplied' : 'Missing statement'}
              </strong>
            </div>
            <div>
              <span>Timestamp precision</span>
              <strong>
                {risk?.timedTransactions}/{risk?.totalTransactions} records include time
              </strong>
            </div>
          </div>
          <Notice>
            Incoming minus outgoing is not the current bank balance. Records may cover only part of
            the account’s activity.
          </Notice>
          <h3>Why this account was flagged</h3>
          {risk?.rules.map((rule) => (
            <div className="rule-explanation" key={rule.id}>
              <div>
                <strong>{rule.title}</strong>
                <Badge tone="amber">+{rule.points} points</Badge>
              </div>
              <p>{rule.description}</p>
              <div className="reference-chips">
                {rule.transactionIds.map((id) => (
                  <button key={id} onClick={() => inspect({ kind: 'transaction', id })}>
                    {id}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!risk?.rules.length && (
            <p className="muted">
              No configured rules triggered. Assess the available coverage before drawing
              conclusions.
            </p>
          )}
          <h3>Transactions involving this account</h3>
          <TransactionTable
            c={c}
            transactions={c.transactions.filter(
              (t) => t.from === account.id || t.to === account.id,
            )}
            inspect={inspect}
          />
        </div>
      )}
      {transaction && (
        <div className="modal-body">
          <div className="transaction-hero">
            <Badge tone="teal">Observed transfer</Badge>
            <h2>{money(transaction.amountPaise)}</h2>
            <p className="mono">{transaction.utr || 'Reference not supplied'}</p>
          </div>
          <div className="transfer-parties">
            <button onClick={() => inspect({ kind: 'account', id: transaction.from })}>
              {c.accounts.find((a) => a.id === transaction.from)?.label || transaction.from}
              <small>{transaction.from}</small>
            </button>
            <ArrowRight size={20} />
            <button onClick={() => inspect({ kind: 'account', id: transaction.to })}>
              {c.accounts.find((a) => a.id === transaction.to)?.label || transaction.to}
              <small>{transaction.to}</small>
            </button>
          </div>
          <div className="detail-grid">
            <div>
              <span>Original timestamp</span>
              <strong>{transaction.originalTimestamp}</strong>
            </div>
            <div>
              <span>Normalized UTC</span>
              <strong>{transaction.timestamp}</strong>
            </div>
            <div>
              <span>Precision</span>
              <strong>{transaction.precision}</strong>
            </div>
            <div>
              <span>Timezone</span>
              <strong>{transaction.timezone}</strong>
            </div>
          </div>
          <p>{transaction.narration}</p>
          <h3>Supporting source records</h3>
          {transaction.sources.map((s, i) => (
            <div className="source-card" key={i}>
              <button onClick={() => inspect({ kind: 'evidence', id: s.evidenceId })}>
                <FileText size={18} />
                <strong>{s.file}</strong>
                <ArrowUpRight size={15} />
              </button>
              <span>
                {s.location} · {s.evidenceId}
              </span>
              {s.statementAccount && (
                <p className="source-observation">
                  Statement account: {s.statementAccount} ·{' '}
                  {s.direction || 'direction not supplied'}
                  {s.balancePaise !== undefined
                    ? ` · reported balance ${money(s.balancePaise)}`
                    : ''}
                </p>
              )}
              {s.raw && <pre>{s.raw}</pre>}
            </div>
          ))}
          <Notice>
            This documents a transfer. Attributing its funds to an earlier payment requires an
            explicit allocation method and complete records.
          </Notice>
        </div>
      )}
      {evidence && (
        <div className="modal-body">
          <div className="inspector-title">
            <span className="large-icon">
              <Fingerprint size={25} />
            </span>
            <div>
              <h2>{evidence.name}</h2>
              <p>
                {evidence.kind} · {time(evidence.createdAt)} IST
              </p>
            </div>
          </div>
          <p>{evidence.summary}</p>
          <label className="hash-block">
            <span>
              SHA-256{' '}
              {evidence.storedFile ? 'of original uploaded file' : 'of stored evidence content'}
            </span>
            <code>{evidence.sha256 || 'Not computed in standalone preview'}</code>
          </label>
          <Notice>
            A hash supports later integrity comparison. It does not prove the source is authentic or
            establish a legal chain of custody.
          </Notice>
          <div className="source-content">
            <pre>{evidence.content || evidence.summary}</pre>
          </div>
          <Button
            onClick={async () => {
              try {
                if (offline) saveText(`${evidence.id}.txt`, evidence.content || evidence.summary);
                else
                  await download(
                    `/api/cases/${c.id}/evidence/${evidence.id}/download`,
                    evidence.storedFile ? evidence.name : `${evidence.id}.txt`,
                  );
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            <ArrowDownToLine size={16} />
            Download source
          </Button>
        </div>
      )}
      {!account && !transaction && !evidence && (
        <Empty
          title="Record not available"
          description="The selected item is not present in this case."
        />
      )}
    </Modal>
  );
}
function NewCase({
  onClose,
  onCreated,
  notify,
}: {
  onClose: () => void;
  onCreated: (c: CaseData) => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}) {
  const [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [utr, setUtr] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Create an investigation" onClose={onClose}>
      <form
        className="modal-body form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onCreated(
              await post<CaseData>('/api/cases', { title, description, victimUtr: utr }),
            );
          } catch (e) {
            notify((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Notice>Use organizer-provided or self-made synthetic data only.</Notice>
        <label className="field">
          <span>Case title</span>
          <input
            required
            minLength={3}
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Investment platform complaint"
          />
        </label>
        <label className="field">
          <span>Complaint summary</span>
          <textarea
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the reported payment and available evidence."
            rows={4}
          />
        </label>
        <label className="field">
          <span>
            Victim transaction / UTR <small>Optional for now</small>
          </span>
          <input value={utr} maxLength={100} onChange={(e) => setUtr(e.target.value)} />
        </label>
        <div className="modal-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create case'}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
