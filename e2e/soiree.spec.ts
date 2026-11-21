import { test, expect, type Browser, type Page } from '@playwright/test'
import { installFakeYouTube } from './support/fake-youtube'

/**
 * Le Mode Soirée joué comme à une vraie table : deux téléphones et une platine.
 *
 * Aucun appel à YouTube : la platine reçoit une fausse API IFrame (e2e/support/fake-youtube.ts) qui
 * fait réellement tourner le moteur — deux decks, fin de morceau, fondu enchaîné — et les téléphones
 * reçoivent des titres simulés pour les liens collés. On vérifie le chemin complet : lancement par
 * l'hôte, platine qui prend la main, ajouts par lien, réaction, vote pour passer entre membres
 * connectés, puis mode continu quand la file est vide.
 */

const NOISE = /ytimg|youtube|googleapis|spotify|Failed to load resource|net::|ERR_|favicon/i
const FIRST = 'dQw4w9WgXcQ'
const SECOND = 'kJQP7kiw5Fk'
const TITLES: Record<string, string> = { [FIRST]: 'Morceau un', [SECOND]: 'Morceau deux' }

async function phone(browser: Browser, errors: string[], who: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await installFakeYouTube(ctx)
  // Titres des liens collés : réponse simulée de notre propre serveur.
  await ctx.route('**/api/youtube/meta**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id') ?? ''
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: TITLES[id] ?? 'Inconnu', artist: 'E2E' }) })
  })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => {
    if (!NOISE.test(e.message)) errors.push(`[${who}] ${e.message}`)
  })
  p.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(`[${who}] ${m.text()}`)
  })
  return p
}

// Les pages de ce test (deux téléphones, une platine) ne doivent pas tourner pendant les suivants.
test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((c) => c.close()))
})

async function addByLink(p: Page, link: string) {
  await p.getByRole('button', { name: /^Ajouter$/ }).click()
  await p.getByLabel('Rechercher un morceau ou coller un lien').fill(link)
  await expect(p.getByText('Lien reconnu')).toBeVisible()
  await p.getByRole('button', { name: 'Ajouter à la file' }).click()
}

test('Mode Soirée : platine, ajouts par lien, réaction, vote pour passer, mode continu', async ({ browser }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  const host = await phone(browser, errors, 'Hote')
  await host.goto('/')
  await host.getByRole('button', { name: /Créer un groupe/ }).click()
  await host.getByPlaceholder('Les Inséparables').fill('E2E Soirée')
  await host.getByPlaceholder('Alex').fill('Hote')
  await host.getByRole('button', { name: /Créer et commencer/ }).click()
  await host.waitForURL(/\/lobby/)
  const code = ((await host.locator('span[class*="tracking-[0.2em]"]').first().textContent()) ?? '').trim()
  expect(code).toMatch(/^[A-Z0-9]{5}$/)

  const guest = await phone(browser, errors, 'Invite')
  await guest.goto('/')
  await guest.getByRole('button', { name: /Rejoindre avec un code/ }).click()
  await guest.getByPlaceholder('AB3XZ').fill(code)
  await guest.getByPlaceholder('Sam').fill('Invite')
  await guest.getByRole('button', { name: /Rejoindre et commencer/ }).click()
  await guest.waitForURL(/\/lobby/)

  // L'hôte lance la soirée (YouTube) et arrive sur la platine partagée ; l'invité, lui, n'est pas
  // déplacé de force : une bannière l'y mène.
  await host.getByRole('button', { name: 'Lancer le Mode Soirée' }).click()
  await host.getByRole('button', { name: /YouTube/ }).click()
  await host.waitForURL(/\/soiree/)
  await expect(host.getByText('Aucune platine pour l’instant')).toBeVisible()
  await guest.getByRole('button', { name: /Soirée/ }).first().click()
  await guest.waitForURL(/\/soiree/)

  // La platine (un portable relié à l'enceinte) prend la main.
  const platineCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await installFakeYouTube(platineCtx)
  const platine = await platineCtx.newPage()
  platine.on('pageerror', (e) => {
    if (!NOISE.test(e.message)) errors.push(`[platine] ${e.message}`)
  })
  await platine.goto(`/#/platine/${code}`)
  await platine.getByRole('button', { name: /Démarrer la platine/ }).click()
  await expect(platine.getByText('Le son sort ici')).toBeVisible()
  await expect(host.getByText('Aucune platine pour l’instant')).toBeHidden()

  // Ajouts par lien collé : le premier part tout de suite, le second est « le prochain ».
  await addByLink(host, `https://youtu.be/${FIRST}`)
  await expect(host.getByText(/Ajouté — ça joue maintenant/)).toBeVisible()
  await addByLink(guest, `https://www.youtube.com/watch?v=${SECOND}`)
  await expect(guest.getByText(/Ajouté — c’est le prochain/)).toBeVisible()
  await expect(platine.locator(`[data-fake-yt][data-video="${FIRST}"][data-state="1"]`)).toHaveCount(1)
  await expect(platine.getByRole('heading', { name: 'Morceau un' })).toBeVisible()

  // Une réaction de l'invité se compte chez l'hôte.
  await guest.getByRole('button', { name: /^En cours$/ }).click()
  await host.getByRole('button', { name: /^En cours$/ }).click()
  await guest.getByRole('button', { name: 'Réagir 🔥' }).click()
  await expect(host.getByRole('button', { name: 'Réagir 🔥' })).toContainText('1')

  // Vote pour passer : deux membres connectés, il faut deux voix.
  const vote = host.getByRole('button', { name: /Voter pour passer|Tu veux passer/ })
  await expect(vote).toContainText('0/2')
  await vote.click()
  await expect(vote).toContainText('1/2')
  await expect(host.getByRole('heading', { name: 'Morceau un' })).toBeVisible()
  await guest.getByRole('button', { name: /Voter pour passer/ }).click()
  await expect(host.getByRole('heading', { name: 'Morceau deux' })).toBeVisible()
  await expect(platine.locator(`[data-fake-yt][data-video="${SECOND}"][data-state="1"]`)).toHaveCount(1)

  // File vide : le mode continu propose de repiocher « Morceau un » (le plus applaudi)…
  await expect(host.getByText('Ensuite · mode continu')).toBeVisible()
  // … et la platine l'enchaîne en fondu à la fin du morceau : on avance son horloge.
  await platine.evaluate('window.__ytPlayers.filter((p) => p.state === 1).forEach((p) => { p.t = p.dur - 6 })')
  await expect(host.getByRole('heading', { name: 'Morceau un' })).toBeVisible({ timeout: 15_000 })
  await expect(host.getByText('En cours · mode continu')).toBeVisible()

  expect(errors).toEqual([])
})
