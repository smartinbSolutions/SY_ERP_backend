const actionExecutionLogModel = require("../../../models/Hr/Deductions/actionExecutionLogModel");
const advanceLogsModel = require("../../../models/Hr/Advance/advanceLogsModel");
const fingerprintModel = require("../../../models/Hr/Attendance/fingerprintModel");
const leavesLogsModel = require("../../../models/Hr/Leaves/leavesLogsModel");
const overtimeLogsModel = require("../../../models/Hr/Overtime/overtimeLogsModel");
const payrollPeriodModel = require("../../../models/Hr/Payrolls/payrollPeriodModel");
const staffModel = require("../../../models/Hr/Staffs/staffModel");
const EmployeePayrollState = require("../../../models/Hr/Payrolls/EmployeePayrollStateSchema");
const mongoose = require("mongoose");

const buildPayrollContext = async (periodId) => {
  // 1. get period information
  const period = await payrollPeriodModel.findById(periodId);
  if (!period) throw new Error("Payroll period not found");

  // 2. get staff that active in the same (payrollGroupId)
  let employees = await staffModel
    .find({
      payrollGroupId: period.payrollGroupId,
      companyId: period.companyId,
      isActive: true,
    })
    .populate({
      path: "groupId",
    });

  if (period.status === "processing") {
    const completedStates = await EmployeePayrollState.find({
      payrollPeriodId: periodId,
      status: "calculated",
    }).select("employeeId");

    const completedEmployeeIds = new Set(
      completedStates.map((s) => s.employeeId.toString()),
    );

    employees = employees.filter(
      (emp) => !completedEmployeeIds.has(emp._id.toString()),
    );
  }
  const employeeIds = employees.map((e) => e._id);

  // 3. get all data from DB (Attendence + Logs Layer)
  const [attendanceMap, leaveMap, overtimeMap, advanceMap, deductionMap] =
    await Promise.all([
      getAttendanceData(employeeIds, period),
      getLeaveData(employeeIds, period),
      getOvertimeData(employeeIds, period),
      getAdvanceData(employeeIds, period),
      getDeductionData(employeeIds, period),
    ]);

  return {
    period,
    employees,

    // logs
    attendanceMap,
    leaveMap,
    overtimeMap,
    advanceMap,
    deductionMap,
  };
};

