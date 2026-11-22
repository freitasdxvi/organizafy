import { useEffect, useRef, useState, type MouseEvent } from "react";

const soundPreference = "persiste.interface-clicks.v1";
const controls = "button, a[href], select, summary, [role='button'], [role='tab'], input[type='checkbox'], input[type='radio']";

export function usePersisteClickSound() {
  const audio = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(soundPreference) !== "off"; } catch { return true; }
  });

  useEffect(() => () => {
    if (audio.current) void audio.current.close().catch(() => {});
    audio.current = null;
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(soundPreference, next ? "on" : "off"); } catch { /* Storage can be disabled. */ }
  }

  function play(event: MouseEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target.closest(controls) : null;
    if (!enabled || !target || target.matches(":disabled, [aria-disabled='true'], [data-persiste-sound-toggle]") || !window.AudioContext) return;

    try {
      const context = audio.current ??= new AudioContext();
      if (context.state === "suspended") void context.resume().catch(() => {});
      const time = context.currentTime;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(1_260, time);
      oscillator.frequency.exponentialRampToValueAtTime(560, time + 0.034);
      envelope.gain.setValueAtTime(0.001, time);
      envelope.gain.exponentialRampToValueAtTime(0.085, time + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.052);
      oscillator.connect(envelope).connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(time);
      oscillator.stop(time + 0.056);
    } catch { /* Audio availability must not interfere with the click. */ }
  }

  return { enabled, toggle, play };
}

export function PersisteAtmosphere() {
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia) return;
    const motion = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame: number | undefined;
    let x = 0;
    let y = 0;

    function setPosition(event: PointerEvent) {
      if (!motion.matches || event.pointerType === "touch") return;
      x = event.clientX;
      y = event.clientY;
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        const horizontal = x / window.innerWidth;
        const vertical = y / window.innerHeight;
        const style = surface.current?.style;
        style?.setProperty("--persiste-x", `${(horizontal - 0.5) * 52}px`);
        style?.setProperty("--persiste-y", `${(vertical - 0.5) * 36}px`);
        style?.setProperty("--persiste-light-x", `${horizontal * 100}%`);
        style?.setProperty("--persiste-light-y", `${vertical * 100}%`);
      });
    }

    window.addEventListener("pointermove", setPosition, { passive: true });
    return () => {
      window.removeEventListener("pointermove", setPosition);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={surface} className="persiste-atmosphere" aria-hidden="true"><div className="persiste-ribbon" /></div>;
}
