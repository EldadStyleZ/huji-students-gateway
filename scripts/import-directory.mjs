import { readFile, writeFile } from 'node:fs/promises';
import { validateDirectory } from '../src/domain.mjs';
// RFC-style quoted CSV fields, including escaped quotes and embedded newlines.
function parseCsv(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if (c === '\n' && !quoted) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((row) => row.some(Boolean));
}
const [source, target] = process.argv.slice(2);
if (!source || !target)
  throw new Error('Usage: node scripts/import-directory.mjs source.csv output.json');
const [headers, ...rows] = parseCsv((await readFile(source, 'utf8')).replace(/^\uFEFF/, ''));
const entries = rows.map((values) => {
  if (values.length !== headers.length) throw new Error('CSV row has incorrect column count');
  const r = Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
  return {
    id: r.id,
    roleId: r.role_id,
    name: { he: r.name_he, en: r.name_en },
    email: r.email,
    topicIds: r.topic_ids.split(';'),
    campusIds: r.campus_ids.split(';'),
    approved: r.approved === 'true',
    approvedBy: r.approved_by,
    validUntil: r.valid_until || '1970-01-01T00:00:00Z',
    responsibilityExamples: r.responsibility_examples,
    exceptions: r.exceptions,
    universityHandoff: r.university_handoff,
  };
});
const directory = { version: `import-${new Date().toISOString()}`, entries };
validateDirectory(directory);
// Review output before replacing config/directory.json; import never approves rows.
await writeFile(target, JSON.stringify(directory, null, 2), { flag: 'wx' });
console.log(`Wrote ${entries.length} directory entries to ${target}`);
