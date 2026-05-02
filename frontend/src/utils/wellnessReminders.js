export const WELLNESS_REMINDER_TYPES = {
  eye: {
    label: 'Eye reset',
    statLabel: 'Eye reminders',
    title: '20-20-20 eye reset',
    message: 'Look at something farther away for 20 seconds. Tiny reset, then back to the run.',
    doneLabel: 'Done',
    skipLabel: 'Skip',
  },
  posture: {
    label: 'Posture check',
    statLabel: 'Posture checks',
    title: 'Posture check',
    message: 'Relax your shoulders, unclench your hands, and settle back in comfortably.',
    doneLabel: 'Done',
    skipLabel: 'Skip',
  },
  walk: {
    label: 'Two-minute walk and stretch break',
    statLabel: 'Walk and stretch reminders',
    title: 'Two-minute walk and stretch',
    message: 'A short lap, water refill, or doorway stretch can help the next match feel better.',
    doneLabel: 'Done',
    skipLabel: 'Skip',
  },
}

export const WELLNESS_INTENSITIES = {
  gentle: {
    label: 'Gentle',
    description: 'Fewer nudges for relaxed sessions.',
    snoozeMinutes: 10,
    intervals: {
      eye: 30,
      posture: 45,
      walk: 90,
    },
  },
  balanced: {
    label: 'Balanced',
    description: 'A steady companion rhythm for most play sessions.',
    snoozeMinutes: 7,
    intervals: {
      eye: 20,
      posture: 40,
      walk: 60,
    },
  },
  active: {
    label: 'Active',
    description: 'More frequent check-ins for high-focus sessions.',
    snoozeMinutes: 5,
    intervals: {
      eye: 20,
      posture: 30,
      walk: 60,
    },
  },
}

export const defaultWellnessReminderTypes = {
  eye: true,
  posture: true,
  stretch: true,
  walk: true,
}

export const defaultWellnessCounts = {
  completed: 0,
  skipped: 0,
  byType: Object.keys(WELLNESS_REMINDER_TYPES).reduce((counts, type) => {
    counts[type] = { completed: 0, skipped: 0 }
    return counts
  }, {}),
}

export function normalizeWellnessPreferences(settings = {}) {
  const intensity = WELLNESS_INTENSITIES[settings.wellnessIntensity]
    ? settings.wellnessIntensity
    : 'balanced'

  return {
    enabled: settings.wellnessRemindersEnabled !== false,
    intensity,
    activeTypes: {
      ...defaultWellnessReminderTypes,
      ...(settings.wellnessReminderTypes || {}),
    },
  }
}

export function getActiveWellnessTypes(settings = {}) {
  const preferences = normalizeWellnessPreferences(settings)
  if (!preferences.enabled) return []

  return Object.keys(WELLNESS_REMINDER_TYPES).filter((type) => preferences.activeTypes[type])
}

export function getWellnessIntervalSeconds(type, settings = {}) {
  const preferences = normalizeWellnessPreferences(settings)
  const minutes = WELLNESS_INTENSITIES[preferences.intensity]?.intervals?.[type] || 60
  return Math.max(60, Math.round(minutes * 60))
}

export function getWellnessSnoozeSeconds(settings = {}) {
  const preferences = normalizeWellnessPreferences(settings)
  const minutes = WELLNESS_INTENSITIES[preferences.intensity]?.snoozeMinutes || 7
  return Math.max(60, Math.round(minutes * 60))
}

export function createWellnessSchedule(settings = {}, startAtSeconds = 0) {
  return getActiveWellnessTypes(settings).reduce((schedule, type) => {
    schedule[type] = startAtSeconds + getWellnessIntervalSeconds(type, settings)
    return schedule
  }, {})
}

export function createWellnessScheduleFromSession(session = {}, settings = {}, elapsedSeconds = 0) {
  const startedAt = session.startedAt ? new Date(session.startedAt) : null
  const reminders = Array.isArray(session.wellnessReminders) ? session.wellnessReminders : []

  if (!startedAt || Number.isNaN(startedAt.getTime())) {
    return createWellnessSchedule(settings, elapsedSeconds)
  }

  return getActiveWellnessTypes(settings).reduce((schedule, type) => {
    const intervalSeconds = getWellnessIntervalSeconds(type, settings)
    const lastReminder = reminders
      .filter((entry) => entry.reminderType === type && entry.remindedAt)
      .sort((a, b) => new Date(b.remindedAt) - new Date(a.remindedAt))[0]

    if (!lastReminder) {
      schedule[type] = intervalSeconds
      return schedule
    }

    const remindedAt = new Date(lastReminder.remindedAt)
    const remindedElapsedSeconds = Math.max(0, Math.floor((remindedAt - startedAt) / 1000))
    schedule[type] = Math.max(intervalSeconds, remindedElapsedSeconds + intervalSeconds)
    return schedule
  }, {})
}

export function getWellnessCounts(session = {}) {
  const byType = Object.keys(WELLNESS_REMINDER_TYPES).reduce((counts, type) => {
    counts[type] = {
      completed: Number(session[`${type}RemindersCompleted`]) || 0,
      skipped: Number(session[`${type}RemindersSkipped`]) || 0,
    }
    return counts
  }, {})

  if (session.postureChecksCompleted !== undefined || session.postureChecksSkipped !== undefined) {
    byType.posture = {
      completed: Number(session.postureChecksCompleted) || 0,
      skipped: Number(session.postureChecksSkipped) || 0,
    }
  }

  if (session.walkRemindersCompleted !== undefined || session.walkRemindersSkipped !== undefined) {
    byType.walk = {
      completed: Number(session.walkRemindersCompleted) || 0,
      skipped: Number(session.walkRemindersSkipped) || 0,
    }
  }

  const completed = Object.values(byType).reduce((sum, entry) => sum + entry.completed, 0)
  const skipped = Object.values(byType).reduce((sum, entry) => sum + entry.skipped, 0)

  return { completed, skipped, byType }
}

export function getNextWellnessReminder(settings = {}, schedule = {}) {
  const activeTypes = getActiveWellnessTypes(settings)
  if (!activeTypes.length) return null

  return activeTypes
    .map((type) => ({
      type,
      dueAt: Number(schedule[type]) || getWellnessIntervalSeconds(type, settings),
    }))
    .sort((a, b) => a.dueAt - b.dueAt)[0] || null
}
