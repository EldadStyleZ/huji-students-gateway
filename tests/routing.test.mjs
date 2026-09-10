import test from 'node:test';
import assert from 'node:assert/strict';
import { suggest, resolveRoute, shareUrl, topicFromUrl } from '../public/routing.js';
import { destinationFor, ticketInput, validateDirectory } from '../src/domain.mjs';
import { classify, validatePrediction, redactObviousIdentifiers } from '../src/ai.mjs';
const input = { topicId: 'course-registration', campus: 'givat-ram', registrationIssue: 'payment' };
const entry = {
  id: 'academic-givat',
  roleId: 'academic',
  name: { he: 'אקדמיה', en: 'Academic' },
  email: 'academic@example.org',
  topicIds: ['course-registration'],
  campusIds: ['givat-ram'],
  approved: true,
  approvedBy: 'test',
  validUntil: '2099-01-01',
};
test('Hebrew prefixes and English course registration produce useful suggestions', () => {
  assert.equal(suggest('אני לא מצליח להירשם לקורס')[0].topicId, 'course-registration');
  assert.equal(suggest('course registration is blocked')[0].topicId, 'course-registration');
});
test('no accidental English substring matching', () =>
  assert.deepEqual(suggest('a discourse on repairs'), []));
test('multiple issues remain selectable', () => {
  const ids = suggest('מילואים ובחינה').map((x) => x.topicId);
  assert.ok(ids.includes('reserve-support'));
  assert.ok(ids.includes('exam-appeal'));
});
test('payment status is never inferred from natural language', () =>
  assert.equal(
    resolveRoute({ topicId: 'course-registration', campus: 'givat-ram' }).status,
    'needs-question',
  ));
test('registration branch gives payment office only after explicit choice', () => {
  assert.equal(resolveRoute(input).university.name.en, 'Tuition office');
  assert.equal(resolveRoute({ ...input, registrationIssue: 'unknown' }).university, null);
});
test('unknown campus preserves a triage path', () =>
  assert.equal(resolveRoute({ ...input, campus: 'unknown' }).roleId, 'triage'));
test('malformed campus and unknown topics are rejected', () => {
  assert.equal(resolveRoute({ ...input, campus: 'invented' }).status, 'needs-campus');
  assert.equal(resolveRoute({ ...input, topicId: 'invented' }).status, 'invalid');
});
test('share links exclude personal input and reject unknown deep links', () => {
  const result = shareUrl(
    'https://example.org/?email=private@example.org&text=secret',
    'course-registration',
    'he',
  );
  assert.ok(!result.includes('secret'));
  assert.ok(!result.includes('private'));
  assert.equal(topicFromUrl(result), 'course-registration');
  assert.equal(topicFromUrl('https://example.org/?topic=unknown'), null);
});
test('only current approved contacts can receive a request', () => {
  assert.equal(destinationFor(input, { version: '1', entries: [entry] }).email, entry.email);
  assert.throws(() =>
    destinationFor(input, { version: '1', entries: [{ ...entry, approved: false }] }),
  );
  assert.throws(() =>
    destinationFor(input, { version: '1', entries: [{ ...entry, validUntil: '2020-01-01' }] }),
  );
});
test('ambiguous contacts fail closed instead of selecting arbitrary recipient', () =>
  assert.throws(
    () => destinationFor(input, { version: '1', entries: [entry, { ...entry, id: 'duplicate' }] }),
    /ambiguous-directory/,
  ));
test('specific route beats a general fallback', () => {
  const fallback = { ...entry, id: 'triage', roleId: 'triage', campusIds: ['*'], topicIds: ['*'] };
  assert.equal(destinationFor(input, { version: '1', entries: [fallback, entry] }).id, entry.id);
});
test('placeholder recipient cannot be approved', () =>
  assert.throws(() =>
    validateDirectory({ version: '1', entries: [{ ...entry, email: 'a@example.invalid' }] }),
  ));
test('clients cannot supply recipient email or owner ID', () =>
  assert.throws(() =>
    ticketInput({
      ...input,
      description: 'Help',
      name: '',
      consent: true,
      lang: 'en',
      email: 'attacker@example.org',
    }),
  ));
test('whitespace issue and missing consent rejected', () => {
  assert.throws(() => ticketInput({ ...input, description: '   ', consent: true, lang: 'en' }));
  assert.throws(() => ticketInput({ ...input, description: 'Help', lang: 'en' }));
});
test('invalid model IDs and extra properties rejected', () => {
  for (const value of [
    { topicIds: ['invented'], abstain: false },
    { topicIds: ['housing'], abstain: false, email: 'evil@example.org' },
  ])
    assert.throws(() => validatePrediction(value));
});
test('model abstention does not invent a destination', () =>
  assert.deepEqual(validatePrediction({ topicIds: [], abstain: true }), []));
test('model failures fall back to keywords', async () => {
  const result = await classify(
    'course registration',
    { aiBase: 'http://localhost/v1', aiModel: 'test' },
    {
      fetchImpl: async () => {
        throw new Error('timeout');
      },
    },
  );
  assert.equal(result.method, 'keywords');
  assert.equal(result.fallback, true);
  assert.equal(result.suggestions[0].topicId, 'course-registration');
});
test('valid constrained model result accepted without a confidence claim', async () => {
  const result = await classify(
    'help',
    { aiBase: 'http://localhost/v1', aiModel: 'test' },
    {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: JSON.stringify({ topicIds: ['housing'], abstain: false }) } },
          ],
        }),
      }),
    },
  );
  assert.equal(result.method, 'model');
  assert.equal(result.suggestions[0].topicId, 'housing');
  assert.equal(result.suggestions[0].confidence, undefined);
});
test('obvious contact identifiers removed from model input', () => {
  const text = redactObviousIdentifiers('email me at name@example.org 054-123-4567');
  assert.ok(!text.includes('name@example.org'));
  assert.ok(!text.includes('054'));
});

test('repeated valid model labels are normalized safely', () =>
  assert.deepEqual(validatePrediction({ topicIds: ['housing', 'housing'], abstain: false }), [
    'housing',
  ]));
