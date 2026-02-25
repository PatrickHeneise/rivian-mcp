#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import * as rivian from './lib/rivian.js';

const CONFIG_DIR = join(homedir(), '.rivian-mcp');
const SESSION_FILE = join(CONFIG_DIR, 'session.json');
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── Session persistence ───────────────────────────────────────────────

function loadSession() {
  if (!existsSync(SESSION_FILE)) return false;

  try {
    const st = statSync(SESSION_FILE);
    if (st.mode & 0o077) {
      console.error(
        `[rivian-mcp] WARNING: ${SESSION_FILE} is readable by other users. Run: chmod 600 "${SESSION_FILE}"`,
      );
    }
  } catch {}

  const session = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));

  if (session.savedAt && Date.now() - session.savedAt > SESSION_MAX_AGE_MS) {
    console.error('[rivian-mcp] Session expired. Please log in again.');
    return false;
  }

  if (session.authenticated || session.needsOtp) {
    rivian.restoreSession(session);
    return session.authenticated ? true : 'needs_otp';
  }

  return false;
}

function saveSession() {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  chmodSync(CONFIG_DIR, 0o700);
  const session = { ...rivian.exportSession(), savedAt: Date.now() };
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
  chmodSync(SESSION_FILE, 0o600);
}

function requireAuth() {
  if (!rivian.isAuthenticated()) {
    throw new Error('Not logged in. Ask the user to log in to Rivian first.');
  }
}

function text(str) {
  return { content: [{ type: 'text', text: str }] };
}

// ── Formatting ────────────────────────────────────────────────────────

