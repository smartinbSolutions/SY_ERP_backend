const asyncHandler = require("express-async-handler");
const fingerPrintModel = require("../../models/Hr/fingerprintModel");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const fingerprintModel = require("../../models/Hr/fingerprintModel");
const dayjs = require("dayjs");
const Staff = require("../../models/Hr/staffModel");

//@desc Get list of finger-print
//@route GET /api/finger-print
//@access public just for Admin
exports.getFingerPrint = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const pageSize = 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let mongooseQuery = fingerPrintModel.find({ companyId });
  mongooseQuery = mongooseQuery.populate("userID", "name email");

  if (req.query.keyword) {
    const query = {
      $and: [
        {
          $or: [
            {
              name: {
                $regex: req.query.keyword,
                $options: "i",
              },
            },
          ],
        },
      ],
    };
    mongooseQuery = mongooseQuery.find(query);
  }
  mongooseQuery = mongooseQuery.sort({ createdAt: -1 });
  const totalItems = await fingerPrintModel.countDocuments({ companyId });

  const totalPages = Math.ceil(totalItems / pageSize);

  mongooseQuery = mongooseQuery.skip(skip).limit(pageSize);
  const fingerPrint = await mongooseQuery;

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: fingerPrint.length,
    data: fingerPrint,
  });
});

exports.getLoggedUserFingerPrint = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = 20;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const skip = (page - 1) * pageSize;

  // Base filter
  const filter = {
    userID: req.user.id,
    companyId,
  };

  // Count total documents
  const totalItems = await fingerPrintModel.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / pageSize);

  // If page exceeds totalPages, return empty safely
  if (page > totalPages && totalPages !== 0) {
    return res.status(200).json({
      status: true,
      Pages: totalPages,
      results: totalItems,
      data: [],
    });
  }

  // Fetch paginated & sorted results (NEWEST FIRST)
  const fingerPrint = await fingerPrintModel
    .find(filter)
    .sort({ createdAt: -1 }) 
    .skip(skip)
    .limit(pageSize);



  res.status(200).json({
    status: true,
    Pages: totalPages,
    results: totalItems,
    currentPage: page,
    pageSize,
    data: fingerPrint,
  });
});

exports.getTodayFingerPrint = asyncHandler(async (req, res, next) => {
  console.log("triggerd");
  const companyId = req.query.companyId;
  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }
  console.log("companyId", companyId);
  let ts = Date.now();
  let date_ob = new Date(ts);
  let date = padZero(date_ob.getDate());
  let month = padZero(date_ob.getMonth() + 1);
  let year = date_ob.getFullYear();

  const Dates = year + "-" + month + "-" + date;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const fingerPrint = await fingerPrintModel.find({ date: Dates, companyId });

  res.status(201).json({
    status: "success",
    data: fingerPrint,
  });
});
//@desc Get one finger-print
//@route GET /api/finger-print/:id
//@access public just for Admin
exports.getOneFingerPrint = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const fingerPrint = await fingerPrintModel.findOne({
    _id: req.params.id,
    companyId,
  });

  if (!fingerPrint) {
    return next(
      new ApiError(`No fingerPrint found for id ${req.params.id}`, 404),
    );
  }

  res.status(200).json({
    status: "true",
    results: 1,
    data: fingerPrint,
  });
});

//@desc Post Make the finger print for enter and exit
//@route POST /api/finger-print
//@access public just for Employee
exports.createLoggedFingerPrint = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const staffMember = await Staff.findOne({ email: req.user.email, companyId });

  if (!staffMember) {
    return res.status(400).json({
      status: false,
      message: "User is not a staff member",
    });
  }
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  let ts = Date.now();
  let date_ob = new Date(ts);
  let date = padZero(date_ob.getDate());
  let month = padZero(date_ob.getMonth() + 1);
  let year = date_ob.getFullYear();
  let hours = padZero(date_ob.getHours());
  let minutes = padZero(date_ob.getMinutes());
  let seconds = padZero(date_ob.getSeconds());

  const Dates = year + "-" + month + "-" + date;
  const Time = hours + ":" + minutes + ":" + seconds;
  req.body.date = Dates;
  req.body.Time = Time;
  req.body.userID = staffMember._id;
  req.body.name = staffMember.name;
  req.body.email = staffMember.email;
  req.body.companyId = companyId;

  const fingerPrint = await fingerprintModel.create(req.body);
  res.status(200).json({
    status: "success",
    data: fingerPrint,
  });
});

