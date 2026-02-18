# Type Safety Guide

## Overview

This document outlines TypeScript type safety practices for Recete Retention Agent.

## TypeScript Configuration

### Strict Mode

All packages use TypeScript strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Key Strict Options

- **`strict`**: Enables all strict type checking options
- **`noImplicitAny`**: Error on `any` type inference
- **`strictNullChecks`**: Null and undefined are separate types
- **`strictFunctionTypes`**: Stricter function type checking
- **`noUnusedLocals`**: Error on unused local variables
- **`noUnusedParameters`**: Error on unused parameters

## Type Safety Best Practices

### 1. Avoid `any`

```typescript
// Bad
function process(data: any): any {
  return data.value;
}

// Good
interface ProcessData {
  value: string;
}

function process(data: ProcessData): string {
  return data.value;
}

// If type is truly unknown
function process(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }
  throw new Error('Invalid data');
}
```

### 2. Use Type Guards

```typescript
// Type guard
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj
  );
}

// Usage
function processUser(data: unknown): void {
  if (isUser(data)) {
    // TypeScript knows data is User here
    console.log(data.email);
  }
}
```

### 3. Handle Null/Undefined

```typescript
// Bad
function getName(user: User | null): string {
  return user.name; // Error: user might be null
}

// Good
function getName(user: User | null): string {
  if (!user) {
    throw new Error('User is required');
  }
  return user.name;
}

// Or with optional chaining
function getName(user: User | null): string | undefined {
  return user?.name;
}
```

### 4. Use Discriminated Unions

```typescript
// Good
type ApiResponse =
  | { status: 'success'; data: User }
  | { status: 'error'; message: string };

function handleResponse(response: ApiResponse): void {
  if (response.status === 'success') {
    // TypeScript knows response.data exists
    console.log(response.data);
  } else {
    // TypeScript knows response.message exists
    console.error(response.message);
  }
}
```

### 5. Type Assertions (Use Sparingly)

```typescript
// Only when you're certain
const data = response.json() as User;

// Better: Use type guard
if (isUser(data)) {
  // Use data
}
```

## Common Type Patterns

### API Responses

```typescript
interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

async function fetchUser(id: string): Promise<ApiResponse<User>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
```

### Database Queries

```typescript
interface DatabaseResult<T> {
  data: T | null;
  error: Error | null;
}

async function queryUser(id: string): Promise<DatabaseResult<User>> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  
  return {
    data: data as User | null,
    error: error as Error | null,
  };
}
```

### Event Handlers

```typescript
type EventHandler<T = void> = (event: T) => void | Promise<void>;

interface ButtonProps {
  onClick: EventHandler<MouseEvent>;
  onHover?: EventHandler<MouseEvent>;
}
```

## Type Coverage

### Check Type Coverage

```bash
# Install type-coverage
pnpm add -D type-coverage

# Check coverage
pnpm type-coverage

# Target: > 95% type coverage
```

### Increase Coverage

1. Replace `any` with proper types
2. Add type annotations to function parameters
3. Use type guards for runtime checks
4. Add return type annotations

## Type Definitions

### External Libraries

Create type definitions for untyped libraries:

```typescript
// types/custom-library.d.ts
declare module 'custom-library' {
  export interface Config {
    apiKey: string;
    timeout?: number;
  }
  
  export function initialize(config: Config): void;
}
```

### Global Types

```typescript
// types/global.d.ts
declare global {
  interface Window {
    customProperty: string;
  }
}

export {};
```

## Type Testing

### Test Type Safety

```typescript
// types.test.ts
import type { User } from './types';

// This will fail at compile time if User type is wrong
const testUser: User = {
  id: '123',
  email: 'test@example.com',
  // Missing required field will cause error
};
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Type Coverage Tool](https://github.com/plantain-00/type-coverage)
