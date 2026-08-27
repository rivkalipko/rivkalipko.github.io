# staging.rivka.me

Static preview of [rivka.me](https://rivka.me), migrated from WordPress and designed for GitHub Pages at [staging.rivka.me](https://staging.rivka.me).

## Build locally

```bash
npm run build
npm run preview
```

The build has no package dependencies. It reads the archived WordPress JSON in `source/wordpress/`, copies self-hosted media from `src/media/`, and writes the complete site to `_site/`.

## Publish

1. Push this project to `rivkalipko/rivkalipko.github.io` on the `main` branch.
2. In the repository’s **Settings → Pages**, select **GitHub Actions** as the source.
3. Add and verify `staging.rivka.me` as the custom domain before changing DNS.
4. Add a `CNAME` record for `staging.rivka.me` pointing to `rivkalipko.github.io`, then enable **Enforce HTTPS** after the certificate is ready.

The deployment workflow, sitemap, RSS feed, search index, and existing URL structure are generated automatically. The production WordPress site at `rivka.me` remains untouched during staging.

## Content

The original WordPress export remains unchanged in `source/wordpress/`. The importer keeps article HTML, figures, tables, metadata, category archives, the featured tag, the author archive, and glossary pages. New articles can be added to the source JSON or the generator can be extended to read a simpler Markdown content directory.
