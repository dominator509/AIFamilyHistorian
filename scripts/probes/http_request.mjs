import { URL } from 'node:url';

const MAX_RESPONSE_BYTES = 1 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`provider probe: ${name} is required`);
  return value;
}

function boundedHeader(value, name) {
  if (
    value.length > 4096 ||
    [...value].some(
      (character) =>
        (character.codePointAt(0) ?? 0) < 0x20 || (character.codePointAt(0) ?? 0) === 0x7f,
    )
  )
    throw new Error(`provider probe: ${name} is invalid`);
  return value;
}

function buildRequest() {
  const url = new URL(required('PROBE_URL'));
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new Error('provider probe: URL is invalid');
  if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('provider probe: insecure URL is not local');

  const headers = {};
  if (process.env.PROBE_HEADERS_JSON) {
    let parsed;
    try {
      parsed = JSON.parse(process.env.PROBE_HEADERS_JSON);
    } catch {
      throw new Error('provider probe: headers are invalid');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('provider probe: headers are invalid');
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') throw new Error('provider probe: headers are invalid');
      headers[name] = boundedHeader(value, name);
    }
  }

  const secretEnv = process.env.PROBE_SECRET_ENV;
  if (secretEnv) {
    const secret = boundedHeader(required(secretEnv), secretEnv);
    const headerName = boundedHeader(required('PROBE_HEADER_NAME'), 'PROBE_HEADER_NAME');
    headers[headerName] = boundedHeader(
      `${process.env.PROBE_HEADER_PREFIX ?? ''}${secret}`,
      headerName,
    );
  }

  const basicUserEnv = process.env.PROBE_BASIC_USER_ENV;
  if (basicUserEnv) {
    const user = boundedHeader(required(basicUserEnv), basicUserEnv);
    const password = process.env.PROBE_BASIC_PASSWORD_ENV
      ? boundedHeader(
          required(process.env.PROBE_BASIC_PASSWORD_ENV),
          process.env.PROBE_BASIC_PASSWORD_ENV,
        )
      : '';
    headers.authorization = `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
  }

  let body;
  if (process.env.PROBE_FORM_SECRET_ENV) {
    body = new URLSearchParams({
      secret: required(process.env.PROBE_FORM_SECRET_ENV),
      response: process.env.PROBE_FORM_RESPONSE ?? 'preflight-invalid-token',
    }).toString();
    headers['content-type'] = 'application/x-www-form-urlencoded';
  } else if (process.env.PROBE_BODY) {
    body = process.env.PROBE_BODY;
    if (!headers['content-type']) headers['content-type'] = 'application/json';
  }

  return {
    url,
    init: {
      method: process.env.PROBE_METHOD ?? (body ? 'POST' : 'GET'),
      headers,
      ...(body === undefined ? {} : { body }),
      redirect: 'error',
      signal: AbortSignal.timeout(Number(process.env.PROBE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)),
    },
  };
}

async function consumeBounded(response) {
  if (!response.body) return;
  const reader = response.body.getReader();
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return;
      total += next.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error('provider probe: response exceeds 1 MiB');
    }
  } finally {
    reader.releaseLock();
  }
}

const request = buildRequest();
const response = await fetch(request.url, request.init);
await consumeBounded(response);
if (!response.ok) throw new Error(`provider probe: HTTP ${response.status}`);
console.log('provider probe: ok');
