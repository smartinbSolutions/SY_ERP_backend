const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const departmentModel = require("../../models/Hr/departmentModel");

/////////
exports.getAllDepartments = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const query = { companyId };

  if (req.query.keyword) {
    query.$or = [{ name: { $regex: req.query.keyword, $options: "i" } }];
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await departmentModel.countDocuments(query);

  const department = await departmentModel
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
    results: department.length,
    data: department,
  });
});

////////
exports.getOneDepartment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  if (!req.params.id) {
    return next(
      new ApiError(`No Department for this ID: ${req.params.id}`, 404)
    );
  }
  const department = await departmentModel.findOne({
    _id: req.params.id,
    companyId,
  });
  res.status(200).json({ status: "success", data: department });
});

/////////
exports.createDepartment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const department = await departmentModel.create({
    name: req.body.name,
    code: req.body.code,
    managerId: req.body.managerId,
    description: req.body.description,
    companyId: companyId,
  });

  res.status(200).json({ status: "success", data: department });
});

//////
exports.updateDepartment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  req.body.companyId = companyId;
  if (!id) {
    return next(new ApiError(`No Department for this ID: ${id}`, 404));
  }
  const department = await departmentModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
    }
  );

  res.status(200).json({ status: "success", data: department });
});

////////
exports.deleteDepartment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;
  if (!id) {
    return next(new ApiError(`Provide id to delete`, 400));
  }

  const department = await departmentModel.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!department) {
    res
      .status(404)
      .json({ status: "fail", message: `No Department found for ID: ${id}` });
  }

  res.status(200).json({
    status: "success",
    data: department,
    message: "Deleted successfully",
  });
});
