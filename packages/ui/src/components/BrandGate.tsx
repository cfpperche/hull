import { loadPublicConfig, type PublicConfig } from "@hull/config";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useT } from "./LocaleProvider";

const BrandContext = createContext<PublicConfig | null>(null);

export function BrandGate({ children }: { children: ReactNode }) {
  const t = useT();
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void loadPublicConfig()
      .then(setCfg)
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : t("app.configMissing")),
      );
  }, [t]);
  if (err) {
    return <div className="text-destructive p-8 text-sm">{err}</div>;
  }
  if (!cfg) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        {t("app.loading")}
      </div>
    );
  }
  return <TitledBrand value={cfg}>{children}</TitledBrand>;
}

function TitledBrand({
  value,
  children,
}: {
  value: PublicConfig;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = value.brand;
  }, [value.brand]);
  return (
    <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
  );
}

export function useBrand(): PublicConfig {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand requires BrandGate");
  return ctx;
}
