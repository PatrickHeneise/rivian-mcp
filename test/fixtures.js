// Mock data based on real API response structure, with all values scrambled/anonymized

export const vehicleState = {
  cloudConnection: {
    lastSync: '2025-11-15T18:32:12.456Z',
    isOnline: true,
  },
  gnssLocation: {
    latitude: 37.7749,
    longitude: -122.4194,
    timeStamp: '2025-11-15T18:32:10.123Z',
  },
  gnssAltitude: {
    timeStamp: '2025-11-15T18:32:10.123Z',
    value: 52.3,
  },
  batteryLevel: {
    timeStamp: '2025-11-15T18:30:00.000Z',
    value: 72.300003,
  },
  batteryLimit: {
    timeStamp: '2025-11-10T12:00:00.000Z',
    value: 80,
  },
  batteryCapacity: {
    timeStamp: '2025-11-15T18:30:00.000Z',
    value: 131.847992,
  },
  distanceToEmpty: {
    timeStamp: '2025-11-15T18:30:00.000Z',
    value: 218,
  },
  vehicleMileage: {
    timeStamp: '2025-11-15T17:00:00.000Z',
    value: 24510400,
  },
  powerState: {
    timeStamp: '2025-11-15T17:05:00.000Z',
    value: 'ready',
  },
  timeToEndOfCharge: {
    timeStamp: '2025-11-10T12:00:00.000Z',
    value: 0,
  },
  remoteChargingAvailable: {
    timeStamp: '2025-11-10T12:00:00.000Z',
    value: 0,
  },
  chargerStatus: {
    timeStamp: '2025-11-10T12:00:00.000Z',
    value: 'chrgr_sts_not_connected',
  },
  chargerState: {
    timeStamp: '2025-11-10T12:00:00.000Z',
    value: 'charging_ready',
  },
  chargePortState: {
    timeStamp: '2025-11-10T13:00:00.000Z',
    value: 'closed',
  },
  otaCurrentVersion: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: '2025.42.0',
  },
  otaCurrentVersionGitHash: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 'a3b7c9d2',
  },
  otaCurrentVersionYear: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 2025,
  },
  otaCurrentVersionWeek: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 42,
  },
  otaCurrentVersionNumber: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 0,
  },
  otaAvailableVersion: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: '0.0.0',
  },
  otaAvailableVersionGitHash: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: '',
  },
  otaAvailableVersionYear: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 0,
  },
  otaAvailableVersionWeek: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 0,
  },
  otaAvailableVersionNumber: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 0,
  },
  otaStatus: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 'Idle',
  },
  otaCurrentStatus: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 'Install_Success',
  },
  otaInstallReady: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 'ota_not_available',
  },
  otaInstallProgress: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 0,
  },
  otaDownloadProgress: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 0,
  },
  otaInstallType: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 'Convenience',
  },
  otaInstallDuration: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 0,
  },
  otaInstallTime: {
    timeStamp: '2025-11-01T10:00:00.000Z',
    value: 0,
  },
  driveMode: {
    timeStamp: '2025-11-15T17:03:00.000Z',
    value: 'all_purpose',
  },
  gearStatus: {
    timeStamp: '2025-11-15T17:03:00.000Z',
    value: 'park',
  },
  tirePressureStatusFrontLeft: {
    timeStamp: '2025-11-15T17:10:00.000Z',
    value: 'OK',
  },
  tirePressureStatusFrontRight: {
    timeStamp: '2025-11-15T17:10:00.000Z',
    value: 'OK',
  },
  tirePressureStatusRearLeft: {
    timeStamp: '2025-11-15T17:10:00.000Z',
    value: 'Low',
  },
  tirePressureStatusRearRight: {
    timeStamp: '2025-11-15T17:10:00.000Z',
    value: 'OK',
  },
  doorFrontLeftClosed: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'closed' },
  doorFrontRightClosed: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'closed' },
  doorRearLeftClosed: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'closed' },
  doorRearRightClosed: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'closed' },
  doorFrontLeftLocked: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'locked' },
  doorFrontRightLocked: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'locked' },
  doorRearLeftLocked: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'locked' },
  doorRearRightLocked: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'locked' },
  closureFrunkClosed: { timeStamp: '2025-11-14T08:00:00.000Z', value: 'closed' },
  closureFrunkLocked: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'locked' },
  closureLiftgateClosed: { timeStamp: '2025-11-15T01:00:00.000Z', value: 'closed' },
  closureLiftgateLocked: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'locked' },
  closureTailgateClosed: { timeStamp: '2025-11-15T01:00:00.000Z', value: 'signal_not_available' },
  closureTailgateLocked: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'unlocked' },
  closureTonneauClosed: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'signal_not_available' },
  closureTonneauLocked: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'unlocked' },
  windowFrontLeftClosed: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'closed' },
  windowFrontRightClosed: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'closed' },
  windowRearLeftClosed: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'closed' },
  windowRearRightClosed: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'closed' },
  windowFrontLeftCalibrated: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'Calibrated' },
  windowFrontRightCalibrated: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'Calibrated' },
  windowRearLeftCalibrated: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'Calibrated' },
  windowRearRightCalibrated: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'Calibrated' },
  cabinClimateInteriorTemperature: { timeStamp: '2025-11-15T17:20:00.000Z', value: 22 },
  cabinClimateDriverTemperature: { timeStamp: '2025-11-15T17:20:00.000Z', value: 21 },
  cabinPreconditioningStatus: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'undefined' },
  cabinPreconditioningType: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'NONE' },
  defrostDefogStatus: { timeStamp: '2025-11-15T17:20:00.000Z', value: 'Off' },
  petModeStatus: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'Off' },
  petModeTemperatureStatus: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'Default' },
  seatFrontLeftHeat: { timeStamp: '2025-11-10T10:00:00.000Z', value: 'Off' },
  seatFrontRightHeat: { timeStamp: '2025-11-15T17:20:00.000Z', value: 'Off' },
  seatRearLeftHeat: { timeStamp: '2025-11-10T10:00:00.000Z', value: 'Off' },
  seatRearRightHeat: { timeStamp: '2025-11-15T17:20:00.000Z', value: 'Off' },
  seatThirdRowLeftHeat: { timeStamp: '2025-11-10T10:00:00.000Z', value: 'Off' },
  seatThirdRowRightHeat: { timeStamp: '2025-11-15T17:20:00.000Z', value: 'Off' },
  seatFrontLeftVent: { timeStamp: '2025-11-10T10:00:00.000Z', value: 'Off' },
  seatFrontRightVent: { timeStamp: '2025-11-15T17:20:00.000Z', value: 'Off' },
  steeringWheelHeat: { timeStamp: '2025-11-10T10:00:00.000Z', value: 'Off' },
  gearGuardLocked: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'locked' },
  gearGuardVideoStatus: { timeStamp: '2025-11-15T16:50:00.000Z', value: 'Enabled' },
  gearGuardVideoMode: { timeStamp: '2025-11-15T16:50:00.000Z', value: 'Away_From_Home' },
  alarmSoundStatus: { timeStamp: '2025-11-15T16:50:00.000Z', value: 'false' },
  batteryHvThermalEvent: { timeStamp: '2025-11-14T02:00:00.000Z', value: 'off' },
  trailerStatus: { timeStamp: '2025-11-15T17:03:00.000Z', value: 'TRAILER_NOT_PRESENT' },
}

