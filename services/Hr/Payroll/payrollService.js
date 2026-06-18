function  calculateHourlyRate(staff, group) {
  console.log("=== calculateHourlyRate START ===");

  const amount = Number(staff?.salary?.amount);
  console.log("salary.amount:", staff?.salary?.amount);
  console.log("parsed amount:", amount);

  if (!Number.isFinite(amount)) {
    console.log("INVALID amount → return 0");
    return 0;
  }

  console.log("payType:", staff?.salary?.payType);

  if (staff?.salary?.payType === "hourly") {
    console.log("HOURLY staff → return amount:", amount);
    return amount;
  }

  const period = getSalaryPeriod(staff?.salary?.payType);
  console.log("salary period:", period);

  const totalWorkingHours = getWorkingHours(
    group,
    period.startDate,
    period.endDate,
  );

  console.log("totalWorkingHours:", totalWorkingHours);

  if (!Number.isFinite(totalWorkingHours) || totalWorkingHours === 0) {
    console.log("INVALID working hours → return 0");
    return 0;
  }

  const result = Number((amount / totalWorkingHours).toFixed(2));

  console.log("FINAL hourlyRate:", result);
  console.log("=== calculateHourlyRate END ===");

  return result;
}

/**
 * Determine salary period based on pay type
 */
function getSalaryPeriod(payType) {
  console.log("=== getSalaryPeriod ===", payType);

  const now = new Date();
  console.log("now:", now);

  switch (payType) {
    case "weekly": {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      console.log("weekly range:", { startDate, endDate });

      return { startDate, endDate };
    }

    case "monthly": {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      console.log("monthly range:", { startDate, endDate });

      return { startDate, endDate };
    }

    case "annual": {
      const startDate = new Date(now.getFullYear(), 0, 1);
      const endDate = new Date(now.getFullYear(), 11, 31);

      console.log("annual range:", { startDate, endDate });

      return { startDate, endDate };
    }

    default:
      console.log("DEFAULT range used");
      return { startDate: now, endDate: now };
  }
}

/**
 * Calculate total working hours in period
 */
function getWorkingHours(group = {}, startDate, endDate) {
  console.log("=== getWorkingHours START ===");
  console.log("startDate:", startDate);
  console.log("endDate:", endDate);
  console.log("group.attendanceType:", group.attendanceType);
  console.log("group.offDays:", group.offDays);

  const hoursPerDay = getHoursPerDay(group);
  console.log("hoursPerDay:", hoursPerDay);

  if (!Number.isFinite(hoursPerDay)) {
    console.log("INVALID hoursPerDay → return 0");
    return 0;
  }

  let totalHours = 0;

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayName = currentDate.toLocaleDateString("en-US", {
      weekday: "long",
    });

    const offDays = group.offDays || [];

    console.log("checking date:", currentDate, "day:", dayName);

    if (!offDays.includes(dayName)) {
      totalHours += hoursPerDay;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log("totalHours:", totalHours);
  console.log("=== getWorkingHours END ===");

  return totalHours;
}

/**
 * Get hours per day based on attendance type
 */
function getHoursPerDay(group = {}) {
  console.log("=== getHoursPerDay ===");
  console.log("attendanceType:", group.attendanceType);

  switch (group.attendanceType) {
    case "fixed": {
      const result = getHoursDifference(
        group?.fixedAttendance?.startTime,
        group?.fixedAttendance?.endTime,
      );

      console.log("fixed hours:", result);
      return result || 0;
    }

    case "flexible": {
      const result = group?.flexibleAttendance?.requiredHoursPerDay || 0;
      console.log("flexible hours:", result);
      return result;
    }

    case "remote": {
      const result = group?.remoteAttendance?.requiredHoursPerDay || 0;
      console.log("remote hours:", result);
      return result;
    }

    default:
      console.log("UNKNOWN attendance type");
      return 0;
  }
}

/**
 * Convert HH:mm to hours difference
 */
function getHoursDifference(start, end) {
  console.log("getHoursDifference:", { start, end });

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const result = (eh * 60 + em - (sh * 60 + sm)) / 60;

  console.log("hours difference result:", result);

  return result;
}

module.exports = {
  calculateHourlyRate,
};
