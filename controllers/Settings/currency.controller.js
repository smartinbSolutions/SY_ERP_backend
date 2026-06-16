const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const currencyService = require("../../services/Settings/currency.service");
const { default: mongoose } = require("mongoose");

exports.createCurrency = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const currency = await currencyService.createCurrencyService({
    companyId,
    body: req.body,
    session,
    user: req.user,
  });

  await session.commitTransaction();
  session.endSession();

  res.status(201).json({
    status: true,
    data: currency,
  });
});

exports.getCurrencies = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  const currencies = await currencyService.getCurrenciesService({ companyId });

  res.status(200).json({
    status: true,
    results: currencies.length,
    data: currencies,
  });
});

exports.getCurrency = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const currency = await currencyService.getCurrencyService({
    currencyId: id,
    companyId,
  });

  res.status(200).json({
    status: true,
    data: currency,
  });
});

exports.updateCurrency = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const currency = await currencyService.updateCurrencyService({
      id,
      companyId,
      body: req.body,
      session,
      user: req.user,
    });

    await session.commitTransaction();

    res.status(200).json({
      status: true,
      data: currency,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

exports.deleteCurrency = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  await currencyService.deleteCurrencyService({
    currencyId: id,
    companyId,
  });

  res.status(200).json({
    status: true,
    message: "Currency deleted successfully",
  });
});
