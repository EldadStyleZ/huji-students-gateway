import { AppError } from './domain.mjs';
export async function rawBody(req, max = 16384) {
  if (Number(req.headers['content-length']) > max) throw new AppError(413, 'request-too-large');
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > max) throw new AppError(413, 'request-too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}
