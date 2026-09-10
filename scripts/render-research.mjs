import { readFile, writeFile } from 'node:fs/promises';
const { marked } = await import(process.env.MARKED_MODULE || 'marked');
const markdown = await readFile(new URL('../docs/research.md', import.meta.url), 'utf8');
let content = marked.parse(markdown);
const sections = [];
content = content.replace(/<h2>(.*?)<\/h2>/g, (_, text) => {
  const id = `section-${sections.length + 1}`;
  sections.push({ text, id });
  return `<h2 id="${id}">${text}</h2>`;
});
const page = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Student support gateway research</title><style>
*{box-sizing:border-box}body{margin:0;color:#242724;background:#fff;font:16px/1.75 system-ui,-apple-system,sans-serif}header{border-bottom:1px solid #ddd;padding:20px 5%;font-size:13px}header a{color:#333}a{color:#235447;text-underline-offset:3px}main{max-width:1250px;margin:50px auto;display:grid;grid-template-columns:215px minmax(0,850px);gap:65px;padding:0 30px}aside{font-size:12px;position:sticky;top:25px;align-self:start}aside strong{display:block;margin-bottom:12px}aside a{display:block;margin-bottom:12px;text-decoration:none;color:#555;line-height:1.5}h1{font-size:40px;line-height:1.2;letter-spacing:-1.2px;font-weight:650;margin:0 0 50px}h2{font-size:26px;line-height:1.4;font-weight:600;margin:52px 0 22px;padding-top:20px;border-top:1px solid #ddd}p{margin:0 0 19px}table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.65;margin:27px 0}th,td{border:1px solid #d7dad7;padding:13px;text-align:left;vertical-align:top}th{background:#f0f2ef;font-weight:600}td:first-child{min-width:135px}code{font-size:.9em;background:#f1f2ef;padding:2px 4px;overflow-wrap:anywhere}li{margin-bottom:10px}article{min-width:0}article>ol:last-child{font-size:13px;padding-left:23px}.note{color:#555;font-size:12px;margin-bottom:24px}@media(max-width:900px){main{display:block;margin:25px auto;padding:0 20px}aside{position:static;border-bottom:1px solid #ddd;margin-bottom:30px;padding-bottom:15px}aside a{display:inline-block;margin:4px 15px 4px 0}h1{font-size:32px}table{display:block;overflow-x:auto}h2{font-size:23px}}@media print{header,aside{display:none}main{display:block;margin:0;padding:0}body{font-size:10pt;line-height:1.5}h1{font-size:24pt}h2{break-after:avoid;font-size:16pt}tr{break-inside:avoid}table{font-size:9pt}a{color:inherit}}
</style></head><body><header><a href="/">← Student gateway</a></header><main><aside><strong>Contents</strong>${sections.map((s) => `<a href="#${s.id}">${s.text}</a>`).join('')}</aside><article>${content}</article></main></body></html>`;
await writeFile(new URL('../public/research.html', import.meta.url), page);
console.log(`Rendered ${sections.length} research sections.`);
