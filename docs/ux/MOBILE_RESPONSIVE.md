# Mobile Responsive Design Guide

## Overview

This document outlines mobile responsiveness strategies and best practices for Recete Retention Agent.

## Breakpoints

We use Tailwind CSS default breakpoints:

- **sm**: 640px (small tablets)
- **md**: 768px (tablets)
- **lg**: 1024px (small laptops)
- **xl**: 1280px (desktops)
- **2xl**: 1536px (large desktops)

## Responsive Patterns

### 1. Mobile-First Approach

Always design for mobile first, then enhance for larger screens:

```tsx
// Mobile-first: Base styles for mobile
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-xl md:text-2xl lg:text-3xl">Title</h1>
</div>
```

### 2. Grid Layouts

Use responsive grid columns:

```tsx
// 1 column on mobile, 2 on tablet, 3 on desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

### 3. Navigation

Mobile: Hamburger menu  
Desktop: Horizontal navigation

```tsx
<div className="md:hidden">
  {/* Mobile menu */}
  <button onClick={toggleMenu}>☰</button>
</div>
<div className="hidden md:flex">
  {/* Desktop menu */}
  <nav>...</nav>
</div>
```

### 4. Tables

Tables should scroll horizontally on mobile:

```tsx
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>
```

### 5. Forms

Stack form fields on mobile:

```tsx
<div className="flex flex-col md:flex-row gap-4">
  <input className="flex-1" />
  <input className="flex-1" />
</div>
```

## Touch Targets

### Minimum Sizes

- **Buttons**: 44x44px minimum (iOS/Android guidelines)
- **Links**: 44x44px minimum
- **Input fields**: 44px height minimum

```tsx
<button className="px-4 py-3 min-h-[44px] min-w-[44px]">
  Click me
</button>
```

### Spacing

- **Between touch targets**: 8px minimum
- **Padding**: 16px on mobile, 24px on desktop

## Typography

### Responsive Text Sizes

```tsx
<h1 className="text-2xl md:text-3xl lg:text-4xl">Heading</h1>
<p className="text-sm md:text-base lg:text-lg">Body text</p>
```

### Line Height

- Mobile: 1.5 (easier to read on small screens)
- Desktop: 1.6

## Images

### Responsive Images

```tsx
<img
  src="image.jpg"
  alt="Description"
  className="w-full h-auto"
  loading="lazy"
/>
```

### Aspect Ratios

```tsx
<div className="aspect-video md:aspect-square">
  <img src="image.jpg" className="object-cover" />
</div>
```

## Performance

### Lazy Loading

```tsx
// Lazy load images below the fold
<img loading="lazy" src="image.jpg" />
```

### Conditional Rendering

```tsx
// Only render heavy components on desktop
{isDesktop && <HeavyComponent />}
```

## Testing

### Device Testing

Test on:
- iPhone (Safari)
- Android (Chrome)
- iPad (Safari)
- Desktop browsers

### Browser DevTools

Use Chrome DevTools:
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test different devices

### Real Device Testing

- Use BrowserStack or similar
- Test on actual devices when possible

## Common Issues

### 1. Horizontal Scroll

**Problem**: Content overflows on mobile

**Solution**:
```tsx
<div className="overflow-x-hidden">
  {/* Content */}
</div>
```

### 2. Text Too Small

**Problem**: Text unreadable on mobile

**Solution**: Use responsive text sizes:
```tsx
<p className="text-base md:text-lg">Text</p>
```

### 3. Buttons Too Small

**Problem**: Hard to tap on mobile

**Solution**: Increase touch target size:
```tsx
<button className="px-6 py-3 min-h-[44px]">Button</button>
```

### 4. Forms Not Usable

**Problem**: Forms cramped on mobile

**Solution**: Stack fields vertically:
```tsx
<div className="flex flex-col gap-4 md:flex-row">
  <input />
  <input />
</div>
```

## Best Practices

1. **Test on real devices**: Emulators are good, but real devices are better
2. **Use relative units**: `rem`, `em`, `%` instead of `px` where possible
3. **Optimize images**: Use WebP, lazy loading, responsive sizes
4. **Minimize JavaScript**: Reduce bundle size for mobile
5. **Progressive enhancement**: Start with basic functionality, enhance for larger screens

## Checklist

- [ ] All pages responsive (mobile, tablet, desktop)
- [ ] Touch targets ≥ 44x44px
- [ ] No horizontal scroll on mobile
- [ ] Text readable on mobile (≥ 16px)
- [ ] Forms usable on mobile
- [ ] Navigation works on mobile
- [ ] Images optimized and responsive
- [ ] Tested on real devices
- [ ] Performance acceptable on mobile (< 3s load)

## Resources

- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_design)
- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
