export const REMINDER_PRESETS = {
  tank: {
    label: 'Tank',
    subtitle: 'Marathon Play',
    intervalMinutes: 60,
    breakDurationMinutes: 12,
    reminderMode: 'gentle',
    description: 'Long queues, long runs, calm recovery windows.',
  },
  dps: {
    label: 'DPS',
    subtitle: 'High Intensity',
    intervalMinutes: 35,
    breakDurationMinutes: 5,
    reminderMode: 'focus',
    description: 'Shorter cycles for high-focus bursts and fast resets.',
  },
  support: {
    label: 'Support',
    subtitle: 'Sustain Play',
    intervalMinutes: 45,
    breakDurationMinutes: 8,
    reminderMode: 'balanced',
    description: 'Steady pacing for longer sessions without wearing down.',
  },
  captain: {
    label: 'Captain',
    subtitle: 'Strategic Pace',
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
