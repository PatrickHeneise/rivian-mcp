/**
 * Rivian API — READ ONLY
 *
 * Based on bretterer/rivian-python-client and rivian-api.kaedenb.org docs.
 * No write/post/patch mutations — only auth and queries.
 */

const GRAPHQL_GATEWAY = 'https://rivian.com/api/gql/gateway/graphql'
const GRAPHQL_CHARGING = 'https://rivian.com/api/gql/chrg/user/graphql'
export const APOLLO_CLIENT_NAME = 'com.rivian.ios.consumer-apollo-ios'

const BASE_HEADERS = {
  'User-Agent': 'RivianApp/707 CFNetwork/1237 Darwin/20.4.0',
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'Apollographql-Client-Name': APOLLO_CLIENT_NAME,
}

// ── Types ───────────────────────────────────────────────────────────

export interface Session {
  csrfToken: string
  appSessionToken: string
  accessToken: string
  refreshToken: string
  userSessionToken: string
  otpToken: string
}

/** The session plus the flags written to disk. */
export interface SavedSession extends Partial<Session> {
  needsOtp?: boolean
  authenticated?: boolean
  savedAt?: number
}

export type StateValue = string | number | boolean | null

export interface StateEntry {
  value?: StateValue
  timeStamp?: string
  // cloudConnection
  lastSync?: string
  isOnline?: boolean
  // gnssLocation
  latitude?: number
  longitude?: number
}

export type VehicleState = Record<string, StateEntry | null>

interface Option {
  optionId: string
  optionName: string | null
}

interface OtaDetails {
  url?: string | null
  version: string
  locale?: string | null
}

export interface UserInfo {
  id?: string
  firstName: string
  lastName: string
  email: string
  vehicles?: {
    id: string
    vin: string
    name: string | null
    vehicle: {
      modelYear: number
      make: string
      model: string
      actualGeneralAssemblyDate?: string | null
      mobileConfiguration?: {
        trimOption?: Option | null
        driveSystemOption?: Option | null
        exteriorColorOption?: Option | null
        interiorColorOption?: Option | null
        wheelOption?: Option | null
      } | null
      otaEarlyAccessStatus?: boolean | null
      currentOTAUpdateDetails?: OtaDetails | null
      availableOTAUpdateDetails?: OtaDetails | null
    }
  }[]
}

export interface OtaStatus {
  currentOTAUpdateDetails?: OtaDetails | null
  availableOTAUpdateDetails?: OtaDetails | null
  vehicleState?: { otaStatus?: { value: string | null } | null } | null
}

interface Timed<T> {
  value: T
  updatedAt?: string
}

export interface LiveChargingSession {
  transactionId?: string | null
  startTime?: string | null
  timeElapsed?: string | null
  currentPrice?: string | number | null
  currentCurrency?: string | null
  isFreeSession?: boolean | null
  isRivianCharger?: boolean | null
  soc?: Timed<number> | null
  power?: Timed<number> | null
  current?: Timed<number> | null
  rangeAddedThisSession?: Timed<number> | null
  totalChargedEnergy?: Timed<number> | null
  timeRemaining?: Timed<number> | null
  timeReady?: Timed<string> | null
  vehicleChargerState?: Timed<string> | null
  location?: { name?: string | null; city?: string | null; operator?: { name?: string } | null }
}

interface HistoryItem {
  transactionId: string
  vehicleId: string
  vehicleName: string | null
  startDateTime: string
  endDateTime: string
  totalEnergy: number | null
  rangeAdded: number | null
  charger?: {
    name?: string | null
    type?: string | null
    vendor?: string | null
    isPublic?: boolean | null
    isHomeCharger?: boolean | null
    isRoamingNetwork?: boolean | null
    address?: { city?: string | null } | null
  } | null
  order?: { currencyCode?: string | null; paidTotal?: number | null } | null
}

export interface SessionSummary {
  transactionId: string
  vehicleId: string
  vehicleName: string | null
  startInstant: string
  endInstant: string
  totalEnergyKwh: number | null
  rangeAddedKm: number | null
  chargerName: string | null
  chargerType: string | null
  vendor: string | null
  city: string | null
  isPublic: boolean | null
  isHomeCharger: boolean | null
  isRoamingNetwork: boolean | null
  currencyCode: string | null
  paidTotal: number | null
}

