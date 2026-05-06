import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roleLoading: boolean;
  userRole: string | null;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  roleLoading: true,
  userRole: null,
  refreshRole: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchRole = async (userId: string) => {
    setRoleLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setUserRole(data?.role ?? null);
    } catch (e) {
      console.error("Failed to fetch user role", e);
      setUserRole(null);
    } finally {
      setRoleLoading(false);
    }
  };

  const refreshRole = async () => {
    if (!user?.id) return;
    await fetchRole(user.id);
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setRoleLoading(true);
        setTimeout(() => {
          if (mounted) fetchRole(session.user.id);
        }, 0);
      } else {
        setUserRole(null);
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
          await fetchRole(session.user.id);
        } else {
          setUserRole(null);
          setRoleLoading(false);
        }
      } catch (e) {
        console.error("Auth init error", e);
        if (mounted) {
          setSession(null);
          setUser(null);
          setUserRole(null);
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
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUserRole(null);
    setRoleLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, roleLoading, userRole, refreshRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
