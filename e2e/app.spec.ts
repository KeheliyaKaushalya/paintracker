import { expect, test, type Page } from '@playwright/test'
import { freshState, installMockBackend, ME, NURSE2, P1, type MockState } from './mockBackend'

let state: MockState

async function start(page: Page, over: Partial<MockState> = {}) {
  state = { ...freshState(), ...over }
  if (over.role === 'admin') state.profiles[0].role = 'admin'
  if (over.active === false) state.profiles[0].active = false
  await installMockBackend(page, state)
}

async function login(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await page.getByLabel('Email').fill('nurse@example.com')
  await page.getByLabel('Password').fill('correct-horse')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('logged-out visitors are sent to the login page', async ({ page }) => {
  await start(page)
  await page.goto('/patients/' + P1)
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByLabel('Password')).toBeVisible()
})

test('wrong password is refused, right password shows the board', async ({ page }) => {
  await start(page)
  await page.goto('/')
  await page.getByLabel('Email').fill('nurse@example.com')
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('not correct')
  await page.getByLabel('Password').fill('correct-horse')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Ward board' })).toBeVisible()
  await expect(page.getByText('2 active patients')).toBeVisible()
  await expect(page.getByText('Demo Patient One')).toBeVisible()
  await expect(page.getByText('Urgent review').first()).toBeVisible()
})

test('an unapproved user sees only the waiting screen', async ({ page }) => {
  await start(page, { active: false })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible()
  await expect(page.getByText('Demo Patient One')).toHaveCount(0)
})

test('board search and category filter work', async ({ page }) => {
  await start(page)
  await login(page)
  await page.getByPlaceholder('Search name or BHT').fill('0002')
  await expect(page.getByText('Demo Patient Two')).toBeVisible()
  await expect(page.getByText('Demo Patient One')).toHaveCount(0)
  await page.getByPlaceholder('Search name or BHT').fill('')
  await page.getByRole('tab', { name: /Difficult airway/ }).click()
  await expect(page.getByText('No patients match these filters')).toBeVisible()
})

test('patient page shows alerts, medications, chart and rounds', async ({ page }) => {
  await start(page)
  await login(page)
  await page.getByText('Demo Patient One').click()
  await expect(page.getByRole('heading', { name: 'Demo Patient One' })).toBeVisible()
  await expect(page.getByText('Keep catheter until reviewed')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Paracetamol' })).toBeVisible()
  await expect(page.locator('.chart-wrap canvas').first()).toBeVisible()
  await expect(page.getByTestId('round-item')).toHaveCount(2)
})

test('adding a pain round: warns about severe pain, saves, records the right values', async ({ page }) => {
  await start(page)
  await login(page)
  await page.getByText('Demo Patient One').click()
  await page.getByRole('link', { name: 'Pain round' }).click()
  await page.getByRole('button', { name: 'Rest pain 3 out of 10' }).click()
  await page.getByRole('button', { name: 'Movement pain 8 out of 10' }).click()
  await expect(page.getByText('8 - Severe ▲')).toBeVisible()
  await page.getByLabel('SpO2 %').fill('92')
  await page.getByLabel('BP (120/80)').fill('128/82')
  await expect(page.getByText('Please double-check')).toBeVisible()
  await expect(page.getByText('SpO2 92% is low')).toBeVisible()
  await page.getByRole('button', { name: 'Urgent review' }).click()
  await page.getByRole('button', { name: 'Save round' }).click()
  await expect(page.getByRole('heading', { name: 'Demo Patient One' })).toBeVisible()
  await expect(page.getByTestId('round-item')).toHaveCount(3)
  await expect(page.getByText('Movement 8 ▲ Severe')).toBeVisible()
  const saved = state.rounds.at(-1)!
  expect(saved).toMatchObject({ kind: 'pain', pain_rest: 3, pain_move: 8, spo2: 92, bp_sys: 128, bp_dia: 82, created_by: ME, tags: ['Urgent review'] })
})

test('typos are blocked with a clear message and nothing is sent', async ({ page }) => {
  await start(page)
  await login(page)
  await page.getByText('Demo Patient One').click()
  await page.getByRole('link', { name: 'Pain round' }).click()
  const before = state.rounds.length
  await page.getByRole('button', { name: 'Save round' }).click()
  await expect(page.getByText('Choose a rest pain score')).toBeVisible()
  await page.getByRole('button', { name: 'Rest pain 3 out of 10' }).click()
  await page.getByRole('button', { name: 'Movement pain 4 out of 10' }).click()
  await page.getByLabel('SpO2 %').fill('980')
  await page.getByRole('button', { name: 'Save round' }).click()
  await expect(page.getByText(/SpO2 must be between 0 and 100/)).toBeVisible()
  expect(state.rounds.length).toBe(before)
})

test('correcting a round keeps the original as an earlier version', async ({ page }) => {
  await start(page)
  await login(page)
  await page.getByText('Demo Patient One').click()
  await page.getByRole('link', { name: 'Correct this round' }).first().click()
  await expect(page.getByRole('heading', { name: 'Correct round' })).toBeVisible()
  await page.getByRole('button', { name: 'Movement pain 2 out of 10' }).click()
  await page.getByRole('button', { name: 'Save correction' }).click()
  await expect(page.getByTestId('round-item')).toHaveCount(2)
  await expect(page.getByText('Corrected')).toBeVisible()
  await page.getByText(/Earlier version/).click()
  await expect(state.rounds).toHaveLength(3)
  expect(state.rounds.at(-1)!.amended_of).toBeTruthy()
})

test('offline: the round is kept on the phone, flagged as unsent, then sent by itself when the connection returns', async ({ page, context }) => {
  await start(page)
  await login(page)
  await page.getByText('Demo Patient One').click()
  await page.getByRole('link', { name: 'Pain round' }).click()
  await page.getByRole('button', { name: 'Rest pain 1 out of 10' }).click()
  await page.getByRole('button', { name: 'Movement pain 2 out of 10' }).click()
  state.offline = true
  await context.setOffline(true)
  const before = state.rounds.length
  await page.getByRole('button', { name: 'Save round' }).click()
  await expect(page.getByText(/NOT YET SENT/)).toBeVisible()
  await expect(page.getByText('1 entry not yet sent.')).toBeVisible()
  expect(state.rounds.length).toBe(before)

  state.offline = false
  await context.setOffline(false) // the phone fires "online"; the app sends without being asked
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText(/not yet sent/)).toHaveCount(0)
  expect(state.rounds.length).toBe(before + 1)
  expect(state.rounds.at(-1)).toMatchObject({ pain_rest: 1, pain_move: 2, created_by: ME })
})

