const financialFundsModel = require("../../../../models/Accounting/CurrentAssets/financialFundsModel");
const paymentModel = require("../../../../models/paymentModel");
const reportsFinancialFunds = require("../../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const salesPointModel = require("../../../../models/salesPointModel");
const counterModel = require("../../../../models/Settings/counterModel");
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

exports.cashTransferService = async ({ req, companyId, session }) => {
  const { id } = req.params;
  const {
    fund,
    fundFromAmount,
    fundToAmount,
    exchangeRate,
    fundNamefrom,
    fundNameto,
    description,
    fromFundCurrencyCode,
    fundCurrency,
    totalMainCurrency,
    toCurrencyInfo,
  } = req.body;

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }
  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;

  const dateAndTime = `${req.body.date}T${formattedDate}Z`;
  req.body.date = dateAndTime;

  const fromFund = await financialFundsModel
    .findOne({
      _id: id,
      companyId,
    })
    .session(session);

  if (!fromFund) {
    throw new ApiError("Source fund not found", 404);
  }

  //   if (fromFund.fundBalance < fundFromAmount) {
  //     throw new ApiError("Insufficient balance", 400);
  //   }

  const toFund = await financialFundsModel
    .findOne({
      _id: fund,
      companyId,
    })
    .session(session);

  if (!toFund) {
    throw new ApiError("Destination fund not found", 404);
  }

  fromFund.fundBalance -= Number(fundFromAmount);
  toFund.fundBalance += Number(fundToAmount);

  await fromFund.save({ session });
  await toFund.save({ session });

  const counter = await counterModel.findOneAndUpdate(
    { companyId, name: "Payment" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  const payment = await paymentModel.create(
    [
      {
        companyId,

        source: {
          id: id,
          name: fundNamefrom,
        },
        sourceType: "fund",

        destination: {
          id: fund,
          name: fundNameto,
        },
        destinationType: "fund",

        totalInPaymentCurrency: fundToAmount,
        totalMainCurrency,
        paymentInDestinationCurrency: fundFromAmount,

        paymentCurrency: {
          name: toCurrencyInfo.currencyName,
          code: fundCurrency,
          id: toCurrencyInfo._id,
          exchangeRate: toCurrencyInfo.exchangeRate,
        },

        destinationCurrencyCode: fromFundCurrencyCode,
        destinationExchangeRate: req.body.fromFundExchangeRate,

        type: "Transfer",
        paymentType: "Transfer",
        paymentText: "Transfer",
        description,
        date: req.body.date,

        counter: counter.seq,
      },
    ],
    { session }
  );

  const paymentId = payment[0]._id;

  await reportsFinancialFunds.create(
    [
      {
        date: req.body.date,
        amount: fundFromAmount,
        type: "Withdrawal transfer",
        exchangeRate,
        financialFundId: id,
        financialFundRest: fromFund.fundBalance,
        paymentType: "Withdrawal",
        description,
        ref: paymentId,
        payment: paymentId,
        companyId,
      },

      {
        date: req.body.date,
        amount: fundToAmount,
        type: "Deposit transfer",
        exchangeRate,
        financialFundId: fund,
        financialFundRest: toFund.fundBalance,
        paymentType: "Deposit",
        description,
        ref: paymentId,
        payment: paymentId,
        companyId,
      },
    ],
    { session }
  );

  return payment[0];
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
