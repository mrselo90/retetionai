# Contributing to Recete

Thank you for your interest in contributing to Recete! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL (via Supabase)
- Redis

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/retention-agent-ai.git
   cd retention-agent-ai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Fill in required values

4. **Run database migrations**
   ```bash
   # See supabase/RUN_MIGRATIONS.md
   ```

5. **Start development servers**
   ```bash
   # API
   pnpm --filter @glowguide/api dev
   
   # Workers
   pnpm --filter @glowguide/workers dev
   
   # Web
   pnpm --filter @glowguide/web dev
   ```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer interfaces over types
- Use explicit return types for functions
- Avoid `any` type

### Naming Conventions

- **Files**: kebab-case (`user-service.ts`)
- **Functions**: camelCase (`getUserById`)
- **Classes**: PascalCase (`UserService`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)

### Code Organization

- **Routes**: One file per resource (`routes/products.ts`)
- **Middleware**: Reusable logic (`middleware/auth.ts`)
- **Lib**: Business logic (`lib/aiAgent.ts`)
- **Schemas**: Validation schemas (`schemas/products.ts`)

## Testing

### Running Tests

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### Writing Tests

- Write tests for new features
- Aim for 70%+ coverage
- Test error cases
- Use descriptive test names

## Pull Request Process

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes**
   - Write code
   - Add tests
   - Update documentation

3. **Commit changes**
   ```bash
   git commit -m "feat: add new feature"
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature
   ```

### Commit Messages

Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

## Code Review

- All PRs require review
- Address review comments
- Keep PRs focused and small
- Update documentation

## Questions?

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: dev@glowguide.ai
