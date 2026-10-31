// Cliente da API. Erros chegam como ApiError { status, code, field }.
export class ApiError extends Error {
  constructor(status, code, field) {
    super(code);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'INTERNAL_ERROR', data.field);
  return data;
}

let catalogPromise;
export function getCatalog(force) {
  if (!catalogPromise || force) catalogPromise = api('/api/catalog');
  return catalogPromise;
}

let settingsPromise;
export function getSettings() {
  settingsPromise ||= api('/api/settings/public');
  return settingsPromise;
}
