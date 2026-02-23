# Brand check: Recete guidelines vs app

Comparison of the Recete brand identity (from your guideline image) with the current app colors and icon usage.

---

## Brand guideline (from image)

| Element | Light mode | Dark mode |
|--------|------------|-----------|
| **Background** | Cream `#F8F5E6` | Deep Forest Green `#0A3D2E` |
| **Text / wordmark** | Deep Forest Green `#0A3D2E` | Cream `#F8F5E6` |
| **Logo icon (R)** | Emerald → Gold gradient (same in both modes) |
| **Primary palette** | Deep Forest Green, Emerald Gold gradient, Cream |

### Hex → HSL (for CSS)

| Name | Hex | HSL (approx) |
|------|-----|--------------|
| **Deep Forest Green** | `#0A3D2E` | `164 72% 14%` |
| **Cream** | `#F8F5E6` | `51 57% 94%` |
| **Emerald Gold gradient** | — | Icon accent only (e.g. emerald → gold in SVG/PNG) |

---

## Current app (`packages/web/app/globals.css`)

| Token | Light mode (current) | Dark mode (current) |
|-------|----------------------|----------------------|
| **Background** | `0 0% 100%` (white) | `220 26% 14%` (#1A202C slate) |
| **Foreground** | `222 47% 9%` (dark grey) | `0 0% 98%` (near white) |
| **Primary** | `220 26% 14%` (dark slate) | `0 0% 98%` (inverted) |
| **Primary foreground** | `0 0% 100%` (white) | `240 5.9% 10%` (dark) |
| **Surface** | `240 5% 97%` (light grey) | — |

---

## Gap (brand vs app)

1. **Primary / background**
   - Brand: Deep Forest Green `#0A3D2E` as primary; Cream `#F8F5E6` as light background.
   - App: Primary is dark slate (`220 26% 14%`); background is pure white. No Cream, no Deep Forest Green in tokens.

2. **Dark mode**
   - Brand: Deep Forest Green as dark background; Cream as text.
   - App: Dark uses blue-grey `#1A202C`, not Deep Forest Green.

3. **Icon**
   - Brand: Stylized “R” with emerald → gold gradient; “Icon only” and full wordmark variants for light/dark.
   - App: Uses `icon.svg` / `icon.png`; see `docs/ICON_SPEC.md` for sizes. Icon art should follow the gradient R from the guideline (you provide assets).

4. **Wordmark**
   - Brand: “recete” in serif, Deep Forest Green on light, Cream on dark.
   - App: No separate wordmark token; headings use Polaris-type scale and current `--foreground` / `--primary`.

---

## Recommendation

- **To align with the guideline:**
  1. **Colors:** Set light-mode background to Cream and primary to Deep Forest Green; set dark-mode background to Deep Forest Green and foreground to Cream (see “Optional: adopt brand colors” below).
  2. **Icons:** Use the R icon (and optional wordmark) from the guideline; export 32×32 and 180×180 (and 1200×1200 for Shopify) per `docs/ICON_SPEC.md`, with light/dark variants if desired.
  3. **Accent:** Use the emerald–gold gradient only for the logo/icon (e.g. SVG or PNG), not as a global UI accent, to keep contrast and Polaris alignment.

- **Optional: adopt brand colors in CSS**  
  In `globals.css` you could add brand tokens and optionally wire them to `--primary`, `--background`, etc.:

```css
/* Recete brand (from guideline) */
--recete-deep-forest: 164 72% 14%;   /* #0A3D2E */
--recete-cream: 51 57% 94%;          /* #F8F5E6 */
```

Then for light mode: `--background: var(--recete-cream);` and `--primary: var(--recete-deep-forest);` (and adjust primary-foreground for contrast). For dark: `--background` and `--primary` from `--recete-deep-forest`, foreground from `--recete-cream`.

---

## Summary

| Item | Status |
|------|--------|
| **Deep Forest Green #0A3D2E** | Not in app tokens; use for primary (and dark bg if desired). |
| **Cream #F8F5E6** | Not in app tokens; use for light bg and dark text. |
| **Emerald Gold gradient** | For logo/icon only; provide as SVG/PNG. |
| **Icon / wordmark** | Sizes and formats in `docs/ICON_SPEC.md`; artwork should match guideline. |
| **Light/dark usage** | Guideline matches: green on cream (light), cream on green (dark). |

If you want, the next step is to apply the Recete brand colors in `globals.css` (and optionally a short “Brand colors” section in your design docs) using the values above.

**Applied:** Brand colors are now applied. `globals.css` has Recete tokens; light = Cream bg + Deep Forest Green primary; dark = Deep Forest Green bg + Cream text. Dashboard uses semantic tokens; landing (Hero, Stats, Features, HowItWorks, CTA, Footer) uses Deep Forest Green and Cream.
