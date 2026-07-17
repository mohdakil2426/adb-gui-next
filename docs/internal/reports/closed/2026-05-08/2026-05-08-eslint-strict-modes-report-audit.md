# ESLint Strict Mode Implementation Report

**Date:** May 8, 2026  
**Research:** Context7, Web Search, Official Documentation

---

## Current State Analysis

### Current ESLint Config (`eslint.config.mjs`)
- Uses `@eslint/js` recommended
- Uses `typescript-eslint` recommended
- Has `react-hooks` and `react-refresh` plugins
- Uses `eslint-config-prettier` for formatting

### Current TypeScript Config (`tsconfig.json`)
- Has `strict: true` ✅
- Missing additional strict flags

---

## Recommended Enhancements

### 1. TypeScript ESLint - Strict Config

Replace `tseslint.configs.recommended` with stricter versions:

| Config | Description | Recommendation |
|--------|-------------|----------------|
| `recommended` | Basic correctness | Current |
| `recommended-type-checked` | Requires type info | **Add** |
| `strict` | Opinionated strict rules | **Upgrade to** |
| `strict-type-checked` | All strict + type aware | **Maximum** |
| `stylistic` | Code style consistency | **Add** |
| `stylistic-type-checked` | Style + type aware | **Add** |

**Recommendation:** Use `strict-type-checked` + `stylistic-type-checked` for maximum enforcement.

### 2. TypeScript Compiler Additional Strict Flags

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    // Already enabled
    "strict": true,
    
    // Additional strict checks (NOT in "strict" umbrella)
    "noUncheckedIndexedAccess": true,    // Array access returns T | undefined
    "noImplicitReturns": true,          // All code paths must return
    "noImplicitOverride": true,          // Require override keyword
    "exactOptionalPropertyTypes": true,  // Optional props: T vs T | undefined
    
    // Module strictness
    "verbatimModuleSyntax": true,         // Cannot use import type interchangeably
    "isolatedModules": true,              // Each file must be standalone
    
    // Enable these existing flags (currently disabled)
    "noUnusedLocals": true,               // Detect unused variables
    "noUnusedParameters": true,          // Detect unused params
  }
}
```

### 3. ESLint Rules to Upgrade to Error

| Rule | Current | Recommended | Reason |
|------|---------|--------------|--------|
| `@typescript-eslint/no-unused-vars` | warn | error | Production grade |
| `@typescript-eslint/no-explicit-any` | off | error | Type safety |
| `@typescript-eslint/consistent-type-imports` | warn | error | Import consistency |
| `react-hooks/exhaustive-deps` | warn | error | Missing dependencies |

### 4. Additional Type-Aware Rules (Require parserOptions.project)

These rules require full type information and catch bugs that TypeScript alone doesn't:

```javascript
{
  rules: {
    // Async safety - catches unhandled promises
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    
    // Null safety - enforces nullish coalescing
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'error',
    
    // Type safety
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
  }
}
```

### 5. React-Specific Strict Rules

```javascript
{
  rules: {
    // JSX
    'react/jsx-boolean-value': ['error', 'never'],
    'react/jsx-no-leaked-render': 'error',
    'react/jsx-no-useless-fragment': 'error',
    
    // Hooks
    'react-hooks/exhaustive-deps': 'error',
    
    // Performance
    'react/no-array-index-key': 'error',
    'react/no-danger': 'warn',
    
    // Accessibility (already good but can be stricter)
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-has-content': 'error',
  }
}
```

### 6. Import Organization Rules

```javascript
{
  rules: {
    'import/order': [
      'error',
      {
        groups: [
          'builtin',     // Node.js built-ins
          'external',     // npm packages
          'internal',    // @/ aliases
          ['parent', 'sibling', 'index'],  // local
        ],
        alphabetize: { order: 'asc' },
        'newlines-between': 'always',
      }
    ],
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'error',
  }
}
```

### 7. Naming Conventions

```javascript
{
  rules: {
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow',
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase'],
      },
      {
        selector: 'interface',
        format: ['PascalCase'],
        prefix: ['I'],  // Optional: require I prefix
      },
    ],
  }
}
```

---

## Implementation Plan

### Phase 1: Quick Wins (Low Risk)

1. Upgrade warn → error for existing rules:
```javascript
'@typescript-eslint/no-unused-vars': 'error',
'@typescript-eslint/consistent-type-imports': 'error',
```

2. Enable unused locals/params in tsconfig:
```json
"noUnusedLocals": true,
"noUnusedParameters": true,
```

### Phase 2: TypeScript Strict (Medium Risk)

1. Update tsconfig with additional strict flags
2. Add `typescript-eslint` strict configs

### Phase 3: Maximum Strict (High Risk - May Need Code Changes)

1. Add type-aware ESLint rules
2. Add all additional rules from above

---

## Estimated Impact

| Phase | Files Affected | Changes Needed |
|-------|---------------|----------------|
| Phase 1 | Few | Minor rule adjustments |
| Phase 2 | Some | tsconfig + ESLint config |
| Phase 3 | Many | Significant code changes |

**Warning:** Phase 3 will likely produce hundreds of lint errors. Plan for a gradual migration.

---

## Alternative: Airbnb Strict Rules

There's a community package `eslint-config-airbnb-extended` with pre-built strict rules:

```bash
bun add -D eslint-config-airbnb-extended
```

This provides:
- 50+ strict import rules
- 30+ strict React rules
- 40+ strict TypeScript rules

---

## Recommendation

Start with **Phase 1** (quick wins) to test the waters, then incrementally add more strict rules as the team adapts.

Would you like me to implement Phase 1 now?