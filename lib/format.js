import { c, section, bar, kv, table, vehicleDiagram, tireDiagram, closureStatus } from './ui.js'

function fmt(n) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function isZeroish(val) {
  return val === 0 || val === '0' || val === '0.0.0' || val === '' || val === 'undefined'
}

export function formatUserInfo(user) {
  const lines = [c.bold(`${user.firstName} ${user.lastName}`) + c.dim(` (${user.email})`), '']

  if (!user.vehicles?.length) {
    lines.push(c.dim('No vehicles on this account.'))
    return lines.join('\n')
  }

  for (const v of user.vehicles) {
    const car = v.vehicle
    lines.push(c.bold(v.name || car.model))
    lines.push(kv('Model', `${car.modelYear} ${car.make} ${car.model}`))
    lines.push(kv('VIN', v.vin))

    if (car.otaEarlyAccessStatus) {
      lines.push(
        kv('OTA early access', car.otaEarlyAccessStatus === 'OPTED_IN' ? c.green('Yes') : 'No'),
      )
    }
    if (car.currentOTAUpdateDetails) {
      lines.push(kv('Software', `v${car.currentOTAUpdateDetails.version}`))
    }
    if (car.availableOTAUpdateDetails) {
      lines.push(kv('Update available', c.yellow(`v${car.availableOTAUpdateDetails.version}`)))
      lines.push(kv('Release notes', car.availableOTAUpdateDetails.url))
    } else {
      lines.push(kv('Software', c.green('Up to date')))
    }
    lines.push('')
  }

  return lines
    .filter((l) => l !== null)
    .join('\n')
    .trim()
}

