# Vehicle State Properties Reference

All properties confirmed working via live API testing (April 2026).
All return `{ timeStamp, value }` unless noted in the Custom Templates section.

Units are determined by the user's in-vehicle settings (km/miles, °C/°F). The API returns raw values without unit metadata. User unit preferences (`distanceUnit`, `temperatureUnit`, `pressureUnit`) are available on `currentUser.settings` but may be `null`. The `vehicleMileage` field always returns km regardless of user setting.

## Custom Templates

Three properties require non-standard fragment templates (defined in `TEMPLATE_MAP` in `lib/rivian-api.js`):

| Property          | Fragment                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `cloudConnection` | `{ lastSync isOnline }`                                           |
| `gnssLocation`    | `{ latitude longitude timeStamp }`                                |
| `gnssError`       | `{ timeStamp positionVertical positionHorizontal speed bearing }` |

## Connectivity

| Property          | Value type | Example                                                       |
| ----------------- | ---------- | ------------------------------------------------------------- |
| `cloudConnection` | custom     | `{ isOnline: true, lastSync: "2026-04-09T22:14:47Z" }`        |
| `gnssLocation`    | custom     | `{ latitude: 40.066, longitude: -105.287, timeStamp: "..." }` |
| `gnssAltitude`    | Float      | `1695.9`                                                      |
| `gnssSpeed`       | Int        | `0` (GPS speed)                                               |

## Battery & Range

