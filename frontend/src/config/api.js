const rawApiUrl = import.meta.env.VITE_API_URL?.trim()

if (!rawApiUrl) {
  throw new Error('Missing VITE_API_URL. Set it in your frontend environment variables.')
}

export const API_BASE_URL = rawApiUrl.replace(/\/+$/, '')
