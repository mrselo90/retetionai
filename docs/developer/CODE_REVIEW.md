# Code Review Guidelines

## Overview

This document outlines the code review process and guidelines for GlowGuide Retention Agent.

## Review Process

### 1. Create Pull Request

- Create a feature branch from `main`
- Make changes and commit with clear messages
- Push branch and create PR
- Add reviewers (at least 1 required)

### 2. Review Checklist

Reviewers should check:

- [ ] **Functionality**: Does it work as intended?
- [ ] **Code Quality**: Follows style guide, no lint errors
- [ ] **Tests**: Tests added/updated, coverage maintained
- [ ] **Documentation**: Code comments, README updates
- [ ] **Security**: No sensitive data exposed, proper validation
- [ ] **Performance**: No obvious performance issues
- [ ] **Error Handling**: Proper error handling and logging

### 3. Review Feedback

- Be constructive and respectful
- Explain why changes are needed
- Suggest alternatives when possible
- Approve when ready, request changes when needed

### 4. Merge

- All reviewers must approve
- CI checks must pass
- No merge conflicts
- Squash and merge (for cleaner history)

## Review Criteria

### Code Quality

**Good Code:**
- Clear, readable, and maintainable
- Follows project conventions
- Well-documented
- Handles edge cases
- Proper error handling

**Bad Code:**
- Unclear variable names
- Magic numbers/strings
- Duplicated code
- Missing error handling
- No comments for complex logic

### Example Review Comments

**Good:**
```
This function is doing too much. Consider splitting into:
1. validateInput()
2. processData()
3. saveResult()
```

**Bad:**
```
This is wrong. Fix it.
```

### Security Review

Check for:
- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication/authorization bypass
- Sensitive data exposure
- Rate limiting
- Input validation

### Performance Review

Check for:
- N+1 queries
- Missing indexes
- Unnecessary API calls
- Memory leaks
- Inefficient algorithms

## PR Template

Use this template for pull requests:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guide
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass locally
```

## Review Best Practices

### For Authors

1. **Keep PRs Small**: Easier to review, faster to merge
2. **Write Clear Descriptions**: Explain what and why
3. **Respond Promptly**: Address feedback quickly
4. **Be Open to Feedback**: Code review is a learning opportunity

### For Reviewers

1. **Review Promptly**: Don't let PRs sit for days
2. **Be Specific**: Point to exact lines, suggest fixes
3. **Ask Questions**: If something is unclear, ask
4. **Praise Good Code**: Positive feedback is important

## Common Issues

### 1. Missing Error Handling

```typescript
// Bad
const result = await fetch(url);

// Good
try {
  const result = await fetch(url);
  if (!result.ok) {
    throw new Error(`HTTP ${result.status}`);
  }
} catch (error) {
  logger.error({ error, url }, 'Fetch failed');
  throw error;
}
```

### 2. Type Safety

```typescript
// Bad
function process(data: any) {
  return data.value;
}

// Good
interface ProcessData {
  value: string;
}

function process(data: ProcessData): string {
  return data.value;
}
```

### 3. Code Duplication

```typescript
// Bad
function getUser(id: string) {
  return db.query('SELECT * FROM users WHERE id = ?', [id]);
}

function getProduct(id: string) {
  return db.query('SELECT * FROM products WHERE id = ?', [id]);
}

// Good
function getById<T>(table: string, id: string): Promise<T> {
  return db.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
}
```

## Review Tools

- **GitHub PR Reviews**: Inline comments, suggestions
- **ESLint**: Automated code quality checks
- **TypeScript**: Type checking
- **Prettier**: Code formatting
- **Sentry**: Error tracking (post-merge)

## Resources

- [Google Code Review Guide](https://google.github.io/eng-practices/review/)
- [Effective Code Reviews](https://www.atlassian.com/agile/software-development/code-reviews)
