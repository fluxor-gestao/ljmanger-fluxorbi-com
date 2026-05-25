import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "comercial" | "financeiro" | "operacao";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roleLoading: boolean;
  /** Primeiro papel (compatibilidade legacy). Prefira `roles`/`hasRole`. */
  userRole: AppRole | null;
  roles: AppRole[];
  hasRole: (role: AppRole | AppRole[]) => boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  roleLoading: true,
  userRole: null,
  roles: [],
  hasRole: () => false,
  refreshRole: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const fetchRoles = useCallback(async (userId: string) => {
    setRoleLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      setRoles(((data ?? []).map((r) => r.role)) as AppRole[]);
    } catch (e) {
      console.error("Failed to fetch user roles", e);
      setRoles([]);
    } finally {
      setRoleLoading(false);
    }
  }, []);

  const refreshRole = useCallback(async () => {
    if (!user?.id) return;
    await fetchRoles(user.id);
  }, [user?.id, fetchRoles]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setRoleLoading(true);
        setTimeout(() => {
          if (mounted) fetchRoles(session.user.id);
        }, 0);
      } else {
        setRoles([]);
        setRoleLoading(false);
      }
      setLoading(false);
    });

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchRoles(session.user.id);
        } else {
          setRoles([]);
          setRoleLoading(false);
        }
      } catch (e) {
        console.error("Auth init error", e);
        if (mounted) {
          setSession(null);
          setUser(null);
          setRoles([]);
          setRoleLoading(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRoles]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRoles([]);
    setRoleLoading(false);
  };

  const hasRole = useCallback(
    (role: AppRole | AppRole[]) => {
      const list = Array.isArray(role) ? role : [role];
      // Admin sempre tem acesso
      if (roles.includes("admin")) return true;
      return list.some((r) => roles.includes(r));
    },
    [roles],
  );

  const userRole = roles[0] ?? null;

  return (
    <AuthContext.Provider
      value={{ user, session, loading, roleLoading, userRole, roles, hasRole, refreshRole, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
