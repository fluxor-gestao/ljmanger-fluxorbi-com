import {
  Home,
  ShoppingCart,
  DollarSign,
  Settings2,
  Building2,
  BarChart3,
  Shield,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import logoBanner from "@/assets/logo-banner.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Início", url: "/hub", icon: Home },
  { title: "Comercial", url: "/comercial", icon: ShoppingCart },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Operação", url: "/operacao", icon: Settings2 },
];

const managementItems = [
  { title: "Gestão", url: "/gestao", icon: Building2 },
  { title: "BI / Business Intelligence", url: "/bi", icon: BarChart3 },
  { title: "Opções / Usuários", url: "/admin", icon: Shield, adminOnly: true },
  { title: "Central de Ajuda", url: "/ajuda", icon: HelpCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshRole, signOut } = useAuth();

  const isActive = (path: string) =>
    path === "/hub" ? location.pathname === "/hub" : location.pathname.startsWith(path);

  const filteredManagement = managementItems.filter(
    (item) => !item.adminOnly || Boolean(user)
  );

  const handleNavigate = async (url: string) => {
    if (url === "/admin") await refreshRole();
    navigate({ to: url as string });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center justify-center">
          {collapsed ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
              <span className="text-xs font-bold text-sidebar-primary-foreground">LJ</span>
            </div>
          ) : (
            <img src={logoBanner} alt="Lundgaard Jensen" className="h-auto w-[160px]" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={isActive(item.url)} onClick={() => handleNavigate(item.url)}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredManagement.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={isActive(item.url)} onClick={() => handleNavigate(item.url)}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && user && (
          <p className="truncate px-2 text-xs text-sidebar-foreground/50">
            {user.email}
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
