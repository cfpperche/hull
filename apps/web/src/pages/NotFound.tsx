import { Link } from "react-router";
import { useT } from "@hull/ui";

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="text-xl font-semibold tracking-tight">
        {t("notFound.title")}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        <Link to="/" className="text-foreground underline">
          {t("notFound.back")}
        </Link>
      </p>
    </div>
  );
}
