import { originFor } from "@hull/config";
import { useBrand } from "@hull/ui";

function Mark({ brand, mark }: { brand: string; mark: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="bg-foreground text-background flex size-7 items-center justify-center rounded-md text-xs font-semibold">
        {mark}
      </span>
      <span className="text-sm font-semibold tracking-tight">{brand}</span>
    </span>
  );
}

export function App() {
  const { brand, mark } = useBrand();
  const app = originFor("web");
  const admin = originFor("admin");
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-4 px-6">
          <a href="#top" aria-label={brand}>
            <Mark brand={brand} mark={mark} />
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#product" className="hover:text-foreground">
              Product
            </a>
            <a href="#surfaces" className="hover:text-foreground">
              Surfaces
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <a href={`${app}/signin`} className="text-sm font-medium hover:underline" data-testid="www-signin">
              Sign in
            </a>
            <a
              href={`${app}/signup`}
              data-testid="www-signup"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Get started
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto max-w-[1120px] px-6 py-24">
          <p className="text-muted-foreground text-sm">Standalone scaffold</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
            App shell and chrome. No business attached.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-base">
            Clone, run the setup script, Docker does the rest. Signup is username, email, and password. Then one
            workspace name.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`${app}/signup`}
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Create account
            </a>
            <a href="#surfaces" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium">
              See surfaces
            </a>
          </div>
        </section>

        <section id="product" className="border-t">
          <div className="mx-auto grid max-w-[1120px] gap-10 px-6 py-20 md:grid-cols-3">
            <div>
              <h2 className="text-sm font-semibold">Own edge</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Traefik, certificates, and hosts live in this repo. Nothing on the machine except Docker.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold">User + org</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                One login, many workspaces. Isolation is org_id. Support views an org without stealing the session.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold">Module slot</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                The home page is empty on purpose. A product module fills it. The hull does not know what you sell.
              </p>
            </div>
          </div>
        </section>

        <section id="surfaces" className="border-t">
          <div className="mx-auto max-w-[1120px] px-6 py-20">
            <h2 className="text-xl font-semibold tracking-tight">Three hosts</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              <li className="rounded-xl border p-5">
                <p className="text-sm font-medium">www</p>
                <p className="text-muted-foreground mt-1 text-sm">This page. No cookie.</p>
              </li>
              <li className="rounded-xl border p-5">
                <p className="text-sm font-medium">app</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Product shell.{" "}
                  <a className="text-foreground underline" href={app}>
                    Open
                  </a>
                </p>
              </li>
              <li className="rounded-xl border p-5">
                <p className="text-sm font-medium">admin</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Install operators.{" "}
                  <a className="text-foreground underline" href={admin}>
                    Open
                  </a>
                </p>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-[1120px] items-center justify-between px-6 py-8 text-sm">
          <Mark brand={brand} mark={mark} />
          <p>MIT</p>
        </div>
      </footer>
    </div>
  );
}
