# Polaris typography and component alignment

This document records the Polaris-aligned tokens and patterns adopted in the Recete dashboard so the app looks native to Shopify Admin. Approach used: **token alignment** (custom components styled with Polaris type scale, spacing, and visual rules; no Polaris React components except AppProvider + Polaris CSS).

## Typography

### CSS variables (`packages/web/app/globals.css`)

- **Headings:** `--polaris-heading-3xl` (36px), `--polaris-heading-2xl` (30px), `--polaris-heading-xl` (24px), `--polaris-heading-lg` (20px), `--polaris-heading-md` (14px), `--polaris-heading-sm` (13px), `--polaris-heading-xs` (12px). Weights: bold for 3xl–xl, semibold for lg–xs.
- **Body:** `--polaris-body-md` (14px), `--polaris-body-sm` (12px).

### Base styles

- `body`: font-size `--polaris-body-md`, line-height 1.5.
- `h1`–`h6`: use the heading variables above; h4–h6 use font-weight 600 (semibold).

### Utility classes

- **`.page-title`:** Polaris headingXl/heading2xl (24px, 30px on sm+), bold, for dashboard page titles.
- **`.page-description`:** Polaris bodyMd, muted color, for page descriptions.
- **`.form-label`:** 14px, font-weight 600, for form labels (Polaris TextField label).
- **`.form-helper`:** 12px, muted, for helper text.

### Where used

- **CardTitle / CardDescription** (`packages/web/components/ui/card.tsx`): CardTitle uses `--polaris-heading-lg`, CardDescription uses `--polaris-body-md`.
- **Dashboard pages:** Conversations, Products, Integrations, Settings, Analytics, Dashboard home, Customers use `.page-title` and `.page-description` for the main header.

## Components

### Button (`packages/web/components/ui/button.tsx`)

- Default height 36px (`h-9`), border-radius 8px, font 14px (bodyMd), font-semibold.
- Sizes: default `h-9 px-4`, sm `h-8 px-3`, lg `h-10 px-5`, xl `h-11 px-6`.
- Primary/default: solid background, white text, subtle border.

### Card (`packages/web/components/ui/card.tsx`)

- White/card background, subtle border, 8px radius, very light shadow (no heavy shadow).
- Padding: CardHeader and CardContent use `p-5` (20px) for Polaris-like spacing.

### EmptyState (`packages/web/components/ui/empty-state.tsx`)

- Centered layout; icon container 64×64px, rounded-xl; title uses `--polaris-heading-lg`, description `--polaris-body-md`; vertical padding 48px, horizontal 24px; primary/secondary actions use default button size.

### Input (`packages/web/components/ui/input.tsx`)

- Height 36px (`h-9`), 14px font (bodyMd), padding px-3 py-2, 8px radius, border and focus ring unchanged.

### Label (`packages/web/components/ui/label.tsx`)

- 14px (bodyMd), font-semibold, for alignment with Polaris TextField labels.

## Layout

### Page container (`packages/web/components/layout/DashboardLayout.tsx`)

- Main content padding: 16px (default), 24px from `sm`, 32px from `lg` (`p-4 sm:p-6 lg:p-8`).
- Max-width `max-w-6xl` for content; vertical spacing between sections follows Tailwind spacing (e.g. space-y-6 ≈ 24px, gap-4 ≈ 16px).

### Spacing variables

- In `globals.css`: `--polaris-space-4` (16px), `--polaris-space-5` (20px), `--polaris-space-6` (24px), `--polaris-space-8` (32px) for reference and future consistency.

## References

- [Polaris typography](https://polaris.shopify.com/design/typography)
- Plan: “Make the application look like Shopify Polaris typography and component rules” (Approach A: token alignment).
- AppProvider and Polaris CSS: `packages/web/components/ShopifyProvider.tsx`.
