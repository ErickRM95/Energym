type AudioContextConstructor = typeof AudioContext;

function audioContext(): AudioContext | null {
  const scope = globalThis as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Context) return null;
  if (!shared) shared = new Context();
  return shared;
}

let shared: AudioContext | null = null;

export async function unlockBeep() {
  const context = audioContext();
  if (context?.state === "suspended") await context.resume();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tone(frequency: number, durationMs: number) {
  const context = audioContext();
  if (!context) return;
  if (context.state === "suspended") await context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime;
  const end = start + durationMs / 1000;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end);
  await wait(durationMs);
}

export async function playBeeps(count: number, frequency = 880) {
  const total = Math.max(1, Math.min(3, count));
  for (let index = 0; index < total; index += 1) {
    await tone(frequency, 160);
    if (index < total - 1) await wait(120);
  }
}
