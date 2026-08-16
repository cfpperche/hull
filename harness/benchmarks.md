# Benchmarks by sector

**Normative.** Before UI/UX work, the operator reads the row for **this slice**. Write 3–6 sentences: what those products do, what we copy, what we refuse. Then implement.

Search the **product**, not only the marketing site.

Chrome set (shared): **Vercel**, **Linear**, **Supabase**.  
Refuse from that set: ERP master data, Inter+purple slop.

## www — landing, CTA, no cookie

**Copy:** Vercel / Linear marketing, Stripe. One headline, one primary CTA to `app…/signup`, quiet footer.  
**Refuse:** lead-magnet modal, splash, LUZ-style “desbloquear acesso”, six feature cards as the hero.

## web chrome — sidebar, switcher, empty home, account

**Copy:** Vercel / Linear / Supabase density. Left nav, org switcher as Vercel team switcher, empty home quiet until a module exists, account as settings-in-shell.  
**Refuse:** generic dashboard (six stat cards), debugger JSON as the page, Inter+purple, glassmorphism.

## auth / first org

**Copy:** Linear / Vercel first workspace: username + email + password, then **one** name, Continue.  
**Refuse:** company on signup, five-step wizard, email-verify wall on the lab path.

## admin / support

**Copy:** Vercel / Linear “viewing as” bar + Stop. Support impersonates an **org**.  
**Refuse:** minting the customer JWT (Supabase “impersonate user” as the product), viewing the app as a different login, key-paste as the human door.

## lab / install

**Copy:** one compose project, project CA, Mailpit, `setup-local` + Windows UAC.  
**Refuse:** joining an external Traefik, Grafana/Loki stack, `docker run` orphans.

## schema / HTTP contract

Not a visual sector. Postgres SQL in `schema/` is the data contract. `contracts/openapi.yaml` is the HTTP contract. FastAPI is an adapter.  
**Refuse:** ORM as source of truth, a database microservice.
