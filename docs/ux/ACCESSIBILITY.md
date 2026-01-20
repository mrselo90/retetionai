# Accessibility Guide

## Overview

This document outlines accessibility (a11y) best practices for GlowGuide Retention Agent, following WCAG 2.1 Level AA standards.

## WCAG Principles

### 1. Perceivable

Content must be perceivable to all users.

#### Text Alternatives

```tsx
// Always provide alt text for images
<img src="logo.png" alt="GlowGuide Logo" />

// Decorative images
<img src="decoration.png" alt="" aria-hidden="true" />
```

#### Color Contrast

- **Normal text**: 4.5:1 contrast ratio
- **Large text**: 3:1 contrast ratio
- **Interactive elements**: 3:1 contrast ratio

```tsx
// Good: High contrast
<button className="bg-blue-600 text-white">Button</button>

// Bad: Low contrast
<button className="bg-blue-200 text-blue-300">Button</button>
```

#### Text Size

- Minimum: 16px for body text
- Scalable: Use relative units (rem, em)

### 2. Operable

Interface must be operable by all users.

#### Keyboard Navigation

All interactive elements must be keyboard accessible:

```tsx
// Buttons are keyboard accessible by default
<button onClick={handleClick}>Click me</button>

// Custom components need keyboard support
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Custom button
</div>
```

#### Focus Indicators

Visible focus indicators:

```tsx
// Tailwind default focus styles
<button className="focus:outline-none focus:ring-2 focus:ring-blue-500">
  Button
</button>
```

#### Skip Links

Allow users to skip navigation:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### 3. Understandable

Content must be understandable.

#### Language

```tsx
<html lang="en">
  {/* Content */}
</html>
```

#### Form Labels

Always label form inputs:

```tsx
<label htmlFor="email">
  Email Address
  <input id="email" type="email" required />
</label>

// Or use aria-label
<input
  type="email"
  aria-label="Email Address"
  required
/>
```

#### Error Messages

Clear, descriptive error messages:

```tsx
{error && (
  <div role="alert" className="text-red-600">
    {error.message}
  </div>
)}
```

### 4. Robust

Content must be robust and compatible.

#### Semantic HTML

Use semantic HTML elements:

```tsx
// Good
<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>
<main>
  <article>...</article>
</main>
<footer>...</footer>

// Bad
<div>
  <div>
    <div>...</div>
  </div>
</div>
```

#### ARIA Labels

Use ARIA when semantic HTML isn't enough:

```tsx
<button aria-label="Close dialog">
  <XIcon />
</button>

<div role="dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Dialog Title</h2>
</div>
```

## Common Patterns

### 1. Loading States

```tsx
<button disabled={isLoading} aria-busy={isLoading}>
  {isLoading ? (
    <>
      <Spinner aria-label="Loading" />
      <span className="sr-only">Loading...</span>
    </>
  ) : (
    'Submit'
  )}
</button>
```

### 2. Error States

```tsx
<div role="alert" aria-live="polite">
  {error && <ErrorMessage message={error} />}
</div>
```

### 3. Modal Dialogs

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Modal Title</h2>
  <p id="modal-description">Modal description</p>
  <button aria-label="Close modal">×</button>
</div>
```

### 4. Navigation

```tsx
<nav aria-label="Main navigation">
  <ul>
    <li>
      <a href="/dashboard" aria-current="page">Dashboard</a>
    </li>
  </ul>
</nav>
```

## Testing

### Automated Testing

Use tools:
- **axe DevTools**: Browser extension
- **Lighthouse**: Built into Chrome DevTools
- **WAVE**: Web accessibility evaluation tool

### Manual Testing

1. **Keyboard Navigation**: Tab through all interactive elements
2. **Screen Reader**: Test with NVDA (Windows) or VoiceOver (Mac)
3. **Color Contrast**: Use WebAIM Contrast Checker
4. **Focus Indicators**: Ensure all elements have visible focus

### Checklist

- [ ] All images have alt text
- [ ] Color contrast meets WCAG AA
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] Form labels present
- [ ] Error messages clear
- [ ] Semantic HTML used
- [ ] ARIA labels where needed
- [ ] Tested with screen reader
- [ ] Tested with keyboard only

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [axe DevTools](https://www.deque.com/axe/devtools/)
