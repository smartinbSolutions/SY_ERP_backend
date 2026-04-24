const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

const {
  createFundTransferService,
  cancelFundTransferService,
  getAllFundTransfersService,
  getOneFundTransferService,
} = require("../../../services/Accounting/CurrentAssets/Funds/FundTransfer.service");

exports.createFundTransfer = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();

  try {
    let transfer;

    await session.withTransaction(async () => {
      transfer = await createFundTransferService({
        req,
        companyId,
        session,
      });
    });

    res.status(201).json({
      status: "success",
      message: "Fund transfer created successfully",
      data: transfer,
    });
  } finally {
    await session.endSession();
  }
});

exports.cancelFundTransfer = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const transferId = req.params.id;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();

  try {
    let transfer;

    await session.withTransaction(async () => {
      transfer = await cancelFundTransferService({
        transferId,
        companyId,
        cancelledBy: req.user?._id || null,
        cancellationReason: req.body.cancellationReason || "",
        session,
      });
    });

    res.status(200).json({
      status: "success",
      message: "Fund transfer cancelled successfully",
      data: transfer,
    });
  } finally {
    await session.endSession();
  }
});

exports.getAllFundTransfers = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const result = await getAllFundTransfersService({ req, companyId });

  res.status(200).json(result);
});

exports.getOneFundTransfer = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const transferId = req.params.id;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const data = await getOneFundTransferService({
    transferId,
    companyId,
  });

  res.status(200).json({
    status: "success",
    data,
  });
});
