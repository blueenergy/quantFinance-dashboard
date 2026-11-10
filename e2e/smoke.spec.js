import { test, expect } from '@playwright/test'
import {
  installApiMocks,
  seedAuthenticatedSession,
  SMOKE_USER,
} from './helpers/mockApi.js'

test.describe('smoke (mocked API)', () => {
  test('unauthenticated visitors see the login form', async ({ page }) => {
    await installApiMocks(page)
    await page.goto('/')
    await expect(page.getByTestId('login-page')).toBeVisible()
    await expect(page.getByTestId('login-username')).toBeVisible()
    await expect(page.getByTestId('login-submit')).toBeVisible()
    await expect(page.getByTestId('app-shell')).toHaveCount(0)
  })

  test('login form can authenticate via mocked /api/auth/login', async ({ page }) => {
    await installApiMocks(page)
    await page.goto('/')

    await page.getByTestId('login-username').fill(SMOKE_USER.username)
    await page.getByTestId('login-password').fill('password123')
    await page.getByTestId('login-submit').click()

    await expect(page.getByTestId('app-shell')).toBeVisible()
    await expect(page.getByTestId('app-title')).toContainText('悟空量化')
    await expect(page.getByTestId('nav-sidebar')).toBeVisible()
    await expect(page.getByTestId('nav-group-stock')).toBeVisible()
  })

  test('authenticated shell loads nav, opens watchlist tab, and notification panel', async ({
    page,
  }) => {
    await installApiMocks(page)
    await seedAuthenticatedSession(page)
    await page.goto('/')

    await expect(page.getByTestId('app-shell')).toBeVisible()
    await expect(page.getByTestId('notification-center')).toBeVisible()
    await expect(page.getByTestId('nav-sidebar')).toBeVisible()
    await expect(page.getByTestId('nav-group-stock')).toBeVisible()

    await page.getByTestId('nav-group-stock').click()
    await expect(page.getByTestId('nav-tab-watchlist')).toBeVisible()
    await page.getByTestId('nav-group-screening').click()
    await expect(page.getByTestId('nav-tab-ranking')).toBeVisible()
    await page.getByTestId('nav-group-stock').click()
    await page.getByTestId('nav-tab-watchlist').click()
    await expect(page.getByTestId('nav-tab-watchlist')).toHaveClass(/active/)
    // Watchlist view mounts (async chunk); wait for something stable from that tab.
    await expect(page.locator('.watchlist-view, .user-status, table').first()).toBeVisible({
      timeout: 15_000,
    })

    await page.getByTestId('notification-bell').click()
    await expect(page.getByTestId('notification-panel')).toBeVisible()
    await expect(page.getByTestId('notification-panel')).toContainText('E2E smoke notification')
    await expect(page.getByTestId('notification-badge')).toHaveText('1')
  })
})

test.describe('narrow viewport (mocked API)', () => {
  test.use({ viewport: { width: 1024, height: 800 } })

  test('opens the sidebar drawer and navigates to watchlist', async ({ page }) => {
    await installApiMocks(page)
    await seedAuthenticatedSession(page)
    await page.goto('/')

    await expect(page.getByTestId('app-shell')).toBeVisible()
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible()

    await page.getByTestId('nav-menu-toggle').click()
    await expect(page.getByTestId('nav-group-stock')).toBeVisible()
    await page.getByTestId('nav-group-stock').click()
    await expect(page.getByTestId('nav-tab-watchlist')).toBeVisible()

    await page.getByTestId('nav-tab-watchlist').click()
    await expect(page.getByTestId('nav-tab-watchlist')).toHaveClass(/active/)
  })
})
