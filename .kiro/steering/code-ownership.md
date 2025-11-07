---
inclusion: always
---

# Code Ownership and Responsibility

## Absolute Ownership Rules

**You are responsible for ALL code in the codebase, not only code you change or touch.**

### Test Failure Policy

- **Any change you introduce that breaks a test is a failure** - even if the test is in a completely different file
- **Any test failure must be fixed before marking a task complete** - no exceptions for "unrelated" failures
- **You cannot rationalize around test failures** - if tests fail after your changes, you must fix them

### Test Coverage Policy

- **Any change you introduce without a test is a failure**
- New functionality requires corresponding tests
- Modified functionality requires updated tests
- Bug fixes require tests that would have caught the bug

### No Excuses

- "The test was already flaky" - fix it
- "The test is unrelated to my changes" - fix it anyway
- "The test is timing-based" - make it reliable
- "I only changed types/documentation" - all tests must still pass

### Task Completion Criteria

A task is ONLY complete when:
1. All code changes are implemented
2. All tests pass (including pre-existing tests)
3. New/modified code has test coverage
4. `npm run build && npm run test` returns exit code 0

**Zero tolerance for test failures or missing tests.**
