import { PersisteMark } from "@/components/layout/PersisteBrand";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import "./welcome-animation.css";

export function WelcomeAnimation() {
  const [visible, setVisible] = useState(() => window.location.pathname.replace(/\/+$/, "") !== "/instagram/conectar");
  useEffect(() => {
    if (!visible) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setVisible(false), reduced ? 300 : 1400);
    return () => window.clearTimeout(timer);
  }, [visible]);
  return <Dialog.Root open={visible} onOpenChange={setVisible}>
    <Dialog.Portal>
      <Dialog.Content className="welcome-stage persiste-welcome" data-ready="true">
        <div className="welcome-stage-brand">
          <div className="welcome-stage-emblem"><PersisteMark /></div>
          <Dialog.Title className="welcome-stage-title">persiste</Dialog.Title>
        </div>
        <Dialog.Description className="sr-only">Publique no seu ritmo.</Dialog.Description>
        <Dialog.Close className="welcome-stage-skip" aria-label="Pular apresentação">Pular</Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
