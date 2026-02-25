#!/usr/bin/env node

import { createInterface } from 'node:readline'
import * as rivian from './lib/rivian-api.js'
import { formatOTAStatus, formatVehicleState } from './lib/format.js'
import { loadSession, saveSession } from './lib/session.js'

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function ensureAuth() {
  const result = loadSession(rivian)
  if (result === true) return

  let email = process.env.RIVIAN_EMAIL
  let password = process.env.RIVIAN_PASSWORD

  if (!email) email = await prompt('Rivian email: ')
  if (!password) password = await prompt('Rivian password: ')

  await rivian.createCsrfToken()
  const { mfa } = await rivian.login(email, password)

  if (mfa || rivian.needsOtp()) {
    const code = await prompt('Verification code: ')
    await rivian.validateOtp(email, code)
  }

  saveSession(rivian)
}

async function resolveVehicleId() {
  const user = await rivian.getUserInfo()
  if (!user.vehicles?.length) throw new Error('No vehicles found on your Rivian account.')
  return user.vehicles[0].id
}

const command = process.argv[2]

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log('Usage: rivian <command>')
  console.log('')
  console.log('Commands:')
  console.log('  ota    Check software update status')
  console.log('  stats  Show full vehicle state')
  process.exit(0)
}

try {
  await ensureAuth()

  if (command === 'ota') {
    const vehicleId = await resolveVehicleId()
    const data = await rivian.getOTAUpdateDetails(vehicleId)
    console.log(formatOTAStatus(data))
  } else if (command === 'stats') {
    const vehicleId = await resolveVehicleId()
    const state = await rivian.getVehicleState(vehicleId)
    console.log(formatVehicleState(state))
  } else {
    console.error(`Unknown command: ${command}`)
    console.error('Run "rivian help" for usage.')
    process.exit(1)
  }
} catch (err) {
  console.error(`Error: ${err.message}`)
  process.exit(1)
}
