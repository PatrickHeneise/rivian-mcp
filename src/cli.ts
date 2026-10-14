#!/usr/bin/env node

import { createInterface } from 'node:readline'
import { formatOTAStatus, formatVehicleState } from './format.ts'
import * as rivian from './rivian-api.ts'
import { loadSession, saveSession } from './session.ts'
import { c, logo } from './ui.ts'

const session = rivian.emptySession()

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stderr.write(question)
    const stdin = process.stdin
    const wasRaw = stdin.isRaw ?? false
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    let input = ''
    const onData = (ch: string) => {
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
  const result = loadSession(session)
  if (result === true) return

  // OTP was already initiated (e.g. via MCP login) — just complete it
  if (result === 'needs_otp') {
    const email = process.env.RIVIAN_EMAIL || (await prompt(`${c.dim('Rivian email:')} `))
    const code = await promptSecret(`${c.dim('Verification code:')} `)
    await rivian.validateOtp(session, email, code)
    saveSession(session)
    return
  }

  let email = process.env.RIVIAN_EMAIL
  let password = process.env.RIVIAN_PASSWORD

  if (!email) email = await prompt(`${c.dim('Rivian email:')} `)
  if (!password) password = await promptSecret(`${c.dim('Rivian password:')} `)

  await rivian.createCsrfToken(session)
  const { mfa } = await rivian.login(session, email, password)

  if (mfa || rivian.needsOtp(session)) {
    const code = await promptSecret(`${c.dim('Verification code:')} `)
    await rivian.validateOtp(session, email, code)
  }

  saveSession(session)
}

async function resolveVehicleId() {
  const user = await rivian.getUserInfo(session)
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
    const data = await rivian.getOTAUpdateDetails(session, vehicleId)
    console.log('')
    console.log(`  ${logo()}`)
    console.log('')
    console.log(formatOTAStatus(data))
    console.log('')
  } else if (command === 'stats') {
    const vehicleId = await resolveVehicleId()
    const state = await rivian.getVehicleState(session, vehicleId)
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
} catch (e) {
  const err = e as rivian.RivianError
  console.error(`${c.red('Error:')} ${err.message}`)
  if (err.code) console.error(c.dim(`  Code: ${err.code}`))
  if (err.reason) console.error(c.dim(`  Reason: ${err.reason}`))
  process.exit(1)
}
