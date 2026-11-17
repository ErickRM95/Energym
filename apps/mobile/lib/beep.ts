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

async function horn(frequency: number, durationMs: number) {
  const context = audioContext();
  if (!context) return;
  if (context.state === "suspended") await context.resume();
  const start = context.currentTime;
  const end = start + durationMs / 1000;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.7, start + 0.012);
  master.gain.setValueAtTime(0.7, Math.max(start + 0.04, end - 0.06));
  master.gain.exponentialRampToValueAtTime(0.0001, end);
  master.connect(context.destination);

  const partials: Array<{ type: OscillatorType; ratio: number; level: number }> = [
    { type: "square", ratio: 1, level: 0.42 },
    { type: "sawtooth", ratio: 1.5, level: 0.28 },
    { type: "square", ratio: 2, level: 0.14 },
  ];
  for (const partial of partials) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = partial.type;
    oscillator.frequency.setValueAtTime(frequency * partial.ratio, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * partial.ratio * 0.86, end);
    gain.gain.setValueAtTime(partial.level, start);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
  await wait(durationMs);
}

export async function playBeeps(count: number, frequency = 466) {
  const total = Math.max(1, Math.min(3, count));
  for (let index = 0; index < total; index += 1) {
    await horn(frequency, 280);
    if (index < total - 1) await wait(90);
  }
}
