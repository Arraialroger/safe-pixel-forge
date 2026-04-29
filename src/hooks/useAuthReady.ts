import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que a sessão Supabase já foi restaurada do storage
 * antes de habilitar queries que dependem de RLS / auth.uid().
 *
 * Uso:
 *   const { user, isReady } = useAuthReady();
 *   useQuery({ ..., enabled: isReady && !!user?.id });
 */
export function useAuthReady() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Listener primeiro — evita perder eventos
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Não chame APIs Supabase aqui dentro (evita deadlock).
    });

    // Restaura sessão atual do storage
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setUser(current?.user ?? null);
      setIsReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, session, isReady };
}