| Property                  | Value type | Example                                         |
| ------------------------- | ---------- | ----------------------------------------------- |
| `batteryLevel`            | Float      | `48.600002` (%, may have float noise)           |
| `batteryLimit`            | Int        | `85` (%)                                        |
| `batteryCapacity`         | Float      | `143.554993`                                    |
| `distanceToEmpty`         | Int        | `300` (user's distance unit)                    |
| `vehicleMileage`          | Int        | `37413` (always km)                             |
| `powerState`              | String     | `"sleep"`, `"ready"`, `"go"`                    |
| `timeToEndOfCharge`       | Int        | `45` (minutes, `0` when not charging)           |
| `remoteChargingAvailable` | Int        | `0` or `1`                                      |
| `rangeThreshold`          | String     | `"vehicle_range_normal"`, `"vehicle_range_low"` |

## Charging

| Property              | Value type | Example                                                                                        |
| --------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `chargerStatus`       | String     | `"chrgr_sts_not_connected"`, `"chrgr_sts_connected_no_chrg"`, `"chrgr_sts_connected_charging"` |
| `chargerState`        | String     | `"charging_ready"`, `"charging_active"`, `"charging_stopped"`                                  |
| `chargePortState`     | String     | `"close"`, `"open"`, `"Locked"`                                                                |
| `chargerDerateStatus` | String     | `"NONE"` (derate info during charging)                                                         |

## OTA Software

| Property                     | Value type | Example                                                                                                                                                       |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `otaCurrentVersion`          | String     | `"2026.03.0"`                                                                                                                                                 |
| `otaCurrentVersionGitHash`   | String     | `"61f1eaca"`                                                                                                                                                  |
| `otaCurrentVersionYear`      | Int        | `2026`                                                                                                                                                        |
| `otaCurrentVersionWeek`      | Int        | `3`                                                                                                                                                           |
| `otaCurrentVersionNumber`    | Int        | `0`                                                                                                                                                           |
| `otaAvailableVersion`        | String     | `"2026.07.0"` — `"0.0.0"` means no update                                                                                                                     |
| `otaAvailableVersionGitHash` | String     | empty string when no update                                                                                                                                   |
| `otaAvailableVersionYear`    | Int        | `0` when no update available                                                                                                                                  |
| `otaAvailableVersionWeek`    | Int        | `0` when no update available                                                                                                                                  |
| `otaAvailableVersionNumber`  | Int        | `0` when no update available                                                                                                                                  |
| `otaStatus`                  | String     | `"Idle"`, `"Available"`, `"Ready_To_Install"`, `"Scheduled_To_Install"`, `"Install_Countdown"`, `"Awaiting_Install"`, `"Installing"`, `"Success"`, `"Failed"` |
| `otaCurrentStatus`           | String     | `"Install_Success"`, install state detail                                                                                                                     |
| `otaInstallReady`            | String     | `"ota_not_available"`, `"Ready"`                                                                                                                              |
| `otaInstallProgress`         | Int        | `0`–`100` (%)                                                                                                                                                 |
| `otaDownloadProgress`        | Int        | `0`–`100` (%)                                                                                                                                                 |
| `otaInstallType`             | String     | `"Convenience"`, `"FOTA"`                                                                                                                                     |
| `otaInstallDuration`         | Int        | minutes; `0` when idle                                                                                                                                        |
| `otaInstallTime`             | Int        | scheduled install time; `0` when idle                                                                                                                         |

## Drive

| Property      | Value type | Example                                                                                                                                                                         |
| ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `driveMode`   | String     | `"everyday"`, `"sport"`, `"distance"`, `"all_purpose"`, `"winter"`, `"off_road_auto"`, `"off_road_rocks"`, `"off_road_sport_auto"`, `"off_road_sport_drift"`, `"off_road_sand"` |
| `gearStatus`  | String     | `"park"`, `"drive"`, `"reverse"`, `"neutral"`                                                                                                                                   |
| `serviceMode` | String     | `"off"`, `"on"`                                                                                                                                                                 |
| `carWashMode` | String     | `"off"`, `"on"`                                                                                                                                                                 |

## Tires

| Property                       | Value type | Example                       |
| ------------------------------ | ---------- | ----------------------------- |
| `tirePressureStatusFrontLeft`  | String     | `"OK"`, `"Low"`, `"Critical"` |
| `tirePressureStatusFrontRight` | String     |                               |
| `tirePressureStatusRearLeft`   | String     |                               |
| `tirePressureStatusRearRight`  | String     |                               |

## Doors

| Property               | Example values            |
| ---------------------- | ------------------------- |
| `doorFrontLeftClosed`  | `"closed"` / `"open"`     |
| `doorFrontRightClosed` |                           |
| `doorRearLeftClosed`   |                           |
| `doorRearRightClosed`  |                           |
| `doorFrontLeftLocked`  | `"locked"` / `"unlocked"` |
| `doorFrontRightLocked` |                           |
| `doorRearLeftLocked`   |                           |
| `doorRearRightLocked`  |                           |

## Closures

| Property                    | Example values                       |
| --------------------------- | ------------------------------------ |
| `closureFrunkClosed`        | `"closed"` / `"open"`                |
| `closureFrunkLocked`        | `"locked"` / `"unlocked"`            |
| `closureFrunkNextAction`    | `"Open_Allowed"`, `"SNA"`            |
| `closureLiftgateClosed`     |                                      |
| `closureLiftgateLocked`     |                                      |
| `closureLiftgateNextAction` | `"Open_Allowed"`, `"SNA"`            |
| `closureTailgateClosed`     | `"signal_not_available"` when N/A    |
| `closureTailgateLocked`     |                                      |
| `closureTailgateNextAction` | `"SNA"` (signal not available)       |
| `closureTonneauClosed`      | `"signal_not_available"` when N/A    |
| `closureTonneauLocked`      |                                      |
| `closureTonneauNextAction`  | `"SNA"`                              |
| `closureSideBinLeftClosed`  | `"closed"`, `"signal_not_available"` |
| `closureSideBinLeftLocked`  | `"locked"` / `"unlocked"`            |
| `closureSideBinRightClosed` |                                      |
| `closureSideBinRightLocked` |                                      |

## Windows

| Property                     | Example values        |
| ---------------------------- | --------------------- |
| `windowFrontLeftClosed`      | `"closed"` / `"open"` |
| `windowFrontRightClosed`     |                       |
| `windowRearLeftClosed`       |                       |
| `windowRearRightClosed`      |                       |
| `windowFrontLeftCalibrated`  | `"Calibrated"`        |
| `windowFrontRightCalibrated` |                       |
| `windowRearLeftCalibrated`   |                       |
| `windowRearRightCalibrated`  |                       |

## Climate

| Property                          | Value type | Example                           |
| --------------------------------- | ---------- | --------------------------------- |
| `cabinClimateInteriorTemperature` | Float      | `19` (actual cabin temp)          |
| `cabinClimateDriverTemperature`   | Float      | `24` (driver setpoint)            |
| `cabinPreconditioningStatus`      | String     | `"undefined"` (= off), `"active"` |
| `cabinPreconditioningType`        | String     | `"NONE"`, `"AWAY"`                |
| `defrostDefogStatus`              | String     | `"Off"`, `"On"`                   |
| `petModeStatus`                   | String     | `"Off"`, `"Disabled"`             |
| `petModeTemperatureStatus`        | String     | `"Default"`                       |

## Seat Heat & Vent

| Property                | Value type | Example                                |
| ----------------------- | ---------- | -------------------------------------- |
| `seatFrontLeftHeat`     | String     | `"Off"`, `"Low"`, `"Medium"`, `"High"` |
| `seatFrontRightHeat`    | String     |                                        |
| `seatRearLeftHeat`      | String     |                                        |
| `seatRearRightHeat`     | String     |                                        |
| `seatThirdRowLeftHeat`  | String     |                                        |
| `seatThirdRowRightHeat` | String     |                                        |
| `seatFrontLeftVent`     | String     | `"Off"`, `"Low"`, `"Medium"`, `"High"` |
| `seatFrontRightVent`    | String     |                                        |
| `steeringWheelHeat`     | String     | `"Off"`, `"On"`                        |

## Security

| Property               | Value type | Example                                   |
| ---------------------- | ---------- | ----------------------------------------- |
| `gearGuardLocked`      | String     | `"locked"` / `"unlocked"`                 |
| `gearGuardVideoStatus` | String     | `"Enabled"`, `"Disabled"`                 |
| `gearGuardVideoMode`   | String     | `"Away_From_Home"`, `"Parked"`            |
| `alarmSoundStatus`     | String     | `"false"` (not active), `"true"` (active) |

## Vehicle Health

| Property                           | Value type | Example                       |
| ---------------------------------- | ---------- | ----------------------------- |
| `batteryHvThermalEvent`            | String     | `"off"`                       |
| `batteryHvThermalEventPropagation` | String     | `"nominal"`                   |
| `twelveVoltBatteryHealth`          | String     | `"NORMAL_OPERATION"`          |
| `wiperFluidState`                  | String     | `"normal"`                    |
| `brakeFluidLow`                    | null       | `null` (not triggered)        |
| `limitedAccelCold`                 | Int        | `0` (% limited, `0` = normal) |
| `limitedRegenCold`                 | Int        | `0` (% limited, `0` = normal) |

## Towing

| Property          | Value type | Example                                      |
| ----------------- | ---------- | -------------------------------------------- |
| `trailerStatus`   | String     | `"TRAILER_NOT_PRESENT"`, `"TRAILER_PRESENT"` |
| `rearHitchStatus` | String     | `"NONE"`                                     |

## Hardware Failure Status

These fields exist but return `null` under normal conditions:

- `btmFfHardwareFailureStatus`
- `btmIcHardwareFailureStatus`
- `btmLfdHardwareFailureStatus`
- `btmRfHardwareFailureStatus`
- `btmRfdHardwareFailureStatus`

## Supported Features Query

`SupportedFeatures` can be queried via `vehicleState(id:).supportedFeatures { name status }`. Returns feature flags like:
`ACTV_USR`, `AUTONOMY_PLUS`, `CAR_WASH_MODE`, `CHARG_PORT_DOOR_COMMAND`, `SMART_CHARG`, `HEATED_SEATS_THIRD`, `LIFTGATE_CMD`, `PET_MODE_LOW_TEMP`, `SCHED_DPRT`, `SCHED_OTA`, `TESLA_NACS`, `TRAILER_STATUS`, `TRIP_PLANNER_TRAILERS`, `WINDOWS_CMD`, etc.

---

## Charging Session Fields (`getLiveSessionData`)

Timestamped fields use `{ __typename, value, updatedAt }`. Returns `null` when not actively charging.

| Field                      | Type    | Notes                    |
| -------------------------- | ------- | ------------------------ |
| `soc`                      | Float   | Battery %                |
| `power`                    | Float   | kW                       |
| `current`                  | Float   | Amps                     |
| `rangeAddedThisSession`    | Float   |                          |
| `totalChargedEnergy`       | Float   | kWh                      |
| `timeElapsed`              | String  | ISO duration             |
| `timeRemaining`            | Float   | minutes                  |
| `kilometersChargedPerHour` | Float   |                          |
| `currentPrice`             | Float   | cost so far              |
| `currentCurrency`          | String  | e.g. `"USD"`             |
| `isFreeSession`            | Boolean |                          |
| `isRivianCharger`          | Boolean | Rivian Adventure Network |
| `startTime`                | String  | ISO timestamp            |
| `chargerId`                | String  |                          |
| `locationId`               | String  |                          |
| `vehicleChargerState`      | String  | charger state detail     |

## Charging History Fields (`getCompletedSessionSummaries`)

| Field                         | Notes                 |
| ----------------------------- | --------------------- |
| `startInstant` / `endInstant` | ISO timestamps        |
| `totalEnergyKwh`              | Float                 |
| `rangeAddedKm`                | Float (always km)     |
| `paidTotal`                   | Float                 |
| `currencyCode`                | `"USD"` etc.          |
| `chargerType`                 | `"AC"`, `"DC"`        |
| `city`                        | String                |
| `vendor`                      | Charging network name |
| `isHomeCharger`               | Boolean               |
| `isRoamingNetwork`            | Boolean               |
| `isPublic`                    | Boolean               |
| `vehicleId`                   | String                |
| `vehicleName`                 | String                |
| `transactionId`               | String                |

## Charging Schedule Fields (`chargingSchedules`)

| Field       | Notes                                     |
| ----------- | ----------------------------------------- |
| `startTime` | Minutes from midnight — `1320` = 10:00 PM |
| `duration`  | Minutes — `360` = 6 hours                 |
| `amperage`  | Int                                       |
| `enabled`   | Boolean                                   |
| `weekDays`  | Array of day strings                      |
| `location`  | `{ latitude, longitude }`                 |

---

## Additional Queries (from external docs, not yet implemented)

**Gateway endpoint (`/gateway/graphql`):**

- `GetEstimatedRange(soc, driveMode, trailerProfile)` — estimate range
- `SupportedFeatures` — feature flags (confirmed working)
- `GetVehicleLastConnection` — last cloud sync timestamp
- `getVehicleImages` — vehicle configuration images
- WebSocket subscriptions at `wss://api.rivian.com/gql-consumer-subscriptions/graphql`
- `planTrip` / `planTripWithMultiStop` — trip planning with charging stops
- `places` — place search (Google Places integration)

**Charging endpoint (`/chrg/user/graphql`):**

- `getWallboxStatus` — Rivian Charger status (power, voltage, amps)
- `ChargerDetails(id)` — DC charging station details
- `CheckByRivianId` — linked third-party charging accounts
- `getLiveSessionHistory` — charging power history over time

**Orders endpoint (`/orders/graphql`):**

- `vehicleOrders` — pre-orders/orders
- `searchOrders` — retail/gear shop orders
- `delivery` — delivery status
- `financeSummary` — financing details

---

## What Does NOT Exist (confirmed rejected by API)

These were probed and returned `GRAPHQL_VALIDATION_FAILED` — do not use them:

**Vehicle state:** `vehicleSpeed`, `suspensionLevel`, `rideHeight`, `kineticRoll`, `pitchAngle`, `batteryAuxLevel`, `chargerVoltage`, `chargerCurrent`, `regenBrakingMode`, `odometer`, `tripMileage`, `towMode`, `campMode`, `differentialLockFront/Rear`, `seatVentFrontLeft/Right` (wrong name — use `seatFrontLeftVent`), `tirePressureFrontLeft` (wrong — use `tirePressureStatusFrontLeft`), `tirePressureValidFrontLeft/Right/RearLeft/Right`, `doorFrontLeft/Right/RearLeft/RightNextAction`

**Gateway queries:** `planTrip` (via our query format — may need different operation name), `getNearbyChargingSites`, `getVehicleImages` (rejected in our tests), `getVehicleWarranty`, `getUserNotifications`, `getVehicleOrderStatus`

**Charging queries:** `getChargingSiteDetails`, `getActiveChargingSession`, `getPricingInfo`, `getChargerSummary`, `getNearbyChargingStations`, `getRoamingChargingNetworks`
