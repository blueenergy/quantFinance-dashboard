# Playwright smoke (mocked API)

Browser smoke tests live under `e2e/`. They run against `vite preview`
(built `dist/`) and **mock all `/api/**` traffic** — no live backend.

## Commands

```bash
# one-time: install browser binary
npx playwright install chromium

# build then smoke
npm run build
npm run test:e2e

# interactive UI
npm run test:e2e:ui
```

## Coverage (first slice)

1. Unauthenticated → login form visible  
2. Login via mocked `/api/auth/login` → app shell + nav tabs  
3. Seeded session → open 自选股 tab + notification panel  

Stable selectors use `data-testid` on login, shell, nav tabs, and notifications.
