const asyncHandler = require("express-async-handler");
const {
  createShortageService,
  updateShortageService,
} = require("../../../services/Stocks/Stocks/shortage.service");
const mongoose = require("mongoose");

exports.createShortage = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyId = req.companyId;
    const user = req.user._id;

    if (!companyId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "companyId is required",
      });
    }

    req.body.companyId = companyId;
    req.body.user = user;

    const shortage = await createShortageService({
      session,
      body: req.body,
      companyId,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      status: true,
      data: shortage,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

exports.updateShortage = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyId = req.companyId;
    const user = req.user._id;
    const id = req.params.id;

    if (!companyId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "companyId is required",
      });
    }

    const shortage = await updateShortageService({
      session,
      id,
      body: req.body,
      companyId,
      user,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: true,
      data: shortage,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

exports.getAllShortage = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  let query = {
    companyId,
    isDeleted: false,
  };

  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.query.source) {
    query.source = req.query.source;
  }

  if (req.query.keyword) {
    query.notes = { $regex: req.query.keyword, $options: "i" };
  }

  const total = await Shortage.countDocuments(query);

  const data = await Shortage.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("productId")
    .populate("warehouseId")
    .populate("user", "name email");

  res.json({
    status: true,
    total,
    pages: Math.ceil(total / limit),
    data,
  });
});
