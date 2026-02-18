# Code Style Guide

## Overview

This document outlines the coding standards and style guidelines for Recete Retention Agent.

## TypeScript

### General Rules

- Use TypeScript strict mode
- Prefer `const` over `let`, avoid `var`
- Use explicit return types for exported functions
- Avoid `any` type (use `unknown` if type is truly unknown)
- Use interfaces for object shapes, types for unions/intersections

### Naming Conventions

- **Files**: `camelCase.ts` for utilities, `PascalCase.tsx` for components
- **Variables/Functions**: `camelCase`
- **Classes/Interfaces/Types**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private members**: Prefix with `_`

### Example

```typescript
// Good
export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export function getUserProfile(userId: string): Promise<UserProfile> {
  // Implementation
}

// Bad
export function getUserProfile(userId: any): any {
  // Implementation
}
```

## ESLint Rules

### Key Rules

- `@typescript-eslint/no-unused-vars`: Error on unused variables
- `@typescript-eslint/no-explicit-any`: Warn on `any` usage
- `@typescript-eslint/no-floating-promises`: Error on unhandled promises
- `no-console`: Warn (allow `console.warn` and `console.error`)
- `prefer-const`: Error on `let` that could be `const`

### Running ESLint

```bash
# Check all files
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix
```

## Prettier

### Configuration

- **Semicolons**: Yes
- **Single Quotes**: Yes
- **Trailing Commas**: ES5
- **Print Width**: 100 characters
- **Tab Width**: 2 spaces

### Running Prettier

```bash
# Format all files
pnpm format

# Check formatting
pnpm format:check
```

## File Organization

### Import Order

1. External dependencies
2. Internal modules (`@glowguide/*`)
3. Relative imports
4. Type imports (use `import type`)

```typescript
// Good
import { Hono } from 'hono';
import { getSupabaseClient } from '@glowguide/shared';
import { authMiddleware } from '../middleware/auth';
import type { User } from '../types/user';
```

### File Structure

```
packages/
  api/
    src/
      routes/        # API route handlers
      lib/          # Business logic
      middleware/   # Middleware functions
      types/        # Type definitions
      schemas/      # Validation schemas
```

## Error Handling

### Always Handle Errors

```typescript
// Good
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  logger.error({ error }, 'Operation failed');
  throw new Error('User-friendly message');
}

// Bad
const result = await someAsyncOperation(); // Unhandled promise
```

### Use Structured Logging

```typescript
// Good
logger.error({ error, merchantId, userId }, 'Failed to process order');

// Bad
console.log('Error:', error);
```

## Testing

### Test File Naming

- Test files: `*.test.ts` or `*.spec.ts`
- Co-located with source: `component.test.tsx` next to `component.tsx`

### Test Structure

```typescript
describe('functionName', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionName(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## Git Commit Messages

### Format

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

### Examples

```
feat(api): add caching layer for products

- Implement Redis caching
- Add cache invalidation
- Update product routes

Closes #123
```

## Code Review Checklist

- [ ] Code follows style guide
- [ ] No ESLint errors
- [ ] Prettier formatted
- [ ] TypeScript compiles without errors
- [ ] Error handling implemented
- [ ] Logging added for important operations
- [ ] Tests added/updated
- [ ] Documentation updated

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
