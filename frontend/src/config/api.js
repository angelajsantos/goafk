const rawApiUrl = import.meta.env.VITE_API_URL?.trim()

function getDefaultApiUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001'
  }

  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:3001`
}

export const API_BASE_URL = (rawApiUrl || getDefaultApiUrl()).replace(/\/+$/, '')