export function formatVehicleState(state) {
  const lines = []
  const printed = new Set()

  function v(key) {
    return state[key]?.value ?? null
  }

  function print(label, key, suffix = '') {
    if (!(key in state)) return
    printed.add(key)
    const value = v(key)
    if (value === null || value === undefined || value === 'undefined') return
    lines.push(kv(label, value, suffix))
  }

  // Battery & Range
  if ('batteryLevel' in state || 'distanceToEmpty' in state) {
    lines.push(section('Battery & Range'))
    const level = v('batteryLevel')
    const limit = v('batteryLimit')
    if (level !== null) {
      printed.add('batteryLevel')
      const rounded = Math.round(level)
      const gauge = bar(rounded)
      lines.push(`  ${gauge}  ${c.bold(rounded + '%')}`)
    }
    if (limit !== null) {
      printed.add('batteryLimit')
      lines.push(kv('Charge limit', limit, '%'))
    }
    print('Capacity', 'batteryCapacity')
    const range = v('distanceToEmpty')
    if (range !== null) {
      printed.add('distanceToEmpty')
      lines.push(kv('Range', c.bold(fmt(range))))
    }
    if ('vehicleMileage' in state) {
      printed.add('vehicleMileage')
      const raw = v('vehicleMileage')
      if (raw !== null) lines.push(kv('Odometer', fmt(raw)))
    }
    print('Power', 'powerState')

    const ttf = v('timeToEndOfCharge')
    if (ttf !== null && ttf > 0) {
      printed.add('timeToEndOfCharge')
      const hours = Math.floor(ttf / 60)
      const mins = ttf % 60
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
      lines.push(kv('Time to full', timeStr))
    } else {
      printed.add('timeToEndOfCharge')
    }
    printed.add('remoteChargingAvailable')
    print('Range status', 'rangeThreshold')
    lines.push('')
  }

  // Charging
  if ('chargerStatus' in state || 'chargerState' in state) {
    lines.push(section('Charging'))
    const status = v('chargerStatus')
    if (status) {
      printed.add('chargerStatus')
      const color = status.toLowerCase().includes('charg') ? c.green : c.dim
      lines.push(kv('Charger status', color(status)))
    }
    print('Charger state', 'chargerState')
    print('Charge port', 'chargePortState')
    print('Charger derate', 'chargerDerateStatus')
    lines.push('')
  }

  // Doors — vehicle diagram
  const doorPositions = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight']
  const doorData = {}
  const posMap = { FrontLeft: 'fl', FrontRight: 'fr', RearLeft: 'rl', RearRight: 'rr' }
  let hasDoors = false
  for (const pos of doorPositions) {
    const closedKey = `door${pos}Closed`
    const lockedKey = `door${pos}Locked`
    if (closedKey in state || lockedKey in state) {
      hasDoors = true
      printed.add(closedKey)
      printed.add(lockedKey)
      doorData[posMap[pos]] = { closed: v(closedKey), locked: v(lockedKey) }
    }
  }
  if (hasDoors) {
    lines.push(section('Doors'))
    lines.push(vehicleDiagram(doorData))
    lines.push('')
  }

  // Closures
  const closures = ['Frunk', 'Liftgate', 'Tailgate', 'Tonneau', 'SideBinLeft', 'SideBinRight']
  const closureLines = []
  for (const name of closures) {
    const closedKey = `closure${name}Closed`
    const lockedKey = `closure${name}Locked`
    const nextKey = `closure${name}NextAction`
    if (closedKey in state || lockedKey in state) {
      printed.add(closedKey)
      printed.add(lockedKey)
      if (nextKey in state) printed.add(nextKey)
      const label = name.replace(/([A-Z])/g, ' $1').trim()
      const line = closureStatus(label, v(closedKey), v(lockedKey))
      if (line) closureLines.push(line)
    }
  }
  if (closureLines.length) {
    lines.push(section('Closures'))
    lines.push(...closureLines)
    lines.push('')
  }

  // Windows (with calibration status from new fields)
  const windowLines = []
  for (const pos of doorPositions) {
    const closedKey = `window${pos}Closed`
    const calKey = `window${pos}Calibrated`
    if (closedKey in state || calKey in state) {
      printed.add(closedKey)
      printed.add(calKey)
      const closed = v(closedKey)
      const cal = v(calKey)
      const label = pos
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase()
      const icon =
        closed === 'closed' ? c.green('■') : closed === 'open' ? c.yellow('□') : c.dim('·')
      const parts = [closed, cal].filter((x) => x !== null && x !== undefined)
      if (parts.length) windowLines.push(`  ${icon} ${label}: ${parts.join(', ')}`)
    }
  }
  if (windowLines.length) {
    lines.push(section('Windows'))
    lines.push(...windowLines)
    lines.push('')
  }

  // Climate (expanded with new fields)
  const climateKeys = [
    'cabinClimateInteriorTemperature',
    'cabinClimateDriverTemperature',
    'cabinPreconditioningStatus',
    'cabinPreconditioningType',
    'defrostDefogStatus',
    'petModeStatus',
    'petModeTemperatureStatus',
  ]
  if (climateKeys.some((k) => k in state)) {
    lines.push(section('Climate'))
    if ('cabinClimateInteriorTemperature' in state) {
      printed.add('cabinClimateInteriorTemperature')
      const temp = v('cabinClimateInteriorTemperature')
      if (temp !== null) lines.push(kv('Cabin temp', `${temp}°`))
    }
    if ('cabinClimateDriverTemperature' in state) {
      printed.add('cabinClimateDriverTemperature')
      const temp = v('cabinClimateDriverTemperature')
      if (temp !== null) lines.push(kv('Driver setpoint', `${temp}°`))
    }
    print('Preconditioning', 'cabinPreconditioningStatus')
    print('Preconditioning type', 'cabinPreconditioningType')
    print('Defrost/defog', 'defrostDefogStatus')
    print('Pet mode', 'petModeStatus')
    print('Pet mode temp', 'petModeTemperatureStatus')
    lines.push('')
  }

  // Seat heat & vent (new section)
  const seatKeys = [
    'seatFrontLeftHeat',
    'seatFrontRightHeat',
    'seatRearLeftHeat',
    'seatRearRightHeat',
    'seatThirdRowLeftHeat',
    'seatThirdRowRightHeat',
    'seatFrontLeftVent',
    'seatFrontRightVent',
    'steeringWheelHeat',
  ]
  if (seatKeys.some((k) => k in state)) {
    lines.push(section('Seat Heat & Vent'))
    print('Front left heat', 'seatFrontLeftHeat')
    print('Front right heat', 'seatFrontRightHeat')
    print('Rear left heat', 'seatRearLeftHeat')
    print('Rear right heat', 'seatRearRightHeat')
    print('Third row left', 'seatThirdRowLeftHeat')
    print('Third row right', 'seatThirdRowRightHeat')
    print('Front left vent', 'seatFrontLeftVent')
    print('Front right vent', 'seatFrontRightVent')
    print('Steering wheel', 'steeringWheelHeat')
    lines.push('')
  }

  // Tires
  const tirePositions = {
    FrontLeft: 'fl',
    FrontRight: 'fr',
    RearLeft: 'rl',
    RearRight: 'rr',
  }
  const tireData = {}
  let hasTires = false
  for (const [pos, key] of Object.entries(tirePositions)) {
    const stateKey = `tirePressureStatus${pos}`
    if (stateKey in state) {
      printed.add(stateKey)
      tireData[key] = v(stateKey)
      hasTires = true
    }
  }
  if (hasTires) {
    lines.push(section('Tire Pressure'))
    lines.push(tireDiagram(tireData))
    lines.push('')
  }

  // Software (OTA) — expanded with build numbers and install duration
  if ('otaCurrentVersion' in state || 'otaAvailableVersion' in state || 'otaStatus' in state) {
    lines.push(section('Software'))
    print('Current version', 'otaCurrentVersion')

    if ('otaCurrentVersionYear' in state && 'otaCurrentVersionWeek' in state) {
      printed.add('otaCurrentVersionYear')
      printed.add('otaCurrentVersionWeek')
      printed.add('otaCurrentVersionNumber')
      const yr = v('otaCurrentVersionYear')
      const wk = v('otaCurrentVersionWeek')
      const num = v('otaCurrentVersionNumber')
      if (yr && wk) lines.push(kv('Current build', c.dim(`${yr}.${wk}.${num ?? 0}`)))
    }

    const availVer = v('otaAvailableVersion')
    if (availVer && !isZeroish(availVer)) {
      printed.add('otaAvailableVersion')
      lines.push(kv('Available update', c.yellow(availVer)))
    } else {
      printed.add('otaAvailableVersion')
    }

    if ('otaAvailableVersionYear' in state) {
      printed.add('otaAvailableVersionYear')
      printed.add('otaAvailableVersionWeek')
      printed.add('otaAvailableVersionNumber')
      const yr = v('otaAvailableVersionYear')
      const wk = v('otaAvailableVersionWeek')
      const num = v('otaAvailableVersionNumber')
      if (yr && !isZeroish(yr)) lines.push(kv('Available build', c.dim(`${yr}.${wk}.${num ?? 0}`)))
    }

    const otaStatus = v('otaStatus')
    if (otaStatus) {
      printed.add('otaStatus')
      const statusColor = otaStatus.toLowerCase() === 'idle' ? c.green : c.yellow
      lines.push(kv('Status', statusColor(otaStatus)))
    }
    print('Install status', 'otaCurrentStatus')
    print('Install ready', 'otaInstallReady')

    const installProg = v('otaInstallProgress')
    printed.add('otaInstallProgress')
    if (installProg !== null && installProg > 0) {
      lines.push(kv('Install', `${bar(installProg, 100, 15)} ${installProg}%`))
    }
    const dlProg = v('otaDownloadProgress')
    printed.add('otaDownloadProgress')
    if (dlProg !== null && dlProg > 0) {
      lines.push(kv('Download', `${bar(dlProg, 100, 15)} ${dlProg}%`))
    }
    print('Install type', 'otaInstallType')
    const installDur = v('otaInstallDuration')
    printed.add('otaInstallDuration')
    if (installDur && !isZeroish(installDur)) lines.push(kv('Install duration', installDur, ' min'))
    const installTime = v('otaInstallTime')
    printed.add('otaInstallTime')
    if (installTime && !isZeroish(installTime)) lines.push(kv('Install time', installTime))
    print('Current hash', 'otaCurrentVersionGitHash')
    const availHash = v('otaAvailableVersionGitHash')
    printed.add('otaAvailableVersionGitHash')
    if (availHash && !isZeroish(availHash)) lines.push(kv('Available hash', availHash))
    lines.push('')
  }

  // Security
  const securityKeys = [
    'gearGuardLocked',
    'gearGuardVideoStatus',
    'gearGuardVideoMode',
    'alarmSoundStatus',
  ]
  if (securityKeys.some((k) => k in state)) {
    lines.push(section('Security'))
    const gg = v('gearGuardLocked')
    if (gg) {
      printed.add('gearGuardLocked')
      const icon = gg === 'locked' ? c.green('🔒') : c.yellow('🔓')
      lines.push(kv('Gear Guard', `${icon} ${gg}`))
    }
    print('Gear Guard video', 'gearGuardVideoStatus')
    print('Gear Guard mode', 'gearGuardVideoMode')
    print('Alarm', 'alarmSoundStatus')
    lines.push('')
  }

  // Drive
  if ('driveMode' in state || 'gearStatus' in state || 'gnssSpeed' in state) {
    lines.push(section('Drive'))
    print('Drive mode', 'driveMode')
    print('Gear', 'gearStatus')
    const speed = v('gnssSpeed')
    if (speed !== null && speed > 0) {
      printed.add('gnssSpeed')
      lines.push(kv('Speed', fmt(speed)))
    } else {
      printed.add('gnssSpeed')
    }
    print('Service mode', 'serviceMode')
    print('Car wash mode', 'carWashMode')
    lines.push('')
  }

  // Vehicle Health
  const healthKeys = [
    'batteryHvThermalEvent',
    'batteryHvThermalEventPropagation',
    'twelveVoltBatteryHealth',
    'wiperFluidState',
    'brakeFluidLow',
    'limitedAccelCold',
    'limitedRegenCold',
  ]
  if (healthKeys.some((k) => k in state)) {
    lines.push(section('Vehicle Health'))
    print('HV thermal', 'batteryHvThermalEvent')
    print('HV thermal prop.', 'batteryHvThermalEventPropagation')
    print('12V battery', 'twelveVoltBatteryHealth')
    print('Wiper fluid', 'wiperFluidState')
    print('Brake fluid low', 'brakeFluidLow')
    const accelCold = v('limitedAccelCold')
    if (accelCold !== null && accelCold > 0) {
      printed.add('limitedAccelCold')
      lines.push(kv('Accel limited (cold)', c.yellow(`${accelCold}%`)))
    } else {
      printed.add('limitedAccelCold')
    }
    const regenCold = v('limitedRegenCold')
    if (regenCold !== null && regenCold > 0) {
      printed.add('limitedRegenCold')
      lines.push(kv('Regen limited (cold)', c.yellow(`${regenCold}%`)))
    } else {
      printed.add('limitedRegenCold')
    }
    lines.push('')
  }

  // Connection
  if ('cloudConnection' in state) {
    printed.add('cloudConnection')
    const cc = state.cloudConnection
    const online = cc?.isOnline
    const icon = online ? c.green('●') : c.red('●')
    const label = online ? 'Online' : 'Offline'
    let syncLabel = ''
    if (cc?.lastSync) {
      const ago = Date.now() - new Date(cc.lastSync).getTime()
      const mins = Math.round(ago / 60000)
      if (mins < 1) syncLabel = 'just now'
      else if (mins < 60) syncLabel = `${mins}m ago`
      else if (mins < 1440) syncLabel = `${Math.round(mins / 60)}h ago`
      else syncLabel = cc.lastSync
    }
    const sync = syncLabel ? c.dim(` (${syncLabel})`) : ''
    lines.push(section('Connection'))
    lines.push(`  ${icon} ${label}${sync}`)
    lines.push('')
  }

  // Location (with altitude)
  if ('gnssLocation' in state || 'gnssAltitude' in state) {
    printed.add('gnssLocation')
    printed.add('gnssAltitude')
    const loc = state.gnssLocation
    const alt = state.gnssAltitude?.value
    if (loc?.latitude && loc?.longitude) {
      lines.push(section('Location'))
      lines.push(`  ${c.dim('📍')} ${loc.latitude}, ${loc.longitude}`)
      if (alt !== null && alt !== undefined) lines.push(kv('Altitude', alt))
      lines.push('')
    }
  }

  // Towing
  if ('trailerStatus' in state || 'rearHitchStatus' in state) {
    lines.push(section('Towing'))
    print('Trailer', 'trailerStatus')
    print('Rear hitch', 'rearHitchStatus')
    lines.push('')
  }

  // Remaining
  const remaining = []
  for (const [key, entry] of Object.entries(state)) {
    if (printed.has(key)) continue
    const value = entry?.value ?? entry
    if (value !== null && value !== undefined) {
      remaining.push(kv(key, value))
    }
  }
  if (remaining.length) {
    lines.push(section('Other'))
    lines.push(...remaining)
  }

  return lines
    .filter((l) => l !== null)
    .join('\n')
    .trim()
}

