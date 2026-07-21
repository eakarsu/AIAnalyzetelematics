'use strict';

module.exports = {
  table: 'governed_fleet_work_orders',
  initialStatus: 'ingested',
  statuses: ['ingested', 'anomaly_validated', 'review_ready', 'approved', 'dispatched', 'closed'],
  editableStatuses: ['ingested', 'anomaly_validated', 'review_ready'],
  transitions: {
    ingested: ['anomaly_validated'], anomaly_validated: ['ingested', 'review_ready'],
    review_ready: ['anomaly_validated', 'approved'], approved: ['review_ready', 'dispatched'],
    dispatched: ['closed'], closed: [],
  },
  approvalStatuses: ['approved', 'dispatched'],
  approverRoles: ['fleet_manager', 'maintenance_manager', 'admin'],
  evidenceRoles: ['integration', 'fleet_manager', 'maintenance_manager', 'admin'],
  syncRoles: ['integration', 'admin'],
  rolesByStatus: { approved: ['fleet_manager', 'maintenance_manager', 'admin'], dispatched: ['fleet_manager', 'dispatcher', 'admin'] },
  separationOfDuties: { dispatched: { priorStatus: 'approved', disallowSameActor: true } },
  providerRequirementsByStatus: { dispatched: { allOf: ['dispatch'] } },
  requiredFields: ['vehicleReference', 'deviceReference', 'anomalyCode', 'thresholdVersion', 'workOrderAction'],
  requiredEvidence: ['telemetry', 'vehicle_identity', 'maintenance_history', 'route_constraints'],
  deterministicChecks: [
    { code: 'DEVICE_AUTHENTICATED', test: (p) => p.deviceAuthenticated === true },
    { code: 'ANOMALY_REPRODUCED', test: (p) => p.anomalyReproduced === true },
    { code: 'DRIVER_LOCATION_MINIMIZED', test: (p) => p.driverLocationMinimized === true },
  ],
  providers: ['oem_telematics', 'maintenance_system', 'charging_fuel', 'maps', 'dispatch'],
  providerEnv: {
    oem_telematics: 'OEM_TELEMATICS_API_URL', maintenance_system: 'MAINTENANCE_API_URL',
    charging_fuel: 'CHARGING_FUEL_API_URL', maps: 'MAPS_API_URL', dispatch: 'DISPATCH_API_URL',
  },
};
