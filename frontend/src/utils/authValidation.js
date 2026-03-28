const EMAIL_PATTERN = /^(?=.{6,254}$)(?=.{1,64}@)(?!.*\.\.)([a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*)@((?!-)[a-zA-Z0-9-]+(?<!-)(?:\.(?!-)[a-zA-Z0-9-]+(?<!-))+)$/

export function isValidEmail(email = '') {
  const normalizedEmail = email.trim()
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return false
  }

  const domain = normalizedEmail.split('@')[1] || ''
  const topLevelDomain = domain.split('.').pop() || ''
  return topLevelDomain.length >= 2
}

export function validateSignupForm({ username, email, password }) {
  if (!username.trim()) {
    return 'Please enter a username.'
  }

  if (!email.trim()) {
    return 'Please enter an email address.'
  }

  if (!isValidEmail(email)) {
    return 'Please enter a valid email address.'
  }

  if (!password.trim()) {
    return 'Please enter a password.'
  }

  if (password.trim().length < 6) {
    return 'Password must be at least 6 characters.'
  }

  return ''
}

export function validateLoginForm({ email, password }) {
  if (!email.trim() || !password.trim()) {
    return 'Please enter both email and password.'
  }

  if (!isValidEmail(email)) {
    return 'Please enter a valid email address.'
  }

  return ''
}
