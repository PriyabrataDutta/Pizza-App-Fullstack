// A short two-note chime for a new order, so the kitchen hears it without watching the screen. Browsers only allow sound after the
// person has clicked or tapped the page once, so the audio is prepared on the first interaction; until then the chime stays silent
// and the banner and the tab title still show the order. The on/off choice is remembered in this browser.

let audio: AudioContext | null = null;
const listeners = new Set<() => void>();
const KEY = "cc_order_sound";

/** Call from a click or tap handler (once is enough). */
export function prepareChime() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    // no audio in this browser: the alert is visual only
  }
}

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // storage blocked: the choice lasts until the page is closed
  }
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore. */
export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function playChime() {
  if (!soundOn() || !audio || audio.state !== "running") return;
  try {
    const start = audio.currentTime;
    [[880, 0], [1175, 0.18]].forEach(([freq, offset]) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.5);
      osc.connect(gain).connect(audio!.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.55);
    });
  } catch {
    // ignore: a missed chime must never break the board
  }
}
