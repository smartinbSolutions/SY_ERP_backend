const PayrollPeriod = require("../../../models/Hr/Payrolls/payrollPeriodModel");
const Staff = require("../../../models/Hr/Staffs/staffModel");
const PayrollGroup = require("../../../models/Hr/Payrolls/payrollGroupModel");
const EmployeePayroll = require("../../../models/Hr/Payrolls/employeePayrollModel");
const groupsModel = require("../../../models/Hr/Attendance/groupsModel");
const staffModel = require("../../../models/Hr/Staffs/staffModel");
const PayrollEmployeeLine = require("../../../models/Hr/Payrolls/employeePayrollLine");
const buildPayrollContext = require("./buildPayrollContext");
const { processEmployeePayroll } = require("./processEmployeePayroll");
const { getIo } = require("../../../utils/socket");
const EmployeePayrollState = require("../../../models/Hr/Payrolls/EmployeePayrollStateSchema");

// ================= CREATE =================
exports.createPayrollPeriod = async (data) => {
  const overlap = await PayrollPeriod.findOne({
    payrollGroupId: data.payrollGroupId,

    startDate: {
      $lte: data.endDate,
    },

    endDate: {
      $gte: data.startDate,
    },
  });

  if (overlap) {
    throw new Error("Payroll period overlaps with existing period");
  }

  return PayrollPeriod.create(data);
};

// Suggest Period (starttime -> endtime) for Validation
exports.getSuggestedPayrollPeriod = async (payrollGroupId) => {
  const group = await PayrollGroup.findById(payrollGroupId);

  if (!group) {
    throw new Error("Payroll group not found");
  }

  const lastPeriod = await PayrollPeriod.findOne({
    payrollGroupId,
  }).sort({
    endDate: -1,
  });

  let startDate;
  let endDate;

  if (!lastPeriod) {
    startDate = new Date();

    switch (group.payrollType) {
      case "weekly":
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        break;

      case "byweekly":
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 13);
        break;

      case "monthly":
      default:
        endDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + 1,
          0,
        );
    }
  } else {
    startDate = new Date(lastPeriod.endDate);
    startDate.setDate(startDate.getDate() + 1);

    switch (group.payrollType) {
      case "weekly":
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        break;

      case "byweekly":
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 13);
        break;

      case "monthly":
      default:
        endDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + 1,
          0,
        );
    }
  }

  return {
    payrollType: group.payrollType,
    startDate,
    endDate,
    previousPeriod: lastPeriod,
  };
};

