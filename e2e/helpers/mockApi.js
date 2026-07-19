/**
 * Shared API mocks for smoke E2E.
 * Covers auth bootstrap + navigation + notifications + catch-all.
 */

export const SMOKE_USER = {
  id: 'e2e-user-1',
  username: 'e2e_smoke',
  email: 'e2e@example.com',
  full_name: 'E2E Smoke',
  email_verified: true,
  is_admin: false,
  service_level: 'pro',
  active_llm_config_id: null,
}

export const SMOKE_VISIBLE_TABS = [
  'watchlist',
  'ranking',
  'stock-workbench',
  'user-profile',
  'global-market-brief',
  'data-pulse',
  'market-analysis',
]

/**
 * @param {import('@playwright/test').Page} page
 */
export async function installApiMocks(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const method = request.method().toUpperCase()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api/, '') || '/'

    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })

    // Auth / profile (fetch + request)
    if (path === '/auth/login' && method === 'POST') {
      return json({
        access_token: 'e2e-token',
        token_type: 'bearer',
        user: SMOKE_USER,
      })
    }

    if (path === '/user/profile' && method === 'GET') {
      return json({ success: true, user: SMOKE_USER })
    }

    if (path === '/user/navigation-tabs' && method === 'GET') {
      return json({
        success: true,
        data: { visible_tab_ids: SMOKE_VISIBLE_TABS },
      })
    }

    // Notifications
    if (path === '/notifications/settings' && method === 'GET') {
      return json({
        success: true,
        data: { email_enabled: true, push_enabled: false },
      })
    }

    if (path === '/notifications' && method === 'GET') {
      return json({
        success: true,
        data: {
          notifications: [
            {
              _id: 'n1',
              title: 'E2E smoke notification',
              message: 'Playwright mock',
              is_read: false,
              created_at: Math.floor(Date.now() / 1000),
            },
          ],
          unread_count: 1,
        },
      })
    }

    // Watchlist / common reads
    if (path === '/user/watchlist' && method === 'GET') {
      return json({ success: true, data: { symbols: ['000001.SZ'] } })
    }

    if (path === '/user/watchlist-stocks' && method === 'GET') {
      return json({
        success: true,
        data: [{ symbol: '000001.SZ', name: '平安银行' }],
      })
    }

    if (path === '/user/watchlist-stocks/realtime' && method === 'GET') {
      return json({ success: true, data: [] })
    }

    // Home summary / market reads — soft empty success
    if (method === 'GET' || method === 'HEAD') {
      return json({ success: true, data: null })
    }

    return json({ success: true })
  })
}

/**
 * Seed authenticated session before first navigation.
 * @param {import('@playwright/test').Page} page
 */
export async function seedAuthenticatedSession(page) {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('access_token', token)
      localStorage.setItem('user_info', JSON.stringify(user))
      sessionStorage.clear()
    },
    { token: 'e2e-token', user: SMOKE_USER },
  )
}
