const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const groupsModel = require("../../models/Hr/groupsModel");
const { calculateHourlyRate } = require("./Payroll/payrollService");
const staffModel = require("../../models/Hr/staffModel");

exports.getAllGroups = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const query = { companyId };

  if (req.query.keyword) {
    query.$or = [{ groupName: { $regex: req.query.keyword, $options: "i" } }];
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await groupsModel.countDocuments(query);

  const groups = await groupsModel
    .find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: groups.length,
    data: groups,
  });
});

exports.getOneGroups = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  if (!req.params.id) {
    return next(new ApiError(`No Groups for this ID: ${req.params.id}`, 404));
  }
  const groups = await groupsModel
    .findOne({
      _id: req.params.id,
      companyId,
    })
    .populate("locationId")
    .populate("leavePolicy")
    .populate("overtimePolicy")
    .populate("advancePolicy")
    .populate("deductionPolicy");
  res.status(200).json({ status: "success", data: groups });
});

exports.createGroups = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const groups = await groupsModel.create(req.body);
  res.status(200).json({ status: "success", data: groups });
});

exports.updateGroups = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  const { id } = req.params;

  if (!id) {
    return next(new ApiError(`No Groups for this ID: ${id}`, 404));
  }

  req.body.companyId = companyId;
  console.log("req", req.body);

  const group = await groupsModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!group) {
    return next(new ApiError("Group not found", 404));
  }

  // هل تم تعديل شيء يؤثر على hourlyRate؟
  const shouldRecalculate =
    req.body.attendanceType !== undefined ||
    req.body.offDays !== undefined ||
    req.body.fixedAttendance !== undefined ||
    req.body.flexibleAttendance !== undefined ||
    req.body.remoteAttendance !== undefined;

  if (shouldRecalculate) {
    const staffs = await staffModel.find({
      groupId: group._id,
      companyId,
    });

    for (const staff of staffs) {
      const hourlyRate = calculateHourlyRate(staff, group);

      staff.salary.hourlyRate = hourlyRate;

      await staff.save();
    }
  }

  res.status(200).json({
    status: "success",
    data: group,
  });
});

exports.deleteGroups = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  if (!id) {
    return next(new ApiError(`No Groups for this ID:${id}`, 404));
  }
  const groups = await groupsModel.findOneAndDelete({
    _id: id,
    companyId,
  });
  res.status(200).json({ status: "success", data: groups });
});
