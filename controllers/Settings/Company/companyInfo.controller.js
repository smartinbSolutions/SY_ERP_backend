const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../../utils/apiError");
const companyInfoService = require("../../../services/Settings/Company/companyInfo.service");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const multerStorage = multer.memoryStorage();

const multerFilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ApiError("Only images allowed", 400), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

exports.uploadCompanyLogo = upload.single("companyLogo");

exports.resizerLogo = asyncHandler(async (req, res, next) => {
  const filename = `company-${uuidv4()}-${Date.now()}.png`;

  if (req.file) {
    const uploadDir = path.join("uploads", "companyinfo");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await sharp(req.file.buffer)
      .toFormat("png")
      .png({ quality: 90 })
      .toFile(path.join(uploadDir, filename));
    req.body.companyLogo = filename;
  }

  next();
});

exports.createCompanyInfo = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await companyInfoService.createCompanyInfo({
      body: req.body,
      session,
    });
    console.log(result);

    await companyInfoService.creaeteAccountingTreeService({
      session,
      companyId: result.companyInfo._id,
      body: req.body,
      currency: result.currency[0],
    });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      status: "success",
      message: "Company Info created successfully",
      data: result,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

exports.getCompanyInfo = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const result = await companyInfoService.getCompanyInfo({
    req,
    companyId,
  });
  res.status(200).json({
    status: "success",
    message: "Company Info retrieved successfully",
    data: result.companyInfo,
    companySetting: result.companySetting,
    currency: result.currency,
  });
});

exports.getCompanySetting = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const result = await companyInfoService.getCompanySetting({ companyId });

  res.status(200).json({
    status: "success",
    message: "Company Setting retrieved successfully",
    data: result,
  });
});

exports.updateCompanyInfo = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await companyInfoService.updateCompanyInfo({
      companyId,
      id,
      body: req.body,
      session,
    });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      status: "success",
      message: "Company Info updated successfully",
      data: result.companyInfo,
      companySetting: result.companySetting,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

exports.updateCompanySetting = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await companyInfoService.updateCompanySetting({
      companyId,
      body: req.body,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      message: "Company Setting updated successfully",
      data: result,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

// Have to Start after

exports.rollover = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!req.body.endDate || !req.body.startDate) {
    throw new ApiError(
      "Journal date and price method are required to continue rollover",
      400,
    );
  }
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    //Data
    const newCompanyInfo = await companyInfoService.rolloverService({
      companyId,
      session,
      body: req.body,
    });
    const BeginningInvoice = await companyInfoService.BeginningInvoiceService({
      companyId,
      newCompanyId: newCompanyInfo.newCompanyId,
      session,
      newStocks: newCompanyInfo.newStocks,
      date: newCompanyInfo.date,
      counter: newCompanyInfo.counter,
      units: newCompanyInfo.units,
      newunits: newCompanyInfo.newunits,
      priceMethod: newCompanyInfo.priceMethod,
      manualJournal: newCompanyInfo.manualJournal,
      categoryMap: newCompanyInfo.categoryMap,
      unitMap: newCompanyInfo.unitMap,
      taxMap: newCompanyInfo.taxMap,
      currencyMap: newCompanyInfo.currencyMap,
      brandMap: newCompanyInfo.brandMap,
    });

    await companyInfoService.openingInventoryRolloverService({
      products: BeginningInvoice.products,
      newCompanyId: newCompanyInfo.newCompanyId,
      session,
      newStocks: newCompanyInfo.newStocks,
      date: newCompanyInfo.date,
      counter: newCompanyInfo.counter,
      priceMethod: newCompanyInfo.priceMethod,
      manualJournal: newCompanyInfo.manualJournal,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      status: true,
      message: "Rollover completed successfully",
      data: newCompanyInfo[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
});