export function formatOTAStatus(ota) {
  const lines = []

  lines.push(section('Software Update'))
  lines.push('')

  if (ota.currentOTAUpdateDetails) {
    lines.push(kv('Current', `v${ota.currentOTAUpdateDetails.version}`))
  } else {
    lines.push(kv('Current', c.dim('unknown')))
  }

  const otaStatus = ota.vehicleState?.otaStatus?.value
  if (otaStatus) {
    const statusColor = otaStatus.toLowerCase() === 'idle' ? c.green : c.yellow
    lines.push(kv('Status', statusColor(otaStatus)))
  }

  if (ota.availableOTAUpdateDetails) {
    lines.push(kv('Update available', c.yellow(`v${ota.availableOTAUpdateDetails.version}`)))
    if (ota.availableOTAUpdateDetails.url) {
      lines.push(kv('Release notes', ota.availableOTAUpdateDetails.url))
    }
  } else if (otaStatus && otaStatus.toLowerCase() !== 'idle') {
    lines.push('')
    lines.push(`  ${c.yellow('⏳')} Flagged for update — details pending.`)
  } else {
    lines.push('')
    lines.push(`  ${c.green('✓')} Software is up to date.`)
  }

  return lines.filter((l) => l !== null).join('\n')
}

export function formatChargingSession(data) {
  if (!data) return c.dim('No active charging session.')

  const lines = [section('Charging Session'), '']

  const add = (label, entry, suffix = '') => {
    const value = entry?.value
    if (value !== undefined && value !== null) lines.push(kv(label, value, suffix))
  }

  const soc = data.soc?.value
  if (soc !== undefined && soc !== null) {
    lines.push(`  ${bar(soc)}  ${c.bold(soc + '%')}`)
  }
  add('Power', data.power, ' kW')
  add('Range added', data.rangeAddedThisSession, ' miles')
  add('Energy charged', data.totalChargedEnergy, ' kWh')
  add('Current', data.current, ' A')
  if (data.timeElapsed) lines.push(kv('Time elapsed', data.timeElapsed))
  add('Time remaining', data.timeRemaining, ' min')

  if (data.isRivianCharger) lines.push(kv('Network', c.green('Rivian Adventure Network')))
  if (data.isFreeSession) {
    lines.push(kv('Cost', c.green('Free')))
  } else if (data.currentPrice) {
    lines.push(kv('Cost so far', `${data.currentCurrency || '$'}${data.currentPrice}`))
  }

  add('Charger state', data.vehicleChargerState)

  return lines.filter((l) => l !== null).join('\n')
}

