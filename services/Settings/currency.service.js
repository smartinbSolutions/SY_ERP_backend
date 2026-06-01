const currencyModel = require("../../models/Settings/currency.model");
const currencyLogModel = require("../../models/Settings/currencyLog.model");
// const productModel = require("../../models/Stocks/Products/product.model");
const ApiError = require("../../utils/apiError");

exports.getCurrenciesService = async ({ companyId }) => {
  const currencies = await currencyModel.find({ companyId });
  return currencies;
};

exports.createCurrencyService = async ({ companyId, body, session, user }) => {
  body.companyId = companyId;

  if (body.exchangeRate <= 0) {
    throw new Error("Exchange rate must be greater than 0");
  }

  const [currency] = await currencyModel.create([body], { session });

  await currencyLogModel.create(
    [
      {
        currencyId: currency._id,
        oldRate: body.exchangeRate,
        newRate: body.exchangeRate,
        changeType: "initial",
        updatedBy: user?.name || "system",
        companyId,
      },
    ],
    { session },
  );

  return currency;
};

exports.getCurrencyService = async ({ id, companyId }) => {
  const currency = await currencyModel.findOne({ _id: id, companyId });
  if (!currency) {
    throw new ApiError(`No currency for this id ${id}`, 404);
  }
  return currency;
};

exports.updateCurrencyService = async ({
  body,
  id,
  companyId,
  user,
  session,
}) => {
  body.companyId = companyId;

  const existingCurrency = await currencyModel
    .findOne({ _id: id, companyId })
    .session(session);

  if (!existingCurrency) {
    throw new ApiError(`No currency for this id ${id}`, 404);
  }

  const oldRate = existingCurrency.exchangeRate;
  const newRate = body.exchangeRate ?? oldRate;

  if (body.is_primary === true) {
    await currencyModel.updateMany(
      { companyId, is_primary: true },
      { is_primary: false },
      { session },
    );
  }

  const updatedCurrency = await currencyModel.findOneAndUpdate(
    { _id: id, companyId },
    body,
    { new: true, session },
  );

  if (newRate !== oldRate) {
    await currencyLogModel.create(
      [
        {
          currencyId: currency._id,
          oldRate: oldRate,
          newRate: newRate,
          changeType: "initial",
          updatedBy: user?.name || "system",
          companyId,
          newRate: body.buyingExchangeRate,
        },
      ],
      { session },
    );
  }

  return updatedCurrency;
};

exports.deleteCurrencyService = async ({ currencyId, companyId, session }) => {
  const currency = await currencyModel
    .findOne({ _id: currencyId, companyId })
    .session(session);

  if (!currency) {
    throw new ApiError(`No currency for this id ${currencyId}`, 404);
  }
  // const currencyUsed = await productModel
  //   .exists({
  //     companyId,
  //     $or: [{ currency: currencyId }],
  //   })
  //   .session(session);
  // if (!currencyUsed) {
  //   throw new ApiError(`No currency for this id ${currencyId}`, 404);
  // }
  await currency.deleteOne({ session });

  return currency;
};
