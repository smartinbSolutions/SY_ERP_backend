const financialFundsModel = require("../../../../models/Accounting/CurrentAssets/financialFundsModel");
const reportsFinancialFunds = require("../../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const salesPointModel = require("../../../../models/salesPointModel");
const ApiError = require("../../../../utils/apiError");

exports.findAllFundAndBankService = async ({ req, companyId }) => {
  let query = { archives: { $ne: false }, companyId };

  const fundAndBanks = await financialFundsModel
    .find(query)
    .populate({
      path: "fundCurrency",
      select: "_id currencyCode currencyName exchangeRate",
    })
    .populate({
      path: "linkAccount",
      populate: { path: "currency" },
    });

  return { fundAndBanks, totalItems: fundAndBanks.length };
};

exports.createFundAndBankService = async ({ req, companyId, session }) => {
  const fundAndBank = await financialFundsModel.create([req.body], { session });

  const reports = await reportsFinancialFunds.create(
    [
      {
        date: req.body.date || new Date(),
        ref: fundAndBank[0]._id,
        amount: req.body.fundBalance || 0,
        type: "opening Balance",
        exchangeRate: 1,
        financialFundId: fundAndBank[0]._id,
        financialFundRest: 0,
        paymentType: req.body.fundBalance > 0 ? "Deposit" : "Withdrawal",
        payment: null,
        description: req.body.paymentDescription,
        companyId,
      },
    ],
    { session }
  );

  return { fundAndBank: fundAndBank[0] };
};

exports.findOneFundAndBankService = async ({ req, companyId }) => {
  const { id } = req.params;

  const fundAndBank = await financialFundsModel
    .findOne({
      _id: id,
      companyId,
    })
    .populate({
      path: "fundCurrency",
      select: "_id currencyCode currencyName exchangeRate",
    })
    .populate("linkAccount")
    .populate({
      path: "linkAccount",
      populate: { path: "currency" },
    });

  if (!fundAndBank) {
    throw new ApiError(`No fundAndBank invoice for this id ${id}`, 404);
  }

  return { fundAndBank };
};

exports.updateFundAndBankService = async ({ req, companyId, session }) => {
  const { id } = req.params;

  const fundAndBank = await financialFundsModel
    .findOneAndUpdate(
      {
        _id: id,
        companyId,
      },
      req.body,
      { new: true }
    )
    .session(session);

  if (!fundAndBank) {
    throw new ApiError(`No fund and bank for this id ${id}`, 404);
  }

  return fundAndBank;
};

exports.deleteFundAndBankService = async ({ req, companyId, session }) => {
  const { id } = req.params;

  const ReportsFinancialFunds = await reportsFinancialFunds
    .countDocuments({
      financialFundId: id,
      companyId,
    })
    .session(session);
  let fundAndBank;
  if (ReportsFinancialFunds <= 1) {
    fundAndBank = await financialFundsModel
      .findOneAndDelete({
        _id: id,
        companyId,
      })
      .session(session);
    if (!fundAndBank) {
      throw new ApiError(`No fund and bank for this id ${id}`, 404);
    }
    return true;
  } else {
    return false;
  }
};

exports.getFundAndBankForSalesPointService = async ({
  req,
  companyId,
  session,
}) => {
  const { id } = req.params;

  const salesPoint = await salesPointModel.findOne({ _id: id, companyId });
  if (!salesPoint) {
    return res.status(404).json({ message: "Sales point not found" });
  }
  const funds = await Promise.all(
    salesPoint.funds.map(async (fundItem) => {
      return financialFundsModel
        .findOne({
          _id: fundItem.id,
          companyId,
        })
        .populate({
          path: "fundCurrency",
          select: "_id currencyCode currencyName exchangeRate",
        });
    })
  );

  return funds;
};