exports.createFingerPrint = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  let ts = Date.now();
  let date_ob = new Date(ts);
  let date = padZero(date_ob.getDate());
  let month = padZero(date_ob.getMonth() + 1);
  let year = date_ob.getFullYear();
  let hours = padZero(date_ob.getHours());
  let minutes = padZero(date_ob.getMinutes());
  let seconds = padZero(date_ob.getSeconds());

  const Dates = year + "-" + month + "-" + date;
  const Time = hours + ":" + minutes + ":" + seconds;
  req.body.date = Dates;
  req.body.Time = Time;

  req.body.companyId = companyId;

  const fingerPrint = await fingerprintModel.create(req.body);
  res.status(200).json({
    status: "success",
    data: fingerPrint,
  });
});

//@desc Delete the finger print
//@route DELETE /api/finger-print/:id
//@access public just for Admin
exports.deleteFingerprint = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const fingerPrint = await fingerPrintModel.findOneAndDelete({
    _id: req.params.id,
    companyId,
  });

  if (!fingerPrint) {
    return next(
      new ApiError(`No fingerPrint by this id ${req.params.id}`, 404),
    );
  }
  res.status(200).json({ status: "true", message: "Deleted" });
});

//@desc Update the finger print
//@route PUT /api/finger-print/:id
//@access public just for Admin
exports.updateFingerPrint = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  const fingerPrint = await fingerPrintModel.findOneAndUpdate(
    { _id: req.params.id, companyId },
    req.body,
    { new: true },
  );

  if (!fingerPrint) {
    return next(
      new ApiError(`No fingerPrint by this id ${req.params.id}`, 404),
    );
  }

  res.status(200).json({
    status: "success",
    data: fingerPrint,
  });
});

// @desc    Calculate total worked hours and salary for a user in a given month
// @route   GET /api/finger-print/salary?companyId=xxx&userId=xxx&month=2025-09
// @access  Admin or Employee
// @desc    Calculate total worked hours and salary for a user in a month or custom date range
// @route   GET /api/finger-print/salary?companyId=xxx&userId=xxx&month=yyyy-mm&startDate=yyyy-mm-dd&endDate=yyyy-mm-dd
// @access  Admin or Employee

//@desc    Calculate total worked hours and salary for a user in a month or custom date range
//@route   GET /api/finger-print/salary?companyId=xxx&userId=xxx&month=2025-09&startDate=yyyy-mm-dd&endDate=yyyy-mm-dd
//@access  Admin or Employee

