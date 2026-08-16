import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="text-xl font-semibold tracking-tight">Not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        <Link to="/" className="text-foreground underline">
          Back home
        </Link>
      </p>
    </div>
  );
}
