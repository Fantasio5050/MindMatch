import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'

async function createGroup(page: Page, groupName: string, pseudo: string) {
  await page.goto(`${BASE}/`)
  await page.getByText('Créer un groupe').click()
  await page.getByPlaceholder('Les Inséparables').fill(groupName)
  await page.getByPlaceholder('Alex').fill(pseudo)
  await page.getByRole('button', { name: /Créer et commencer/i }).click()
  await page.waitForURL(/\/lobby/, { timeout: 10000 })
}

async function joinGroup(page: Page, code: string, pseudo: string) {
  await page.goto(`${BASE}/`)
  await page.getByText('Rejoindre avec un code').click()
  await page.getByPlaceholder('AB3XZ').fill(code)
  await page.getByPlaceholder('Sam').fill(pseudo)
  await page.getByRole('button', { name: /Rejoindre et commencer/i }).click()
  await page.waitForURL(/\/lobby/, { timeout: 10000 })
}

async function getCode(page: Page): Promise<string> {
  const text = await page.locator('text=/[A-Z0-9]{5}/').first().textContent()
  return text?.trim() || ''
}

async function startGame(page: Page, gameName: string) {
  const tile = page.getByRole('button', { name: new RegExp(`${gameName}`, 'i') }).first()
  await tile.click()
  await page.waitForTimeout(500)
  await page.getByTestId('launch-game-btn').click()
  await page.waitForTimeout(500)
}

test.describe('New party games should not crash on entry', () => {
  test('One Word Story starts', async ({ browser }) => {
    const host = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await createGroup(host, 'Test OWS', 'Hote')
    const code = await getCode(host)
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await joinGroup(p2, code, 'J2')
    await joinGroup(p3, code, 'J3')
    await startGame(host, "One Word Story")
    await expect(host.locator('text=/histoire commence ici|Votre tour|En attente du mot/').first()).toBeVisible({ timeout: 8000 })
    await host.close(); await p2.close(); await p3.close()
  })

  test('Quiproquo starts', async ({ browser }) => {
    const host = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await createGroup(host, 'Test QQ', 'Hote')
    const code = await getCode(host)
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p4 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await joinGroup(p2, code, 'J2')
    await joinGroup(p3, code, 'J3')
    await joinGroup(p4, code, 'J4')
    await startGame(host, "Quiproquo")
    await expect(host.locator('text=/contrainte|Attends/').first()).toBeVisible({ timeout: 8000 })
    await host.close(); await p2.close(); await p3.close(); await p4.close()
  })

  test('Truth or Dare starts', async ({ browser }) => {
    const host = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await createGroup(host, 'Test ToD', 'Hote')
    const code = await getCode(host)
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await joinGroup(p2, code, 'J2')
    await joinGroup(p3, code, 'J3')
    await startGame(host, "Action ou Vérité")
    await expect(host.locator('text=/Action ou Vérité|Vérité|Action|À toi de jouer/').first()).toBeVisible({ timeout: 8000 })
    await host.close(); await p2.close(); await p3.close()
  })

  test("Time's Up starts", async ({ browser }) => {
    const host = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await createGroup(host, 'Test TU', 'Hote')
    const code = await getCode(host)
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p4 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await joinGroup(p2, code, 'J2')
    await joinGroup(p3, code, 'J3')
    await joinGroup(p4, code, 'J4')
    await startGame(host, "Time's Up")
    await expect(host.locator('text=/Time|Lancer|tour|cartes/').first()).toBeVisible({ timeout: 8000 })
    await host.close(); await p2.close(); await p3.close(); await p4.close()
  })

  test('UNO starts', async ({ browser }) => {
    const host = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await createGroup(host, 'Test UNO', 'Hote')
    const code = await getCode(host)
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await joinGroup(p2, code, 'J2')
    await startGame(host, "UNO")
    await expect(host.locator('text=/UNO|Lancer|Pioche|Ta main/').first()).toBeVisible({ timeout: 8000 })
    await host.close(); await p2.close()
  })

  test('Poker starts', async ({ browser }) => {
    const host = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await createGroup(host, 'Test Poker', 'Hote')
    const code = await getCode(host)
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await joinGroup(p2, code, 'J2')
    await startGame(host, "Poker")
    await expect(host.locator('text=/Poker|Texas|Mode|Normal|Assisté/').first()).toBeVisible({ timeout: 8000 })
    await host.close(); await p2.close()
  })

  test('Loup-Garou starts', async ({ browser }) => {
    const host = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await createGroup(host, 'Test LG', 'Hote')
    const code = await getCode(host)
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p4 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p5 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p6 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p7 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const p8 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await joinGroup(p2, code, 'J2')
    await joinGroup(p3, code, 'J3')
    await joinGroup(p4, code, 'J4')
    await joinGroup(p5, code, 'J5')
    await joinGroup(p6, code, 'J6')
    await joinGroup(p7, code, 'J7')
    await joinGroup(p8, code, 'J8')
    await startGame(host, "Loup-Garou")
    await expect(host.locator('text=/Loup|rôle|village|Nuit/').first()).toBeVisible({ timeout: 8000 })
    await host.close(); await p2.close(); await p3.close(); await p4.close(); await p5.close(); await p6.close(); await p7.close(); await p8.close()
  })
})
