import { test, expect, type Browser, type Page } from '@playwright/test'

/**
 * Les sept jeux ajoutés après la refonte, joués dans le navigateur comme à une vraie table :
 * plusieurs téléphones, une TV, et des actions faites par l'interface.
 *
 * La version précédente de ce fichier vérifiait seulement qu'un écran s'affichait, avec des
 * expressions assez larges (« UNO|Lancer|Pioche|Ta main ») pour passer sur un jeu injouable — et
 * c'est ce qui s'est produit : six jeux sur sept ne pouvaient pas être joués. Ici chaque test
 * vérifie une règle ou un secret précis, et échoue sur la moindre erreur de page (plantage React).
 */

const NOISE = /ytimg|youtube|googleapis|spotify|Failed to load resource|net::|ERR_|favicon/i

interface Table {
  host: Page
  phones: Page[]
  tv: Page
  errors: string[]
}

async function openTable(browser: Browser, pseudos: string[]): Promise<Table> {
  const errors: string[] = []
  const watch = (page: Page, who: string) => {
    page.on('pageerror', (e) => { if (!NOISE.test(e.message)) errors.push(`[${who}] ${e.message}`) })
    page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(`[${who}] ${m.text()}`) })
  }
  const phone = async (who: string) => {
    const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    watch(p, who)
    return p
  }
  const host = await phone(pseudos[0])
  await host.goto('/')
  await host.getByRole('button', { name: /Créer un groupe/ }).click()
  await host.getByPlaceholder('Les Inséparables').fill('E2E')
  await host.getByPlaceholder('Alex').fill(pseudos[0])
  await host.getByRole('button', { name: /Créer et commencer/ }).click()
  await host.waitForURL(/\/lobby/)
  const code = ((await host.locator('span[class*="tracking-[0.2em]"]').first().textContent()) ?? '').trim()
  const phones = [host]
  for (const pseudo of pseudos.slice(1)) {
    const p = await phone(pseudo)
    await p.goto('/')
    await p.getByRole('button', { name: /Rejoindre avec un code/ }).click()
    await p.getByPlaceholder('AB3XZ').fill(code)
    await p.getByPlaceholder('Sam').fill(pseudo)
    await p.getByRole('button', { name: /Rejoindre et commencer/ }).click()
    await p.waitForURL(/\/lobby/)
    phones.push(p)
  }
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  watch(tv, 'TV')
  await tv.goto(`/#/screen/${code}`)
  return { host, phones, tv, errors }
}

/** Lance le jeu et attend que TOUS les téléphones aient rejoint la partie : sans ça, on
 * inspectait des téléphones encore dans le salon. */
async function launch(t: Table, gameName: string) {
  await t.host.locator('button', { hasText: gameName }).first().click()
  await t.host.getByTestId('launch-game-btn').click()
  // Pas de `networkidle` : avec Socket.IO le réseau n'est jamais au repos, l'attente durait
  // jusqu'au délai maximal pour chaque téléphone.
  await Promise.all(t.phones.map((p) => p.waitForURL(/\/play/)))
  await t.host.waitForTimeout(1000)
}

const bodyText = async (p: Page) => ((await p.locator('body').innerText()) ?? '').replace(/\s+/g, ' ')

async function firstWhere(pages: Page[], predicate: (p: Page) => Promise<boolean>): Promise<Page | null> {
  for (const p of pages) if (await predicate(p)) return p
  return null
}

