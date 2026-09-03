export async function fetchJson(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const init = {
    ...options,
    credentials: 'include',
    headers,
  }

  if (init.body && !(init.body instanceof FormData) && typeof init.body !== 'string') {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(init.body)
  }

  const response = await fetch(path, init)
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = data?.error || data?.status || data?.message || `HTTP ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export function publicShareUrl(publicToken) {
  return `${window.location.origin}/share/${publicToken}`
}
