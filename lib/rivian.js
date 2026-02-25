/**
 * Rivian API — READ ONLY
 *
 * Based on bretterer/rivian-python-client and rivian-api.kaedenb.org docs.
 * No write/post/patch mutations — only auth and queries.
 */

const GRAPHQL_GATEWAY = 'https://rivian.com/api/gql/gateway/graphql';
const GRAPHQL_CHARGING = 'https://rivian.com/api/gql/chrg/user/graphql';
const APOLLO_CLIENT_NAME = 'com.rivian.ios.consumer-apollo-ios';

const BASE_HEADERS = {
  'User-Agent': 'RivianApp/707 CFNetwork/1237 Darwin/20.4.0',
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Apollographql-Client-Name': APOLLO_CLIENT_NAME,
};

// ── Session state ───────────────────────────────────────────────────

let csrfToken = '';
let appSessionToken = '';
let accessToken = '';
let refreshToken = '';
let userSessionToken = '';
let otpToken = '';

export const needsOtp = () => !!otpToken;
export const isAuthenticated = () => !!accessToken;

// ── Auth ────────────────────────────────────────────────────────────

export async function createCsrfToken() {
  const data = await gql(GRAPHQL_GATEWAY, {
    operationName: 'CreateCSRFToken',
    query: `mutation CreateCSRFToken {
  createCsrfToken {
    __typename
    csrfToken
    appSessionToken
  }
}`,
    variables: null,
  });
  csrfToken = data.createCsrfToken.csrfToken;
  appSessionToken = data.createCsrfToken.appSessionToken;
}

export async function login(email, password) {
  const data = await gql(
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
    { 'Csrf-Token': csrfToken, 'A-Sess': appSessionToken },
  );

  if (data.login.otpToken) {
    otpToken = data.login.otpToken;
    return { mfa: true };
  }

  accessToken = data.login.accessToken;
  refreshToken = data.login.refreshToken;
  userSessionToken = data.login.userSessionToken;
  return { mfa: false };
}

export async function validateOtp(email, otpCode) {
  const data = await gql(
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
      variables: { email, otpCode, otpToken },
    },
    { 'Csrf-Token': csrfToken, 'A-Sess': appSessionToken },
  );

  accessToken = data.loginWithOTP.accessToken;
  refreshToken = data.loginWithOTP.refreshToken;
  userSessionToken = data.loginWithOTP.userSessionToken;
  otpToken = '';
}

// ── Read-only queries ───────────────────────────────────────────────

export async function getUserInfo() {
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
  };

  return (await gql(GRAPHQL_GATEWAY, body, authHeaders())).currentUser;
}

export async function getVehicleState(vehicleId, properties) {
  const props = properties || DEFAULT_VEHICLE_STATE_PROPERTIES;
  const fragment = [...props]
    .map((p) => `${p} ${TEMPLATE_MAP[p] || VALUE_TEMPLATE}`)
    .join('\n    ');

  const body = {
    operationName: 'GetVehicleState',
    query: `query GetVehicleState($vehicleID: String!) {
  vehicleState(id: $vehicleID) {
    ${fragment}
  }
}`,
    variables: { vehicleID: vehicleId },
  };

  return (await gql(GRAPHQL_GATEWAY, body, authHeaders())).vehicleState;
}

export async function getOTAUpdateDetails(vehicleId) {
  const body = {
    operationName: 'getOTAUpdateDetails',
    query: `query getOTAUpdateDetails($vehicleId: String!) {
  getVehicle(id: $vehicleId) {
    availableOTAUpdateDetails { url version locale }
    currentOTAUpdateDetails { url version locale }
  }
}`,
    variables: { vehicleId },
  };

  return (await gql(GRAPHQL_GATEWAY, body, authHeaders())).getVehicle;
}

export async function getLiveChargingSession(vehicleId) {
  const body = {
    operationName: 'getLiveSessionData',
    query: `query getLiveSessionData($vehicleId: ID!) {
  getLiveSessionData(vehicleId: $vehicleId) {
    __typename
    chargerId
    current { __typename value updatedAt }
    currentCurrency
    currentMiles { __typename value updatedAt }
    currentPrice
    isFreeSession
    isRivianCharger
    kilometersChargedPerHour { __typename value updatedAt }
    locationId
    power { __typename value updatedAt }
    rangeAddedThisSession { __typename value updatedAt }
    soc { __typename value updatedAt }
    startTime
    timeElapsed
    timeRemaining { __typename value updatedAt }
    totalChargedEnergy { __typename value updatedAt }
    vehicleChargerState { __typename value updatedAt }
  }
}`,
    variables: { vehicleId },
  };

  return (await gql(GRAPHQL_CHARGING, body, chargingHeaders())).getLiveSessionData;
}

