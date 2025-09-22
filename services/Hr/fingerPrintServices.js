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
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const fingerPrint = await fingerPrintModel.find({
    userID: req.user.id,
    companyId,
  });

  if (!fingerPrint || fingerPrint.length === 0) {
    return next(
      new ApiError(`No fingerPrint found for id ${req.user.id}`, 404)
    );
  }

  res.status(200).json({
    status: "true",
    results: fingerPrint.length,
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
      new ApiError(`No fingerPrint found for id ${req.params.id}`, 404)
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
exports.createFingerPrint = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

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
  req.body.userID = req.user._id;
  req.body.name = req.user.name;
  req.body.email = req.user.email;

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
      new ApiError(`No fingerPrint by this id ${req.params.id}`, 404)
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
    { new: true }
  );

  if (!fingerPrint) {
    return next(
      new ApiError(`No fingerPrint by this id ${req.params.id}`, 404)
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

exports.calculateSalaryFlexible = asyncHandler(async (req, res, next) => {
  console.log(req.query);
  const { companyId, userId, month, startDate, endDate } = req.query;

  if (!companyId || !userId) {
    return res.status(400).json({
      message: "companyId and userId are required",
    });
  }

  const staffMember = await Staff.findOne({ _id: userId, companyId });
  if (!staffMember) {
    return res.status(404).json({ message: "Staff not found" });
  }

  const salaryPerMonth = staffMember.salary || 0;
  const salaryPerHour = salaryPerMonth / 160;

  let start, end;
  if (startDate && endDate) {
    start = dayjs(startDate).startOf("day").format("YYYY-MM-DD");
    end = dayjs(endDate).endOf("day").format("YYYY-MM-DD");
  } else if (month) {
    start = dayjs(month + "-01")
      .startOf("month")
      .format("YYYY-MM-DD");
    end = dayjs(month + "-01")
      .endOf("month")
      .format("YYYY-MM-DD");
  } else {
    return res.status(400).json({
      message: "Either month or startDate & endDate must be provided",
    });
  }

  const records = await fingerPrintModel
    .find({
      userID: userId,
      companyId,
      date: { $gte: start, $lte: end },
    })
    .sort({ date: 1 });

  if (!records || records.length === 0) {
    return res.status(404).json({
      message: "No attendance records found for this user in the given range",
    });
  }

  let totalHours = 0;
  const daily = {};

  for (let record of records) {
    const dateKey = record.date;
    if (!daily[dateKey])
      daily[dateKey] = { checkIn: null, checkOut: null, hours: 0 };

    if (record.type === "Check-in") daily[dateKey].checkIn = record.Time;
    if (record.type === "Check-out") daily[dateKey].checkOut = record.Time;

    if (daily[dateKey].checkIn && daily[dateKey].checkOut) {
      const inTime = dayjs(`${dateKey} ${daily[dateKey].checkIn}`);
      const outTime = dayjs(`${dateKey} ${daily[dateKey].checkOut}`);
      const diff = outTime.diff(inTime, "hour", true);

      daily[dateKey].hours = diff;
      totalHours += diff;
    }
  }

  const calculatedSalary = totalHours * salaryPerHour;

  res.status(200).json({
    status: true,
    userId,
    staffName: staffMember.name,
    baseSalary: salaryPerMonth,
    totalHours: totalHours.toFixed(2),
    calculatedSalary: calculatedSalary.toFixed(2),
    daily,
    period: {
      start,
      end,
    },
  });
});