const getAttendanceData = async (employeeIds, period) => {
  const normalizedEmployeeIds = (employeeIds || [])
    .filter(Boolean)
    .map((id) =>
      typeof id === "string" ? new mongoose.Types.ObjectId(id) : id,
    );

  const start = new Date(period?.startDate).toISOString().split("T")[0];
  const end = new Date(period?.endDate).toISOString().split("T")[0];

  const query = {
    userID: { $in: normalizedEmployeeIds },
    date: { $gte: start, $lte: end },
  };

  const result = await fingerprintModel.aggregate([
    { $match: query },

    {
      $group: {
        _id: "$userID",
        records: {
          $push: {
            _id: "$_id",
            userID: "$userID",
            email: "$email",
            Time: "$Time",
            date: "$date",
            type: "$type",
            companyId: "$companyId",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        userId: { $toString: "$_id" },
        records: 1,
      },
    },

    {
      $group: {
        _id: null,
        attendanceMap: {
          $push: {
            k: "$userId",
            v: "$records",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        attendanceMap: { $arrayToObject: "$attendanceMap" },
      },
    },
  ]);

  return result?.[0]?.attendanceMap || {};
};

const getLeaveData = async (employeeIds, period) => {
  const result = await leavesLogsModel.aggregate([
    {
      $match: {
        userId: { $in: employeeIds },

        startDate: { $lte: period.endDate },
        endDate: { $gte: period.startDate },
        // approved: true,
      },
    },

    {
      $group: {
        _id: "$userId",
        records: {
          $push: {
            _id: "$_id",
            userId: "$userId",
            startDate: "$startDate",
            endDate: "$endDate",
            totalDays: "$calculation.totalDays",
            appliedPayPercentage: "$calculation.appliedPayPercentage",
            leaveType: "$leaveSnapshot.typeKey",
            payPercentage: "$leaveSnapshot.rule.payPercentage",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        userId: { $toString: "$_id" },
        records: 1,
      },
    },

    {
      $group: {
        _id: null,
        data: {
          $push: {
            k: "$userId",
            v: "$records",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        leaveMap: { $arrayToObject: "$data" },
      },
    },
  ]);

  return result?.[0]?.leaveMap || {};
};

const getOvertimeData = async (employeeIds, period) => {
  const result = await overtimeLogsModel.aggregate([
    {
      $match: {
        userId: { $in: employeeIds },

        approvedAt: {
          $gte: period.startDate,
          $lte: period.endDate,
        },
        // approved: true,
      },
    },

    {
      $group: {
        _id: "$userId",
        records: {
          $push: {
            _id: "$_id",

            overtimeType: "$overtimeType",

            approvedAt: "$approvedAt",

            calculation: "$calculation",

            ruleSnapshot: "$ruleSnapshot",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        userId: { $toString: "$_id" },
        records: 1,
      },
    },

    {
      $group: {
        _id: null,
        data: {
          $push: {
            k: "$userId",
            v: "$records",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        overtimeMap: { $arrayToObject: "$data" },
      },
    },
  ]);

  return result?.[0]?.overtimeMap || {};
};

const getAdvanceData = async (employeeIds, period) => {
  const result = await advanceLogsModel.aggregate([
    {
      $match: {
        userId: { $in: employeeIds },
        approvedAt: {
          $gte: period.startDate,
          $lte: period.endDate,
        },
      },
    },

    // 🔥 DEBUG: after match
    {
      $addFields: {
        __debug: "matched",
      },
    },

    {
      $group: {
        _id: "$userId",
        records: {
          $push: {
            _id: "$_id",

            userId: "$userId",
            advanceRequestId: "$advanceRequestId",
            advanceTypeId: "$advanceTypeId",

            approvedAmount: "$calculation.approvedAmount",
            installments: "$calculation.installments",
            installmentAmount: "$calculation.installmentAmount",

            firstDeductionDate: "$repayment.firstDeductionDate",

            approvedAt: "$approvedAt",
            shouldDeduct: "$shouldDeduct",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        userId: { $toString: "$_id" },
        records: 1,
      },
    },

    {
      $group: {
        _id: null,
        data: {
          $push: {
            k: "$userId",
            v: "$records",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        advanceMap: { $arrayToObject: "$data" },
      },
    },
  ]);

  const output = result?.[0]?.advanceMap || {};

  return output;
};

const getDeductionData = async (employeeIds, period) => {
  const result = await actionExecutionLogModel.aggregate([
    {
      $match: {
        userId: { $in: employeeIds },

        actionType: "deduction",

        executedAt: {
          $gte: period.startDate,
          $lte: period.endDate,
        },

        status: "done",
      },
    },

    {
      $group: {
        _id: "$userId",
        records: {
          $push: {
            _id: "$_id",

            violationType: "$violationType",
            occurrenceCount: "$occurrenceCount",

            actionType: "$actionType",

            deduction: "$deduction",

            sourceRuleId: "$sourceRuleId",

            periodStart: "$periodStart",
            periodEnd: "$periodEnd",

            executedAt: "$executedAt",

            status: "$status",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        userId: { $toString: "$_id" },
        records: 1,
      },
    },

    {
      $group: {
        _id: null,
        data: {
          $push: {
            k: "$userId",
            v: "$records",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        deductionMap: {
          $arrayToObject: "$data",
        },
      },
    },
  ]);

  return result?.[0]?.deductionMap || {};
};

module.exports = buildPayrollContext;
