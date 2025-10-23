const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const locationModel = require("../../models/Hr/locationModel");

exports.getAllLocations = asyncHandler(async (req, res, next) => {
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
  try {
    const total = await locationModel.countDocuments(query);

    const locations = await locationModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .lean()
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      results: locations.length,
      data: locations,
    });
  } catch (error) {
    console.error(`Error fetching locations: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

exports.getOneLocations = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  if (!req.params.id) {
    return next(
      new ApiError(`No Locations for this ID: ${req.params.id}`, 404)
    );
  }
  const locations = await locationModel.findOne({
    _id: req.params.id,
    companyId,
  });
  res.status(200).json({ status: "success", data: locations });
});

exports.createLocations = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const locations = await locationModel.create(req.body);
  res.status(200).json({ status: "success", data: locations });
});

exports.updateLocations = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  req.body.companyId = companyId;
  if (!id) {
    return next(new ApiError(`No Locations for this ID: ${id}`, 404));
  }
  const locations = await locationModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
    }
  );

  res.status(200).json({ status: "success", data: locations });
});

exports.deleteLocations = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  if (!id) {
    return next(new ApiError(`No Locations for this ID:${id}`, 404));
  }
  const locations = await locationModel.findOneAndDelete({
    _id: id,
    companyId,
  });
  res.status(200).json({ status: "success", data: locations });
});
