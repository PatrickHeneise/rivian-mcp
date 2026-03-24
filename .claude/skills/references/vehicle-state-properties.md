# Vehicle State Properties Reference

All properties confirmed working via live API introspection (March 2026).
All return `{ timeStamp, value }` unless noted in the Custom Templates section.

## Custom Templates

Three properties require non-standard fragment templates (defined in `TEMPLATE_MAP` in `lib/rivian-api.js`):

| Property | Fragment |
|---|---|
| `cloudConnection` | `{ lastSync isOnline }` |
| `gnssLocation` | `{ latitude longitude timeStamp }` |
| `gnssError` | `{ timeStamp positionVertical positionHorizontal speed bearing }` |

## Connectivity

| Property | Value type | Example |
|---|---|---|
| `cloudConnection` | custom | `{ isOnline: false, lastSync: "2026-03-23T23:02:06Z" }` |
| `gnssLocation` | custom | `{ latitude: 40.066, longitude: -105.287, timeStamp: "..." }` |
| `gnssAltitude` | Int | `1695` (meters) |

## Battery & Range

| Property | Value type | Example |
|---|---|---|
| `batteryLevel` | Float | `54.4` (%) |
| `batteryLimit` | Int | `90` (%) |
| `batteryCapacity` | Float | `135` (kWh) |
| `distanceToEmpty` | Int | `339` (miles) |
| `vehicleMileage` | Int | `36662` (miles) |
| `powerState` | String | `"sleep"`, `"ready"`, `"go"` |
| `timeToEndOfCharge` | Int | `45` (minutes) |
| `remoteChargingAvailable` | Int | `1` |

## Charging

| Property | Value type | Example |
|---|---|---|
| `chargerStatus` | String | `"chrgr_sts_not_connected"`, `"chrgr_sts_connected_no_chrg"`, `"chrgr_sts_charging"` |
| `chargerState` | String | `"charging_active"`, `"charging_stopped"` |
| `chargePortState` | String | `"Locked"`, `"open"` |

## OTA Software

| Property | Value type | Example |
|---|---|---|
| `otaCurrentVersion` | String | `"2026.03.0"` |
| `otaCurrentVersionGitHash` | String | `"abc1234"` |
| `otaCurrentVersionYear` | Int | `2026` |
| `otaCurrentVersionWeek` | Int | `3` |
| `otaCurrentVersionNumber` | Int | `0` |
| `otaAvailableVersion` | String | `"2026.07.0"` — `"0.0.0"` means no update |
| `otaAvailableVersionGitHash` | String | |
| `otaAvailableVersionYear` | Int | `0` when no update available |
| `otaAvailableVersionWeek` | Int | `0` when no update available |
| `otaAvailableVersionNumber` | Int | `0` when no update available |
| `otaStatus` | String | `"Idle"`, `"Available"`, `"Ready_To_Install"`, `"Scheduled_To_Install"`, `"Install_Countdown"`, `"Awaiting_Install"`, `"Installing"`, `"Success"`, `"Failed"` |
| `otaCurrentStatus` | String | install state detail |
| `otaInstallReady` | String | `"Ready"` |
| `otaInstallProgress` | Int | `0`–`100` (%) |
| `otaDownloadProgress` | Int | `0`–`100` (%) |
| `otaInstallType` | String | `"FOTA"` |
| `otaInstallDuration` | Int | minutes; `0` when idle |
| `otaInstallTime` | Int | scheduled install time; `0` when idle |

## Drive

| Property | Value type | Example |
|---|---|---|
| `driveMode` | String | `"everyday"`, `"sport"`, `"offroad"`, `"tow"` |
| `gearStatus` | String | `"park"`, `"drive"`, `"reverse"`, `"neutral"` |

## Tires

| Property | Value type | Example |
|---|---|---|
| `tirePressureStatusFrontLeft` | String | `"OK"`, `"Low"`, `"Critical"` |
| `tirePressureStatusFrontRight` | String | |
| `tirePressureStatusRearLeft` | String | |
| `tirePressureStatusRearRight` | String | |

## Doors

| Property | Example values |
|---|---|
| `doorFrontLeftClosed` | `"closed"` / `"open"` |
| `doorFrontRightClosed` | |
| `doorRearLeftClosed` | |
| `doorRearRightClosed` | |
| `doorFrontLeftLocked` | `"locked"` / `"unlocked"` |
| `doorFrontRightLocked` | |
| `doorRearLeftLocked` | |
| `doorRearRightLocked` | |

## Closures

| Property | Example values |
|---|---|
| `closureFrunkClosed` | `"closed"` / `"open"` |
| `closureFrunkLocked` | `"locked"` / `"unlocked"` |
| `closureLiftgateClosed` | |
| `closureLiftgateLocked` | |
| `closureTailgateClosed` | |
| `closureTailgateLocked` | |
| `closureTonneauClosed` | |
| `closureTonneauLocked` | |

## Windows

| Property | Example values |
|---|---|
| `windowFrontLeftClosed` | `"closed"` / `"open"` |
| `windowFrontRightClosed` | |
| `windowRearLeftClosed` | |
| `windowRearRightClosed` | |
| `windowFrontLeftCalibrated` | `"Calibrated"` |
| `windowFrontRightCalibrated` | |
| `windowRearLeftCalibrated` | |
| `windowRearRightCalibrated` | |

