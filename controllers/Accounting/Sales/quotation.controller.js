const asyncHandler = require("express-async-handler");
const {
  getAllQuotationsService,
  getOneQuotationService,
  createQuotationService,
  updateQuotationService,
} = require("../../../services/Accounting/Sales/quotation.service");
const { default: mongoose } = require("mongoose");

exports.getAllQuotations = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { quotations, totalPages, totalItems } = await getAllQuotationsService({
    companyId,
    req,
  });

  res.status(200).json({
    status: "success",
    totalPages,
    results: totalItems,
    data: quotations,
  });
});

exports.getOneQuotation = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const quotation = await getOneQuotationService({
    companyId,
    id,
  });

  res.status(200).json({
    status: "success",
    data: quotation,
  });
});

exports.createQuotation = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const newSalesInvoice = await createQuotationService({
      session,
      companyId,
      req,
    });
    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: newSalesInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
});

exports.updateQuotation = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const newSalesInvoice = await updateQuotationService({
      id,
      companyId,
      req,
      session,
    });
    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: newSalesInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
});
