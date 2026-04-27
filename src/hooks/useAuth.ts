// Auth mockada em memória (sem persistência, sem backend).
// Simples store baseado em listeners para compartilhar entre componentes.

import { useEffect, useState } from "react";

let authed = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(authed);

  useEffect(() => {
    const update = () => setIsAuthenticated(authed);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    isAuthenticated,
    login: () => {
      authed = true;
      notify();
    },
    logout: () => {
      authed = false;
      notify();
    },
  };
}
