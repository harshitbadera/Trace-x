import { useState } from 'react';
import {
  ArrowUpRight,
  Clock3,
  Globe2,
  Link2,
  LoaderCircle,
  Search,
  Server,
  ShieldCheck,
} from 'lucide-react';
import type { Lookup } from '../shared/types';
import type { WorkspaceProps } from './workspace';
import { post, offline } from './api';
import { Badge, Button, Empty, Notice, SectionTitle, time } from './components';
import { InfrastructureGraph } from './Graph';

export function Intelligence(p: WorkspaceProps) {
  const { c, refresh, notify, inspect } = p;
  const [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(c.lookups[0]?.id || ''),
    [tab, setTab] = useState('Observations');
  const current = c.lookups.find((l) => l.id === selected) || c.lookups[0];
  async function lookup() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const { lookup, cached } = await post<{ lookup: Lookup; cached: boolean }>(
        `/api/cases/${c.id}/lookups`,
        { indicator: query.trim() },
      );
      await refresh();
      setSelected(lookup.id);
      notify(
        cached
          ? 'Showing the saved observation from the last hour.'
          : `Public lookup saved: ${lookup.status}.`,
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DIGITAL INFRASTRUCTURE</div>
          <h1>Connect the digital evidence</h1>
          <p>Passive public intelligence, with observation times and sources attached.</p>
        </div>
        <Badge tone="teal">
          <ShieldCheck size={13} />
          Passive lookups only
        </Badge>
      </div>
      <section className="panel lookup-bar">
        <div className="lookup-input">
          <Search size={20} />
          <input
            aria-label="Domain or IP address"
            placeholder="Enter a domain, IPv4 or IPv6 address…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void lookup();
            }}
          />
        </div>
        <Button variant="primary" disabled={busy || !query.trim()} onClick={() => void lookup()}>
          {busy ? <LoaderCircle size={17} className="spin" /> : <Globe2 size={17} />}{' '}
          {busy ? 'Querying public sources…' : 'Run public lookup'}
        </Button>
      </section>
      <Notice>
        Public lookups disclose the queried indicator to RDAP, Google DNS, Certificate Transparency
        and/or RIPE services. No bank statements are sent. Subscriber and login records require a
        lawful request.
      </Notice>
      <div className="tabs standalone-tabs">
        {['Observations', 'Relationships'].map((t) => (
          <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Relationships' ? (
        <section className="panel">
          <SectionTitle
            title="Infrastructure relationships"
            description="Solid links represent submitted associations. Dashed links are timestamped DNS observations."
          />
          {c.indicators.length ? (
            <InfrastructureGraph
              c={c}
              onSelect={(value) => {
                const l = c.lookups.find((l) => l.indicator === value);
                if (l) {
                  setSelected(l.id);
                  setTab('Observations');
                } else {
                  const i = c.indicators.find((i) => i.value === value);
                  if (i) inspect({ kind: 'evidence', id: i.sourceId });
                  else if (c.accounts.some((a) => a.id === value))
                    inspect({ kind: 'account', id: value });
                }
              }}
            />
          ) : (
            <Empty
              title="No indicators yet"
              description="Run a public lookup or use the synthetic demo case."
            />
          )}
          <div className="panel-footnote">
            These relationships do not establish a common operator. Review the source and
            observation time.
          </div>
        </section>
      ) : (
        <div className="intelligence-layout">
          <section className="panel indicator-list">
            <SectionTitle
              title="Saved observations"
              description={`${c.lookups.length} observations in this case`}
            />
            {c.lookups.map((l) => (
              <button
                key={l.id}
                className={current?.id === l.id ? 'selected' : ''}
                onClick={() => setSelected(l.id)}
              >
                <span className="indicator-symbol">
                  {l.type === 'domain' ? <Globe2 size={21} /> : <Server size={21} />}
                </span>
                <div>
                  <strong>{l.indicator}</strong>
                  <small>
                    {l.type === 'domain' ? 'Domain' : 'IP address'} ·{' '}
                    {l.mode === 'fixture' ? 'Synthetic fixture' : 'Live public data'}
                  </small>
                </div>
                <ArrowUpRight size={15} />
              </button>
            ))}
            {!c.lookups.length && (
              <Empty
                title="No saved lookups"
                description="Enter an indicator to collect available public records."
              />
            )}
            <div className="indicator-context">
              <h3>Submitted indicators</h3>
              {c.indicators.map((i) => (
                <button key={i.id} onClick={() => inspect({ kind: 'evidence', id: i.sourceId })}>
                  <span>
                    {i.value}
                    <small>{i.relation || i.type}</small>
                  </span>
                  <Link2 size={14} />
                </button>
              ))}
            </div>
          </section>
          <section className="panel lookup-detail">
            {current ? (
              <>
                <div className="lookup-heading">
                  <span className="large-icon">
                    {current.type === 'domain' ? <Globe2 size={26} /> : <Server size={26} />}
                  </span>
                  <div>
                    <h2>{current.indicator}</h2>
                    <p>
                      <Clock3 size={13} />
                      Observed {time(current.observedAt)} IST
                    </p>
                  </div>
                  <Badge tone={current.mode === 'fixture' ? 'amber' : 'teal'}>
                    {current.mode === 'fixture' ? 'Synthetic fixture' : 'Live public data'}
                  </Badge>
                </div>
                <div className="lookup-fields">
                  {Object.entries(current.fields).map(([k, v]) => (
                    <div key={k}>
                      <span>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                <div className="record-heading">
                  <h3>Available records</h3>
                  <Badge>{current.status}</Badge>
                </div>
                <div className="dns-records">
                  {current.records.map((r, i) => (
                    <div className="dns-record" key={i}>
                      <Badge tone={r.type === 'CT' ? 'purple' : 'neutral'}>{r.type}</Badge>
                      <div>
                        {['RDAP', 'BGP'].includes(r.type) ? (
                          <details>
                            <summary>View raw provider response</summary>
                            <pre>{JSON.stringify(JSON.parse(r.value), null, 2)}</pre>
                          </details>
                        ) : (
                          <strong className="mono">{r.value}</strong>
                        )}
                        {/^https:\/\//.test(r.source) ? (
                          <a href={r.source} target="_blank" rel="noreferrer">
                            View source
                            <ArrowUpRight size={12} />
                          </a>
                        ) : (
                          <small>{r.source}</small>
                        )}
                      </div>
                    </div>
                  ))}
                  {!current.records.length && (
                    <p className="muted">
                      No public records returned. The lookup errors are preserved below.
                    </p>
                  )}
                </div>
                <div className="lookup-warnings">
                  {current.warnings.map((w) => (
                    <Notice key={w} tone={current.mode === 'fixture' ? 'warning' : 'info'}>
                      {w}
                    </Notice>
                  ))}
                </div>
                <Button onClick={() => inspect({ kind: 'evidence', id: `EV-${current.id}` })}>
                  Open saved evidence
                  <ArrowUpRight size={15} />
                </Button>
              </>
            ) : (
              <Empty
                title="Investigate an indicator"
                description="Select a saved observation or run a public lookup to inspect sources and limitations."
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
