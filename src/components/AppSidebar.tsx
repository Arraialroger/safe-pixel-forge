import { LayoutDashboard, Settings, LogOut, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerBranding } from "@/hooks/useBranding";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    return (first + last).toUpperCase() || "··";
  }
  return email ? email.slice(0, 2).toUpperCase() : "··";
}

interface SidebarBodyProps {
  /** Opcional: chamado ao clicar em um item de navegação (usado para fechar Sheet no mobile). */
  onNavigate?: () => void;
}

/** Conteúdo interno da sidebar, reutilizado pela aside fixa (desktop) e pelo Sheet (mobile). */
export function SidebarBody({ onNavigate }: SidebarBodyProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { logoUrl, displayName } = useOwnerBranding();

  async function handleLogout() {
    await signOut();
    onNavigate?.();
    navigate("/login");
  }

  const email = user?.email ?? "";
  const primaryLabel = displayName?.trim() || email || "Conta";
  const secondaryLabel = displayName?.trim() ? email : "PixelSafe";
  const initials = getInitials(displayName, email);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo customLogoUrl={logoUrl} customLogoAlt={displayName ?? undefined} />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => onNavigate?.()}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeClassName="bg-accent text-foreground"
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-medium text-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{primaryLabel}</p>
            <p className="truncate text-[11px] text-muted-foreground">{secondaryLabel}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}

/** Sidebar fixa (desktop ≥ md). No mobile, o conteúdo é montado dentro do Sheet pelo AuthenticatedLayout. */
export function AppSidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <SidebarBody />
    </aside>
  );
}
