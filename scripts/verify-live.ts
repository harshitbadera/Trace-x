import { lookupIndicator } from '../server/intelligence';
for (const indicator of ['example.com', '1.1.1.1']) {
  const result = await lookupIndicator(indicator);
  console.log(
    JSON.stringify({
      indicator,
      status: result.status,
      fields: Object.keys(result.fields),
      recordTypes: [...new Set(result.records.map((r) => r.type))],
      warnings: result.warnings,
    }),
  );
}