function formatUserInfo(user) {
  const lines = [`${user.firstName} ${user.lastName} (${user.email})`, ''];

  if (!user.vehicles?.length) {
    lines.push('No vehicles on this account.');
    return lines.join('\n');
  }

  for (const v of user.vehicles) {
    const car = v.vehicle;
    lines.push(v.name || car.model);
    lines.push(`  ${car.modelYear} ${car.make} ${car.model}`);
    lines.push(`  VIN: ${v.vin}`);

    if (car.otaEarlyAccessStatus) {
      lines.push(`  OTA early access: ${car.otaEarlyAccessStatus === 'OPTED_IN' ? 'Yes' : 'No'}`);
    }
    if (car.currentOTAUpdateDetails) {
      lines.push(`  Software: v${car.currentOTAUpdateDetails.version}`);
    }
    if (car.availableOTAUpdateDetails) {
      lines.push(`  Update available: v${car.availableOTAUpdateDetails.version}`);
      lines.push(`  Release notes: ${car.availableOTAUpdateDetails.url}`);
    } else {
      lines.push('  Software is up to date');
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function formatVehicleState(state) {
  const lines = [];
  const printed = new Set();

  function v(key) {
    return state[key]?.value ?? null;
  }

  function print(label, key, suffix = '') {
    if (!(key in state)) return;
    printed.add(key);
    const value = v(key);
    if (value === null || value === undefined) return;
    lines.push(`  ${label}: ${value}${suffix}`);
  }

  // Battery & Range
  if ('batteryLevel' in state || 'distanceToEmpty' in state) {
    lines.push('Battery & Range');
    print('Battery', 'batteryLevel', '%');
    print('Charge limit', 'batteryLimit', '%');
    print('Capacity', 'batteryCapacity');
    print('Range', 'distanceToEmpty', ' miles');
    print('Odometer', 'vehicleMileage', ' miles');
    print('Power', 'powerState');
    print('Time to full', 'timeToEndOfCharge', ' min');
    print('Remote charging', 'remoteChargingAvailable');
    lines.push('');
  }

  // Charging
  if ('chargerStatus' in state || 'chargerState' in state) {
    lines.push('Charging');
    print('Charger status', 'chargerStatus');
    print('Charger state', 'chargerState');
    print('Charge port', 'chargePortState');
    lines.push('');
  }

  // Doors — combine closed + locked per door
  const doorPositions = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight'];
  const doorLines = [];
  for (const pos of doorPositions) {
    const closedKey = `door${pos}Closed`;
    const lockedKey = `door${pos}Locked`;
    if (closedKey in state || lockedKey in state) {
      printed.add(closedKey);
      printed.add(lockedKey);
      const parts = [v(closedKey), v(lockedKey)].filter(Boolean);
      const label = pos.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
      if (parts.length) doorLines.push(`  ${label}: ${parts.join(', ')}`);
    }
  }
  if (doorLines.length) {
    lines.push('Doors');
    lines.push(...doorLines);
    lines.push('');
  }

  // Closures — frunk, liftgate, tailgate, tonneau
  const closures = ['Frunk', 'Liftgate', 'Tailgate', 'Tonneau'];
  const closureLines = [];
  for (const name of closures) {
    const closedKey = `closure${name}Closed`;
    const lockedKey = `closure${name}Locked`;
    if (closedKey in state || lockedKey in state) {
      printed.add(closedKey);
      printed.add(lockedKey);
      const parts = [v(closedKey), v(lockedKey)].filter(Boolean);
      if (parts.length) closureLines.push(`  ${name.toLowerCase()}: ${parts.join(', ')}`);
    }
  }
  if (closureLines.length) {
    lines.push('Closures');
    lines.push(...closureLines);
    lines.push('');
  }

  // Windows
  const windowLines = [];
  for (const pos of doorPositions) {
    const key = `window${pos}Closed`;
    if (key in state) {
      printed.add(key);
      const value = v(key);
      if (value) {
        const label = pos.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
        windowLines.push(`  ${label}: ${value}`);
      }
    }
  }
  if (windowLines.length) {
    lines.push('Windows');
    lines.push(...windowLines);
    lines.push('');
  }

  // Climate
  if ('cabinClimateInteriorTemperature' in state || 'cabinPreconditioningStatus' in state) {
    lines.push('Climate');
    if ('cabinClimateInteriorTemperature' in state) {
      printed.add('cabinClimateInteriorTemperature');
      const temp = v('cabinClimateInteriorTemperature');
      if (temp) lines.push(`  Cabin temp: ${temp}°`);
    }
    print('Preconditioning', 'cabinPreconditioningStatus');
    print('Defrost/defog', 'defrostDefogStatus');
    print('Pet mode', 'petModeStatus');
    lines.push('');
  }

  // Tires
  const tirePositions = { FrontLeft: 'front left', FrontRight: 'front right', RearLeft: 'rear left', RearRight: 'rear right' };
  const tireLines = [];
  for (const [pos, label] of Object.entries(tirePositions)) {
    const key = `tirePressureStatus${pos}`;
    if (key in state) {
      printed.add(key);
      const value = v(key);
      if (value) tireLines.push(`  ${label}: ${value}`);
    }
  }
  if (tireLines.length) {
    lines.push('Tire Pressure');
    lines.push(...tireLines);
    lines.push('');
  }

  // Software (OTA)
  if ('otaCurrentVersion' in state || 'otaAvailableVersion' in state || 'otaStatus' in state) {
    lines.push('Software');
    print('Current version', 'otaCurrentVersion');
    print('Available update', 'otaAvailableVersion');
    print('Status', 'otaStatus');
    print('Install status', 'otaCurrentStatus');
    print('Install ready', 'otaInstallReady');
    print('Install progress', 'otaInstallProgress', '%');
    print('Download progress', 'otaDownloadProgress', '%');
    print('Install type', 'otaInstallType');
    print('Current hash', 'otaCurrentVersionGitHash');
    print('Available hash', 'otaAvailableVersionGitHash');
    lines.push('');
  }

  // Security
  if ('gearGuardLocked' in state) {
    lines.push('Security');
    print('Gear Guard', 'gearGuardLocked');
    print('Gear Guard video', 'gearGuardVideoStatus');
    lines.push('');
  }

  // Drive
  if ('driveMode' in state || 'gearStatus' in state) {
    lines.push('Drive');
    print('Drive mode', 'driveMode');
    print('Gear', 'gearStatus');
    lines.push('');
  }

  // Connection
  if ('cloudConnection' in state) {
    printed.add('cloudConnection');
    const cc = state.cloudConnection;
    const online = cc?.isOnline ? 'Online' : 'Offline';
    const sync = cc?.lastSync ? ` (last sync: ${cc.lastSync})` : '';
    lines.push('Connection');
    lines.push(`  Status: ${online}${sync}`);
    lines.push('');
  }

  // Location
  if ('gnssLocation' in state) {
    printed.add('gnssLocation');
    const loc = state.gnssLocation;
    if (loc?.latitude && loc?.longitude) {
      lines.push('Location');
      lines.push(`  ${loc.latitude}, ${loc.longitude}`);
      lines.push('');
    }
  }

  // Anything not already printed
  const remaining = [];
  for (const [key, entry] of Object.entries(state)) {
    if (printed.has(key)) continue;
    const value = entry?.value ?? entry;
    if (value !== null && value !== undefined) {
      remaining.push(`  ${key}: ${value}`);
    }
  }
  if (remaining.length) {
    lines.push('Other');
    lines.push(...remaining);
  }

  return lines.join('\n').trim();
}

function formatOTAStatus(ota) {
  const lines = [];

  if (ota.currentOTAUpdateDetails) {
    lines.push(`Current software: v${ota.currentOTAUpdateDetails.version}`);
  } else {
    lines.push('Current software: unknown');
  }

  if (ota.availableOTAUpdateDetails) {
    lines.push(`Update available: v${ota.availableOTAUpdateDetails.version}`);
    if (ota.availableOTAUpdateDetails.url) {
      lines.push(`Release notes: ${ota.availableOTAUpdateDetails.url}`);
    }
  } else {
    lines.push('No update available — software is up to date.');
  }

  return lines.join('\n');
}

function formatChargingSession(data) {
  if (!data) return 'No active charging session.';

  const lines = ['Charging Session'];

  const add = (label, entry, suffix = '') => {
    const value = entry?.value;
    if (value !== undefined && value !== null) lines.push(`  ${label}: ${value}${suffix}`);
  };

  add('Battery', data.soc, '%');
  add('Power', data.power, ' kW');
  add('Range added', data.rangeAddedThisSession, ' miles');
  add('Energy charged', data.totalChargedEnergy, ' kWh');
  add('Current', data.current, ' A');
  if (data.timeElapsed) lines.push(`  Time elapsed: ${data.timeElapsed}`);
  add('Time remaining', data.timeRemaining, ' min');

  if (data.isRivianCharger) lines.push('  Network: Rivian Adventure Network');
  if (data.isFreeSession) {
    lines.push('  Cost: Free');
  } else if (data.currentPrice) {
    lines.push(`  Cost so far: ${data.currentCurrency || '$'}${data.currentPrice}`);
  }

  add('Charger state', data.vehicleChargerState);

  return lines.join('\n');
}

function formatDriversAndKeys(data) {
  const lines = [];

  if (data.vin) lines.push(`Vehicle: ${data.vin}`);

  if (!data.invitedUsers?.length) {
    lines.push('No drivers or keys found.');
    return lines.join('\n');
  }

  lines.push('');
  for (const user of data.invitedUsers) {
    if (user.firstName) {
      lines.push(`${user.firstName} ${user.lastName} (${user.email})`);
      if (user.roles?.length) lines.push(`  Roles: ${user.roles.join(', ')}`);

      if (user.devices?.length) {
        for (const d of user.devices) {
          const name = d.deviceName || d.type;
          const status = [
            d.isPaired ? 'paired' : 'not paired',
            d.isEnabled ? 'enabled' : 'disabled',
          ].join(', ');
          lines.push(`  ${name} — ${status}`);
        }
      }
    } else {
      lines.push(`${user.email} (invited, ${user.status})`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

// ── Vehicle ID resolution ─────────────────────────────────────────────

let cachedVehicleId = null;

async function resolveVehicleId() {
  if (cachedVehicleId) return cachedVehicleId;
  const user = await rivian.getUserInfo();
  if (!user.vehicles?.length) {
    throw new Error('No vehicles found on your Rivian account.');
  }
  cachedVehicleId = user.vehicles[0].id;
  return cachedVehicleId;
}

// ── Restore session on startup ────────────────────────────────────────

loadSession();

// ── MCP Server ────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'rivian',
  version: '1.0.0',
});

// ── Auth tools ────────────────────────────────────────────────────────

server.tool(
  'rivian_login',
  'Log in to your Rivian account. Rivian will send a verification code to your phone or email — use rivian_submit_otp to complete sign-in.',
  {},
  async () => {
    const email = process.env.RIVIAN_EMAIL;
    const password = process.env.RIVIAN_PASSWORD;
    if (!email || !password) {
      return text(
        'Rivian credentials are not configured. Set RIVIAN_EMAIL and RIVIAN_PASSWORD in your MCP server settings.',
      );
    }

    try {
      await rivian.createCsrfToken();
      const { mfa } = await rivian.login(email, password);
      saveSession();

      if (mfa) {
        return text(
          "A verification code has been sent to your phone or email. Tell me the code and I'll complete the sign-in.",
        );
      }

      return text('Signed in to Rivian successfully.');
    } catch (err) {
      return text(`Couldn't sign in: ${err.message}`);
    }
  },
);

server.tool(
  'rivian_submit_otp',
  'Complete Rivian sign-in with the verification code sent to your phone or email.',
  { otp_code: z.string().describe('The verification code') },
  async ({ otp_code }) => {
    const email = process.env.RIVIAN_EMAIL;
    if (!email) {
      return text('RIVIAN_EMAIL is not configured.');
    }

    if (!rivian.needsOtp()) {
      return text('No pending verification. Start with rivian_login first.');
    }

    try {
      await rivian.validateOtp(email, otp_code);
      saveSession();
      return text('Signed in to Rivian successfully.');
    } catch (err) {
      return text(
        `Verification failed: ${err.message}. You may need to start over with rivian_login.`,
      );
    }
  },
);

// ── Read-only query tools ─────────────────────────────────────────────

server.tool(
  'rivian_get_user_info',
  'Look up your Rivian account — your vehicles, software versions, and account details.',
  {},
  async () => {
    try {
      requireAuth();
      return text(formatUserInfo(await rivian.getUserInfo()));
    } catch (err) {
      return text(err.message);
    }
  },
);

server.tool(
  'rivian_get_vehicle_state',
  "Check your vehicle's current status — battery, range, doors, tires, location, climate, software, and more.",
  {
    properties: z
      .array(z.string())
      .optional()
      .describe('Specific properties to check. Leave empty for a full status report.'),
  },
  async ({ properties }) => {
    try {
      requireAuth();
      const vehicleId = await resolveVehicleId();
      const props = properties ? new Set(properties) : undefined;
      return text(formatVehicleState(await rivian.getVehicleState(vehicleId, props)));
    } catch (err) {
      return text(err.message);
    }
  },
);

server.tool(
  'rivian_get_ota_status',
  "Check for software updates — what version you're running and whether a new one is available.",
  {},
  async () => {
    try {
      requireAuth();
      const vehicleId = await resolveVehicleId();
      return text(formatOTAStatus(await rivian.getOTAUpdateDetails(vehicleId)));
    } catch (err) {
      return text(err.message);
    }
  },
);

server.tool(
  'rivian_get_charging_session',
  'Check on an active charging session — power, battery level, time remaining, and cost.',
  {},
  async () => {
    try {
      requireAuth();
      const vehicleId = await resolveVehicleId();
      return text(formatChargingSession(await rivian.getLiveChargingSession(vehicleId)));
    } catch (err) {
      return text(err.message);
    }
  },
);

server.tool(
  'rivian_get_drivers_and_keys',
  'See who has access to your vehicle — drivers, phone keys, and key fobs.',
  {},
  async () => {
    try {
      requireAuth();
      const vehicleId = await resolveVehicleId();
      return text(formatDriversAndKeys(await rivian.getDriversAndKeys(vehicleId)));
    } catch (err) {
      return text(err.message);
    }
  },
);

// ── Start ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