export interface ChargingSchedule {
  chargingSchedules?: {
    startTime: number
    duration: number
    location?: { latitude: number; longitude: number } | null
    amperage: number
    enabled: boolean
    weekDays?: string[] | null
  }[]
}

export interface DriversAndKeys {
  vin?: string
  invitedUsers?: {
    firstName?: string | null
    lastName?: string | null
    email: string
    roles?: string[]
    status?: string
    devices?: { type: string; deviceName?: string | null; isPaired: boolean; isEnabled: boolean }[]
  }[]
}

/** A GraphQL error with Rivian's extension code and reason. */
export interface RivianError extends Error {
  code?: string
  reason?: string
}

// ── Session state ───────────────────────────────────────────────────

export const emptySession = (): Session => ({
  csrfToken: '',
  appSessionToken: '',
  accessToken: '',
  refreshToken: '',
  userSessionToken: '',
  otpToken: '',
})

export const needsOtp = (session: Session) => !!session.otpToken
export const isAuthenticated = (session: Session) => !!session.accessToken

// ── Auth ────────────────────────────────────────────────────────────

export async function createCsrfToken(session: Session): Promise<void> {
  const data = await gql<{ createCsrfToken: { csrfToken: string; appSessionToken: string } }>(
    GRAPHQL_GATEWAY,
    {
      operationName: 'CreateCSRFToken',
      query: `mutation CreateCSRFToken {
  createCsrfToken {
    __typename
    csrfToken
    appSessionToken
  }
}`,
      variables: null,
    },
  )
  session.csrfToken = data.createCsrfToken.csrfToken
  session.appSessionToken = data.createCsrfToken.appSessionToken
}

interface LoginTokens {
  accessToken?: string
  refreshToken?: string
  userSessionToken?: string
  otpToken?: string
}

export async function login(
  session: Session,
  email: string,
  password: string,
): Promise<{ mfa: boolean }> {
  const data = await gql<{ login: LoginTokens }>(
    GRAPHQL_GATEWAY,
    {
      operationName: 'Login',
      query: `mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    __typename
    ... on MobileLoginResponse {
      __typename
      accessToken
      refreshToken
      userSessionToken
    }
    ... on MobileMFALoginResponse {
      __typename
      otpToken
    }
  }
}`,
      variables: { email, password },
    },
    { 'Csrf-Token': session.csrfToken, 'A-Sess': session.appSessionToken },
  )

  if (data.login.otpToken) {
    session.otpToken = data.login.otpToken
    return { mfa: true }
  }

  session.accessToken = data.login.accessToken ?? ''
  session.refreshToken = data.login.refreshToken ?? ''
  session.userSessionToken = data.login.userSessionToken ?? ''
  return { mfa: false }
}

export async function validateOtp(session: Session, email: string, otpCode: string): Promise<void> {
  const data = await gql<{ loginWithOTP: LoginTokens | null }>(
    GRAPHQL_GATEWAY,
    {
      operationName: 'LoginWithOTP',
      query: `mutation LoginWithOTP($email: String!, $otpCode: String!, $otpToken: String!) {
  loginWithOTP(email: $email, otpCode: $otpCode, otpToken: $otpToken) {
    __typename
    ... on MobileLoginResponse {
      __typename
      accessToken
      refreshToken
      userSessionToken
    }
  }
}`,
      variables: { email, otpCode, otpToken: session.otpToken },
    },
    { 'Csrf-Token': session.csrfToken, 'A-Sess': session.appSessionToken },
  )

  if (!data?.loginWithOTP?.accessToken) {
    throw new Error('OTP validation failed — incorrect code or expired token. Please try again.')
  }

  session.accessToken = data.loginWithOTP.accessToken
  session.refreshToken = data.loginWithOTP.refreshToken ?? ''
  session.userSessionToken = data.loginWithOTP.userSessionToken ?? ''
  session.otpToken = ''
}

// ── Read-only queries ───────────────────────────────────────────────