## Climate

| Property | Value type | Example |
|---|---|---|
| `cabinClimateInteriorTemperature` | Float | `26` (°C, actual cabin temp) |
| `cabinClimateDriverTemperature` | Float | `21` (°C, driver setpoint) |
| `cabinPreconditioningStatus` | String | `"undefined"`, `"active"` |
| `cabinPreconditioningType` | String | `"NONE"`, `"AWAY"` |
| `defrostDefogStatus` | String | `"Off"`, `"On"` |
| `petModeStatus` | String | `"Disabled"`, `"Off"` |
| `petModeTemperatureStatus` | String | `"Default"` |

## Seat Heat & Vent

| Property | Value type | Example |
|---|---|---|
| `seatFrontLeftHeat` | String | `"Off"`, `"Low"`, `"Medium"`, `"High"` |
| `seatFrontRightHeat` | String | |
| `seatRearLeftHeat` | String | |
| `seatRearRightHeat` | String | |
| `seatThirdRowLeftHeat` | String | |
| `seatThirdRowRightHeat` | String | |
| `seatFrontLeftVent` | String | `"Off"`, `"Low"`, `"Medium"`, `"High"` |
| `seatFrontRightVent` | String | |
| `steeringWheelHeat` | String | `"Off"`, `"On"` |

## Security

| Property | Value type | Example |
|---|---|---|
| `gearGuardLocked` | String | `"locked"` / `"unlocked"` |
| `gearGuardVideoStatus` | String | `"Enabled"`, `"Disabled"` |
| `gearGuardVideoMode` | String | `"Away_From_Home"`, `"Parked"` |
| `alarmSoundStatus` | String | `"false"` (not active), `"true"` (active) |
| `batteryHvThermalEvent` | String | `"off"` |

## Towing

| Property | Value type | Example |
|---|---|---|
| `trailerStatus` | String | `"TRAILER_NOT_PRESENT"`, `"TRAILER_PRESENT"` |

---

## Charging Session Fields (`getLiveSessionData`)

Timestamped fields use `{ __typename, value, updatedAt }`. Returns `null` when not actively charging.

| Field | Type | Notes |
|---|---|---|
| `soc` | Float | Battery % |
| `power` | Float | kW |
| `current` | Float | Amps |
| `rangeAddedThisSession` | Float | miles |
| `totalChargedEnergy` | Float | kWh |
| `timeElapsed` | String | ISO duration |
| `timeRemaining` | Float | minutes |
| `kilometersChargedPerHour` | Float | |
| `currentPrice` | Float | cost so far |
| `currentCurrency` | String | e.g. `"USD"` |
| `isFreeSession` | Boolean | |
| `isRivianCharger` | Boolean | Rivian Adventure Network |
| `startTime` | String | ISO timestamp |
| `chargerId` | String | |
| `locationId` | String | |
| `vehicleChargerState` | String | charger state detail |

## Charging History Fields (`getCompletedSessionSummaries`)

| Field | Notes |
|---|---|
| `startInstant` / `endInstant` | ISO timestamps |
| `totalEnergyKwh` | Float |
| `rangeAddedKm` | Float — multiply × 0.621371 for miles |
| `paidTotal` | Float |
| `currencyCode` | `"USD"` etc. |
| `chargerType` | `"AC"`, `"DC"` |
| `city` | String |
| `vendor` | Charging network name |
| `isHomeCharger` | Boolean |
| `isRoamingNetwork` | Boolean |
| `isPublic` | Boolean |
| `vehicleId` | String |
| `vehicleName` | String |
| `transactionId` | String |

## Charging Schedule Fields (`chargingSchedules`)

| Field | Notes |
|---|---|
| `startTime` | Minutes from midnight — `1320` = 10:00 PM |
| `duration` | Minutes — `360` = 6 hours |
| `amperage` | Int |
| `enabled` | Boolean |
| `weekDays` | Array of day strings |
| `location` | `{ latitude, longitude }` |

---

## What Does NOT Exist (confirmed rejected by API)

These were probed and returned `GRAPHQL_VALIDATION_FAILED` — do not use them:

**Vehicle state:** `vehicleSpeed`, `suspensionLevel`, `rideHeight`, `kineticRoll`, `pitchAngle`, `batteryAuxLevel`, `chargerVoltage`, `chargerCurrent`, `regenBrakingMode`, `odometer`, `tripMileage`, `towMode`, `campMode`, `differentialLockFront/Rear`, `seatVentFrontLeft/Right` (wrong name — use `seatFrontLeftVent`), `tirePressureFrontLeft` (wrong — use `tirePressureStatusFrontLeft`)

**Gateway queries:** `planTrip`, `getNearbyChargingSites`, `getVehicleImages`, `getVehicleWarranty`, `getUserNotifications`, `getVehicleOrderStatus`, `getUserNotifications`

**Charging queries:** `getChargingSiteDetails`, `getActiveChargingSession`, `getPricingInfo`, `getChargerSummary`, `getNearbyChargingStations`, `getRoamingChargingNetworks`
