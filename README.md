# KeepMeDark

KeepMeDark is an international, static directory of privacy and anonymity tools. The site is written in English, generated with Astro and designed to run on GitHub Pages at [keepmedark.com](https://keepmedark.com).

The website has no analytics, advertising or tracking cookies. Directory search and filtering happen entirely in the browser.

## Local development

Requirements: Node.js 24 and npm.

```sh
npm install
npm run dev
```

The development server prints its local URL. To validate the static production output:

```sh
npm run build
npm run preview
```

The generated site is written to `dist/`.

With the preview still running, `npm run test:browser` runs the acceptance smoke test in headless Chrome. Set `CHROME_BIN` if Chrome is not installed at the macOS default path, and `SITE_URL` if the preview uses another address.

## Add or update a tool

The editable catalog lives in [`src/data/tools.json`](src/data/tools.json). Each record provides the content for its profile, search terms and filters. Adding a valid record automatically:

- creates `/tools/<slug>/` at build time;
- adds the tool to the home directory;
- indexes its name, description, category, platforms and aliases in local search;
- exposes its category and platforms to filters;
- adds the profile to the sitemap.

Keep `aliases` focused on real use cases, not marketing phrases. Link claims to primary documentation in `sources`, and change `reviewed` only after checking all material statements on the profile.

Required fields are demonstrated by the four existing records. Run `npm run build` after editing the catalog; Astro’s strict check catches template and type errors before output is produced.

## Project structure

```text
src/
  components/       Logo, directory UI, icons and interactive hood
  data/tools.json   Editable catalog
  layouts/          Shared page shell and metadata
  pages/            Home, generated profiles and editorial pages
  styles/           Global design system
public/
  images/           Local SVG fallbacks and social image
  scripts/          Browser-only search and filters
```

The hood animation is isolated to one Canvas 2D element. Its device-pixel ratio is capped at 2×, it stops rendering outside the viewport and it switches to a static SVG for reduced-motion users. The search value remains in page memory only; it is not placed in the URL or persisted.

Brand glyphs are compiled locally from [Simple Icons](https://simpleicons.org/) (CC0-1.0). Product names and marks remain the property of their respective owners and are used only to identify catalog entries.

## GitHub Pages deployment

The workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys every push to `main`. In the repository on GitHub:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Under **Custom domain**, enter `keepmedark.com` and save it before changing DNS. Verifying the domain in the owner account first is recommended.
4. Push to `main` or run **Deploy to GitHub Pages** manually from the Actions tab.

The repository includes `public/CNAME`, and Astro uses `https://keepmedark.com` for canonical URLs and the sitemap.

## DNS for `keepmedark.com`

At the DNS provider, configure these records for the apex domain:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `StarMKT.github.io` |

Remove conflicting `A`, `AAAA`, `ALIAS` or `ANAME` records on `@`, and conflicting `CNAME` records on `www`. Do not use a wildcard record for a Pages domain. DNS propagation can take up to 24 hours.

These values are the current [GitHub Pages DNS records documented by GitHub](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain). Recheck that documentation if this setup is performed much later.

## HTTPS

After the domain check succeeds and GitHub provisions the certificate:

1. Return to **Settings → Pages**.
2. Enable **Enforce HTTPS**.
3. Confirm that `http://keepmedark.com` redirects to `https://keepmedark.com` and that `https://www.keepmedark.com` redirects to the canonical apex domain.

GitHub documents the certificate process and common DNS conflicts in [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Manual acceptance checks

- Open `/tools/tor-browser/` directly from the production preview.
- Search for `private messaging`; only Signal should remain.
- Combine a category and one or more platforms, then remove an active filter.
- Search for an impossible phrase and use **Clear filters** to restore all four rows.
- Check the home at 390 px and 1440 px, including keyboard tab order and the `/` shortcut.
- Move slowly across the hood, pause over a fold, then leave it. Nearby lines should keep their distance while hovered and settle without residual vibration.
- Emulate touch scrolling over the illustration and enable reduced motion to confirm the static fallback.

## Content and privacy notes

KeepMeDark distinguishes encryption, privacy and anonymity in every profile. Inclusion is not a blanket endorsement; the [selection criteria](https://keepmedark.com/selection-criteria/) explain the editorial method.

GitHub Pages records visitor IP addresses for security. This is disclosed on the site’s privacy page and is described in [GitHub’s Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection).
