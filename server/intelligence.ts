import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import type { Lookup } from '../shared/types';

async function json(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Trace-X-Hackathon/0.1 (passive public intelligence)',
    },
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('Provider response exceeds size limit');
  return JSON.parse(text);
}
export function validateIndicator(input: string): { value: string; type: 'domain' | 'ip' } {
  const value = domainToASCII(input.trim().toLowerCase().replace(/\.$/, ''));
  if (isIP(input.trim())) return { value: input.trim().toLowerCase(), type: 'ip' };
  if (
    value.length > 253 ||
    !value.includes('.') ||
    !value.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw new Error('Enter a domain name or IPv4/IPv6 address, without a URL path.');
  if (/\.(example|invalid|test|localhost)$/.test(value))
    throw new Error(
      'Reserved demo names cannot be looked up live. Select a saved synthetic fixture instead.',
    );
  return { value, type: 'domain' };
}
export async function lookupIndicator(input: string): Promise<Lookup> {
  const { value, type } = validateIndicator(input);
  const result: Lookup = {
    id: randomUUID(),
    indicator: value,
    type,
    observedAt: new Date().toISOString(),
    mode: 'live',
    status: 'complete',
    fields: {},
    records: [],
    warnings: [],
  };
  const jobs: Promise<void>[] = [];
  const rdapUrl = `https://rdap.org/${type === 'domain' ? 'domain' : 'ip'}/${encodeURIComponent(value)}`;
  jobs.push(
    (async () => {
      try {
        const data = await json(rdapUrl);
        result.fields['RDAP source'] = rdapUrl;
        if (type === 'domain') {
          const registrar = data.entities?.find((e: any) => e.roles?.includes('registrar'));
          const fn = registrar?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3];
          result.fields.Registrar = fn || registrar?.handle || 'Not supplied';
          result.fields.Registered =
            data.events?.find((e: any) => e.eventAction === 'registration')?.eventDate ||
            'Not supplied';
          result.fields.Expiry =
            data.events?.find((e: any) => e.eventAction === 'expiration')?.eventDate ||
            'Not supplied';
          result.fields['Registrant / subscriber'] =
            'Non-public details require the applicable lawful process';
        } else {
          result.fields.Network = data.name || data.handle || 'Not supplied';
          result.fields.Range = `${data.startAddress || '?'} – ${data.endAddress || '?'}`;
          result.fields['Registration country'] = data.country || 'Not supplied';
        }
        result.records.push({ type: 'RDAP', value: JSON.stringify(data), source: rdapUrl });
      } catch (e) {
        result.warnings.push(`RDAP unavailable: ${(e as Error).message}`);
      }
    })(),
  );
  if (type === 'domain') {
    for (const record of ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'])
      jobs.push(
        (async () => {
          const source = `https://dns.google/resolve?name=${encodeURIComponent(value)}&type=${record}`;
          try {
            const data = await json(source);
            if (data.Status !== 0) {
              result.warnings.push(`${record}: DNS resolver status ${data.Status}.`);
              return;
            }
            for (const answer of data.Answer || [])
              result.records.push({ type: record, value: answer.data, source });
          } catch (e) {
            result.warnings.push(`${record} lookup unavailable: ${(e as Error).message}`);
          }
        })(),
      );
    jobs.push(
      (async () => {
        const source = `https://crt.sh/?q=${encodeURIComponent('%.' + value)}&output=json`;
        try {
          const entries = await json(source);
          const names = [
            ...new Set<string>(
              (entries as any[]).flatMap((e) => String(e.name_value || '').split('\n')),
            ),
          ].filter(Boolean);
          for (const name of names.slice(0, 100))
            result.records.push({ type: 'CT', value: name, source });
          result.fields['Certificate names returned'] =
            `${names.length}${names.length > 100 ? ' (first 100 shown)' : ''}`;
        } catch (e) {
          result.warnings.push(`Certificate Transparency unavailable: ${(e as Error).message}`);
        }
      })(),
    );
    result.warnings.push(
      'DNS is a current observation. Historical DNS is not supplied by this adapter. CT names do not establish active hosts or common ownership.',
    );
  } else {
    const resolver = new Resolver({ timeout: 2500, tries: 1 });
    jobs.push(
      (async () => {
        try {
          const hosts = await resolver.reverse(value);
          for (const host of hosts)
            result.records.push({
              type: 'PTR',
              value: host,
              source: 'System recursive DNS resolver',
            });
        } catch {
          result.warnings.push('Reverse DNS unavailable or no PTR record.');
        }
      })(),
    );
    jobs.push(
      (async () => {
        const source = `https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(value)}`;
        try {
          const response = await json(source);
          result.fields['Origin ASNs'] =
            (response.data?.asns || []).map((asn: string) => `AS${asn}`).join(', ') ||
            'Not supplied';
          result.fields['Announced prefix'] = response.data?.prefix || 'Not supplied';
          result.records.push({ type: 'BGP', value: JSON.stringify(response.data), source });
        } catch (e) {
          result.warnings.push(`ASN lookup unavailable: ${(e as Error).message}`);
        }
      })(),
    );
    result.fields['VPN / proxy / Tor'] = 'Unknown — no reputation provider configured';
    result.fields['Server geolocation'] = 'Not established';
    result.warnings.push(
      'Network registration and BGP data describe infrastructure, not subscriber identity or a person’s location. Dynamic/shared IPs require time-specific provider records.',
    );
  }
  await Promise.all(jobs);
  result.status = result.records.length
    ? result.warnings.some((w) => /unavailable|resolver status/.test(w))
      ? 'partial'
      : 'complete'
    : 'unavailable';
  return result;
}
