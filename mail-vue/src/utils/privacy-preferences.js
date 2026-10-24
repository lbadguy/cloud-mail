export const privacyAccountKey = user => String(user.userId || user.email || 'anonymous')
export const isReadingProtected = (preferences, key) => preferences[key] !== false