export function formatChargingHistory(sessions) {
  if (sessions === null || sessions === undefined)
    return c.yellow(
      'No charging history returned. Your session may have expired — try logging in again.',
    )
  if (!sessions.length) return c.dim('No charging history found.')

  const lines = [section(`Charging History (${sessions.length} sessions)`), '']

  const headers = ['Date', 'Time', 'Duration', 'Energy', 'Cost']
  const colWidths = [14, 22, 10, 12, 10]
  const rows = []

  for (const s of sessions) {
    const start = new Date(s.startInstant)
    const end = new Date(s.endInstant)
    const date = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const durationMs = end - start
    const durationMin = Math.round(durationMs / 60000)
    const hours = Math.floor(durationMin / 60)
    const mins = durationMin % 60
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

    const energy = s.totalEnergyKwh != null ? `${s.totalEnergyKwh.toFixed(1)} kWh` : '—'

    let cost = '—'
    if (s.paidTotal != null && s.paidTotal > 0) {
      const currency = s.currencyCode === 'USD' ? '$' : `${s.currencyCode} `
      cost = `${currency}${s.paidTotal.toFixed(2)}`
    } else if (s.paidTotal === 0) {
      cost = c.green('Free')
    }

    rows.push([date, `${startTime}–${endTime}`, duration, energy, cost])
  }

  lines.push(table(headers, rows, colWidths))

  // Detail lines below table
  lines.push('')
  for (const s of sessions) {
    const location = [s.city, s.vendor].filter(Boolean).join(' — ')
    const chargerLabel = s.isHomeCharger ? 'Home' : s.chargerType || 'Unknown'
    if (location) {
      const start = new Date(s.startInstant)
      const date = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      lines.push(c.dim(`  ${date}: ${location} (${chargerLabel})`))
    }
  }

  return lines
    .filter((l) => l !== null)
    .join('\n')
    .trim()
}

