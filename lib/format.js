export function formatUserInfo(user) {
  const lines = [`${user.firstName} ${user.lastName} (${user.email})`, '']

  if (!user.vehicles?.length) {
    lines.push('No vehicles on this account.')
    return lines.join('\n')
  }

  for (const v of user.vehicles) {
    const car = v.vehicle
    lines.push(v.name || car.model)
    lines.push(`  ${car.modelYear} ${car.make} ${car.model}`)
    lines.push(`  VIN: ${v.vin}`)

    if (car.otaEarlyAccessStatus) {
      lines.push(`  OTA early access: ${car.otaEarlyAccessStatus === 'OPTED_IN' ? 'Yes' : 'No'}`)
    }
    if (car.currentOTAUpdateDetails) {
      lines.push(`  Software: v${car.currentOTAUpdateDetails.version}`)
    }
    if (car.availableOTAUpdateDetails) {
      lines.push(`  Update available: v${car.availableOTAUpdateDetails.version}`)
      lines.push(`  Release notes: ${car.availableOTAUpdateDetails.url}`)
    } else {
      lines.push('  Software is up to date')
    }
    lines.push('')
  }

  return lines.join('\n').trim()
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
    if (value === null || value === undefined) return
    lines.push(`  ${label}: ${value}${suffix}`)
  }

  // Battery & Range
  if ('batteryLevel' in state || 'distanceToEmpty' in state) {
    lines.push('Battery & Range')
    print('Battery', 'batteryLevel', '%')
    print('Charge limit', 'batteryLimit', '%')
    print('Capacity', 'batteryCapacity')
    print('Range', 'distanceToEmpty', ' miles')
    print('Odometer', 'vehicleMileage', ' miles')
    print('Power', 'powerState')
    print('Time to full', 'timeToEndOfCharge', ' min')
    print('Remote charging', 'remoteChargingAvailable')
    lines.push('')
  }

  // Charging
  if ('chargerStatus' in state || 'chargerState' in state) {
    lines.push('Charging')
    print('Charger status', 'chargerStatus')
    print('Charger state', 'chargerState')
    print('Charge port', 'chargePortState')
    lines.push('')
  }

  // Doors — combine closed + locked per door
  const doorPositions = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight']
  const doorLines = []
  for (const pos of doorPositions) {
    const closedKey = `door${pos}Closed`
    const lockedKey = `door${pos}Locked`
    if (closedKey in state || lockedKey in state) {
      printed.add(closedKey)
      printed.add(lockedKey)
      const parts = [v(closedKey), v(lockedKey)].filter(Boolean)
      const label = pos
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase()
      if (parts.length) doorLines.push(`  ${label}: ${parts.join(', ')}`)
    }
  }
  if (doorLines.length) {
    lines.push('Doors')
    lines.push(...doorLines)
    lines.push('')
  }

  // Closures — frunk, liftgate, tailgate, tonneau
  const closures = ['Frunk', 'Liftgate', 'Tailgate', 'Tonneau']
  const closureLines = []
  for (const name of closures) {
    const closedKey = `closure${name}Closed`
    const lockedKey = `closure${name}Locked`
    if (closedKey in state || lockedKey in state) {
      printed.add(closedKey)
      printed.add(lockedKey)
      const parts = [v(closedKey), v(lockedKey)].filter(Boolean)
      if (parts.length) closureLines.push(`  ${name.toLowerCase()}: ${parts.join(', ')}`)
    }
  }
  if (closureLines.length) {
    lines.push('Closures')
    lines.push(...closureLines)
    lines.push('')
  }

  // Windows
  const windowLines = []
  for (const pos of doorPositions) {
    const key = `window${pos}Closed`
    if (key in state) {
      printed.add(key)
      const value = v(key)
      if (value) {
        const label = pos
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .toLowerCase()
        windowLines.push(`  ${label}: ${value}`)
      }
    }
  }
  if (windowLines.length) {
    lines.push('Windows')
    lines.push(...windowLines)
    lines.push('')
  }

  // Climate
  if ('cabinClimateInteriorTemperature' in state || 'cabinPreconditioningStatus' in state) {
    lines.push('Climate')
    if ('cabinClimateInteriorTemperature' in state) {
      printed.add('cabinClimateInteriorTemperature')
      const temp = v('cabinClimateInteriorTemperature')
      if (temp) lines.push(`  Cabin temp: ${temp}°`)
    }
    print('Preconditioning', 'cabinPreconditioningStatus')
    print('Defrost/defog', 'defrostDefogStatus')
    print('Pet mode', 'petModeStatus')
    lines.push('')
  }

  // Tires
  const tirePositions = {
    FrontLeft: 'front left',
    FrontRight: 'front right',
    RearLeft: 'rear left',
    RearRight: 'rear right',
  }
  const tireLines = []
  for (const [pos, label] of Object.entries(tirePositions)) {
    const key = `tirePressureStatus${pos}`
    if (key in state) {
      printed.add(key)
      const value = v(key)
      if (value) tireLines.push(`  ${label}: ${value}`)
    }
  }
  if (tireLines.length) {
    lines.push('Tire Pressure')
    lines.push(...tireLines)
    lines.push('')
  }

  // Software (OTA)
  if ('otaCurrentVersion' in state || 'otaAvailableVersion' in state || 'otaStatus' in state) {
    lines.push('Software')
    print('Current version', 'otaCurrentVersion')
    print('Available update', 'otaAvailableVersion')
    print('Status', 'otaStatus')
    print('Install status', 'otaCurrentStatus')
    print('Install ready', 'otaInstallReady')
    print('Install progress', 'otaInstallProgress', '%')
    print('Download progress', 'otaDownloadProgress', '%')
    print('Install type', 'otaInstallType')
    print('Current hash', 'otaCurrentVersionGitHash')
    print('Available hash', 'otaAvailableVersionGitHash')
    lines.push('')
  }

  // Security
  if ('gearGuardLocked' in state) {
    lines.push('Security')
    print('Gear Guard', 'gearGuardLocked')
    print('Gear Guard video', 'gearGuardVideoStatus')
    lines.push('')
  }

  // Drive
  if ('driveMode' in state || 'gearStatus' in state) {
    lines.push('Drive')
    print('Drive mode', 'driveMode')
    print('Gear', 'gearStatus')
    lines.push('')
  }

  // Connection
  if ('cloudConnection' in state) {
    printed.add('cloudConnection')
    const cc = state.cloudConnection
    const online = cc?.isOnline ? 'Online' : 'Offline'
    const sync = cc?.lastSync ? ` (last sync: ${cc.lastSync})` : ''
    lines.push('Connection')
    lines.push(`  Status: ${online}${sync}`)
    lines.push('')
  }

  // Location
  if ('gnssLocation' in state) {
    printed.add('gnssLocation')
    const loc = state.gnssLocation
    if (loc?.latitude && loc?.longitude) {
      lines.push('Location')
      lines.push(`  ${loc.latitude}, ${loc.longitude}`)
      lines.push('')
    }
  }

  // Anything not already printed
  const remaining = []
  for (const [key, entry] of Object.entries(state)) {
    if (printed.has(key)) continue
    const value = entry?.value ?? entry
    if (value !== null && value !== undefined) {
      remaining.push(`  ${key}: ${value}`)
    }
  }
  if (remaining.length) {
    lines.push('Other')
    lines.push(...remaining)
  }

  return lines.join('\n').trim()
}

