# Icon specification

Sizes and formats needed for Recete Retention Agent icons (web app, Shopify App Store, optional dark/light and social).

---

## Web app (Next.js) — `packages/web/public/`

| Use                        | Size                                 | Format           | File name                              | Notes                                          |
| -------------------------- | ------------------------------------ | ---------------- | -------------------------------------- | ---------------------------------------------- |
| **Recete icon (brand)**    | 64×64 (vector)                       | SVG              | `recete-icon.svg`                      | Stylized R, Emerald–Gold gradient; used in dashboard sidebar & mobile header |
| **Recete logo (light bg)** | 200×48 (vector)                      | SVG              | `recete-logo.svg`                      | Icon + “recete” wordmark (#0A3D2E); used in landing header |
| **Recete logo (dark bg)**  | 200×48 (vector)                      | SVG              | `recete-logo-dark.svg`                 | Icon + “recete” wordmark (#F8F5E6); used in footer |
| Favicon                    | 32×32 (or 16×16 + 32×32 in one .ico) | `.ico` or `.png` | `favicon.ico` or `icon.png`            | Browser tab                                    |
| Default icon               | **32×32**                            | PNG              | `icon.png`                             | Used for `icon` and `apple` in layout metadata |
| Apple touch icon           | **180×180**                          | PNG              | `apple-icon.png` (or reuse `icon.png`) | iOS “Add to Home Screen”                       |
| Light mode icon (optional) | 32×32                                | PNG              | e.g. `icon-light.png`                  | `prefers-color-scheme: light`                  |
| Dark mode icon (optional)  | 32×32                                | PNG              | e.g. `icon-dark.png`                   | `prefers-color-scheme: dark`                   |


---

## Shopify App Store (required for listing)


| Use      | Size          | Format      | Notes                                           |
| -------- | ------------- | ----------- | ----------------------------------------------- |
| App icon | **1200×1200** | PNG or JPEG | Upload in Partner Dashboard; must match listing |


---

## Social / Open Graph (optional)


| Use                                   | Size                  | Format      | Suggested file      |
| ------------------------------------- | --------------------- | ----------- | ------------------- |
| Open Graph (Facebook, LinkedIn, etc.) | **1200×630**          | PNG or JPEG | e.g. `og-image.png` |
| Twitter card                          | 1200×630 or 1200×1200 | PNG or JPEG | Can reuse OG image  |


---

## Summary checklist


| Priority           | Asset            | Size(s)       | Format      | Where                                    |
| ------------------ | ---------------- | ------------- | ----------- | ---------------------------------------- |
| Required           | Web app icon     | 32×32         | PNG         | `packages/web/public/icon.png`           |
| Recommended        | Apple touch icon | 180×180       | PNG         | `packages/web/public/apple-icon.png`     |
| Required (Shopify) | Shopify app icon | **1200×1200** | PNG or JPEG | Partner Dashboard (+ repo for reference) |
| Optional           | Favicon          | 16×16 + 32×32 | ICO         | `packages/web/public/favicon.ico`        |
| Optional           | Dark/light icons | 32×32 each    | PNG         | `icon-light.png`, `icon-dark.png`        |
| Optional           | Social/OG image  | 1200×630      | PNG/JPEG    | `packages/web/public/og-image.png`       |


---

## Minimum to create

1. **32×32** (and optionally **180×180**) for the web app.
2. **1200×1200** for Shopify App Store.
3. Optional: light and dark variants at 32×32 (and 180×180 for Apple) if you want theme-aware icons.

