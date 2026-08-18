import { originFor } from "@hull/config";
import { BrandMark, useBrand, useT } from "@hull/ui";

export function App() {
  const t = useT();
  const { brand, mark } = useBrand();
  const app = originFor("web");
  const admin = originFor("admin");
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-4 px-6">
          <a href="#top" aria-label={brand}>
            <BrandMark brand={brand} mark={mark} />
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#product" className="hover:text-foreground">
              {t("www.nav.product")}
            </a>
            <a href="#surfaces" className="hover:text-foreground">
              {t("www.nav.surfaces")}
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href={`${app}/signin`}
              className="text-sm font-medium hover:underline"
              data-testid="www-signin"
            >
              {t("auth.signIn")}
            </a>
            <a
              href={`${app}/signup`}
              data-testid="www-signup"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              {t("www.getStarted")}
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto max-w-[1120px] px-6 py-24">
          <p className="text-muted-foreground text-sm">{t("www.eyebrow")}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
            {t("www.headline")}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-base">
            {t("www.sub")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`${app}/signup`}
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t("signup.submit")}
            </a>
            <a
              href="#surfaces"
              className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
            >
              {t("www.seeSurfaces")}
            </a>
          </div>
        </section>

        <section id="product" className="border-t">
          <div className="mx-auto grid max-w-[1120px] gap-10 px-6 py-20 md:grid-cols-3">
            <div>
              <h2 className="text-sm font-semibold">{t("www.edge.title")}</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {t("www.edge.body")}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                {t("www.userOrg.title")}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {t("www.userOrg.body")}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold">{t("www.module.title")}</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {t("www.module.body")}
              </p>
            </div>
          </div>
        </section>

        <section id="surfaces" className="border-t">
          <div className="mx-auto max-w-[1120px] px-6 py-20">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("www.surfaces.title")}
            </h2>
            <ul className="mt-8 grid gap-8 md:grid-cols-3">
              <li>
                <p className="text-sm font-medium">www</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("www.surfaces.www")}
                </p>
              </li>
              <li>
                <p className="text-sm font-medium">app</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("www.surfaces.app")}{" "}
                  <a className="text-foreground underline" href={app}>
                    {t("www.open")}
                  </a>
                </p>
              </li>
              <li>
                <p className="text-sm font-medium">admin</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("www.surfaces.admin")}{" "}
                  <a className="text-foreground underline" href={admin}>
                    {t("www.open")}
                  </a>
                </p>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-[1120px] items-center justify-between px-6 py-8 text-sm">
          <BrandMark brand={brand} mark={mark} />
          {/* i18n-ignore: an SPDX licence identifier, not prose. */}
          <p>MIT</p>
        </div>
      </footer>
    </div>
  );
}
