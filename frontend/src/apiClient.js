const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const apiUrl = (path) => {
  if (!path.startsWith('/')) {
    path = `/${path}`
  }
  if (!API_BASE_URL) {
    return path
  }
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL
  return `${base}${path}`
}

export const getApiBaseUrl = () => API_BASE_URL || '/api'
