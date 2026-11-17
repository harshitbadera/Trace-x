import type { CaseData } from './types';

/** Draft text only. A public lookup timestamp is never treated as an access-log event. */
export function requestDraft(c: CaseData, recipient: string, identifier: string) {
  const related = c.transactions
    .filter((t) => t.from === identifier || t.to === identifier || t.utr === identifier)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const timed = related.filter((t) => t.precision !== 'day');
  const one = timed.length === 1 ? timed[0] : undefined;
  const observation = c.lookups.find((l) => l.indicator === identifier);
  const sources = [...new Set(related.flatMap((t) => t.sources.map((s) => s.evidenceId)))];
  const indicatorSource = c.indicators.find((i) => i.value === identifier)?.sourceId;
  if (indicatorSource && !sources.includes(indicatorSource)) sources.push(indicatorSource);
  return `DRAFT FOR INVESTIGATOR REVIEW — NOT SENT

Case: ${c.id} / ${c.title}
Data: ${c.synthetic ? 'SYNTHETIC DEMONSTRATION' : 'USER-SUPPLIED CASE'}
To: ${recipient}
Subject: Request for records relevant to ${identifier}

Investigating authority: [Complete]
Officer and official contact: [Complete]
Applicable legal authority and approved channel: [Complete after review]

Identifier: ${identifier}
Exact transaction/event timestamp: ${one ? one.originalTimestamp : '[Select and verify the relevant event time from source evidence]'}
Original timezone / UTC offset: ${one ? one.timezone : '[Complete from the event source]'}
UTC equivalent: ${one ? one.timestamp : '[Complete after verifying the event timezone]'}
Requested time interval: [Complete and justify; the events below are context, not an automatically authorized request interval]
For shared-IP attribution, source port, destination IP/port and protocol, if available: [Complete]

${
  related.length
    ? `RELATED OBSERVED TRANSACTIONS
${related
  .slice(0, 50)
  .map(
    (t) =>
      `${t.utr || t.id}: ${t.from} -> ${t.to}; INR ${(t.amountPaise / 100).toFixed(2)}; original ${t.originalTimestamp}; timezone ${t.timezone}; UTC ${t.timestamp}; precision ${t.precision}`,
  )
  .join('\n')}
${related.length > 50 ? 'First 50 records shown. Refer to the complete evidence workbook.' : ''}
`
    : ''
}${
    observation
      ? `PUBLIC OBSERVATION CONTEXT
${observation.indicator} was looked up at ${observation.observedAt} (${observation.mode}). This is NOT a subscriber login/access event timestamp and cannot establish historical IP allocation.

`
      : ''
  }REQUEST SCOPE FOR REVIEW
Please provide the records authorized through the applicable lawful process for the specified identifier and interval. Select the relevant record categories and remove the others:
- Bank: relevant statement coverage, transaction references and beneficiary records.
- Registrar or hosting/network provider: time-specific allocation and relevant subscriber, login or access records, only where lawfully authorized.

Relevant source references: ${sources.length ? sources.join(', ') : '[Identify the supporting source evidence]'}
Case starting transaction reference: ${c.victimUtr || '[Not supplied]'}

Review the recipient, legal authority, event time, identifiers and scope before using an approved channel. This application neither sends this draft nor retrieves non-public subscriber records.
`;
}