export async function getUserInfo(session: Session): Promise<UserInfo> {
  const body = {
    operationName: 'getUserInfo',
    query: `query getUserInfo {
  currentUser {
    __typename
    id
    firstName
    lastName
    email
    vehicles {
      id
      vin
      name
      roles
      state
      createdAt
      updatedAt
      vas { __typename vasVehicleId vehiclePublicKey }
      vehicle {
        __typename
        id
        vin
        modelYear
        make
        model
        expectedBuildDate
        plannedBuildDate
        actualGeneralAssemblyDate
        mobileConfiguration {
          trimOption { optionId optionName }
          driveSystemOption { optionId optionName }
          exteriorColorOption { optionId optionName }
          interiorColorOption { optionId optionName }
          wheelOption { optionId optionName }
        }
        otaEarlyAccessStatus
        currentOTAUpdateDetails { url version locale }
        availableOTAUpdateDetails { url version locale }
        vehicleState {
          supportedFeatures { __typename name status }
        }
      }
    }
    registrationChannels { type }
  }
}`,
    variables: null,
  }

  return (await gql<{ currentUser: UserInfo }>(GRAPHQL_GATEWAY, body, authHeaders(session)))
    .currentUser
}

export async function getVehicleState(
  session: Session,
  vehicleId: string,
  properties?: Set<string>,
): Promise<VehicleState> {
  const props = properties || DEFAULT_VEHICLE_STATE_PROPERTIES
  const fragment = [...props].map((p) => `${p} ${TEMPLATE_MAP[p] || VALUE_TEMPLATE}`).join('\n    ')

  const body = {
    operationName: 'GetVehicleState',
    query: `query GetVehicleState($vehicleID: String!) {
  vehicleState(id: $vehicleID) {
    ${fragment}
  }
}`,
    variables: { vehicleID: vehicleId },
  }

  return (await gql<{ vehicleState: VehicleState }>(GRAPHQL_GATEWAY, body, authHeaders(session)))
    .vehicleState
}

export async function getOTAUpdateDetails(session: Session, vehicleId: string): Promise<OtaStatus> {
  const body = {
    operationName: 'getOTAUpdateDetails',
    query: `query getOTAUpdateDetails($vehicleId: String!) {
  getVehicle(id: $vehicleId) {
    availableOTAUpdateDetails { url version locale }
    currentOTAUpdateDetails { url version locale }
    vehicleState {
      otaStatus { value timeStamp }
    }
  }
}`,
    variables: { vehicleId },
  }

  return (await gql<{ getVehicle: OtaStatus }>(GRAPHQL_GATEWAY, body, authHeaders(session)))
    .getVehicle
}

export async function getLiveChargingSession(
  session: Session,
  vehicleId: string,
): Promise<LiveChargingSession | null> {
  // getLiveSessionData was removed (Oct 2026); its fields moved to getLiveSessionHistory
  const body = {
    operationName: 'getLiveSessionHistory',
    query: `query getLiveSessionHistory($vehicleId: ID!) {
  getLiveSessionHistory(vehicleId: $vehicleId) {
    __typename
    transactionId
    chargerId
    locationId
    startTime
    timeElapsed
    currentPrice
    currentCurrency
    isFreeSession
    isRivianCharger
    derateState
    soc { __typename value updatedAt }
    power { __typename value updatedAt }
    current { __typename value updatedAt }
    currentMiles { __typename value updatedAt }
    kilometersChargedPerHour { __typename value updatedAt }
    rangeAddedThisSession { __typename value updatedAt }
    totalChargedEnergy { __typename value updatedAt }
    timeRemaining { __typename value updatedAt }
    timeReady { __typename value updatedAt }
    vehicleChargerState { __typename value updatedAt }
    location { name city operator { name } }
  }
}`,
    variables: { vehicleId },
  }

  const data = (
    await gql<{ getLiveSessionHistory: LiveChargingSession | null }>(
      GRAPHQL_CHARGING,
      body,
      chargingHeaders(session),
    )
  ).getLiveSessionHistory
  // The query returns an all-null object when no session is active
  if (!data || (!data.transactionId && !data.startTime && !data.soc)) return null
  return data
}

