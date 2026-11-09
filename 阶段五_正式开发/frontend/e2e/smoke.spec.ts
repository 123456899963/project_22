import { expect, test } from '@playwright/test'

test('首页展示六大茶类', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '六大茶类' })).toBeVisible()
  await expect(page.locator('.category-card')).toHaveCount(6)
})

test('后台开发登录后进入工作台', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('openid').fill('dev_openid_001')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible()
})

test('前台核心链路：列表 → 详情 → 收藏 → 搜索', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('openid').fill('dev_openid_001')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/localhost:5173\/me$/)

  await page.goto('/teas/green')
  await expect(page.getByRole('heading', { name: '绿茶' })).toBeVisible()
  const firstCard = page.locator('.tea-card').first()
  await expect(firstCard).toBeVisible()
  const teaName = (await firstCard.locator('.tea-card__name').innerText()).trim()

  await firstCard.click()
  await expect(page).toHaveURL(/\/tea\/\d+$/)
  await expect(page.locator('.detail-title')).toHaveText(teaName)

  await page.getByRole('button', { name: '加入收藏' }).click()
  await expect(page.getByText('已加入收藏')).toBeVisible()

  await page.goto('/search')
  await page.getByPlaceholder('例如：龙井、凤凰单丛、安溪').fill(teaName)
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.locator('.result-item').first()).toBeVisible()
})