export function formatOTAStatus(ota) {
  const lines = []

  if (ota.currentOTAUpdateDetails) {
    lines.push(`Current software: v${ota.currentOTAUpdateDetails.version}`)
  } else {
    lines.push('Current software: unknown')
  }

  const otaStatus = ota.vehicleState?.otaStatus?.value
  if (otaStatus) {
    lines.push(`OTA status: ${otaStatus}`)
  }

  if (ota.availableOTAUpdateDetails) {
    lines.push(`Update available: v${ota.availableOTAUpdateDetails.version}`)
    if (ota.availableOTAUpdateDetails.url) {
      lines.push(`Release notes: ${ota.availableOTAUpdateDetails.url}`)
    }
  } else if (otaStatus && otaStatus.toLowerCase() !== 'idle') {
    lines.push('Flagged for update — details pending.')
  } else {
    lines.push('No update available — software is up to date.')
  }

  return lines.join('\n')
}

export function formatChargingSession(data) {
  if (!data) return 'No active charging session.'

  const lines = ['Charging Session']

  const add = (label, entry, suffix = '') => {
    const value = entry?.value
    if (value !== undefined && value !== null) lines.push(`  ${label}: ${value}${suffix}`)
  }

  add('Battery', data.soc, '%')
  add('Power', data.power, ' kW')
  add('Range added', data.rangeAddedThisSession, ' miles')
  add('Energy charged', data.totalChargedEnergy, ' kWh')
  add('Current', data.current, ' A')
  if (data.timeElapsed) lines.push(`  Time elapsed: ${data.timeElapsed}`)
  add('Time remaining', data.timeRemaining, ' min')

  if (data.isRivianCharger) lines.push('  Network: Rivian Adventure Network')
  if (data.isFreeSession) {
    lines.push('  Cost: Free')
  } else if (data.currentPrice) {
    lines.push(`  Cost so far: ${data.currentCurrency || '$'}${data.currentPrice}`)
  }

  add('Charger state', data.vehicleChargerState)

  return lines.join('\n')
}

