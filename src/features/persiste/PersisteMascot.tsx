import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { mascotLine } from "./dashboard";

export function PersisteMascot({ totalViews, viewsOnNewReels }: { totalViews: number | null; viewsOnNewReels: number }) {
  const [turn, setTurn] = useState<number | null>(null);

  useEffect(() => {
    let nextTurn = 0;
    let hideTimer: number | undefined;
    function show() {
      if (document.hidden) return;
      setTurn(nextTurn++);
      hideTimer = window.setTimeout(() => setTurn(null), 16_000);
    }
    const first = window.setTimeout(show, 12_000);
    const cycle = window.setInterval(show, 135_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(cycle);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (turn === null) return null;

  return (
    <aside className="persiste-mascot" aria-label="Pico, mascote da Persiste">
      <div className="persiste-mascot-face" aria-hidden="true"><span /></div>
      <div className="persiste-mascot-copy" role="status">
        <strong>Pico</strong>
        <p>{mascotLine(turn, totalViews, viewsOnNewReels)}</p>
      </div>
      <button type="button" className="persiste-mascot-dismiss" aria-label="Dispensar mensagem do Pico" onClick={() => setTurn(null)}>
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  );
}