// Vehicle state while actively charging
export const vehicleStateCharging = {
  batteryLevel: { timeStamp: '2025-11-15T18:30:00.000Z', value: 43.2 },
  batteryLimit: { timeStamp: '2025-11-10T12:00:00.000Z', value: 90 },
  distanceToEmpty: { timeStamp: '2025-11-15T18:30:00.000Z', value: 134 },
  vehicleMileage: { timeStamp: '2025-11-15T17:00:00.000Z', value: 24510400 },
  powerState: { timeStamp: '2025-11-15T17:05:00.000Z', value: 'ready' },
  timeToEndOfCharge: { timeStamp: '2025-11-15T18:30:00.000Z', value: 185 },
  chargerStatus: { timeStamp: '2025-11-15T18:30:00.000Z', value: 'chrgr_sts_connected_charging' },
  chargerState: { timeStamp: '2025-11-15T18:30:00.000Z', value: 'charging_active' },
  chargePortState: { timeStamp: '2025-11-15T18:30:00.000Z', value: 'open' },
  otaStatus: { timeStamp: '2025-11-01T10:00:00.000Z', value: 'Idle' },
  otaCurrentVersion: { timeStamp: '2025-11-01T10:00:00.000Z', value: '2025.42.0' },
  cloudConnection: { lastSync: '2025-11-15T18:32:12.456Z', isOnline: true },
}

// Vehicle state with active OTA update
export const vehicleStateOtaUpdate = {
  batteryLevel: { timeStamp: '2025-11-15T18:30:00.000Z', value: 85 },
  batteryLimit: { timeStamp: '2025-11-10T12:00:00.000Z', value: 90 },
  distanceToEmpty: { timeStamp: '2025-11-15T18:30:00.000Z', value: 260 },
  vehicleMileage: { timeStamp: '2025-11-15T17:00:00.000Z', value: 24510400 },
  otaCurrentVersion: { timeStamp: '2025-11-01T10:00:00.000Z', value: '2025.42.0' },
  otaAvailableVersion: { timeStamp: '2025-11-15T10:00:00.000Z', value: '2025.46.0' },
  otaAvailableVersionGitHash: { timeStamp: '2025-11-15T10:00:00.000Z', value: 'f4e2a1c9' },
  otaAvailableVersionYear: { timeStamp: '2025-11-15T10:00:00.000Z', value: 2025 },
  otaAvailableVersionWeek: { timeStamp: '2025-11-15T10:00:00.000Z', value: 46 },
  otaAvailableVersionNumber: { timeStamp: '2025-11-15T10:00:00.000Z', value: 0 },
  otaStatus: { timeStamp: '2025-11-15T10:00:00.000Z', value: 'Available' },
  otaCurrentStatus: { timeStamp: '2025-11-15T10:00:00.000Z', value: 'In_Progress' },
  otaInstallReady: { timeStamp: '2025-11-15T10:00:00.000Z', value: 'ready' },
  otaInstallProgress: { timeStamp: '2025-11-15T10:00:00.000Z', value: 0 },
  otaDownloadProgress: { timeStamp: '2025-11-15T10:00:00.000Z', value: 67 },
  otaInstallType: { timeStamp: '2025-11-15T10:00:00.000Z', value: 'Scheduled' },
  otaInstallDuration: { timeStamp: '2025-11-15T10:00:00.000Z', value: 45 },
  cloudConnection: { lastSync: '2025-11-15T18:32:12.456Z', isOnline: true },
}