test.describe('Nouveaux jeux — jouables et étanches', () => {
  test('Histoire à un mot : un seul joueur écrit, l’histoire s’affiche en direct', async ({ browser }) => {
    const t = await openTable(browser, ['Hote', 'J2', 'J3'])
    await launch(t, 'One Word Story')
    await t.host.getByRole('button', { name: /Commencer l'histoire/ }).click()
    const writersNow = async () => (await Promise.all(t.phones.map((p) => p.getByPlaceholder('Votre mot…').isVisible()))).filter(Boolean).length
    for (const word of ['Il', 'était', 'une']) {
      // Exactement un téléphone propose la saisie (on attend la fin de la transition entre deux tours).
      await expect.poll(writersNow, { timeout: 5000 }).toBe(1)
      const writer = await firstWhere(t.phones, (p) => p.getByPlaceholder('Votre mot…').isVisible())
      const input = writer!.getByPlaceholder('Votre mot…')
      await input.fill(word)
      await input.press('Enter')
      await expect(input).toBeHidden()
    }
    await expect(t.tv.locator('body')).toContainText('Il était une')
    expect(t.errors).toEqual([])
  })

  test('Action ou Vérité : la carte s’affiche et le groupe rend le verdict', async ({ browser }) => {
    const t = await openTable(browser, ['Hote', 'J2', 'J3'])
    await launch(t, 'Action ou Vérité')
    const chooser = await firstWhere(t.phones, async (p) => (await bodyText(p)).includes('Action ou Vérité ?'))
    expect(chooser).not.toBeNull()
    await chooser!.getByRole('button', { name: /Vérité/ }).first().click()
    await expect(chooser!.locator('body')).toContainText(/Exécute-toi/i)
    for (const p of t.phones) {
      const b = p.getByRole('button', { name: /Validé/ })
      if (await b.isVisible()) await b.click()
    }
    await expect(t.host.locator('body')).toContainText(/Validé par le groupe/i)
    expect(t.errors).toEqual([])
  })

  test("Time's Up : la carte n'existe que sur le téléphone de celui qui fait deviner", async ({ browser }) => {
    const t = await openTable(browser, ['Hote', 'J2', 'J3', 'J4'])
    await launch(t, "Time's Up")
    const describer = await firstWhere(t.phones, (p) => p.getByRole('button', { name: /Je suis prêt/ }).isVisible())
    expect(describer).not.toBeNull()
    await describer!.getByRole('button', { name: /Je suis prêt/ }).click()
    const card = ((await describer!.locator('.font-display.text-3xl').first().textContent()) ?? '').trim()
    expect(card).not.toBe('')
    expect(await bodyText(t.tv)).not.toContain(card)
    for (const p of t.phones.filter((x) => x !== describer)) expect(await bodyText(p)).not.toContain(card)
    await describer!.getByRole('button', { name: /^Trouvé$/ }).click()
    await expect(t.tv.locator('body')).toContainText(card)
    expect(t.errors).toEqual([])
  })

  test('Quiproquo : chacun ne voit que sa contrainte, la TV aucune', async ({ browser }) => {
    const t = await openTable(browser, ['Hote', 'J2', 'J3', 'J4'])
    await launch(t, 'Quiproquo')
    const constraints: string[] = []
    for (const p of t.phones) constraints.push(((await p.locator('.text-xl.font-bold').first().textContent()) ?? '').trim())
    expect(new Set(constraints).size).toBe(4)
    const tv = await bodyText(t.tv)
    for (const c of constraints) expect(tv).not.toContain(c)
    await expect(t.phones[1].getByRole('button', { name: /Lancer la discussion/ })).toHaveCount(0)
    expect(t.errors).toEqual([])
  })

  test('UNO : on pose des cartes jusqu’à ce que la main tourne', async ({ browser }) => {
    const t = await openTable(browser, ['Hote', 'J2'])
    await launch(t, 'UNO')
    await t.host.getByRole('button', { name: /Lancer la partie/ }).click()
    let played = 0
    for (let i = 0; i < 12; i++) {
      const p = await firstWhere(t.phones, async (x) => (await bodyText(x)).includes('À toi'))
      if (!p) continue
      const playable = p.locator('button.w-16.h-24:not([disabled])')
      if (await playable.count()) {
        await playable.first().click()
        if ((await bodyText(p)).includes('Choisis une couleur')) {
          await p.getByRole('button', { name: /Bleu/ }).click()
          await p.getByRole('button', { name: /^Confirmer$/ }).click()
        }
        played++
      } else {
        const draw = p.getByRole('button', { name: /Piocher une carte|Garder la carte et passer/ })
        await draw.click()
      }
      await p.waitForTimeout(400)
    }
    expect(played).toBeGreaterThan(3)
    await expect(t.tv.locator('body')).toContainText(/\d+ cartes?/)
    expect(t.errors).toEqual([])
  })

  test('Poker : une main complète va jusqu’à l’abattage', async ({ browser }) => {
    const t = await openTable(browser, ['Hote', 'J2', 'J3'])
    await launch(t, 'Poker')
    for (const p of t.phones) await p.getByRole('button', { name: /Mode Normal/ }).click()
    await t.host.getByRole('button', { name: /Distribuer les cartes/ }).click()
    await expect(t.host.locator('body')).toContainText(/tes cartes/i)
    for (let i = 0; i < 30; i++) {
      if (/abattage/i.test(await bodyText(t.host))) break
      const actor = await firstWhere(t.phones, (p) => p.getByRole('button', { name: /Checker|Suivre/ }).first().isVisible())
      if (actor) await actor.getByRole('button', { name: /Checker|Suivre/ }).first().click()
      await t.host.waitForTimeout(300)
    }
    await expect(t.host.locator('body')).toContainText(/ramasse|pot partagé/i)
    expect(t.errors).toEqual([])
  })

  test('Loup-Garou : chacun voit son rôle, la TV aucun, la première nuit se joue', async ({ browser }) => {
    test.setTimeout(180000)
    const t = await openTable(browser, ['Hote', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8'])
    await launch(t, 'Loup-Garou')
    const roles = ['Loup-Garou', 'Voyante', 'Sorcière', 'Chasseur', 'Cupidon', 'Salvateur', 'Petite Fille']
    let wolves = 0
    for (const p of t.phones) if ((await bodyText(p)).includes('Loup-Garou')) wolves++
    expect(wolves).toBe(2)
    const tv = await bodyText(t.tv)
    for (const r of roles) expect(tv).not.toContain(r)
    await t.host.getByRole('button', { name: /Lancer la première nuit/ }).click()
    // Chaque étape de nuit, jouée par le téléphone concerné (les hooks plantaient ici).
    const pick = async (p: Page, n = 1) => {
      for (let k = 0; k < n; k++) await p.locator('button[class*="p-2.5"]').nth(k).click()
    }
    for (let i = 0; i < 20; i++) {
      if ((await bodyText(t.host)).includes('Le village se réveille')) break
      for (const p of t.phones) {
        const txt = await bodyText(p)
        if (txt.includes('Choisis deux amoureux')) { await pick(p, 2); await p.getByRole('button', { name: /Unir/ }).click(); break }
        if (txt.includes('Qui veux-tu sonder')) { await pick(p); await p.getByRole('button', { name: /Voir son rôle/ }).click(); await p.getByRole('button', { name: /Refermer les yeux/ }).click(); break }
        if (txt.includes('Qui protèges-tu')) { await pick(p); await p.getByRole('button', { name: /^Protéger$/ }).click(); break }
        if (txt.includes('Qui dévorez-vous') && !txt.includes('Changer ma cible')) { await pick(p); await p.getByRole('button', { name: /^Dévorer$/ }).click(); break }
        if (txt.includes('Garder les yeux fermés')) { await p.getByRole('button', { name: /Garder les yeux fermés/ }).click(); break }
        if (txt.includes('Les loups ont attaqué')) { await p.getByRole('button', { name: /Refermer les yeux/ }).click(); break }
      }
      await t.host.waitForTimeout(400)
    }
    await expect(t.host.locator('body')).toContainText(/Le village se réveille|chasseur/i)
    expect(t.errors).toEqual([])
  })
})
