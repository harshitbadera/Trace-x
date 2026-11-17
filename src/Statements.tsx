import { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Pencil,
  Search,
  Upload,
  X,
} from 'lucide-react';
import type { CaseData, ImportPreview, ImportRow } from '../shared/types';
import type { WorkspaceProps } from './workspace';
import { api, download, offline, post, saveText } from './api';
import { Badge, Button, Empty, Modal, Notice, SectionTitle, money, time } from './components';
import { TransactionTable } from './App';
import { demoCases } from '../shared/fixtures';

const FIELDS = [
  'timestamp',
  'account',
  'counterparty',
  'direction',
  'amount',
  'debit',
  'credit',
  'balance',
  'utr',
  'narration',
  'from',
  'to',
];
export function Statements(p: WorkspaceProps) {
  const { c, refresh, notify, inspect } = p;
  const input = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState(''),
    [timezone, setTimezone] = useState('+05:30'),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [excluded, setExcluded] = useState<number[]>([]),
    [page, setPage] = useState(0),
    [edit, setEdit] = useState<ImportRow | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [query, setQuery] = useState('');
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notify('Upload a file smaller than 10 MB.', true);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('account', account);
      body.append('timezone', timezone);
      setPreview(await api<ImportPreview>(`/api/cases/${c.id}/import`, { method: 'POST', body }));
      setExcluded([]);
      setPage(0);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  async function update(body: unknown) {
    if (!preview) return;
    setBusy(true);
    try {
      setPreview(
        await api<ImportPreview>(`/api/cases/${c.id}/import/${preview.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await post<{ case: CaseData; added: number; duplicates: number }>(
        `/api/cases/${c.id}/import/${preview.id}/commit`,
        { excluded },
      );
      await refresh();
      setPreview(null);
      notify(
        `${result.added} new transfers imported; ${result.duplicates} matching observations merged.`,
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function sample(format: string) {
    try {
      if (offline) {
        if (format !== 'csv')
          throw new Error(
            'PDF and Excel sample generation is available in the local app. The CSV sample works in this preview.',
          );
        const e = demoCases()[0].evidence.find((e) => e.id === 'EV-SYN-A1042')!;
        saveText('SYN-A1042-sample.csv', e.content!, 'text/csv');
      } else await download(`/api/samples/${format}`, `SYN-A1042-sample.${format}`);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  const filtered = c.transactions.filter((t) =>
    JSON.stringify([t.utr, t.from, t.to, t.narration]).toLowerCase().includes(query.toLowerCase()),
  );
  const errorCount =
    preview?.rows.filter((r) => r.errors.length && !excluded.includes(r.row)).length || 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">NORMALIZE THE EVIDENCE</div>
          <h1>Statements & transactions</h1>
          <p>Bring different statement formats into one reviewable transaction schema.</p>
        </div>
        <Badge>{c.transactions.length} normalized transfers</Badge>
      </div>
      {!preview ? (
        <>
          <div className="upload-grid">
            <section
              className={`upload-zone ${drag ? 'dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void upload(e.dataTransfer.files[0]);
              }}
            >
              <div className="upload-symbol">
                {busy ? <LoaderCircle className="spin" size={30} /> : <Upload size={30} />}
              </div>
              <h2>{busy ? 'Reading your statement…' : 'Drop a statement here'}</h2>
              <p>PDF, Excel (.xlsx) or CSV · up to 10 MB</p>
              <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>
                <PlusIcon />
                Choose statement
              </Button>
              <input
                ref={input}
                type="file"
                accept=".csv,.xlsx,.pdf"
                className="visually-hidden"
                aria-label="Upload statement"
                onChange={(e) => void upload(e.target.files?.[0])}
              />
              <small>Synthetic or organizer-provided data only. Review before import.</small>
            </section>
            <section className="panel import-options">
              <SectionTitle
                title="Import context"
                description="Used when these details are absent from the statement."
              />
              <label className="field">
                <span>Statement account identifier</span>
                <input
                  value={account}
                  maxLength={100}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="e.g. SYN-A1042"
                />
              </label>
              <label className="field">
                <span>Statement timezone</span>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="+05:30">India · UTC+05:30</option>
                  <option value="Z">UTC · +00:00</option>
                  <option value="+08:00">UTC+08:00</option>
                  <option value="-05:00">UTC−05:00 (fixed offset)</option>
                  <option value="+01:00">UTC+01:00 (fixed offset)</option>
                </select>
              </label>
              <p className="muted small-text">
                Explicit offsets in a row take precedence. Date-only records retain their limited
                precision.
              </p>
              <div className="sample-downloads">
                <strong>Try a synthetic sample</strong>
                <div>
                  {['csv', 'xlsx', 'pdf'].map((f) => (
                    <button key={f} onClick={() => void sample(f)}>
                      <ArrowDownToLine size={14} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
          <Notice>
            Excel imports the first worksheet. PDF extraction supports selectable-text tables;
            scanned documents need OCR. Unrecognized fields and invalid rows are surfaced for
            review.
          </Notice>
        </>
      ) : (
        <section className="panel import-review">
          <SectionTitle
            title="Review before importing"
            description={`${preview.name} · ${preview.rows.length} extracted rows · original file fingerprint retained`}
            action={
              <Button disabled={busy} onClick={() => setPreview(null)}>
                <X size={15} />
                Close preview
              </Button>
            }
          />
          <div className="import-review-body">
            <div className="import-summary">
              <Badge tone="teal">
                {preview.rows.filter((r) => !r.errors.length && !excluded.includes(r.row)).length}{' '}
                valid
              </Badge>
              <Badge tone={errorCount ? 'red' : 'neutral'}>{errorCount} unresolved</Badge>
              <Badge>{excluded.length} excluded</Badge>
            </div>
            {preview.warnings.map((w) => (
              <Notice key={w}>{w}</Notice>
            ))}
            <h3>Map statement columns</h3>
            <p className="muted">
              Map a timestamp and amount, plus either from/to identifiers or account, counterparty
              and direction. Separate debit/credit columns can supply amount and direction.
            </p>
            <div className="mapping-grid">
              {FIELDS.map((field) => (
                <label className="field" key={field}>
                  <span>{field}</span>
                  <select
                    disabled={busy}
                    value={preview.mapping[field] || ''}
                    onChange={(e) =>
                      void update({ mapping: { ...preview.mapping, [field]: e.target.value } })
                    }
                  >
                    <option value="">Not mapped</option>
                    {preview.columns.map((col) => (
                      <option value={col} key={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="context-inline">
              <label className="field">
                <span>Fallback account</span>
                <input
                  value={preview.account}
                  disabled={busy}
                  onChange={(e) => setPreview({ ...preview, account: e.target.value })}
                  onBlur={() => void update({ account: preview.account })}
                />
              </label>
              <label className="field">
                <span>Timezone for unzoned rows</span>
                <select
                  value={preview.timezone}
                  disabled={busy}
                  onChange={(e) => void update({ timezone: e.target.value })}
                >
                  <option value="+05:30">UTC+05:30</option>
                  <option value="Z">UTC</option>
                  <option value="+08:00">UTC+08:00</option>
                  <option value="-05:00">UTC−05:00</option>
                  <option value="+01:00">UTC+01:00</option>
                </select>
              </label>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Include</th>
                  <th>Source row</th>
                  <th>Timestamp</th>
                  <th>Transfer</th>
                  <th>Amount</th>
                  <th>Review</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(page * 15, page * 15 + 15).map((r) => (
                  <tr key={r.row} className={excluded.includes(r.row) ? 'excluded-row' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Include row ${r.row}`}
                        checked={!excluded.includes(r.row)}
                        onChange={(e) =>
                          setExcluded(
                            e.target.checked
                              ? excluded.filter((n) => n !== r.row)
                              : [...excluded, r.row],
                          )
                        }
                      />
                    </td>
                    <td>{r.location}</td>
                    <td>{r.transaction ? time(r.transaction.timestamp) : 'Needs review'}</td>
                    <td>
                      <strong>{r.transaction?.from || '—'}</strong>
                      <small>→ {r.transaction?.to || '—'}</small>
                    </td>
                    <td>{r.transaction ? money(r.transaction.amountPaise) : '—'}</td>
                    <td className="review-cell">
                      {r.errors.length ? (
                        <span className="error-text">{r.errors.join(' ')}</span>
                      ) : r.warnings.length ? (
                        <span className="warning-text">{r.warnings.join(' ')}</span>
                      ) : (
                        <Badge tone="teal">
                          <CheckCircle2 size={12} />
                          Valid
                        </Badge>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Edit row ${r.row}`}
                        disabled={busy}
                        onClick={() => {
                          setEdit(r);
                          setValues({ ...r.raw });
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="import-footer">
            <div className="pagination">
              <button
                className="icon-button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                aria-label="Previous preview page"
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {page + 1} / {Math.ceil(preview.rows.length / 15)}
              </span>
              <button
                className="icon-button"
                disabled={(page + 1) * 15 >= preview.rows.length}
                onClick={() => setPage(page + 1)}
                aria-label="Next preview page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <span className="muted">Excluded rows and corrections are recorded.</span>
            <Button
              variant="primary"
              disabled={busy || errorCount > 0 || excluded.length === preview.rows.length}
              onClick={() => void commit()}
            >
              {busy ? 'Working…' : 'Confirm import'}
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <div>
            <h2>Normalized transactions</h2>
            <p>{filtered.length} transfers · matched observations are combined</p>
          </div>
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Filter transactions"
              placeholder="Search reference or account…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <TransactionTable c={c} transactions={filtered.slice(0, 100)} inspect={inspect} />
        {filtered.length > 100 && (
          <p className="table-footnote">
            Showing the first 100 matches. Narrow your search or export the complete dataset.
          </p>
        )}
      </section>
      {edit && preview && (
        <Modal title={`Review source row ${edit.row}`} onClose={() => setEdit(null)}>
          <form
            className="modal-body form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                let next = preview;
                for (const column of preview.columns) {
                  if (values[column] !== edit.raw[column])
                    next = await api<ImportPreview>(`/api/cases/${c.id}/import/${preview.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({
                        correction: { row: edit.row, column, value: values[column] },
                      }),
                    });
                }
                setPreview(next);
                setEdit(null);
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Notice>
              The original uploaded file and original row values are retained. Corrections are
              recorded in the import log.
            </Notice>
            {preview.columns.map((col) => (
              <label className="field" key={col}>
                <span>{col}</span>
                <input
                  value={values[col] || ''}
                  onChange={(e) => setValues({ ...values, [col]: e.target.value })}
                />
              </label>
            ))}
            <Button variant="primary" type="submit" disabled={busy}>
              Save reviewed correction
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function PlusIcon() {
  return <Upload size={16} />;
}
