export const REMINDER_PRESETS = {
  tank: {
    label: 'Tank',
    subtitle: 'Long Sessions',
    intervalMinutes: 60,
    breakDurationMinutes: 12,
    reminderMode: 'gentle',
    description: 'Long queues, long runs, calm recovery windows.',
  },
  dps: {
    label: 'DPS',
    subtitle: 'Focused',
    intervalMinutes: 35,
    breakDurationMinutes: 5,
    reminderMode: 'focus',
    description: 'Shorter cycles for high-focus bursts and fast resets.',
  },
  support: {
    label: 'Support',
    subtitle: 'Balanced',
    intervalMinutes: 30,
    breakDurationMinutes: 5,
    reminderMode: 'balanced',
    description: 'A steady default: a break check-in every 30 minutes with a 5-minute reset.',
  },
  captain: {
    label: 'Captain',
    subtitle: 'Relaxed',
    intervalMinutes: 55,
    breakDurationMinutes: 10,
    reminderMode: 'gentle',
    description: 'Room to think between matches and keep the calls sharp.',
  },
  custom: {
    label: 'Custom',
    subtitle: 'Your Rules',
    description: 'Fine-tune the timing yourself.',
  },
}

const REMINDER_PRESET_ALIASES = {
  casual: 'tank',
  focused: 'dps',
  balanced: 'support',
}

export const DEFAULT_REMINDER_PRESET = 'support'
export const DEFAULT_BREAK_REMINDER_INTERVAL_MINUTES = REMINDER_PRESETS[DEFAULT_REMINDER_PRESET].intervalMinutes
export const DEFAULT_PREFERRED_BREAK_DURATION_MINUTES = REMINDER_PRESETS[DEFAULT_REMINDER_PRESET].breakDurationMinutes

export function resolveReminderPresetKey(presetKey = '') {
  if (REMINDER_PRESETS[presetKey]) return presetKey
  return REMINDER_PRESET_ALIASES[presetKey] || 'custom'
}

export function applyReminderPreset(presetKey, currentSettings) {
  const resolvedPresetKey = resolveReminderPresetKey(presetKey)
  const preset = REMINDER_PRESETS[resolvedPresetKey]

  if (!preset || resolvedPresetKey === 'custom') {
    return {
      ...currentSettings,
      reminderPreset: 'custom',
    }
  }

  return {
    ...currentSettings,
    breakReminderIntervalMinutes: preset.intervalMinutes,
    preferredBreakDuration: preset.breakDurationMinutes,
    reminderMode: preset.reminderMode,
    reminderPreset: resolvedPresetKey,
    gentleReminderMode: preset.reminderMode === 'gentle',
    focusMode: preset.reminderMode === 'focus',
  }
}

export function syncReminderSettings(partialSettings, previousSettings) {
  const nextSettings = {
    ...previousSettings,
    ...partialSettings,
  }

  return {
    ...nextSettings,
    gentleReminderMode: nextSettings.reminderMode === 'gentle',
    focusMode: nextSettings.reminderMode === 'focus',
  }
}

export function normalizeReminderSettings(settings = {}) {
  const resolvedPresetKey = resolveReminderPresetKey(settings.reminderPreset || DEFAULT_REMINDER_PRESET)
  const preset = REMINDER_PRESETS[resolvedPresetKey]

  if (preset && resolvedPresetKey !== 'custom') {
    return syncReminderSettings(
      {
        ...settings,
        breakReminderIntervalMinutes: preset.intervalMinutes,
        preferredBreakDuration: preset.breakDurationMinutes,
        reminderMode: preset.reminderMode,
        reminderPreset: resolvedPresetKey,
      },
      settings
    )
  }

  const intervalMinutes = Math.max(
    0.1,
    Number(settings.breakReminderIntervalMinutes) || DEFAULT_BREAK_REMINDER_INTERVAL_MINUTES
  )
  const breakDurationMinutes = Math.max(
    1,
    Number(settings.preferredBreakDuration) || DEFAULT_PREFERRED_BREAK_DURATION_MINUTES
  )

  return syncReminderSettings(
    {
      ...settings,
      breakReminderIntervalMinutes: intervalMinutes,
      preferredBreakDuration: breakDurationMinutes,
      reminderMode: settings.reminderMode || REMINDER_PRESETS[DEFAULT_REMINDER_PRESET].reminderMode,
      reminderPreset: 'custom',
    },
    settings
  )
}