exports.calculateSalaryFlexible = asyncHandler(async (req, res, next) => {
  const { companyId, userId, month, startDate, endDate } = req.query;

  // Validate required parameters
  if (!companyId || !userId) {
    return res.status(400).json({
      message: "companyId and userId are required",
    });
  }

  // Validate MongoDB ID format
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid userId format" });
  }

  try {
    // Get staff member details
    const staffMember = await Staff.findOne({ _id: userId, companyId });
    if (!staffMember) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const salaryPerMonth = staffMember.salary || 0;
    if (salaryPerMonth <= 0) {
      return res.status(400).json({
        message: "Base salary is not set or invalid for this staff member",
      });
    }

    const salaryPerHour = salaryPerMonth / 160; // Assuming 160 working hours per month

    // Calculate date range
    let start, end;
    if (startDate && endDate) {
      start = dayjs(startDate).startOf("day");
      end = dayjs(endDate).endOf("day");

      if (start.isAfter(end)) {
        return res.status(400).json({
          message: "startDate cannot be after endDate",
        });
      }
    } else if (month) {
      start = dayjs(month + "-01").startOf("month");
      end = dayjs(month + "-01").endOf("month");
    } else {
      return res.status(400).json({
        message: "Either month or startDate & endDate must be provided",
      });
    }

    // Get all records for the period, sorted by date and time
    const records = await fingerPrintModel
      .find({
        userID: userId,
        companyId,
        date: {
          $gte: start.format("YYYY-MM-DD"),
          $lte: end.format("YYYY-MM-DD"),
        },
        type: { $in: ["Check-in", "Check-out"] },
      })
      .select("date Time type")
      .sort({ date: 1, Time: 1 })
      .lean();

    if (!records || records.length === 0) {
      return res.status(404).json({
        message:
          "No attendance records found for this user in the given period",
        period: {
          start: start.format("YYYY-MM-DD"),
          end: end.format("YYYY-MM-DD"),
        },
      });
    }

    // Group records by date and type
    const dailyRecords = {};

    records.forEach((record) => {
      const dateKey = record.date;
      if (!dailyRecords[dateKey]) {
        dailyRecords[dateKey] = {
          checkIns: [],
          checkOuts: [],
          hours: 0,
          pairs: [],
        };
      }

      if (record.type === "Check-in") {
        dailyRecords[dateKey].checkIns.push(record.Time);
      } else if (record.type === "Check-out") {
        dailyRecords[dateKey].checkOuts.push(record.Time);
      }
    });

    let totalHours = 0;
    const dailySummary = {};

    // Calculate hours for each day
    Object.keys(dailyRecords).forEach((dateKey) => {
      const day = dailyRecords[dateKey];
      let dayHours = 0;

      // Pair check-ins with check-outs
      const minPairs = Math.min(day.checkIns.length, day.checkOuts.length);

      for (let i = 0; i < minPairs; i++) {
        const checkInTime = dayjs(`${dateKey} ${day.checkIns[i]}`);
        const checkOutTime = dayjs(`${dateKey} ${day.checkOuts[i]}`);

        // Validate time logic
        if (checkOutTime.isBefore(checkInTime)) {
          // Handle overnight shifts (check-out next day)
          const adjustedCheckOutTime = checkOutTime.add(1, "day");
          const hoursDiff = adjustedCheckOutTime.diff(
            checkInTime,
            "hour",
            true,
          );
          dayHours += Math.max(0, hoursDiff);

          day.pairs.push({
            checkIn: day.checkIns[i],
            checkOut: day.checkOuts[i],
            hours: hoursDiff,
            overnight: true,
          });
        } else {
          const hoursDiff = checkOutTime.diff(checkInTime, "hour", true);
          dayHours += Math.max(0, hoursDiff);

          day.pairs.push({
            checkIn: day.checkIns[i],
            checkOut: day.checkOuts[i],
            hours: hoursDiff,
            overnight: false,
          });
        }
      }

      // Handle unpaired records
      const unpairedCheckIns = day.checkIns.length - minPairs;
      const unpairedCheckOuts = day.checkOuts.length - minPairs;

      dailySummary[dateKey] = {
        checkIns: day.checkIns,
        checkOuts: day.checkOuts,
        totalHours: dayHours,
        pairs: day.pairs,
        unpairedCheckIns,
        unpairedCheckOuts,
        warnings: [],
      };

      if (unpairedCheckIns > 0) {
        dailySummary[dateKey].warnings.push(
          `Has ${unpairedCheckIns} unpaired check-in(s)`,
        );
      }
      if (unpairedCheckOuts > 0) {
        dailySummary[dateKey].warnings.push(
          `Has ${unpairedCheckOuts} unpaired check-out(s)`,
        );
      }

      totalHours += dayHours;
    });

    const calculatedSalary = totalHours * salaryPerHour;

    res.status(200).json({
      status: true,
      userId,
      staffName: staffMember.name,
      baseSalary: salaryPerMonth,
      salaryPerHour: salaryPerHour.toFixed(4),
      totalHours: totalHours.toFixed(2),
      calculatedSalary: calculatedSalary.toFixed(2),
      totalDays: Object.keys(dailySummary).length,
      dailySummary,
      period: {
        start: start.format("YYYY-MM-DD"),
        end: end.format("YYYY-MM-DD"),
        daysInPeriod: end.diff(start, "day") + 1,
      },
      summary: {
        totalCheckIns: records.filter((r) => r.type === "Check-in").length,
        totalCheckOuts: records.filter((r) => r.type === "Check-out").length,
        averageHoursPerDay: (
          totalHours / Object.keys(dailySummary).length
        ).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Salary calculation error:", error);
    return res.status(500).json({
      message: "Error calculating salary",
      error: error.message,
    });
  }
});