export function formatChargingSchedule(data) {
  const schedules = data?.chargingSchedules
  if (!schedules?.length) return c.dim('No charging schedules configured.')

  const lines = [section('Charging Schedules'), '']

  for (const s of schedules) {
    const startHour = Math.floor(s.startTime / 60)
    const startMin = s.startTime % 60
    const endMinutes = s.startTime + s.duration
    const endHour = Math.floor(endMinutes / 60) % 24
    const endMin = endMinutes % 60

    const fmt = (h, m) => {
      const period = h >= 12 ? 'PM' : 'AM'
      const hour12 = h % 12 || 12
      return `${hour12}:${String(m).padStart(2, '0')} ${period}`
    }

    const enabled = s.enabled ? c.green('●') : c.red('●')
    lines.push(
      `  ${enabled} ${c.bold(`${fmt(startHour, startMin)} – ${fmt(endHour, endMin)}`)} ${c.dim(`(${s.duration / 60}h)`)}`,
    )
    lines.push(kv('Amperage', s.amperage, 'A'))
    if (s.weekDays?.length) lines.push(kv('Days', s.weekDays.join(', ')))
    if (s.location) lines.push(kv('Location', `${s.location.latitude}, ${s.location.longitude}`))
    lines.push('')
  }

  return lines
    .filter((l) => l !== null)
    .join('\n')
    .trim()
}

export function formatDriversAndKeys(data) {
  const lines = []

  if (data.vin) lines.push(section(`Vehicle ${data.vin}`))
  else lines.push(section('Drivers & Keys'))

  if (!data.invitedUsers?.length) {
    lines.push(c.dim('No drivers or keys found.'))
    return lines.join('\n')
  }

  lines.push('')
  for (const user of data.invitedUsers) {
    if (user.firstName) {
      lines.push(`  ${c.bold(`${user.firstName} ${user.lastName}`)} ${c.dim(`(${user.email})`)}`)
      if (user.roles?.length) lines.push(kv('Roles', user.roles.join(', ')))

      if (user.devices?.length) {
        for (const d of user.devices) {
          const name = d.deviceName || d.type
          const paired = d.isPaired ? c.green('paired') : c.red('not paired')
          const enabled = d.isEnabled ? c.green('enabled') : c.red('disabled')
          lines.push(`    ${c.dim('└')} ${name} — ${paired}, ${enabled}`)
        }
      }
    } else {
      lines.push(`  ${c.dim('○')} ${user.email} ${c.dim(`(invited, ${user.status})`)}`)
    }
    lines.push('')
  }

  return lines
    .filter((l) => l !== null)
    .join('\n')
    .trim()
}
