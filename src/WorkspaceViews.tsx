import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  FolderOpen,
  Link2,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import type { AuditEvent, RuleSettings } from '../shared/types';
import { DEFAULT_RULES } from '../shared/analysis';
import { requestDraft } from '../shared/requests';
import type { WorkspaceProps } from './workspace';
import { api, download, offline, post, saveText } from './api';
import { Badge, Button, Empty, Modal, Notice, SectionTitle, money, time } from './components';

export function Connections({ c, analysis, selectCase, inspect }: WorkspaceProps) {
  const groups = [...new Set(analysis.links.map((l) => l.caseId))];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RELATIONSHIP DISCOVERY</div>
          <h1>Find the connection between cases</h1>
          <p>
            Exact identifier matches surface a lead. The underlying evidence supplies its meaning.
          </p>
        </div>
        <Badge tone="purple">
          {groups.length} connected case{groups.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      <Notice>
        Shared accounts and payment identifiers are investigative leads. A shared cloud provider,
        registrar or public resolver is not sufficient to infer common control.
      </Notice>
      {groups.map((id) => {
        const links = analysis.links.filter((l) => l.caseId === id);
        return (
          <section className="panel connection-panel" key={id}>
            <div className="connection-top">
              <div className="case-identity">
                <span className="large-icon">
                  <FolderOpen size={24} />
                </span>
                <div>
                  <span className="eyebrow">{id}</span>
                  <h2>{links[0].caseTitle}</h2>
                </div>
              </div>
              <Button onClick={() => selectCase(id)}>
                Open related case
                <ArrowUpRight size={15} />
              </Button>
            </div>
            <div className="connection-visual">
              <div>
                <span className="case-dot" />
                <strong>{c.id}</strong>
                <small>Current investigation</small>
              </div>
              <span className="connector-line" />
              <div className="match-center">
                <Link2 size={20} />
                <strong>{links.length} exact matches</strong>
              </div>
              <span className="connector-line" />
              <div>
                <span className="case-dot purple" />
                <strong>{id}</strong>
                <small>Related investigation</small>
              </div>
            </div>
            <div className="connection-matches">
              {links.map((l, i) => (
                <div key={i}>
                  <Badge tone="purple">{l.kind}</Badge>
                  <div>
                    <strong className="mono">{l.value}</strong>
                    <p>{l.explanation}</p>
                  </div>
                  <Button
                    onClick={() => {
                      const indicator = c.indicators.find((x) => x.value === l.value);
                      if (indicator) inspect({ kind: 'evidence', id: indicator.sourceId });
                      else inspect({ kind: 'account', id: l.value });
                    }}
                  >
                    Inspect source
                    <ArrowUpRight size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {!groups.length && (
        <section className="panel">
          <Empty
            title="No exact cross-case matches yet"
            description="Connections appear when another local case contains the same account or submitted indicator."
          />
        </section>
      )}
    </>
  );
}

export function EvidenceView({ c, notify, refresh, inspect }: WorkspaceProps) {
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState('Sources'),
    [query, setQuery] = useState(''),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [events, setEvents] = useState<AuditEvent[]>([]);
  useEffect(() => {
    api<AuditEvent[]>(`/api/cases/${c.id}/audit`)
      .then(setEvents)
      .catch((e) => notify(e.message, true));
  }, [c.id, c.evidence.length, c.notes.length, notify]);
  const evidence = c.evidence.filter((e) =>
    `${e.name} ${e.summary} ${e.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVIDENCE WORKSPACE</div>
          <h1>A source behind every finding</h1>
          <p>
            Inspect original records, document your reasoning, and review the local activity log.
          </p>
        </div>
        <Badge tone="teal">
          <Fingerprint size={13} />
          {c.evidence.length} evidence items
        </Badge>
      </div>
      <div className="tabs standalone-tabs">
        {['Sources', 'Analyst notes', 'Activity log'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Sources' && (
        <section className="panel">
          <div className="table-toolbar">
            <div className="inline-actions">
              <h2>Evidence register</h2>
              <Button onClick={() => setAdding(true)}>
                <Plus size={14} />
                Add source
              </Button>
            </div>
            <label className="search-input">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search evidence"
                placeholder="Search sources…"
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Recorded · IST</th>
                  <th>Integrity reference</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <tr key={e.id} onClick={() => inspect({ kind: 'evidence', id: e.id })}>
                    <td>
                      <div className="account-cell">
                        <span className="file-symbol">
                          <FileText size={19} />
                        </span>
                        <div>
                          <strong>{e.name}</strong>
                          <small>{e.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge>{e.kind}</Badge>
                      <small>{e.synthetic ? 'Synthetic' : 'Public lookup'}</small>
                    </td>
                    <td>{time(e.createdAt)}</td>
                    <td className="mono">
                      {e.sha256
                        ? `${e.sha256.slice(0, 10)}…${e.sha256.slice(-6)}`
                        : 'Preview fixture'}
                    </td>
                    <td>
                      <button className="icon-button" aria-label={`Inspect evidence ${e.name}`}>
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!evidence.length && (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      No evidence matches this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="panel-footnote">
            Uploaded file hashes are computed from the original bytes. Generated evidence hashes
            cover stored content. Local activity logs are not tamper-proof.
          </div>
        </section>
      )}
      {tab === 'Analyst notes' && (
        <div className="notes-layout">
          <section className="panel note-composer">
            <SectionTitle
              title="Document your reasoning"
              description="Keep observations, hypotheses and unresolved questions explicit."
            />
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!note.trim()) return;
                setBusy(true);
                try {
                  await post(`/api/cases/${c.id}/notes`, { text: note });
                  await refresh();
                  setNote('');
                  notify('Analyst note saved.');
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <textarea
                aria-label="Analyst note"
                rows={8}
                maxLength={5000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Observation: …\nSupporting source: …\nInterpretation: …\nNext verification: …"
              />
              <Button type="submit" variant="primary" disabled={busy || !note.trim()}>
                <Plus size={16} />
                Save note
              </Button>
            </form>
          </section>
          <section className="panel">
            <SectionTitle title="Case notes" description={`${c.notes.length} saved notes`} />
            {[...c.notes].reverse().map((n) => (
              <article className="analyst-note" key={n.id}>
                <span>
                  <Clock3 size={13} />
                  {time(n.createdAt)} IST · Local analyst
                </span>
                <p>{n.text}</p>
              </article>
            ))}
            {!c.notes.length && (
              <Empty
                title="The investigation notebook is empty"
                description="Add your first observation or question."
              />
            )}
          </section>
        </div>
      )}
      {adding && (
        <SourceForm
          c={c}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            await refresh();
            setAdding(false);
            notify('Source evidence and submitted association saved.');
          }}
          notify={notify}
        />
      )}
      {tab === 'Activity log' && (
        <section className="panel">
          <SectionTitle
            title="Local activity log"
            description="Latest 100 recorded events. Stored in the same local database as the cases."
          />
          <div className="activity-list">
            {events.map((e) => (
              <div key={e.id}>
                <span className="activity-dot" />
                <div>
                  <strong>{e.action}</strong>
                  <p>{e.detail}</p>
                  <small>{time(e.at)} IST</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function Reports(p: WorkspaceProps) {
  const { c, analysis, notify } = p;
  const [busy, setBusy] = useState(''),
    [recipient, setRecipient] = useState('Bank records / compliance team'),
    [identifier, setIdentifier] = useState(
      c.accounts.find((a) => !a.statementAvailable && analysis.trace.accountIds.includes(a.id))
        ?.id || '',
    ),
    [draft, setDraft] = useState('');
  async function exportReport(format: string) {
    setBusy(format);
    try {
      if (offline) {
        if (format === 'pdf') {
          window.print();
          return;
        }
        throw new Error('Excel report generation is available in the local application.');
      }
      await download(`/api/cases/${c.id}/report/${format}`, `${c.id}-investigation.${format}`);
      notify(`${format.toUpperCase()} report downloaded.`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy('');
    }
  }
  async function generate() {
    setBusy('draft');
    try {
      if (offline) {
        setDraft(requestDraft(c, recipient, identifier));
      } else {
        const result = await post<{ text: string }>(`/api/cases/${c.id}/request`, {
          recipient,
          identifier,
        });
        setDraft(result.text);
      }
      notify('Draft prepared for your review. Nothing was sent.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <div className="page-heading no-print">
        <div>
          <div className="eyebrow">FROM FINDINGS TO ACTION</div>
          <h1>Reports & information requests</h1>
          <p>Package the evidence, explain the limits, and prepare the next lawful step.</p>
        </div>
        <Badge tone="teal">Evidence-backed exports</Badge>
      </div>
      <div className="export-grid no-print">
        <button className="export-card" disabled={!!busy} onClick={() => void exportReport('pdf')}>
          <span className="export-icon pdf">
            <FileText size={29} />
          </span>
          <div>
            <h3>Investigation report</h3>
            <p>Findings, money trail, infrastructure, sources and limitations.</p>
            <span>
              {busy === 'pdf'
                ? 'Generating…'
                : offline
                  ? 'Print / save PDF preview'
                  : 'Download PDF'}
              <ArrowDownToLine size={15} />
            </span>
          </div>
        </button>
        <button className="export-card" disabled={!!busy} onClick={() => void exportReport('xlsx')}>
          <span className="export-icon excel">
            <FileSpreadsheet size={29} />
          </span>
          <div>
            <h3>Evidence workbook</h3>
            <p>Normalized transactions, account findings and source register.</p>
            <span>
              {busy === 'xlsx' ? 'Generating…' : 'Download Excel'}
              <ArrowDownToLine size={15} />
            </span>
          </div>
        </button>
      </div>
      <section className="panel report-preview">
        <div className="report-brand">
          <NetworkMark />
          <span>TRACE-X / INVESTIGATION BRIEF</span>
          <Badge>Synthetic demonstration</Badge>
        </div>
        <h2>{c.title}</h2>
        <p>
          {c.id} · {c.description}
        </p>
        <div className="report-metrics">
          <div>
            <span>Starting payment</span>
            <strong>
              {analysis.trace.root ? money(analysis.trace.root.amountPaise) : 'Not set'}
            </strong>
          </div>
          <div>
            <span>Accounts for review</span>
            <strong>{analysis.risks.filter((r) => r.score >= 30).length}</strong>
          </div>
          <div>
            <span>Source records</span>
            <strong>{c.evidence.length}</strong>
          </div>
          <div>
            <span>Exact cross-case matches</span>
            <strong>{analysis.links.length}</strong>
          </div>
        </div>
        <h3>Key findings</h3>
        {analysis.risks
          .filter((r) => r.rules.length)
          .map((r) => (
            <div className="report-finding" key={r.accountId}>
              <strong>
                {c.accounts.find((a) => a.id === r.accountId)?.label} · {r.accountId}
              </strong>
              <span>
                {r.level} priority · {r.score}/100
              </span>
              <p>{r.rules.map((rule) => rule.description).join(' ')}</p>
            </div>
          ))}
        {!analysis.risks.some((r) => r.rules.length) && (
          <p>No configured rules triggered in the available records.</p>
        )}
        <h3>Infrastructure observations</h3>
        {c.lookups.map((l) => (
          <p key={l.id}>
            <strong>{l.indicator}</strong> ·{' '}
            {l.mode === 'fixture' ? 'Synthetic fixture' : 'Public lookup'} · {l.observedAt}
            <br />
            {Object.entries(l.fields)
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')}
          </p>
        ))}
        <h3>Interpretation & limitations</h3>
        <p>
          {analysis.trace.warnings.join(' ')} Risk scores prioritize review. Shared infrastructure
          does not prove common ownership. Non-public subscriber or access records require the
          applicable lawful process.
        </p>
        <div className="print-only">
          <h3>Observed transfers in the candidate trail</h3>
          {analysis.trace.transactions.map((t) => (
            <p key={t.id}>
              {t.utr || t.id}: {t.from} → {t.to} · {money(t.amountPaise)} · {t.timestamp}
              <br />
              Sources: {t.sources.map((s) => `${s.evidenceId}, ${s.location}`).join('; ')}
            </p>
          ))}
          <h3>Evidence register</h3>
          {c.evidence.map((e) => (
            <p key={e.id}>
              {e.id} · {e.name}
              <br />
              SHA-256: {e.sha256 || 'Not computed in standalone preview'}
            </p>
          ))}
        </div>
        <div className="report-footer">
          <ShieldCheck size={15} />
          Full generated reports include source references, rule settings and evidence gaps.
        </div>
      </section>
      <section className="panel request-panel no-print">
        <SectionTitle
          title="Prepare an information request"
          description="Generate an editable draft. The application does not send requests or obtain non-public records."
        />
        <div className="request-form">
          <label className="field">
            <span>Recipient / records custodian</span>
            <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option>Bank records / compliance team</option>
              <option>Domain registrar compliance team</option>
              <option>Hosting / cloud provider compliance team</option>
              <option>Network provider compliance team</option>
            </select>
          </label>
          <label className="field">
            <span>Account, domain or IP identifier</span>
            <input
              value={identifier}
              maxLength={253}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Identifier requiring records"
            />
          </label>
          <Button
            variant="primary"
            disabled={!!busy || identifier.trim().length < 2}
            onClick={() => void generate()}
          >
            <FileText size={16} />
            {busy === 'draft' ? 'Preparing…' : 'Generate draft'}
          </Button>
        </div>
        {draft && (
          <div className="draft-editor">
            <Notice tone="warning">
              Complete the authority, event timestamps, timezone, scope and recipient before using
              an approved legal channel. For dynamic/shared IPs, include ports and protocol when
              available.
            </Notice>
            <textarea
              aria-label="Information request draft"
              rows={19}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="draft-actions">
              <Badge tone="amber">Draft · not sent</Badge>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(draft);
                    notify('Draft copied.');
                  } catch {
                    notify('Clipboard is unavailable. Use Download draft.', true);
                  }
                }}
              >
                <Copy size={15} />
                Copy text
              </Button>
              <Button onClick={() => saveText(`${c.id}-request-draft.txt`, draft)}>
                <ArrowDownToLine size={15} />
                Download draft
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
function NetworkMark() {
  return <span className="mini-brand">X</span>;
}

function SourceForm({
  c,
  onClose,
  onSaved,
  notify,
}: {
  c: WorkspaceProps['c'];
  onClose: () => void;
  onSaved: () => Promise<void>;
  notify: WorkspaceProps['notify'];
}) {
  const [name, setName] = useState(''),
    [kind, setKind] = useState('complaint'),
    [content, setContent] = useState(''),
    [indicator, setIndicator] = useState(''),
    [type, setType] = useState('domain'),
    [account, setAccount] = useState(''),
    [relation, setRelation] = useState(
      'Reported in the submitted complaint; requires corroboration',
    ),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Add source evidence" onClose={onClose}>
      <form
        className="modal-body form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await post(`/api/cases/${c.id}/evidence`, {
              name,
              kind,
              content,
              ...(indicator.trim()
                ? {
                    indicator: {
                      type,
                      value: indicator.trim(),
                      relatedAccount: account || undefined,
                      relation,
                    },
                  }
                : {}),
            });
            await onSaved();
          } catch (e) {
            notify((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Notice>
          Enter synthetic source text. A submitted association is a recorded claim, not
          automatically verified ownership.
        </Notice>
        <label className="field">
          <span>Source title</span>
          <input
            required
            minLength={3}
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Complaint C-003 / payment receipt"
          />
        </label>
        <label className="field">
          <span>Source type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="complaint">Complaint / submitted record</option>
            <option value="note">Analyst-supplied source note</option>
          </select>
        </label>
        <label className="field">
          <span>Source text</span>
          <textarea
            required
            minLength={10}
            maxLength={10000}
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Include the identifiers, event times and provenance stated in the source."
          />
        </label>
        <div className="context-inline">
          <label className="field">
            <span>Indicator type</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {['domain', 'ip', 'upi', 'phone'].map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              Indicator <small>Optional</small>
            </span>
            <input
              value={indicator}
              maxLength={253}
              onChange={(e) => setIndicator(e.target.value)}
              placeholder="e.g. synthetic-platform.example"
            />
          </label>
        </div>
        {indicator && (
          <>
            <label className="field">
              <span>
                Associated account <small>Only if supported by this source</small>
              </span>
              <select value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">No account association</option>
                {c.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>What does the source establish?</span>
              <textarea
                required
                minLength={5}
                maxLength={500}
                rows={3}
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
              />
            </label>
          </>
        )}
        <div className="modal-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save evidence'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const ruleInputs: {
  key: keyof RuleSettings;
  label: string;
  description: string;
  min: number;
  max: number;
  unit: string;
}[] = [
  {
    key: 'rapidMinutes',
    label: 'Rapid-transfer window',
    description: 'Examine outgoing transfers after a timed incoming payment.',
    min: 1,
    max: 1440,
    unit: 'minutes',
  },
  {
    key: 'rapidPercent',
    label: 'Outgoing amount threshold',
    description:
      'Outgoing total relative to the incoming payment. This is a proximity signal, not an allocation.',
    min: 1,
    max: 100,
    unit: 'percent',
  },
  {
    key: 'fanInSenders',
    label: 'Distinct incoming senders',
    description: 'Minimum distinct identifiers in a rolling 24-hour window.',
    min: 2,
    max: 1000,
    unit: 'senders',
  },
  {
    key: 'roundMultipleRupees',
    label: 'Round-figure multiple',
    description: 'Flag repeated outgoing amounts divisible by this value.',
    min: 1,
    max: 10000000,
    unit: 'INR',
  },
  {
    key: 'roundCount',
    label: 'Round-figure occurrence count',
    description: 'Minimum qualifying transfers in the supplied statement period.',
    min: 2,
    max: 1000,
    unit: 'transfers',
  },
  {
    key: 'repeatCount',
    label: 'Repeated recipient threshold',
    description: 'Minimum outgoing transfers to the same account identifier.',
    min: 2,
    max: 1000,
    unit: 'transfers',
  },
  {
    key: 'dormancyDays',
    label: 'Observed inactivity gap',
    description:
      'Minimum gap before renewed activity. Does not establish complete statement coverage.',
    min: 1,
    max: 3650,
    unit: 'days',
  },
];
export function Rules({ analysis, refresh, notify }: WorkspaceProps) {
  const [rules, setRules] = useState(analysis.rules),
    [busy, setBusy] = useState(false);
  useEffect(() => setRules(analysis.rules), [analysis.rules]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TRANSPARENT BY DESIGN</div>
          <h1>Analysis rules</h1>
          <p>Make each threshold explicit. Changes apply to all local cases and are recorded.</p>
        </div>
        <Badge>Rules version 0.1</Badge>
      </div>
      <Notice>
        These are demonstration heuristics, not calibrated fraud probabilities. Review false
        positives and statement coverage before interpreting a score.
      </Notice>
      <form
        className="panel rules-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/api/settings', { method: 'PUT', body: JSON.stringify(rules) });
            await refresh();
            notify('Rules saved. Account findings have been recalculated.');
          } catch (e) {
            notify((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {ruleInputs.map((r) => (
          <label className="rule-setting" key={r.key}>
            <div>
              <strong>{r.label}</strong>
              <p>{r.description}</p>
            </div>
            <div className="number-input">
              <input
                aria-label={r.label}
                type="number"
                required
                min={r.min}
                max={r.max}
                step="1"
                value={rules[r.key]}
                onChange={(e) => setRules({ ...rules, [r.key]: Number(e.target.value) })}
              />
              <span>{r.unit}</span>
            </div>
          </label>
        ))}
        <div className="rules-method">
          <h3>How the priority score is calculated</h3>
          <p>
            Rapid forwarding +35 · incoming senders +25 · round figures +15 · repeated recipient +10
            · observed gap +15. Each rule contributes once. High: 60–100. Elevated: 30–59. Low:
            0–29. Victim accounts are excluded from scoring in the synthetic case.
          </p>
        </div>
        <div className="modal-actions">
          <Button onClick={() => setRules({ ...DEFAULT_RULES })}>
            <RotateCcw size={15} />
            Restore default values
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            <CheckCircle2 size={16} />
            {busy ? 'Saving…' : 'Save & recalculate'}
          </Button>
        </div>
      </form>
    </>
  );
}
