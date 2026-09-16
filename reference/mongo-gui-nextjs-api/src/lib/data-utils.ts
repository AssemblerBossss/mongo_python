/**
 * Converts an array of documents to a CSV string.
 * Handles nested objects by JSON-stringifying them.
 */
export function convertToCSV(docs: Record<string, unknown>[]): string {
  if (!docs || docs.length === 0) return '';

  const headers = Array.from(new Set(docs.flatMap(d => Object.keys(d))));
  const escape  = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = docs.map(doc => headers.map(h => escape(doc[h])).join(','));
  return [headers.join(','), ...rows].join('\n');
}
