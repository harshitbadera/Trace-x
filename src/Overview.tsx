import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  FileText,
  Fingerprint,
  Plus,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import type { WorkspaceProps } from './workspace';
import { Badge, Button, Empty, LinkButton, money, time } from './components';
import { MoneyGraph } from './Graph';

export function Overview({ c, analysis, navigate, inspect }: WorkspaceProps) {
  const [window, setWindow] = useState<'opening' | 'all'>('opening');
  const [selectedTransfer, setSelectedTransfer] = useState<string>();
  const flagged = analysis.risks.filter((r) => r.score >= 30);
  const root = analysis.trace.root;
  const shown = useMemo(
    () =>
      analysis.trace.transactions.filter(
        (t) =>
          window === 'all' ||
          !root ||
          Date.parse(t.timestamp) <= Date.parse(root.timestamp) + 20 * 60000,
      ),
    [analysis.trace.transactions, root, window],
  );
  const missing = c.accounts.filter(
    (a) => analysis.trace.accountIds.includes(a.id) && !a.statementAvailable,
  );
  const elapsed =
    root && shown.length
      ? Math.round(
          (Date.parse(shown[shown.length - 1].timestamp) - Date.parse(root.timestamp)) / 60000,
        )
      : 0;
  const timed = shown.every((t) => t.precision !== 'day');
  const openTransfer = (id: string) => {
    setSelectedTransfer(id);
    inspect({ kind: 'transaction', id });
  };
  const clock = (timestamp: string) =>
    new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(new Date(timestamp));
  return (
    <div className="case-file-view">
      <div className="page-heading case-file-heading">
        <div>
          <div className="eyebrow">
            <span className="file-tab" />
            INVESTIGATION BRIEF
            <span className="eyebrow-divider" />
            FINANCIAL + DIGITAL
          </div>
          <h1>{c.title}</h1>
          <p>{c.description}</p>
        </div>
        <div className="heading-actions">
          <Button onClick={() => navigate('reports')}>
            <ArrowDownToLine size={16} />
            Export report
          </Button>
          <Button variant="primary" onClick={() => navigate('statements')}>
            <Plus size={17} />
            Add evidence
          </Button>
        </div>
      </div>

      <section className="case-ledger" aria-label="Case facts">
        <div className="reported-payment">
          <div className="ledger-label">
            STARTING PAYMENT <span>INR</span>
          </div>
          <strong>{root ? money(root.amountPaise) : 'Not set'}</strong>
          {root ? (
            <button className="reference-link" onClick={() => openTransfer(root.id)}>
              <ScanLine size={13} />
              {root.utr}
              <ArrowUpRight size={12} />
            </button>
          ) : (
            <button className="reference-link" onClick={() => navigate('statements')}>
              Add the victim’s transaction
              <ArrowRight size={13} />
            </button>
          )}
        </div>
        <div className="ledger-facts">
          <button onClick={() => navigate('trail')}>
            <span className="ledger-label">IN THE TRAIL</span>
            <strong>
              {analysis.trace.accountIds.length}
              <small>account identifiers</small>
            </strong>
            <span className="ledger-note">
              {analysis.trace.depth} hops in available records
              <ArrowUpRight size={13} />
            </span>
          </button>
          <button onClick={() => navigate('accounts')}>
            <span className="ledger-label">REVIEW QUEUE</span>
            <strong>
              {flagged.length}
              <small>flagged accounts</small>
            </strong>
            <span className="ledger-note">
              Rules with source references
              <ArrowUpRight size={13} />
            </span>
          </button>
          <button onClick={() => navigate('intelligence')}>
            <span className="ledger-label">DIGITAL EVIDENCE</span>
            <strong>
              {c.indicators.length}
              <small>submitted indicators</small>
            </strong>
            <span className="ledger-note">
              {c.lookups.length} saved observations
              <ArrowUpRight size={13} />
            </span>
          </button>
          <button onClick={() => navigate('connections')}>
            <span className="ledger-label">ACROSS CASES</span>
            <strong>
              {analysis.links.length}
              <small>exact identifier matches</small>
            </strong>
            <span className="ledger-note">
              Open the supporting context
              <ArrowUpRight size={13} />
            </span>
          </button>
        </div>
        <div className="ledger-caption">
          <Fingerprint size={13} />
          <span>
            {c.evidence.length} evidence items · {c.transactions.length} normalized transfers
          </span>
          <span>Reported payment is not a recovery estimate.</span>
        </div>
      </section>

      <section className="panel caseboard">
        <div className="caseboard-heading">
          <div>
            <div className="section-index">01 / RECONSTRUCTION</div>
            <h2>The money trail</h2>
          </div>
          <div className="board-tools">
            <div className="tabs">
              <button
                className={window === 'opening' ? 'active' : ''}
                onClick={() => setWindow('opening')}
              >
                First 20 minutes
              </button>
              <button className={window === 'all' ? 'active' : ''} onClick={() => setWindow('all')}>
                Available trail
              </button>
            </div>
            <LinkButton onClick={() => navigate('trail')}>Explore trail</LinkButton>
          </div>
        </div>
        <div className="board-caption">
          <span className="board-caption-rule" />
          <span>
            {root
              ? `${time(root.timestamp)} IST · ${root.precision === 'day' ? 'Date-only starting record' : 'Starting observation'}`
              : 'No starting observation'}
          </span>
          <span className="board-duration">
            {shown.length} transfers
            {timed && shown.length > 1 ? ` / ${elapsed} minutes between first and last` : ''}
          </span>
        </div>
        {shown.length ? (
          <MoneyGraph
            accounts={c.accounts}
            transactions={shown}
            risks={analysis.risks}
            onAccount={(id) => inspect({ kind: 'account', id })}
            onTransaction={openTransfer}
            selectedTransaction={selectedTransfer}
            compact
          />
        ) : (
          <Empty
            title="Start with a transaction"
            description="Upload a statement and choose the victim’s UTR to reconstruct the available trail."
            action={<Button onClick={() => navigate('statements')}>Upload statement</Button>}
          />
        )}
        {shown.length > 0 && (
          <div className="event-strip">
            <div className="event-strip-label">
              OBSERVED EVENTS<span>IST · select to inspect</span>
            </div>
            <div className="event-rail">
              {shown.map((t, i) => (
                <button
                  key={t.id}
                  className={selectedTransfer === t.id ? 'selected' : ''}
                  onClick={() => openTransfer(t.id)}
                  aria-label={`Inspect event ${t.utr || t.id}`}
                >
                  <span className="event-marker">
                    <i />
                    {t.precision === 'day' ? 'Date only' : clock(t.timestamp)}
                    <small>{String(i + 1).padStart(2, '0')}</small>
                  </span>
                  <strong>{money(t.amountPaise)}</strong>
                  <span className="event-party">
                    To {c.accounts.find((a) => a.id === t.to)?.label || t.to}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="board-footnote">
          <ShieldCheck size={14} />
          <span>
            Edges are documented transfers. Attribution to the victim’s funds is a candidate path,
            especially where money mixes.
          </span>
        </div>
      </section>

      <div className="overview-workbench">
        <section className="panel review-queue">
          <div className="workbench-heading">
            <span className="section-index">02 / ACCOUNT REVIEW</span>
            <LinkButton onClick={() => navigate('accounts')}>All accounts</LinkButton>
          </div>
          <h2>Where to look closer</h2>
          <p className="workbench-subtitle">Review priority, with the reasons attached.</p>
          <div className="queue-rows">
            {flagged.slice(0, 4).map((risk) => {
              const account = c.accounts.find((a) => a.id === risk.accountId)!;
              return (
                <button
                  key={account.id}
                  onClick={() => inspect({ kind: 'account', id: account.id })}
                >
                  <span className={`priority-mark ${risk.level.toLowerCase()}`} />
                  <div>
                    <strong>{account.label}</strong>
                    <small>{risk.rules[0]?.title}</small>
                  </div>
                  <span className="queue-score">
                    {risk.score}
                    <small>/100</small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              );
            })}
            {!flagged.length && (
              <Empty
                title="No configured signals"
                description="Review coverage before interpreting the absence of flags."
              />
            )}
          </div>
        </section>
        <section className="panel source-register">
          <div className="workbench-heading">
            <span className="section-index">03 / SOURCE REGISTER</span>
            <LinkButton onClick={() => navigate('evidence')}>
              View all {c.evidence.length}
            </LinkButton>
          </div>
          <h2>Open the original evidence</h2>
          <p className="workbench-subtitle">Source records stay attached to findings.</p>
          <div className="evidence-mini">
            {c.evidence.slice(0, 4).map((e) => (
              <button key={e.id} onClick={() => inspect({ kind: 'evidence', id: e.id })}>
                <span className="file-symbol">
                  <FileText size={18} />
                </span>
                <span>
                  <strong>{e.name}</strong>
                  <small>
                    {e.rows ? `${e.rows} source rows` : e.kind} ·{' '}
                    {e.synthetic ? 'Synthetic' : 'Public observation'}
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
            {!c.evidence.length && (
              <Empty title="No source records yet" description="Add synthetic evidence to begin." />
            )}
          </div>
        </section>
        <section className="unresolved-card">
          <div className="section-index">04 / UNRESOLVED</div>
          <div className="gap-symbol">
            <span />
            <span />
          </div>
          <h2>
            {missing.length
              ? 'The trail stops at a missing record.'
              : 'Keep the next question visible.'}
          </h2>
          <p>
            {missing.length
              ? `${missing.map((a) => a.id).join(', ')} appears in the trail. Without the account statement, its onward activity remains unknown.`
              : 'Document the evidence you still need, inspect uncertain matches and record your next verification step.'}
          </p>
          <Button onClick={() => navigate('reports')}>
            Prepare a records request
            <ArrowRight size={15} />
          </Button>
          <small>Draft for investigator review. No request is sent.</small>
        </section>
      </div>
    </div>
  );
}
