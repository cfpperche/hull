import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { HullMe } from "@hull/api-client";
import { ApiError } from "@hull/api-client";
import { api } from "./api";

type Ctx = {
  ready: boolean;
  me: HullMe | null;
  signedIn: boolean;
  refreshMe: () => Promise<HullMe | null>;
  signOut: () => Promise<void>;
};

const Session = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<HullMe | null>(null);
  const refreshMe = useCallback(async () => {
    try {
      const next = await api.me();
      setMe(next);
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.problem.status === 401) {
        setMe(null);
        return null;
      }
      throw err;
    }
  }, []);
  const signOut = useCallback(async () => {
    await api.signout();
    setMe(null);
  }, []);
  useEffect(() => {
    void refreshMe()
      .catch(() => setMe(null))
      .finally(() => setReady(true));
  }, [refreshMe]);
  return (
    <Session.Provider
      value={{ ready, me, signedIn: Boolean(me), refreshMe, signOut }}
    >
      {children}
    </Session.Provider>
  );
}

export function useSession(): Ctx {
  const ctx = useContext(Session);
  if (!ctx) throw new Error("useSession requires SessionProvider");
  return ctx;
}
