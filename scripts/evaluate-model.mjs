import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { classify } from '../src/ai.mjs';
const cases = JSON.parse(await readFile(new URL('./eval-cases.json', import.meta.url), 'utf8'));
const config = {
  aiBase: process.env.AI_BASE_URL,
  aiModel: process.env.AI_MODEL,
  aiProtocol: process.env.AI_PROTOCOL || 'openai',
  aiTimeout: Number(process.env.AI_TIMEOUT_MS || 60000),
};
const results = [];
for (const item of cases) {
  const start = performance.now();
  const result = await classify(item.text, config);
  const ids = result.suggestions.map((s) => s.topicId);
  const abstained = ids.length === 0 || ids[0] === 'general-help';
  const top1 = item.abstain ? abstained : item.expected.includes(ids[0]);
  const covered = item.abstain ? abstained : item.expected.every((id) => ids.includes(id));
  results.push({
    id: item.id,
    lang: item.lang,
    expected: item.expected,
    suggested: ids,
    method: result.method,
    fallback: result.fallback,
    top1,
    covered,
    unexpectedSuggestions: ids.filter(
      (id) => !item.expected.includes(id) && !(item.abstain && id === 'general-help'),
    ).length,
    ms: Math.round(performance.now() - start),
  });
  console.log(
    `${item.id}: ${result.method}; ${ids.join(',') || 'abstain'}; ${results.at(-1).ms}ms`,
  );
}
const summarize = (rows) => ({
  count: rows.length,
  top1: rows.filter((r) => r.top1).length,
  allExpectedInTop3: rows.filter((r) => r.covered).length,
  unexpectedSuggestions: rows.reduce((sum, r) => sum + r.unexpectedSuggestions, 0),
  modelResponses: rows.filter((r) => r.method === 'model').length,
  p50ms: rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length * 0.5)],
  p95ms: rows.map((r) => r.ms).sort((a, b) => a - b)[
    Math.min(rows.length - 1, Math.floor(rows.length * 0.95))
  ],
});
const report = {
  model: config.aiModel || 'keyword-baseline',
  synthetic: true,
  notProductionValidation: true,
  createdAt: new Date().toISOString(),
  summary: summarize(results),
  byLanguage: Object.fromEntries(
    [...new Set(results.map((r) => r.lang))].map((lang) => [
      lang,
      summarize(results.filter((r) => r.lang === lang)),
    ]),
  ),
  results,
};
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
const output = new URL(
  `../artifacts/evaluation-${config.aiModel ? 'model' : 'keywords'}.json`,
  import.meta.url,
);
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary));
