# Git Commit Strategy

## Branch Naming Convention

```
feature/[feature-name]      # New features
bugfix/[bug-name]           # Bug fixes
hotfix/[issue-name]         # Production hotfixes
chore/[task-name]           # Maintenance tasks
docs/[doc-name]             # Documentation updates
perf/[optimization-name]    # Performance improvements
test/[test-name]            # Test additions
```

## Commit Message Format

### Template
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Dependency updates, build changes
- **ci**: CI/CD configuration changes

### Scope
- **api**: API endpoints
- **db**: Database/Models
- **cache**: Redis/Caching
- **socket**: WebSocket/Real-time
- **ui**: Frontend components
- **auth**: Authentication
- **queue**: Message queue
- **logging**: Logging system

### Subject
- Use imperative mood ("add" not "adds" or "added")
- Don't capitalize first letter
- No period at end
- Max 50 characters

### Body
- Explain what and why, not how
- Wrap at 72 characters
- Separate from subject with blank line

### Footer
```
Closes #123
Refs #456
Breaking Change: description
```

## Examples

### Feature Commit
```
feat(api): add priority notification endpoint

Add new endpoint to fetch top 10 priority notifications
using in-memory heap data structure for efficiency.

Implements sorting by:
- Notification type (placement > result > event)
- Recency (recent has higher priority)
- Age penalty (older notifications lose points)

Closes #789
```

### Bugfix Commit
```
fix(cache): prevent cache invalidation race condition

Invalidate cache atomically using Redis UNLINK command
to avoid concurrent access issues during TTL refresh.

Previously, multiple EXPIRE calls could cause inconsistent state.
```

### Performance Commit
```
perf(db): add composite index on notifications collection

Optimize query: { studentId, isRead, createdAt }
Expected improvement: 20x faster for paginated reads
With 1M+ notifications collection size.

Benchmark: 500ms → 25ms for typical query
```

### Test Commit
```
test(services): add unit tests for NotificationService

Add 15 test cases covering:
- getNotifications with caching
- markAsRead functionality
- invalidateCache edge cases
- Error handling scenarios

Coverage: 92% of NotificationService code
```

## Release Process

### Version Format: Major.Minor.Patch

```
v1.0.0  - Initial release
v1.0.1  - Bug fix
v1.1.0  - New feature
v2.0.0  - Breaking changes
```

### Release Steps

```bash
# 1. Create release branch
git checkout -b release/v1.1.0

# 2. Update version in package.json
# 3. Update CHANGELOG.md
# 4. Commit changes
git commit -m "chore(release): v1.1.0"

# 5. Create tag
git tag -a v1.1.0 -m "Release version 1.1.0"

# 6. Push to remote
git push origin release/v1.1.0
git push origin v1.1.0

# 7. Create Pull Request for final review
# 8. Merge to main after approval
# 9. Delete release branch
git branch -d release/v1.1.0
```

## Pull Request Guidelines

### PR Title Format
```
[TYPE] Brief description (max 65 chars)

Examples:
[FEATURE] Add priority notification system
[BUGFIX] Fix cache invalidation race condition
[PERF] Optimize database queries with indexes
```

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Performance improvement
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] No console.log or debug code
- [ ] Tests pass locally
- [ ] Documentation updated

## Related Issues
Closes #123
```

## Code Review Checklist

Before approving a PR:
- ✅ Follows commit convention
- ✅ All tests pass
- ✅ No console.log statements
- ✅ Proper error handling
- ✅ Performance acceptable
- ✅ Documentation updated
- ✅ Security best practices followed

## Useful Git Commands

```bash
# View commit history
git log --oneline --graph --all

# Rebase before merge
git rebase main

# Squash commits (if needed)
git rebase -i HEAD~3

# View changes
git diff
git diff --staged

# Amend last commit
git commit --amend --no-edit

# Reset (careful!)
git reset --soft HEAD~1

# Cherry-pick commit
git cherry-pick <commit-hash>

# Stash changes
git stash
git stash pop
```

## Continuous Integration

All commits to `main` and PR branches trigger:
- ✅ Unit tests
- ✅ Integration tests
- ✅ Linting (ESLint)
- ✅ Type checking (TypeScript)
- ✅ Code coverage
- ✅ Security scan

## Deployment Pipeline

```
Feature Branch → PR → Code Review → Merge to main → 
→ Run Tests → Build Docker → Push to Registry → 
→ Deploy to Staging → QA → Deploy to Production
```

---

**Last Updated:** 2026-05-05  
**Version:** 1.0.0
