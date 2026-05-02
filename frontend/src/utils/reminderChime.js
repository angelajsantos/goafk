let audioContext = null

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null

  if (!audioContext) {
    audioContext = new AudioContext()
  }

  return audioContext
}

export async function prepareReminderChime() {
  const context = getAudioContext()
  if (!context) return false

  if (context.state === 'suspended') {
    await context.resume()
  }

  return true
}

export function playReminderChime() {
  const context = getAudioContext()
  if (!context) return

  if (context.state === 'suspended') {
    context.resume().catch(() => {})
  }

  const startedAt = context.currentTime + 0.02
  const masterGain = context.createGain()
  masterGain.gain.setValueAtTime(0.0001, startedAt)
  masterGain.gain.exponentialRampToValueAtTime(0.14, startedAt + 0.03)
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 1.15)
  masterGain.connect(context.destination)

  const notes = [
    { frequency: 659.25, delay: 0, duration: 0.42 },
    { frequency: 783.99, delay: 0.14, duration: 0.44 },
    { frequency: 1046.5, delay: 0.31, duration: 0.58 },
  ]

  notes.forEach(({ frequency, delay, duration }) => {
    const noteStart = startedAt + delay
    const noteEnd = noteStart + duration
    const oscillator = context.createOscillator()
    const overtone = context.createOscillator()
    const noteGain = context.createGain()
    const overtoneGain = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, noteStart)
    overtone.type = 'triangle'
    overtone.frequency.setValueAtTime(frequency * 2, noteStart)

    noteGain.gain.setValueAtTime(0.0001, noteStart)
    noteGain.gain.exponentialRampToValueAtTime(0.65, noteStart + 0.02)
    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)

    overtoneGain.gain.setValueAtTime(0.0001, noteStart)
    overtoneGain.gain.exponentialRampToValueAtTime(0.14, noteStart + 0.02)
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd - 0.05)

    oscillator.connect(noteGain)
    overtone.connect(overtoneGain)
    noteGain.connect(masterGain)
    overtoneGain.connect(masterGain)

    oscillator.start(noteStart)
    overtone.start(noteStart)
    oscillator.stop(noteEnd + 0.02)
    overtone.stop(noteEnd + 0.02)
  })
}
