#!/usr/bin/env node

import { createInterface } from 'node:readline'
import * as rivian from './lib/rivian-api.js'
import { formatOTAStatus, formatVehicleState } from './lib/format.js'
import { loadSession, saveSession } from './lib/session.js'
import { logo, c } from './lib/ui.js'

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function promptSecret(question) {
  return new Promise((resolve) => {
    process.stderr.write(question)
    const stdin = process.stdin
    const wasRaw = stdin.isRaw ?? false
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    let input = ''
    const onData = (ch) => {
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        stdin.removeListener('data', onData)
        stdin.setRawMode(wasRaw)
        stdin.pause()
        process.stderr.write('\n')
        resolve(input)
      } else if (ch === '\u007f' || ch === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1)
          process.stderr.write('\b \b')
        }
      } else if (ch === '\u0003') {
        stdin.setRawMode(wasRaw)
        process.exit(130)
      } else {
        input += ch
        process.stderr.write('*')
      }
    }
    stdin.on('data', onData)
  })
}

async function ensureAuth() {
  const result = loadSession(rivian)
  if (result === true) return

  if (result === 'expired') {
    const refreshed = await rivian.refreshSession()
    if (refreshed) {
      saveSession(rivian)
      return
    }
    // refresh failed — fall through to full re-auth
  }

  // OTP was already initiated (e.g. via MCP login) — just complete it
  if (result === 'needs_otp') {
    const email = process.env.RIVIAN_EMAIL || (await prompt(`${c.dim('Rivian email:')} `))
    const code = await promptSecret(`${c.dim('Verification code:')} `)
    await rivian.validateOtp(email, code)
    saveSession(rivian)
    return
  }

  let email = process.env.RIVIAN_EMAIL
  let password = process.env.RIVIAN_PASSWORD

  if (!email) email = await prompt(`${c.dim('Rivian email:')} `)
  if (!password) password = await promptSecret(`${c.dim('Rivian password:')} `)

  await rivian.createCsrfToken()
  const { mfa } = await rivian.login(email, password)

  if (mfa || rivian.needsOtp()) {
    const code = await promptSecret(`${c.dim('Verification code:')} `)
    await rivian.validateOtp(email, code)
  }

  saveSession(rivian)
}

async function resolveVehicleId() {
  const user = await rivian.getUserInfo()
  if (!user.vehicles?.length) throw new Error('No vehicles found on your Rivian account.')
  return user.vehicles[0].id
}

process.on('SIGINT', () => process.exit(130))

const command = process.argv[2]

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log('')
  console.log(`  ${logo()}`)
  console.log('')
  console.log(`  ${c.dim('Usage:')} rivian ${c.brand('<command>')}`)
  console.log('')
  console.log(`  ${c.brand('ota')}     Check software update status`)
  console.log(`  ${c.brand('stats')}   Show full vehicle state`)
  console.log(`  ${c.brand('help')}    Show this help message`)
  console.log('')
  process.exit(0)
}

try {
  await ensureAuth()

  if (command === 'ota') {
    const vehicleId = await resolveVehicleId()
    const data = await rivian.getOTAUpdateDetails(vehicleId)
    console.log('')
    console.log(`  ${logo()}`)
    console.log('')
    console.log(formatOTAStatus(data))
    console.log('')
  } else if (command === 'stats') {
    const vehicleId = await resolveVehicleId()
    const state = await rivian.getVehicleState(vehicleId)
    console.log('')
    console.log(`  ${logo()}`)
    console.log('')
    console.log(formatVehicleState(state))
    console.log('')
  } else {
    console.error(c.red(`Unknown command: ${command}`))
    console.error(c.dim('Run "rivian help" for usage.'))
    process.exit(1)
  }
} catch (err) {
  console.error(`${c.red('Error:')} ${err.message}`)
  if (err.code) console.error(c.dim(`  Code: ${err.code}`))
  if (err.reason) console.error(c.dim(`  Reason: ${err.reason}`))
  process.exit(1)
}
