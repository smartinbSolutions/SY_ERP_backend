const advanceLogsModel = require("../../../models/Hr/advanceLogsModel");
const fingerprintModel = require("../../../models/Hr/fingerprintModel");
const leavesLogsModel = require("../../../models/Hr/leavesLogsModel");
const overtimeLogsModel = require("../../../models/Hr/overtimeLogsModel");
const payrollPeriodModel = require("../../../models/Hr/payrollPeriodModel");
const staffModel = require("../../../models/Hr/staffModel");

const buildPayrollContext = async (periodId) => {
  // 1. get period information
  const period = await payrollPeriodModel.findById(periodId);
  if (!period) throw new Error("Payroll period not found");

  // 2. get staff that active in the same (payrollGroupId)
  const employees = await staffModel.find({
    payrollGroupId: period.payrollGroupId,
    companyId: period.companyId,
    isActive: true,
  });

  const employeeIds = employees.map((e) => e._id);

  // 3. get all data from DB (Attendence + Logs Layer)
  const [attendanceMap, leaveMap, overtimeMap, advanceMap, deductionMap] =
    await Promise.all([
      getAttendanceData(employeeIds, period),
      getLeaveData(employeeIds, period),
      getOvertimeData(employeeIds, period),
      getAdvanceData(employeeIds, period),
      // getDeductionData(employeeIds, period),
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

const mongoose = require("mongoose");


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

        // لو بدك فقط الموافق عليها
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
            leaveType: "$leaveType",
            startDate: "$startDate",
            endDate: "$endDate",
            days: "$days",
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

        // approved: true, // إذا عندك فلترة اعتماد
      },
    },

    {
      $group: {
        _id: "$userId",
        records: {
          $push: {
            _id: "$_id",
            userId: "$userId",
            overtimeType: "$overtimeType",
            hours: "$hours",
            rateMultiplier: "$rateMultiplier",
            approvedAt: "$approvedAt",
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

//more study on this...
const getAdvanceData = async (employeeIds, period) => {
  const result = await advanceLogsModel.aggregate([
    {
      $match: {
        userId: { $in: employeeIds },

        // السلف قبل نهاية الفترة
        approvedAt: { $lte: period.endDate },

        // approved: true (إذا موجودة عندك)
      },
    },

    {
      $group: {
        _id: "$userId",
        records: {
          $push: {
            _id: "$_id",
            userId: "$userId",
            advanceTypeId: "$advanceTypeId",
            approvedAmount: "$approvedAmount",
            installments: "$installments",
            installmentAmount: "$installmentAmount",
            approvedAt: "$approvedAt",
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

  return result?.[0]?.advanceMap || {};
};

// const getDeductionData = async (employeeIds, period) => {

//   return await deductionLog.find({
//     userId: { $in: employeeIds },
//     approvedAt: {
//       $lte: period.endDate,
//     },
//   });
// };

//map employees for index data  style
const mapByEmployee = (records, key) => {
  const map = new Map();

  let skipped = 0;
  let processed = 0;

  for (const record of records) {
    const startLoop = process.hrtime.bigint(); // high precision (ns)

    const id = record[key]?.toString();
    if (!id) {
      skipped++;
      continue;
    }

    if (!map.has(id)) {
      map.set(id, []);
    }

    map.get(id).push(record);

    processed++;

    const endLoop = process.hrtime.bigint();
    const diffMs = Number(endLoop - startLoop) / 1e6;
  }

  return map;
};

module.exports = buildPayrollContext;