// Vehicle-state charging fields. getLiveSessionHistory and the chargingSession subscription
// returned all-null data during an active charge (Oct 10, 2026); vehicle state still showed it
const CHARGING_STATE_PROPERTIES = new Set([
  'batteryLevel',
  'batteryLimit',
  'timeToEndOfCharge',
  'chargerState',
  'chargingTimeEstimationValidity',
])

export async function getChargingState(session: Session, vehicleId: string) {
  return getVehicleState(session, vehicleId, CHARGING_STATE_PROPERTIES)
}

const HISTORY_PAGE_SIZE = 100 // API rejects pageSize > 100

export async function getChargingHistory(
  session: Session,
  vehicleId: string,
): Promise<SessionSummary[] | null> {
  // getCompletedSessionSummaries returns [] since Oct 2026; V2 is paged and per vehicle
  const query = `query getCompletedSessionSummariesV2($vehicleId: String!, $pageSize: Int, $searchAfter: String) {
  getCompletedSessionSummariesV2(vehicleId: $vehicleId, pageSize: $pageSize, searchAfter: $searchAfter) {
    items {
      transactionId
      vehicleId
      vehicleName
      startDateTime
      endDateTime
      totalEnergy
      rangeAdded
      charger {
        name
        type
        vendor
        isPublic
        isHomeCharger
        isRoamingNetwork
        address { city state country }
      }
      order { currencyCode paidTotal totalCost }
    }
    pageInfo { nextCursor hasNextPage }
  }
}`

  type HistoryPage = {
    items: HistoryItem[]
    pageInfo?: { nextCursor?: string | null; hasNextPage?: boolean } | null
  } | null

  const items: HistoryItem[] = []
  const seenCursors = new Set<string>()
  let searchAfter: string | null = null
  for (let page = 0; ; page++) {
    const body: object = {
      operationName: 'getCompletedSessionSummariesV2',
      query,
      variables: { vehicleId, pageSize: HISTORY_PAGE_SIZE, searchAfter },
    }
    const result: HistoryPage = (
      await gql<{ getCompletedSessionSummariesV2: HistoryPage }>(
        GRAPHQL_CHARGING,
        body,
        chargingHeaders(session),
      )
    ).getCompletedSessionSummariesV2
    if (!result) {
      // A null first page means an expired session. A null later page must not look complete.
      if (page === 0) return null
      throw new Error(`Charging history failed on page ${page + 1} after ${items.length} sessions.`)
    }
    items.push(...result.items)
    const cursor: string | null | undefined = result.pageInfo?.nextCursor
    if (!result.pageInfo?.hasNextPage || !cursor) break
    // A repeated cursor would loop forever
    if (seenCursors.has(cursor)) {
      throw new Error(`Charging history returned a repeated cursor after ${items.length} sessions.`)
    }
    seenCursors.add(cursor)
    searchAfter = cursor
  }

  return items.map(toSessionSummary)
}

// History for every vehicle on the account, newest first
export async function getAllChargingHistory(session: Session): Promise<SessionSummary[] | null> {
  const user = await getUserInfo(session)
  // A null user means an expired session, not an empty account
  if (!user) return null
  const histories = await Promise.all(
    (user.vehicles || []).map((v) => getChargingHistory(session, v.id)),
  )
  // A null history means an expired session; surface that instead of a partial list
  if (histories.some((h) => h === null)) return null
  return (histories as SessionSummary[][])
    .flat()
    .sort((a, b) => new Date(b.startInstant).getTime() - new Date(a.startInstant).getTime())
}

// Map a V2 item to the flat shape formatChargingHistory expects
function toSessionSummary(item: HistoryItem): SessionSummary {
  const charger = item.charger || {}
  return {
    transactionId: item.transactionId,
    vehicleId: item.vehicleId,
    vehicleName: item.vehicleName,
    startInstant: item.startDateTime,
    endInstant: item.endDateTime,
    totalEnergyKwh: item.totalEnergy,
    rangeAddedKm: item.rangeAdded,
    chargerName: charger.name ?? null,
    chargerType: charger.type && charger.type !== 'UNKNOWN' ? charger.type : null,
    vendor: charger.vendor ?? null,
    city: charger.address?.city ?? null,
    isPublic: charger.isPublic ?? null,
    isHomeCharger: charger.isHomeCharger ?? null,
    isRoamingNetwork: charger.isRoamingNetwork ?? null,
    currencyCode: item.order?.currencyCode ?? null,
    paidTotal: item.order?.paidTotal ?? null,
  }
}

