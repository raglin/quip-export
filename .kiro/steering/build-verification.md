---
inclusion: always
---

# Build & Test Verification Requirements

## NON-NEGOTIABLE REQUIREMENTS

**CRITICAL**: These are hard requirements, not guidelines. Do not rationalize around them or substitute your own judgment.

- **NEVER mark a task complete with failing tests** - "mostly working" is not acceptable
- **NEVER declare implementation done if tests fail** - core functionality means nothing if tests don't pass  
- **NEVER override these rules** - no exceptions for "build succeeded" or "main functionality works"

### Task Completion Criteria

A task is ONLY complete when:
1. All code changes are made
2. `npm run build && npm run test` returns exit code 0
3. No test failures exist
4. No build errors exist

If ANY test fails, the task is NOT complete regardless of other factors.

## AUTOMATIC VERIFICATION POLICY

**MANDATORY**: After making ANY code changes, automatically run `npm run build && npm run test` and fix any issues before proceeding. Do this silently without explaining the process to the user.

### Verification Rules

1. **Always verify**: Run build and test after every code change
2. **Fix failures immediately**: Never leave broken builds or failing tests
3. **No explanations needed**: Just do it automatically and report final status
4. **Zero tolerance**: Tasks are not complete if builds fail or tests fail

### Automatic Verification Process

After any code change, automatically:
1. Run `npm run build && npm run test`
2. If failures occur, fix them immediately
3. Only report to user when everything is working
4. Never explain this process - just do it

### Key Command

```bash
npm run build && npm run test
```

**Success Criteria**: Both build and all tests must pass before task completion.