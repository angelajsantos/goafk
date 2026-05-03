export function browserNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getBrowserNotificationPermission() {
  if (!browserNotificationsSupported()) return 'unsupported'
  return window.Notification.permission
}

export async function ensureBrowserNotificationPermission() {
  if (!browserNotificationsSupported()) return 'unsupported'

  if (window.Notification.permission === 'default') {
    return window.Notification.requestPermission()
  }

  return window.Notification.permission
}

export function sendBrowserNotification({ title, body, tag, silent = true }) {
  if (!browserNotificationsSupported() || window.Notification.permission !== 'granted') {
    return null
  }

  const notification = new window.Notification(title, {
    body,
    tag,
    icon: '/favicon.svg',
    silent,
  })

  notification.onclick = () => {
    window.focus()
    notification.close()
  }

  window.setTimeout(() => notification.close(), 9000)
  return notification
}
