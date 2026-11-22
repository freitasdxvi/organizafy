import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { X } from "lucide-react";
import { mascotLine } from "./dashboard";

export function PersisteMascot({ totalViews, viewsOnNewReels }: { totalViews: number | null; viewsOnNewReels: number }) {
  const [message, setMessage] = useState<{ line: string; automatic: boolean } | null>(null);
  const metrics = useRef({ totalViews, viewsOnNewReels });
  const nextTurn = useRef(0);
  const launcher = useRef<HTMLButtonElement>(null);
  const bubbleId = useId();

  useEffect(() => {
    metrics.current = { totalViews, viewsOnNewReels };
  }, [totalViews, viewsOnNewReels]);

  const speak = useCallback((automatic: boolean) => {
    const line = mascotLine(nextTurn.current++, metrics.current.totalViews, metrics.current.viewsOnNewReels);
    setMessage((current) => automatic && current && !current.automatic ? current : { line, automatic });
  }, []);

  useEffect(() => {
    const show = () => {
      if (!document.hidden) speak(true);
    };
    const first = window.setTimeout(show, 12_000);
    const cycle = window.setInterval(show, 135_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(cycle);
    };
  }, [speak]);

  useEffect(() => {
    if (!message?.automatic) return;
    const hide = window.setTimeout(() => setMessage(null), 16_000);
    return () => window.clearTimeout(hide);
  }, [message]);

  const dismiss = () => {
    setMessage(null);
    launcher.current?.focus();
  };

  function lookAtPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse") return;
    const { currentTarget, clientX, clientY } = event;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    currentTarget.style.setProperty("--pico-eye-x", `${((clientX - left) / width - 0.5) * 8}px`);
    currentTarget.style.setProperty("--pico-eye-y", `${((clientY - top) / height - 0.5) * 5}px`);
  }

  return (
    <aside
      className="persiste-mascot"
      aria-label="Pico, mascote da Persiste"
      onKeyDown={(event) => {
        if (event.key === "Escape" && message) {
          event.stopPropagation();
          dismiss();
        }
      }}
    >
      <button
        ref={launcher}
        type="button"
        className="persiste-mascot-launcher"
        aria-label="Conversar com Pico"
        aria-expanded={message !== null}
        aria-controls={bubbleId}
        onClick={() => speak(false)}
        onPointerMove={lookAtPointer}
        onPointerLeave={({ currentTarget }) => {
          currentTarget.style.removeProperty("--pico-eye-x");
          currentTarget.style.removeProperty("--pico-eye-y");
        }}
      >
        <span className="persiste-mascot-face" aria-hidden="true"><span /></span>
      </button>
      <div
        id={bubbleId}
        className="persiste-mascot-bubble"
        hidden={message === null}
        onFocus={() => setMessage((current) => current?.automatic ? { ...current, automatic: false } : current)}
      >
        <div className="persiste-mascot-copy" role="status">
          <strong>Pico</strong>
          <p>{message?.line}</p>
        </div>
        <button type="button" className="persiste-mascot-dismiss" aria-label="Dispensar mensagem do Pico" onClick={dismiss}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