// ================= GET ALL =================
exports.getPayrollPeriods = async ({
  companyId,
  payrollGroupId,
  page = 1,
  limit = 10,
}) => {
  const filter = { companyId };

  if (payrollGroupId) {
    filter.payrollGroupId = payrollGroupId;
  }

  const skip = (page - 1) * limit;

  const total = await PayrollPeriod.countDocuments(filter);

  const periods = await PayrollPeriod.find(filter)
    .populate("payrollGroupId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    periods,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// ================= GET ONE =================
exports.getPayrollPeriodById = async (id) => {
  return await PayrollPeriod.findById(id);
};

// ================= UPDATE =================
exports.updatePayrollPeriod = async (id, data) => {
  return await PayrollPeriod.findByIdAndUpdate(id, data, { new: true });
};

// ================= DELETE =================
exports.deletePayrollPeriod = async (id) => {
  return await PayrollPeriod.deleteOne({ _id: id });
};

// ================= GENERATE PAYROLL  =================
exports.getStaffByPayrollPeriod = async (periodId) => {
  const period = await PayrollPeriod.findById(periodId);
  console.log("period", period);

  if (!period) {
    throw new Error("Payroll period not found");
  }

  const staff = await staffModel
    .find({
      payrollGroupId: period.payrollGroupId,
      companyId: period.companyId,
      isActive: true,
    })
    .populate("currency", "currencyName currencyCode")
    .populate("department", "name")
    .populate("position", "name");

  return {
    period,
    staff,
  };
};

exports.generateSalaryPayroll = async (periodId) => {
  const io = getIo();

  const period = await PayrollPeriod.findById(periodId);
  if (!period) throw new Error("Payroll period not found");

  const wasProcessing = period.status === "processing";
  const wasDraft = period.status === "draft";

  const context = await buildPayrollContext(periodId);

  const total = context.employees.length;
  let processed = 0;
  let successCount = 0;
  let failedCount = 0;

  let createdStates = [];

  if (wasDraft) {
    const statesPayload = context.employees.map((emp) => ({
      employeeId: emp._id,
      payrollPeriodId: periodId,
      status: "pending",
      step: "none",
      startedAt: null,
    }));

    createdStates = await EmployeePayrollState.insertMany(statesPayload);
  } else {
    createdStates = await EmployeePayrollState.find({
      payrollPeriodId: periodId,
    });
  }

  if (wasDraft) {
    period.status = "processing";
    await period.save();
  }

  const stateMap = new Map(
    createdStates.map((s) => [s.employeeId.toString(), s]),
  );

  const results = [];
  const failed = [];

  for (const emp of context.employees) {
    const employeeId = emp._id.toString();
    const state = stateMap.get(employeeId);

    try {
      const res = await processEmployeePayroll(emp, context, state._id);

      if (res.status === "failed") {
        failed.push(res);
        failedCount++;

        await EmployeePayrollState.updateOne(
          { _id: state._id },
          {
            status: "failed",
            step: "error",
          },
        );
      } else {
        results.push(res);
        successCount++;

        await EmployeePayrollState.updateOne(
          { _id: state._id },
          {
            status: "calculated",
            step: "done",
            finishedAt: new Date(),
          },
        );
      }
    } catch (err) {
      failed.push({ empId: emp._id, error: err.message });
      failedCount++;

      await EmployeePayrollState.updateOne(
        { _id: state._id },
        {
          status: "failed",
          step: "error",
          errorMessage: err.message,
        },
      );
    }

    processed++;

    io.to(`payroll:${periodId}`).emit("payroll:progress", {
      processed,
      success: successCount,
      failed: failedCount,
      percent: Math.round((processed / total) * 100),
    });
  }

  period.status = "review";
  await period.save();

  io.to(`payroll:${periodId}`).emit("payroll:finished", {
    success: successCount,
    failed: failedCount,
  });

  return {
    context,
    success: successCount,
    failed: failedCount,
  };
};

exports.getPayrollReview = async (periodId) => {
  // ==================================
  // PERIOD
  // ==================================
  const period = await PayrollPeriod.findById(periodId).populate(
    "payrollGroupId",
    "name",
  );

  if (!period) {
    throw new Error("Payroll period not found");
  }

  // ==================================
  // PAYROLLS
  // ==================================
  const payrolls = await EmployeePayroll.find({
    payrollPeriodId: periodId,
  })
    .populate({
      path: "employeeId",
      select: "fullName department position salary",
      populate: [
        { path: "department", select: "name" },
        { path: "position", select: "name" },
      ],
    })
    .lean();

  const payrollIds = payrolls.map((p) => p._id);

  // ==================================
  // LINES
  // ==================================
  const lines = await PayrollEmployeeLine.find({
    payrollEmployeeId: { $in: payrollIds },
  }).lean();

  // ==================================
  // GROUP LINES (FIXED)
  // ==================================
  const grouped = lines.reduce((acc, line) => {
    const payrollId = line.payrollEmployeeId.toString();

    if (!acc[payrollId]) {
      acc[payrollId] = {
        earning: [],
        deduction: [],
        info: [],
      };
    }

    const category =
      line.category === "earning" ||
      line.category === "deduction" ||
      line.category === "info"
        ? line.category
        : "info";

    acc[payrollId][category].push(line);

    return acc;
  }, {});

  // ==================================
  // EMPLOYEES DTO
  // ==================================
  const employees = payrolls.map((payroll) => {
    const group = grouped[payroll._id.toString()] || {
      earning: [],
      deduction: [],
      info: [],
    };

    const earningsTotal = group.earning.reduce(
      (s, l) => s + (l.amount || 0),
      0,
    );

    const deductionsTotal = group.deduction.reduce(
      (s, l) => s + (l.amount || 0),
      0,
    );

    return {
      payrollId: payroll._id,
      employeeId: payroll.employeeId?._id,

      employeeName: payroll.employeeId?.fullName || "-",
      department: payroll.employeeId?.department?.name || "-",
      position: payroll.employeeId?.position?.name || "-",

      salaryBase: payroll.salaryBase || 0,
      netSalary: payroll.netSalary || 0,
      status: payroll.status,

      earningsTotal,
      deductionsTotal,

      earnings: group.earning,
      deductions: group.deduction,
      info: group.info,

      // =========================
      // UI-READY ENRICHMENT (IMPORTANT)
      // =========================

      lineCounts: {
        earnings: group.earning.length,
        deductions: group.deduction.length,
        info: group.info.length,
      },

      flags: {
        hasIssues: group.info.length > 0,

        hasDeductions: deductionsTotal > 0,

        highDeductionRatio:
          payroll.netSalary > 0 &&
          deductionsTotal / (payroll.netSalary + deductionsTotal) > 0.3,

        zeroNet: (payroll.netSalary || 0) === 0,
      },

      display: {
        netSalaryFormatted: payroll.netSalary || 0,
        totalImpact: earningsTotal - deductionsTotal,
      },
    };
  });

  // ==================================
  // SUMMARY (SAFE)
  // ==================================
  const summary = {
    employeesCount: employees.length,

    totalNetSalary: employees.reduce(
      (sum, emp) => sum + (emp.netSalary || 0),
      0,
    ),

    totalEarnings: employees.reduce(
      (sum, emp) => sum + (emp.earningsTotal || 0),
      0,
    ),

    totalDeductions: employees.reduce(
      (sum, emp) => sum + (emp.deductionsTotal || 0),
      0,
    ),

    failedEmployees: employees.filter((e) => e.status !== "calculated").length,
  };

  // ==================================
  // RESPONSE
  // ==================================
  return {
    period,
    summary,
    employees,
  };
};

exports.approvePayrollPeriod = async (id) => {
  const period = await PayrollPeriod.findById(id);

  if (!period) {
    throw new Error("Payroll period not found");
  }

  // approval
  if (period.status === "approved" || period.status === "paid") {
    throw new Error("Payroll already finalized");
  }

  // optional safety check
  if (period.status !== "review") {
    throw new Error("Payroll must be in review state");
  }

  period.status = "approved";
  await period.save();

  return period;
};