export const otaDetails = {
  availableOTAUpdateDetails: null,
  currentOTAUpdateDetails: {
    url: 'https://rivian.com/software/release-notes/2025.42.0',
    version: '2025.42.0',
    locale: 'en-US',
  },
  vehicleState: {
    otaStatus: {
      value: 'Idle',
      timeStamp: '2025-11-01T10:00:00.000Z',
    },
  },
}

export const otaDetailsWithUpdate = {
  availableOTAUpdateDetails: {
    url: 'https://rivian.com/software/release-notes/2025.46.0',
    version: '2025.46.0',
    locale: 'en-US',
  },
  currentOTAUpdateDetails: {
    url: 'https://rivian.com/software/release-notes/2025.42.0',
    version: '2025.42.0',
    locale: 'en-US',
  },
  vehicleState: {
    otaStatus: {
      value: 'Available',
      timeStamp: '2025-11-15T10:00:00.000Z',
    },
  },
}

export const chargingSessions = [
  {
    startInstant: '2025-11-14T19:30:00Z',
    endInstant: '2025-11-14T21:15:00Z',
    city: 'Boulder',
    vendor: 'Rivian Adventure Network',
    chargerType: 'DCFC',
    isHomeCharger: false,
    totalEnergyKwh: 48.7,
    rangeAddedKm: 201,
    paidTotal: 12.35,
    currencyCode: 'USD',
  },
  {
    startInstant: '2025-11-12T23:00:00Z',
    endInstant: '2025-11-13T07:30:00Z',
    city: 'Home',
    vendor: null,
    chargerType: 'Level 2',
    isHomeCharger: true,
    totalEnergyKwh: 62.3,
    rangeAddedKm: 310,
    paidTotal: 0,
    currencyCode: 'USD',
  },
  {
    startInstant: '2025-11-10T15:00:00Z',
    endInstant: '2025-11-10T15:25:00Z',
    city: 'Denver',
    vendor: 'ChargePoint',
    chargerType: 'DCFC',
    isHomeCharger: false,
    totalEnergyKwh: 22.1,
    rangeAddedKm: 105,
    paidTotal: 7.8,
    currencyCode: 'USD',
  },
]

export const chargingSchedule = {
  chargingSchedules: [
    {
      startTime: 1380,
      duration: 480,
      amperage: 48,
      enabled: true,
      weekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      location: { latitude: 37.7749, longitude: -122.4194 },
    },
  ],
}

export const driversAndKeys = {
  vin: '7FCTGAAL5PN099887',
  invitedUsers: [
    {
      firstName: 'Alex',
      lastName: 'Rivera',
      email: 'alex.r@example.com',
      roles: ['primary_owner'],
      status: 'accepted',
      devices: [
        { deviceName: 'iPhone 16 Pro', type: 'phone', isPaired: true, isEnabled: true },
        { deviceName: 'Key fob', type: 'fob', isPaired: true, isEnabled: true },
      ],
    },
    {
      firstName: 'Jordan',
      lastName: 'Rivera',
      email: 'jordan.r@example.com',
      roles: ['driver'],
      status: 'accepted',
      devices: [{ deviceName: 'Pixel 9', type: 'phone', isPaired: true, isEnabled: true }],
    },
    {
      firstName: null,
      lastName: null,
      email: 'guest@example.com',
      roles: [],
      status: 'pending',
      devices: [],
    },
  ],
}

export const chargingSession = {
  soc: { value: 52 },
  power: { value: 11.2 },
  rangeAddedThisSession: { value: 45 },
  totalChargedEnergy: { value: 18.7 },
  current: { value: 48 },
  timeElapsed: '1h 42m',
  timeRemaining: { value: 135 },
  isRivianCharger: false,
  isFreeSession: false,
  currentPrice: 6.48,
  currentCurrency: '$',
  vehicleChargerState: { value: 'charging' },
}

export const userInfo = {
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex.r@example.com',
  vehicles: [
    {
      id: '01-389201456',
      name: 'Blue Lightning',
      vin: '7FCTGAAL5PN099887',
      vehicle: {
        modelYear: 2025,
        make: 'RIVIAN',
        model: 'R1S',
        otaEarlyAccessStatus: 'OPTED_IN',
        currentOTAUpdateDetails: { version: '2025.42.0' },
        availableOTAUpdateDetails: null,
      },
    },
  ],
}
