# staging.rivka.me

Static preview of [rivka.me](https://rivka.me), migrated from WordPress and designed for GitHub Pages at [staging.rivka.me](https://staging.rivka.me).

## Build locally

```bash
npm run build
npm run preview
```

The build has no package dependencies. It reads the archived WordPress JSON in `source/wordpress/`, copies self-hosted media from `src/media/`, and writes the complete site to `_site/`.

### Build variables

Both are optional and set as GitHub Actions repository *variables* (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Canonical origin. Defaults to `https://staging.rivka.me`. |
| `SUBSCRIBE_ENDPOINT` | `/subscribe` URL of the Worker in `worker/`. |

The subscribe box only renders a working form when `SUBSCRIBE_ENDPOINT` is set; otherwise it shows a short placeholder.

## Subscribers

The site is static, so the only stateful piece is the Cloudflare Worker in `worker/`, which writes addresses to a D1 database. Nothing about the list lives in this repository.

### Deploy it

```bash
cd worker
npx wrangler d1 create rivka-subscribers          # copy the id into wrangler.toml
npx wrangler d1 execute rivka-subscribers --remote --file=schema.sql
npx wrangler secret put EXPORT_TOKEN              # long random string
npx wrangler secret put IP_SALT                   # any random string
npx wrangler deploy
```

Wrangler needs Node 22 or newer, which is a separate requirement from the site build.

Then set `SUBSCRIBE_ENDPOINT` to `https://<worker>.workers.dev/subscribe` and keep `ALLOWED_ORIGINS` in `wrangler.toml` in sync with the domains the form is served from.

### Read the list

```bash
curl https://<worker>.workers.dev/subscribers -H "Authorization: Bearer $EXPORT_TOKEN"
```

Returns JSON of every address with its signup time. `npx wrangler d1 execute rivka-subscribers --remote --command="SELECT * FROM subscribers"` works too.

### How it protects itself

Addresses are lowercased and validated before insert, and re-subscribing is a silent no-op, so the endpoint can't be used to test whether a given address is on the list. CORS is limited to `ALLOWED_ORIGINS`, the no-JS redirect only ever returns to those same origins, a hidden honeypot field catches form-filling bots, and signups are capped at five per IP per hour. The rate limiter stores a salted hash of the IP rather than the address itself, and prunes it after an hour.

## Publish

1. Push this project to `rivkalipko/rivkalipko.github.io` on the `main` branch.
2. In the repository’s **Settings → Pages**, select **GitHub Actions** as the source.
3. Add and verify `staging.rivka.me` as the custom domain before changing DNS.
4. Add a `CNAME` record for `staging.rivka.me` pointing to `rivkalipko.github.io`, then enable **Enforce HTTPS** after the certificate is ready.

The deployment workflow, sitemap, RSS feed, search index, and existing URL structure are generated automatically. The production WordPress site at `rivka.me` remains untouched during staging.

## Content

The original WordPress export remains unchanged in `source/wordpress/`. The importer keeps article HTML, figures, tables, metadata, category archives, the author archive, and glossary pages. New articles can be added to the source JSON or the generator can be extended to read a simpler Markdown content directory.

Copyedits live in `source/editorial-edits.mjs` as explicit find/replace pairs rather than being applied to the export. Every article must be listed there, and every replacement must match exactly, or the build fails — so a corrected typo can never silently drift. Replacements are also where LaTeX is introduced, using `\(…\)` and `\[…\]`; KaTeX is loaded only on the articles that actually contain math.