test('offline: if the phone is online but the server is still down, the entry stays and "Send now" works later', async ({ page, context }) => {
  await start(page)
  await login(page)
  await page.getByText('Demo Patient One').click()
  await page.getByRole('link', { name: 'Pain round' }).click()
  await page.getByRole('button', { name: 'Rest pain 4 out of 10' }).click()
  await page.getByRole('button', { name: 'Movement pain 5 out of 10' }).click()
  state.offline = true
  await context.setOffline(true)
  const before = state.rounds.length
  await page.getByRole('button', { name: 'Save round' }).click()
  await expect(page.getByText('1 entry not yet sent.')).toBeVisible()

  await context.setOffline(false) // phone says online, but the server is still unreachable
  await page.waitForTimeout(800)
  await expect(page.getByText('1 entry not yet sent.')).toBeVisible()
  expect(state.rounds.length).toBe(before)

  state.offline = false // server is back
  await page.getByRole('button', { name: 'Send now' }).click()
  await expect(page.getByText(/not yet sent/)).toHaveCount(0)
  expect(state.rounds.length).toBe(before + 1)
})

test('adding a patient with an epidural and a medication', async ({ page }) => {
  await start(page)
  await login(page)
  await page.getByRole('link', { name: 'Add patient' }).click()
  await page.getByRole('button', { name: 'Add patient' }).click()
  await expect(page.getByText('Name is required')).toBeVisible()
  await expect(page.getByText('BHT number is required')).toBeVisible()
  await page.getByLabel('Full name').fill('Fresh Patient')
  await page.getByLabel('BHT number').fill('NEW/001')
  await page.getByLabel('Age').fill('55')
  await page.locator('summary', { hasText: 'Pain management' }).click()
  await page.getByRole('button', { name: 'Epidural' }).click()
  await page.getByLabel(/Level/).fill('T10-T11')
  await page.getByRole('button', { name: /Add medication/ }).click()
  await page.getByLabel('Dose', { exact: true }).fill('1 g')
  await page.getByRole('button', { name: 'Add patient' }).click()
  await expect(page.getByRole('heading', { name: 'Fresh Patient' })).toBeVisible()
  await expect(page.getByText('Epidural T10-T11').first()).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Paracetamol' })).toBeVisible()
  expect(state.patients.at(-1)).toMatchObject({ bht: 'NEW/001', age: 55, has_epidural: true, ep_level: 'T10-T11', created_by: ME })
})

