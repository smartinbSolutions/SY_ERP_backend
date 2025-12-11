const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const departmentModel = require("../../models/Hr/departmentModel");

/////////
exports.getAllDepartments = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const branchId = req.query.branchId;
  const keyword = req.query.keyword;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  // base query
  let query = { companyId };

  // filter by branchId (optional)
  if (branchId) {
    query.branchId = branchId;
  }

  // keyword search
  if (keyword) {
    query.$or = [
      { name: { $regex: keyword, $options: "i" } },
      { nameAR: { $regex: keyword, $options: "i" } },
      { nameTR: { $regex: keyword, $options: "i" } },
    ];
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await departmentModel.countDocuments(query);

  const departments = await departmentModel
    .find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .populate("branchId");

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: departments.length,
    data: departments,
  });
});

////////
exports.getOneDepartment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Department ID format",
    });
  }
  const department = await departmentModel.findOne({
    _id: req.params.id,
    companyId,
  });

  if (!department) {
    res.status(404).json({ status: "fail", message: "Department not found" });
  }
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
    AlternativeName: req.body.AlternativeName,
    code: req.body.code,
    managerId: req.body.managerId,
    parent: req.body.parent,
    isLocal: req.body.isLocal,
    branchId: req.body.branchId,
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
  req.body.companyId = companyId;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Department ID format",
    });
  }
  const department = await departmentModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
    }
  );

  if (!department) {
    res.status(404).json({ status: "fail", message: "Department not found" });
  }

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
    res.status(404).json({ status: "fail", message: "Department not found" });
  }

  res.status(200).json({
    status: "success",
    data: department,
    message: "Deleted successfully",
  });
});
