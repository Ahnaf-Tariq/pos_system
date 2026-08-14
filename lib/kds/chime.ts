export function playNewOrderChime() {
  if (typeof window === 'undefined') return

  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new AudioContextCtor()
    const now = context.currentTime

    ;[0, 0.12, 0.24].forEach((offset, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = index === 2 ? 880 : 660
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now + offset)
      oscillator.stop(now + offset + 0.16)
    })

    window.setTimeout(() => {
      void context.close()
    }, 600)
  } catch {
    // Audio may be blocked until user gesture — ignore.
  }
}
