import { useAdministrationAccess } from "@/features/administration/api";
import { PublicationFeedback } from "@/features/instagram-publisher/PublicationSound";
import { InstagramAlerts } from "@/features/instagram-publisher/InstagramAlerts";
import {
  ShieldCheck,
  Bell,
  LayoutDashboard,
  BarChart3,
  Settings,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Instagram,
  X,
  PlugZap,
  CalendarClock,
  Film,
  UserRound,
  Volume2,
  VolumeX,
  Layers,
  Code2,
  MoreHorizontal,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayoutContext, type PicoMetrics } from "@/contexts/AppLayoutContext";
import { loadAgoniaProfile } from "@/features/agonia/schedule";
import { PersisteBrand } from "./PersisteBrand";
import { PersisteAtmosphere, usePersisteClickSound } from "@/features/persiste/PersisteAtmosphere";
import { PersisteMascot } from "@/features/persiste/PersisteMascot";
import "./app-shell.css";

type NavIcon = LucideIcon | ((props: SVGProps<SVGSVGElement>) => JSX.Element);

interface NavItem {
  title: string;
  path: string;
  icon: NavIcon;
  exact?: boolean;
  matchPaths?: string[];
  externalTab?: boolean;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const agoniaSections: NavSection[] = [
  {
    items: [
      { title: "Dashboard", path: "/persiste", icon: LayoutDashboard, exact: true },
      { title: "Modo Fluxo", path: "/persiste/fluxos", icon: Layers },
      { title: "Conectar", path: "/persiste/conectar", icon: PlugZap },
      { title: "Meta Developer", path: "/persiste/meta-developer", icon: Code2 },
    ],
  },
  {
    label: "Publicação",
    items: [
      { title: "Instagram", path: "/persiste/instagram", icon: Instagram },
      { title: "Agendamentos", path: "/persiste/scheduled", icon: CalendarClock },
      { title: "Publicações", path: "/persiste/reels", icon: Film, matchPaths: ["/persiste/reels", "/persiste/reels-test", "/persiste/reels-new"] },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Alertas de contas", path: "/persiste/alertas", icon: Bell },
      { title: "Visualizações", path: "/persiste/visualizacoes", icon: BarChart3 },
      { title: "Configurações", path: "/persiste/settings", icon: Settings },
      { title: "Meu Perfil", path: "/persiste/profile", icon: UserRound },
    ],
  },
];

const agoniaNavItems = agoniaSections.flatMap((s) => s.items);

function isItemActive(item: NavItem, pathname: string) {
  if (item.exact) {
    return pathname === "/" || pathname === "/persiste" || pathname === "/persiste/";
  }
  if (item.matchPaths) return item.matchPaths.includes(pathname);
  return pathname === item.path;
}

function SideNav({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const access = useAdministrationAccess();
  const sections = access.data?.is_admin ? [...agoniaSections, { label: "Gestão", items: [{ title: "Administração", path: "/persiste/admin", icon: ShieldCheck }] }] : agoniaSections;

  return (
    <>
      {sections.map((section, sectionIdx) => (
        <div key={section.label || sectionIdx} className="shell-nav-section">
          {section.label && !collapsed && (
            <p className="shell-nav-section-label">{section.label}</p>
          )}
          {section.label && collapsed && (
            <span className="shell-nav-section-rule" aria-hidden="true" />
          )}
          {section.items.map((item) => {
            const isActive = isItemActive(item, location.pathname);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                target={item.externalTab ? "_blank" : undefined}
                rel={item.externalTab ? "noopener noreferrer" : undefined}
                onClick={onNavigate}
                title={item.externalTab ? `${item.title} · abre em nova aba` : item.title}
                aria-label={item.title}
                className={cn(
                  "shell-nav-link",
                  isActive && "is-active",
                  collapsed && "is-collapsed",
                )}
              >
                <span className="shell-nav-icon relative">
                  <item.icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
                </span>
                {!collapsed && (
                  <span className="shell-nav-label">
                    <span className="truncate">{item.title}</span>
                    {item.externalTab && (
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-40" aria-hidden="true" />
                    )}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const clickSound = usePersisteClickSound();
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFocusMode, setMobileFocusMode] = useState(false);
  const [picoMetrics, setPicoMetrics] = useState<PicoMetrics | null>(null);
  const [profileTick, setProfileTick] = useState(0);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const { signOut, user } = useAuth();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onProfileUpdate = () => setProfileTick((n) => n + 1);
    window.addEventListener("agonia-profile-updated", onProfileUpdate);
    return () => window.removeEventListener("agonia-profile-updated", onProfileUpdate);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    mobileMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
      if (event.key === "Tab") {
        const focusable = mobileMenuRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled])",
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [mobileMenuOpen]);

  const layoutContext = useMemo(() => ({ setMobileFocusMode, setPicoMetrics }), []);

  const metadataName = user?.user_metadata?.display_name;
  const fallbackName =
    (typeof metadataName === "string" && metadataName.trim()) ||
    user?.email?.split("@")[0] ||
    "Minha conta";

  const agoniaProfile = useMemo(
    () => loadAgoniaProfile(user?.id, fallbackName),
    [user?.id, fallbackName, profileTick],
  );
  const displayName = agoniaProfile.username || fallbackName;
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join("")
    .toUpperCase();

  const currentPage = useMemo(() => {
    if (location.pathname === "/persiste/alertas") return "Alertas de contas";
    if (location.pathname === "/persiste/reels-new") return "Criar publicação";
    if (location.pathname === "/persiste/stories") return "Stories";
    if (location.pathname === "/persiste/admin") return "Administração";
    if (location.pathname === "/persiste/reels-test") return "Diagnóstico de Publicação";
    const match = agoniaNavItems.find((item) =>
      isItemActive(item, location.pathname),
    );
    return match?.title || "Dashboard";
  }, [location.pathname]);

  // Mobile bottom bar: 4 primary destinations + "Mais" drawer trigger
  const mobilePrimaryItems = useMemo(
    () => agoniaNavItems.filter((item) =>
      ["/persiste", "/persiste/fluxos", "/persiste/scheduled", "/persiste/reels"].includes(item.path),
    ),
    [],
  );

  return (
    <AppLayoutContext.Provider value={layoutContext}>
      <div
        className={cn(
          "workspace-shell avanca-dark-shell persiste-shell min-h-[100dvh] min-w-0 shell-agonia-mode",
          desktopSidebarOpen && "shell-expanded",
          mobileFocusMode && "shell-mobile-focus",
        )}
        onClickCapture={clickSound.play}
      >
        <PersisteAtmosphere />
        <a href="#workspace-content" className="shell-skip-link">
          Ir para o conteúdo
        </a>

        {/* Desktop Sidebar */}
        <aside
          id="desktop-workspace-menu"
          className="app-desktop-sidebar shell-rail hidden lg:flex"
          aria-label="Menu lateral"
        >
          <div className="shell-rail-top">
            <NavLink
              to="/persiste"
              className="shell-brand"
              title="Persiste · Dashboard"
              aria-label="Persiste · Dashboard"
            >
              <PersisteBrand compact={!desktopSidebarOpen} />
            </NavLink>
            <button
              type="button"
              aria-label={desktopSidebarOpen ? "Recolher menu lateral" : "Expandir menu lateral"}
              aria-expanded={desktopSidebarOpen}
              aria-controls="desktop-workspace-menu"
              onClick={() => setDesktopSidebarOpen((open) => !open)}
              className="shell-icon-button shell-collapse-btn"
              title={desktopSidebarOpen ? "Recolher menu" : "Expandir menu"}
            >
              {desktopSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          </div>

          <nav className="shell-rail-nav" aria-label="Menu principal">
            <SideNav collapsed={!desktopSidebarOpen} />
          </nav>

          <div className="shell-rail-footer">
            <NavLink
              to="/persiste/profile"
              className={cn("shell-rail-account", !desktopSidebarOpen && "is-collapsed")}
              title={`${displayName} · Configurações`}
              aria-label="Perfil e configurações"
            >
              <span className="shell-avatar">
                {agoniaProfile.avatarDataUrl ? (
                  <img
                    src={agoniaProfile.avatarDataUrl}
                    alt={displayName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </span>
              {desktopSidebarOpen && (
                <span className="shell-account-name">
                  {displayName}
                  <span>{user?.email || "Configurações"}</span>
                </span>
              )}
            </NavLink>
            <button
              type="button"
              onClick={signOut}
              className="shell-icon-button shell-rail-signout"
              title="Sair da conta"
              aria-label="Sair da conta"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* Top Bar */}
        <header className={cn("app-header shell-header", mobileFocusMode && "max-lg:hidden")}>
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-workspace-menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="shell-icon-button shell-mobile-toggle lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>

          <div className="shell-header-title">
            <span className="shell-eyebrow"><PersisteBrand compact /></span>
            <span className="shell-current-page">{currentPage}</span>
          </div>

          <div className="shell-header-space" />

          <div className="shell-header-tools">
            <button
              type="button"
              className="shell-icon-button"
              data-persiste-sound-toggle
              aria-label="Som dos cliques"
              aria-pressed={clickSound.enabled}
              title={clickSound.enabled ? "Silenciar cliques" : "Ativar som dos cliques"}
              onClick={clickSound.toggle}
            >
              {clickSound.enabled ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
            </button>
            <PublicationFeedback />
            <InstagramAlerts />
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            className="app-mobile-drawer shell-mobile-overlay fixed inset-0 z-[60] lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="absolute inset-0 bg-black/70" />
            <aside
              ref={mobileMenuRef}
              id="mobile-workspace-menu"
              className="shell-mobile-menu relative h-full w-[min(18.5rem,86vw)] animate-slide-in-left"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Menu principal"
            >
              <div className="shell-mobile-brand">
                <NavLink
                  to="/persiste"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Persiste"
                >
                  <PersisteBrand />
                </NavLink>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="shell-icon-button"
                  aria-label="Fechar menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="shell-mobile-nav px-3" aria-label="Menu principal">
                <SideNav onNavigate={() => setMobileMenuOpen(false)} />
              </nav>

              <div className="shell-mobile-account">
                <NavLink
                  to="/persiste/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-w-0 flex-1 items-center gap-2.5"
                >
                  <span className="shell-avatar">
                    {agoniaProfile.avatarDataUrl ? (
                      <img
                        src={agoniaProfile.avatarDataUrl}
                        alt={displayName}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </span>
                  <span className="shell-account-name">
                    {displayName}
                    <span>{user?.email || "Configurações"}</span>
                  </span>
                </NavLink>
                <button
                  type="button"
                  onClick={signOut}
                  className="shell-icon-button ml-auto"
                  title="Sair"
                  aria-label="Sair da conta"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Workspace */}
        <div className={cn("app-body flex min-h-[100dvh] min-w-0", mobileFocusMode && "app-body-focus")}>
          <main
            id="workspace-content"
            tabIndex={-1}
            className={cn("app-main min-w-0 flex-1 overflow-x-clip", mobileFocusMode && "app-main-focus")}
          >
            <div className={cn("app-page-frame min-w-0", mobileFocusMode && "app-page-frame-focus")}>
              {children}
            </div>
          </main>
        </div>

        {/* Mobile Bottom Bar */}
        <nav
          className={cn(
            "mobile-bottom-nav shell-bottom-nav fixed inset-x-0 bottom-0 z-50 flex items-center justify-around lg:hidden",
            mobileFocusMode && "hidden",
          )}
          aria-label="Navegação rápida"
        >
          {mobilePrimaryItems.map((item) => {
            const isActive = isItemActive(item, location.pathname);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                aria-label={item.title}
                className={cn(
                  "shell-bottom-link flex min-w-0 flex-1 touch-manipulation flex-col items-center",
                  isActive && "is-active",
                )}
              >
                <span className="shell-bottom-icon">
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                </span>
                <span className="w-full truncate text-center text-[11px] font-medium">{item.title}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Mais opções"
            aria-expanded={mobileMenuOpen}
            className={cn(
              "shell-bottom-link flex min-w-0 flex-1 touch-manipulation flex-col items-center",
              mobileMenuOpen && "is-active",
            )}
          >
            <span className="shell-bottom-icon">
              <MoreHorizontal className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium">Mais</span>
          </button>
        </nav>
        <PersisteMascot totalViews={picoMetrics?.totalViews ?? null} viewsOnNewReels={picoMetrics?.viewsOnNewReels ?? 0} />
      </div>
    </AppLayoutContext.Provider>
  );
}