export function formatChargingHistory(sessions) {
  if (sessions === null || sessions === undefined)
    return 'No charging history returned. Your session may have expired — try logging in again.'
  if (!sessions.length) return 'No charging history found.'

  const lines = [`Charging History (${sessions.length} sessions)`, '']

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

    const location = [s.city, s.vendor].filter(Boolean).join(' — ')
    const chargerLabel = s.isHomeCharger ? 'Home' : s.chargerType || 'Unknown'

    lines.push(`${date}  ${startTime}–${endTime} (${duration})`)
    if (location) lines.push(`  Location: ${location}`)
    lines.push(`  Charger: ${chargerLabel}`)
    if (s.totalEnergyKwh != null) lines.push(`  Energy: ${s.totalEnergyKwh.toFixed(1)} kWh`)
    if (s.rangeAddedKm != null) {
      const miles = (s.rangeAddedKm * 0.621371).toFixed(0)
      lines.push(`  Range added: ${miles} miles`)
    }
    if (s.paidTotal != null && s.paidTotal > 0) {
      const currency = s.currencyCode === 'USD' ? '$' : `${s.currencyCode} `
      lines.push(`  Cost: ${currency}${s.paidTotal.toFixed(2)}`)
    } else if (s.paidTotal === 0) {
      lines.push('  Cost: Free')
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

export function formatChargingSchedule(data) {
  const schedules = data?.chargingSchedules
  if (!schedules?.length) return 'No charging schedules configured.'

  const lines = ['Charging Schedules', '']

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

    lines.push(`${fmt(startHour, startMin)} – ${fmt(endHour, endMin)} (${s.duration / 60}h)`)
    lines.push(`  Amperage: ${s.amperage}A`)
    lines.push(`  Enabled: ${s.enabled ? 'Yes' : 'No'}`)
    if (s.weekDays?.length) lines.push(`  Days: ${s.weekDays.join(', ')}`)
    if (s.location) lines.push(`  Location: ${s.location.latitude}, ${s.location.longitude}`)
    lines.push('')
  }

  return lines.join('\n').trim()
}

export function formatDriversAndKeys(data) {
  const lines = []

  if (data.vin) lines.push(`Vehicle: ${data.vin}`)

  if (!data.invitedUsers?.length) {
    lines.push('No drivers or keys found.')
    return lines.join('\n')
  }

  lines.push('')
  for (const user of data.invitedUsers) {
    if (user.firstName) {
      lines.push(`${user.firstName} ${user.lastName} (${user.email})`)
      if (user.roles?.length) lines.push(`  Roles: ${user.roles.join(', ')}`)

      if (user.devices?.length) {
        for (const d of user.devices) {
          const name = d.deviceName || d.type
          const status = [
            d.isPaired ? 'paired' : 'not paired',
            d.isEnabled ? 'enabled' : 'disabled',
          ].join(', ')
          lines.push(`  ${name} — ${status}`)
        }
      }
    } else {
      lines.push(`${user.email} (invited, ${user.status})`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}