export async function getChargingSchedule(
  session: Session,
  vehicleId: string,
): Promise<ChargingSchedule> {
  const body = {
    operationName: 'GetChargingSchedule',
    query: `query GetChargingSchedule($vehicleId: String!) {
  getVehicle(id: $vehicleId) {
    chargingSchedules {
      startTime
      duration
      location { latitude longitude }
      amperage
      enabled
      weekDays
    }
  }
}`,
    variables: { vehicleId },
  }

  return (await gql<{ getVehicle: ChargingSchedule }>(GRAPHQL_GATEWAY, body, authHeaders(session)))
    .getVehicle
}

export async function getDriversAndKeys(
  session: Session,
  vehicleId: string,
): Promise<DriversAndKeys> {
  const body = {
    operationName: 'DriversAndKeys',
    query: `query DriversAndKeys($vehicleId: String) {
  getVehicle(id: $vehicleId) {
    __typename
    id
    vin
    invitedUsers {
      __typename
      ... on ProvisionedUser {
        firstName lastName email roles userId
        devices { type mappedIdentityId id hrid deviceName isPaired isEnabled }
      }
      ... on UnprovisionedUser {
        email inviteId status
      }
    }
  }
}`,
    variables: { vehicleId },
  }

  return (await gql<{ getVehicle: DriversAndKeys }>(GRAPHQL_GATEWAY, body, authHeaders(session)))
    .getVehicle
}

// ── Session persistence ──────────────────────────────────────────────

export function exportSession(session: Session): SavedSession {
  return {
    ...session,
    needsOtp: !!session.otpToken,
    authenticated: !!session.accessToken,
  }
}

export function restoreSession(session: Session, saved: SavedSession): void {
  session.csrfToken = saved.csrfToken || ''
  session.appSessionToken = saved.appSessionToken || ''
  session.accessToken = saved.accessToken || ''
  session.refreshToken = saved.refreshToken || ''
  session.userSessionToken = saved.userSessionToken || ''
  session.otpToken = saved.otpToken || ''
}

// ── Internals ───────────────────────────────────────────────────────

function authHeaders(session: Session) {
  return { 'A-Sess': session.appSessionToken, 'U-Sess': session.userSessionToken }
}

function chargingHeaders(session: Session) {
  return {
    'U-Sess': session.userSessionToken,
    Authorization: `Bearer ${session.accessToken}`,
  }
}

async function gql<T>(
  url: string,
  body: object,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        ...BASE_HEADERS,
        'dc-cid': `m-ios-${crypto.randomUUID()}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error(`Network error contacting Rivian API: ${(err as Error).message}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
  }

  const json = (await res.json()) as {
    data: T
    errors?: { message?: string; extensions?: { code?: string; reason?: string } }[]
  }

  if (json.errors?.length) {
    const e = json.errors[0]
    const msg = e.message || e.extensions?.code || 'Unknown GraphQL error'
    const err: RivianError = new Error(msg)
    err.code = e.extensions?.code
    err.reason = e.extensions?.reason
    throw err
  }

  return json.data
}

// ── Vehicle state property templates ────────────────────────────────

const VALUE_TEMPLATE = '{ timeStamp value }'

const TEMPLATE_MAP: Record<string, string> = {
  cloudConnection: '{ lastSync isOnline }',
  gnssLocation: '{ latitude longitude timeStamp }',
  gnssError: '{ timeStamp positionVertical positionHorizontal speed bearing }',
}

