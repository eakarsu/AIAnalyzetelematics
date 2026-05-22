const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    summary: { drivers_monitored: 46, violation_risk: 6, mandatory_breaks_due: 9, dispatch_blocks: 3 },
    drivers: [
      { driver: 'Maya Chen', duty_hours: 10.5, remaining_drive: 0.5, risk: 'high', action: 'route relief vehicle' },
      { driver: 'Owen Brooks', duty_hours: 8.25, remaining_drive: 2.75, risk: 'medium', action: 'schedule 30-minute break' },
      { driver: 'Nadia Patel', duty_hours: 5.75, remaining_drive: 5.25, risk: 'low', action: 'normal dispatch' },
    ],
  });
});

router.post('/simulate', (req, res) => {
  const { dutyHours = 8, plannedDriveHours = 2 } = req.body || {};
  const projectedDuty = dutyHours + plannedDriveHours;
  res.json({ projectedDuty, violation: projectedDuty > 11, recommendation: projectedDuty > 11 ? 'Reassign load or insert compliant rest break.' : 'Trip is within ELD hours window.' });
});

module.exports = router;
