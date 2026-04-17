const calculateLeaves = async ({
  employee,
  leaves,
  policy,
  period,
  payroll,
}) => {
  let result;
  let linePayload;

  try {
    // ================================
    // 1. Calculation
    // ================================
    result = {
      amount: leaves.length * 1, // example logic
    };

    // ================================
    // 2. Prepare LINE
    // ================================
    linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "deduction",
      type: "absence_deduction",
      label: "leaves",

      amount: result.amount,

      sourceType: "leave_request",
      isSystemGenerated: true,

      status: "success",
    };

    // ================================
    // 3. Persist LINE (success)
    // ================================
    await PayrollEmployeeLine.create(linePayload);

    return {
      result,
      linePayload,
    };
  } catch (err) {
    // ================================
    // 4. Failure LINE payload
    // ================================
    linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "info",
      type: "manual_adjustment",
      label: "leaves_failed",

      amount: 0,

      status: "failed",
      errorMessage: err.message,

      isSystemGenerated: true,
    };

    // ================================
    // 5. Persist LINE (failure)
    // ================================
    await PayrollEmployeeLine.create(linePayload);

    return {
      result: null,
      linePayload,
      error: err,
    };
  }
};