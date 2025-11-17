const resolveApiRoot = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL
  if (envBase && typeof envBase === 'string') {
    return envBase.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`
  }

  return '/api'
}

const API_BASE_URL = resolveApiRoot()

export const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const withoutApiPrefix = normalizedPath.startsWith('/api/')
    ? normalizedPath.slice(4)
    : normalizedPath
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL
  return `${base}${withoutApiPrefix}`
}

export const getApiBaseUrl = () => API_BASE_URL
