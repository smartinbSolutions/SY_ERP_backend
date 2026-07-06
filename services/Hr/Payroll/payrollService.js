function normalizeToMonthly(amount, payType, standardMonthlyHours) {
  const salary = Number(amount);

  if (!Number.isFinite(salary)) return 0;

  switch (payType) {
    case "weekly":
      return salary * 4.33;

    case "daily":
      return salary * 30;

    case "hourly":
      return salary * standardMonthlyHours;

    case "monthly":
    default:
      return salary;
  }
}

/**
 * Calculate hourly rate from staff + group
 */
function calculateHourlyRate(staff, group) {
  const amount = staff?.salary?.amount;
  const payType = staff?.salary?.payType;

  const standardHours = group?.standardMonthlyHours;

  if (
    !Number.isFinite(Number(amount)) ||
    !Number.isFinite(Number(standardHours)) ||
    standardHours === 0
  ) {   
    return 0;
  }

  const monthly = normalizeToMonthly(amount, payType, standardHours);

  const hourlyRate = monthly / standardHours;

  return Number(hourlyRate.toFixed(2));
}

module.exports = {
  normalizeToMonthly,
  calculateHourlyRate,
};
