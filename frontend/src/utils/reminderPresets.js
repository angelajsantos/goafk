export const REMINDER_PRESETS = {
  casual: {
    label: 'Casual',
    intervalMinutes: 45,
    breakDurationMinutes: 10,
    reminderMode: 'gentle',
    description: 'Longer stretches with a roomier reset.',
  },
  focused: {
    label: 'Focused',
    intervalMinutes: 60,
    breakDurationMinutes: 5,
    reminderMode: 'focus',
    description: 'Fewer nudges, quick breaks, stay locked in.',
  },
  balanced: {
    label: 'Balanced',
    intervalMinutes: 30,
    breakDurationMinutes: 5,
    reminderMode: 'balanced',
    description: 'A steady rhythm for most sessions.',
  },
  custom: {
    label: 'Custom',
    description: 'Fine-tune the timing yourself.',
  },
}

export function applyReminderPreset(presetKey, currentSettings) {
  const preset = REMINDER_PRESETS[presetKey]
  if (!preset || presetKey === 'custom') {
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
    reminderPreset: presetKey,
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
