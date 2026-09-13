import { createHash } from 'node:crypto';
import { topics, campuses, roles, resolveRoute } from '../public/routing.js';
export class AppError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
export const emailValid = (value) =>
  typeof value === 'string' &&
  value.length <= 254 &&
  /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(value);
export function validateDirectory(directory) {
  if (typeof directory.version !== 'string' || !Array.isArray(directory.entries))
    throw new Error('Invalid directory');
  const ids = new Set();
  for (const entry of directory.entries) {
    if (!entry.id || ids.has(entry.id)) throw new Error('Duplicate/missing directory id');
    ids.add(entry.id);
    if (
      !Object.hasOwn(roles, entry.roleId) ||
      !emailValid(entry.email) ||
      !entry.name?.he ||
      !entry.name?.en ||
      !Array.isArray(entry.topicIds) ||
      !entry.topicIds.length ||
      !Array.isArray(entry.campusIds) ||
      !entry.campusIds.length
    )
      throw new Error(`Invalid directory entry ${entry.id}`);
    if (
      entry.topicIds.some((id) => id !== '*' && !topics.some((t) => t.id === id)) ||
      entry.campusIds.some((id) => id !== '*' && !campuses.some((c) => c.id === id))
    )
      throw new Error(`Unknown scope: ${entry.id}`);
    if (
      entry.approved &&
      (!entry.approvedBy ||
        !Number.isFinite(Date.parse(entry.validUntil)) ||
        entry.email.endsWith('.invalid'))
    )
      throw new Error(`Invalid approved entry: ${entry.id}`);
  }
}
export function destinationFor(input, directory, now = new Date()) {
  const route = resolveRoute(input);
  if (route.status !== 'example') throw new AppError(422, route.status);
  const active = directory.entries.filter((e) => e.approved && new Date(e.validUntil) > now);
  const candidates = active.filter(
    (e) =>
      (e.campusIds.includes(input.campus) || e.campusIds.includes('*')) &&
      (e.topicIds.includes(input.topicId) || e.topicIds.includes('*')),
  );
  const rank = (e) =>
    (e.topicIds.includes(input.topicId) ? 4 : 0) +
    (e.campusIds.includes(input.campus) ? 2 : 0) +
    (e.roleId === route.roleId ? 1 : 0);
  const sorted = candidates.sort((a, b) => rank(b) - rank(a));
  const entry = sorted[0];
  // Ambiguous routing is a configuration failure, never arbitrary assignment.
  if (!entry) throw new AppError(503, 'destination-unavailable');
  if (sorted[1] && rank(entry) === rank(sorted[1])) throw new AppError(503, 'ambiguous-directory');
  if (
    !entry.topicIds.includes(input.topicId) &&
    entry.roleId !== 'triage' &&
    entry.roleId !== route.roleId
  )
    throw new AppError(503, 'destination-unavailable');
  return {
    id: entry.id,
    roleId: entry.roleId,
    name: entry.name,
    email: entry.email,
    directoryVersion: directory.version,
  };
}
export function ticketInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new AppError(400, 'invalid-request');
  const allowed = [
    'topicId',
    'campus',
    'registrationIssue',
    'description',
    'name',
    'consent',
    'lang',
    'destinationId',
    'directoryVersion',
    'noticeVersion',
  ];
  if (Object.keys(body).some((k) => !allowed.includes(k))) throw new AppError(400, 'unknown-field');
  if (
    (body.noticeVersion !== undefined &&
      (typeof body.noticeVersion !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(body.noticeVersion))) ||
    typeof body.description !== 'string' ||
    !body.description.trim() ||
    body.description.length > 3000 ||
    typeof (body.name ?? '') !== 'string' ||
    (body.name ?? '').length > 100 ||
    body.consent !== true ||
    !['he', 'en'].includes(body.lang)
  )
    throw new AppError(422, 'invalid-fields');
  if (
    typeof body.destinationId !== 'string' ||
    body.destinationId.length > 100 ||
    typeof body.directoryVersion !== 'string' ||
    body.directoryVersion.length > 100
  )
    throw new AppError(422, 'recipient-review-required');
  const result = {
    topicId: body.topicId,
    campus: body.campus,
    registrationIssue: body.topicId === 'course-registration' ? body.registrationIssue : '',
    description: body.description.trim(),
    name: (body.name || '').trim(),
    consent: true,
    lang: body.lang,
    destinationId: body.destinationId,
    directoryVersion: body.directoryVersion,
    ...(body.noticeVersion ? { noticeVersion: body.noticeVersion } : {}),
  };
  if (resolveRoute(result).status !== 'example') throw new AppError(422, 'incomplete-route');
  return result;
}
export const fingerprint = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