const DEFAULT_VEHICLE_STATE_PROPERTIES = new Set([
  // Connectivity
  'cloudConnection',
  'gnssLocation',
  'gnssAltitude',
  'gnssSpeed',
  'gnssBearing',
  // Battery & range
  'batteryLevel',
  'batteryLimit',
  'batteryCapacity',
  'batteryCellType',
  'batteryNeedsLfpCalibration',
  'distanceToEmpty',
  'vehicleMileage',
  'powerState',
  'timeToEndOfCharge',
  'remoteChargingAvailable',
  'rangeThreshold',
  // Charging
  'chargerStatus',
  'chargerState',
  'chargePortState',
  'chargerDerateStatus',
  'chargingTimeEstimationValidity',
  'chargingDisabledAC',
  'chargingDisabledAll',
  'closureChargePortDoorNextAction',
  // OTA software
  'otaCurrentVersion',
  'otaCurrentVersionGitHash',
  'otaCurrentVersionYear',
  'otaCurrentVersionWeek',
  'otaCurrentVersionNumber',
  'otaAvailableVersion',
  'otaAvailableVersionGitHash',
  'otaAvailableVersionYear',
  'otaAvailableVersionWeek',
  'otaAvailableVersionNumber',
  'otaStatus',
  'otaCurrentStatus',
  'otaInstallReady',
  'otaInstallProgress',
  'otaDownloadProgress',
  'otaInstallType',
  'otaInstallDuration',
  'otaInstallTime',
  // Drive
  'driveMode',
  'gearStatus',
  // Tires
  'tirePressureStatusFrontLeft',
  'tirePressureStatusFrontRight',
  'tirePressureStatusRearLeft',
  'tirePressureStatusRearRight',
  'tirePressureStatusValidFrontLeft',
  'tirePressureStatusValidFrontRight',
  'tirePressureStatusValidRearLeft',
  'tirePressureStatusValidRearRight',
  // Doors
  'doorFrontLeftClosed',
  'doorFrontRightClosed',
  'doorRearLeftClosed',
  'doorRearRightClosed',
  'doorFrontLeftLocked',
  'doorFrontRightLocked',
  'doorRearLeftLocked',
  'doorRearRightLocked',
  // Closures
  'closureFrunkClosed',
  'closureFrunkLocked',
  'closureFrunkNextAction',
  'closureLiftgateClosed',
  'closureLiftgateLocked',
  'closureLiftgateNextAction',
  'closureTailgateClosed',
  'closureTailgateLocked',
  'closureTailgateNextAction',
  'closureTonneauClosed',
  'closureTonneauLocked',
  'closureTonneauNextAction',
  'closureSideBinLeftClosed',
  'closureSideBinLeftLocked',
  'closureSideBinRightClosed',
  'closureSideBinRightLocked',
  'closureSideBinLeftNextAction',
  'closureSideBinRightNextAction',
  // Windows
  'windowFrontLeftClosed',
  'windowFrontRightClosed',
  'windowRearLeftClosed',
  'windowRearRightClosed',
  'windowFrontLeftCalibrated',
  'windowFrontRightCalibrated',
  'windowRearLeftCalibrated',
  'windowRearRightCalibrated',
  'windowsNextAction',
  // Climate
  'cabinClimateInteriorTemperature',
  'cabinClimateDriverTemperature',
  'cabinPreconditioningStatus',
  'cabinPreconditioningType',
  'defrostDefogStatus',
  'petModeStatus',
  'petModeTemperatureStatus',
  // Seat heat & vent
  'seatFrontLeftHeat',
  'seatFrontRightHeat',
  'seatRearLeftHeat',
  'seatRearRightHeat',
  'seatThirdRowLeftHeat',
  'seatThirdRowRightHeat',
  'seatFrontLeftVent',
  'seatFrontRightVent',
  'steeringWheelHeat',
  // Security
  'gearGuardLocked',
  'gearGuardVideoStatus',
  'gearGuardVideoMode',
  'gearGuardVideoTermsAccepted',
  'alarmSoundStatus',
  // Vehicle health
  'batteryHvThermalEvent',
  'batteryHvThermalEventPropagation',
  'twelveVoltBatteryHealth',
  'wiperFluidState',
  'brakeFluidLow',
  'limitedAccelCold',
  'limitedRegenCold',
  'serviceMode',
  'carWashMode',
  'btmOcHardwareFailureStatus',
  // Towing
  'trailerStatus',
  'rearHitchStatus',
])