export async function getChargingHistory() {
  const body = {
    operationName: 'getCompletedSessionSummaries',
    query: `query getCompletedSessionSummaries {
  getCompletedSessionSummaries {
    chargerType
    currencyCode
    paidTotal
    startInstant
    endInstant
    totalEnergyKwh
    rangeAddedKm
    city
    transactionId
    vehicleId
    vehicleName
    vendor
    isRoamingNetwork
    isPublic
    isHomeCharger
  }
}`,
    variables: {},
  };

  return (await gql(GRAPHQL_CHARGING, body, chargingHeaders())).getCompletedSessionSummaries;
}

export async function getChargingSchedule(vehicleId) {
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
  };

  return (await gql(GRAPHQL_GATEWAY, body, authHeaders())).getVehicle;
}

export async function getDriversAndKeys(vehicleId) {
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
  };

  return (await gql(GRAPHQL_GATEWAY, body, authHeaders())).getVehicle;
}

// ── Session persistence ──────────────────────────────────────────────

export function exportSession() {
  return {
    csrfToken,
    appSessionToken,
    accessToken,
    refreshToken,
    userSessionToken,
    otpToken,
    needsOtp: !!otpToken,
    authenticated: !!accessToken,
  };
}

export function restoreSession(session) {
  csrfToken = session.csrfToken || '';
  appSessionToken = session.appSessionToken || '';
  accessToken = session.accessToken || '';
  refreshToken = session.refreshToken || '';
  userSessionToken = session.userSessionToken || '';
  otpToken = session.otpToken || '';
}

// ── Internals ───────────────────────────────────────────────────────

function authHeaders() {
  return { 'A-Sess': appSessionToken, 'U-Sess': userSessionToken };
}

function chargingHeaders() {
  return { 'U-Sess': userSessionToken };
}

async function gql(url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      'dc-cid': `m-ios-${crypto.randomUUID()}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (json.errors?.length) {
    const e = json.errors[0];
    const msg = e.message || e.extensions?.code || 'Unknown GraphQL error';
    const err = new Error(msg);
    err.code = e.extensions?.code;
    err.reason = e.extensions?.reason;
    throw err;
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return json.data;
}

// ── Vehicle state property templates ────────────────────────────────

const VALUE_TEMPLATE = '{ timeStamp value }';

const TEMPLATE_MAP = {
  cloudConnection: '{ lastSync isOnline }',
  gnssLocation: '{ latitude longitude timeStamp isAuthorized }',
  gnssError: '{ timeStamp positionVertical positionHorizontal speed bearing }',
};

const DEFAULT_VEHICLE_STATE_PROPERTIES = new Set([
  'cloudConnection',
  'gnssLocation',
  'batteryLevel',
  'batteryLimit',
  'batteryCapacity',
  'distanceToEmpty',
  'vehicleMileage',
  'powerState',
  'chargerStatus',
  'chargerState',
  'chargePortState',
  'otaAvailableVersion',
  'otaAvailableVersionGitHash',
  'otaCurrentVersion',
  'otaCurrentVersionGitHash',
  'otaStatus',
  'otaInstallReady',
  'otaInstallProgress',
  'otaCurrentStatus',
  'otaDownloadProgress',
  'otaInstallType',
  'driveMode',
  'gearStatus',
  'tirePressureStatusFrontLeft',
  'tirePressureStatusFrontRight',
  'tirePressureStatusRearLeft',
  'tirePressureStatusRearRight',
  'doorFrontLeftClosed',
  'doorFrontRightClosed',
  'doorRearLeftClosed',
  'doorRearRightClosed',
  'doorFrontLeftLocked',
  'doorFrontRightLocked',
  'doorRearLeftLocked',
  'doorRearRightLocked',
  'closureFrunkClosed',
  'closureFrunkLocked',
  'closureLiftgateClosed',
  'closureLiftgateLocked',
  'closureTailgateClosed',
  'closureTailgateLocked',
  'closureTonneauClosed',
  'closureTonneauLocked',
  'windowFrontLeftClosed',
  'windowFrontRightClosed',
  'windowRearLeftClosed',
  'windowRearRightClosed',
  'cabinClimateInteriorTemperature',
  'cabinPreconditioningStatus',
  'defrostDefogStatus',
  'petModeStatus',
  'gearGuardLocked',
  'gearGuardVideoStatus',
  'timeToEndOfCharge',
  'remoteChargingAvailable',
]);
