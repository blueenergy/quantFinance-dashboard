function normalizeLevel(rawLevel) {
  if (rawLevel === undefined || rawLevel === null) return null
  const level = String(rawLevel).trim().toLowerCase()
  return level || null
}

export function getUserServiceLevel(user) {
  const rawLevel = user?.service_level ?? user?.serviceLevel
  return normalizeLevel(rawLevel)
}

export function isAdminUser(user) {
  return user?.is_admin === true
}

// Fail-open by default: when user profile hasn't loaded level yet, do not block paid users accidentally.
export function canUseProFeature(user, options = {}) {
  const { failOpen = true } = options

  if (isAdminUser(user)) return true

  const level = getUserServiceLevel(user)
  if (!level) return failOpen

  return level !== 'free'
}

