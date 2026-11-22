import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ArrowUpRight, BarChart3, Layers, ShieldCheck } from "lucide-react";
import { PersisteBrand, PersisteMark } from "./PersisteBrand";
import "./AuthLayout.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout persiste-auth">
      <div className="auth-shell">
        <section className="auth-showcase" aria-label="Conheça a Persiste">
          <div className="auth-showcase-topline">
            <Link to="/auth?welcome=1" aria-label="Persiste · Tela inicial"><PersisteBrand /></Link>
          </div>
          <div className="auth-emblem-stage" aria-hidden="true">
            <PersisteMark />
          </div>
          <div className="auth-showcase-copy">
            <h1>Publique no seu ritmo.</h1>
            <p>Conecte suas contas, publique com controle e acompanhe o que faz sua audiência crescer.</p>
            <div className="auth-showcase-features" aria-label="Recursos principais">
              <span><Layers size={14} aria-hidden="true" /> Publicação</span>
              <span><BarChart3 size={14} aria-hidden="true" /> Métricas</span>
              <span><ArrowUpRight size={14} aria-hidden="true" /> Performance</span>
            </div>
          </div>
        </section>
        <section className="auth-form-area" aria-label="Acesso à sua conta">
          <div className="auth-card">
            <Link className="auth-form-brand" to="/auth?welcome=1" aria-label="Persiste · Tela inicial"><PersisteBrand /></Link>
            {children}
            <p className="auth-security"><ShieldCheck size={13} aria-hidden="true" /> Seu espaço. Seu controle.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