test('a duplicate BHT is explained in plain words', async ({ page }) => {
  await start(page)
  await login(page)
  await page.getByRole('link', { name: 'Add patient' }).click()
  await page.getByLabel('Full name').fill('Someone')
  await page.getByLabel('BHT number').fill('DEMO/0001')
  await page.getByRole('button', { name: 'Add patient' }).click()
  await expect(page.getByText('A patient with that BHT number already exists.')).toBeVisible()
})

test('discharge moves a patient to the Discharged list and back', async ({ page }) => {
  await start(page)
  await login(page)
  await page.getByText('Demo Patient Two').click()
  await page.getByRole('button', { name: 'Discharge patient' }).click()
  await page.getByRole('button', { name: 'Discharge', exact: true }).click()
  await expect(page.getByText('1 active patients')).toBeVisible()
  await page.getByRole('link', { name: 'Discharged' }).click()
  await expect(page.getByText('Demo Patient Two')).toBeVisible()
  await page.getByText('Demo Patient Two').click()
  await page.getByRole('button', { name: 'Return to board' }).first().click()
  await page.getByRole('button', { name: 'Return to board' }).last().click()
  await page.getByRole('link', { name: 'Board' }).click()
  await expect(page.getByText('2 active patients')).toBeVisible()
})

test('light and dark mode: pure white and pure black, remembered after reload', async ({ page }) => {
  await start(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Ward board' })).toBeVisible()
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(await bg()).toBe('rgb(255, 255, 255)')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await bg()).toBe('rgb(0, 0, 0)')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('link', { name: 'Your profile' }).click()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'System' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('a nurse does not see Team and is blocked from its address', async ({ page }) => {
  await start(page)
  await login(page)
  await expect(page.getByRole('link', { name: 'Team' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Your profile' }).click()
  await page.goto('/team')
  await expect(page.getByText('Administrators only')).toBeVisible()
})

test('an admin sees Team and can approve a waiting user', async ({ page }) => {
  await start(page, { role: 'admin' })
  await login(page)
  await page.getByRole('link', { name: 'Team' }).click()
  await expect(page.getByText('Nurse Pending')).toBeVisible()
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect.poll(() => state.profiles.find((p) => p.id === NURSE2)!.active).toBe(true)
  await expect(page.getByText('Waiting for approval')).toHaveCount(0)
})

test('a user with no name is nudged to add one, and it shows up after saving', async ({ page }) => {
  await start(page)
  state.profiles[0].full_name = ''
  await login(page)
  await expect(page.getByText('Add your name so rounds show who recorded them.')).toBeVisible()
  await page.getByRole('link', { name: 'Add name' }).click()
  await page.getByLabel(/Your name/).fill('Dr. A. Silva')
  await page.getByRole('button', { name: 'Save name' }).click()
  await expect(page.getByText('Name saved')).toBeVisible()
  expect(state.profiles[0].full_name).toBe('Dr. A. Silva')
  await page.getByRole('link', { name: 'Board' }).click()
  await expect(page.getByText('Add your name so rounds show who recorded them.')).toHaveCount(0)
})

test('changing your password: too short and mismatched are refused, then it works', async ({ page }) => {
  await start(page)
  await login(page)
  await page.getByRole('link', { name: 'Your profile' }).click()
  await page.getByLabel('New password').fill('short')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('Use at least 12 characters.')).toBeVisible()
  await page.getByLabel('New password').fill('a-long-new-passphrase')
  await page.getByLabel('Type it again').fill('something-different-1')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('The two passwords do not match.')).toBeVisible()
  await page.getByLabel('Type it again').fill('a-long-new-passphrase')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('Password changed')).toBeVisible()
  expect(state.password).toBe('a-long-new-passphrase')
})

test('no sideways scrolling on a phone, on the main screens', async ({ page }) => {
  await start(page)
  await login(page)
  for (const path of ['/', '/patients/' + P1, '/patients/new', '/patients/' + P1 + '/round', '/profile']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1)
  }
})

test('signs out after being idle', async ({ page }) => {
  await page.clock.install()
  await start(page)
  await login(page)
  await expect(page.getByRole('heading', { name: 'Ward board' })).toBeVisible()
  await page.clock.fastForward('06:00')
  await expect(page).toHaveURL(/\/login/)
})
