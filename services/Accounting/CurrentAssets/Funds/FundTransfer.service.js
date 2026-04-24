const financialFundsModel = require("../../../../models/Accounting/CurrentAssets/financialFundsModel");
const FundTransferModel = require("../../../../models/Accounting/CurrentAssets/fundTransfer.model");
const reportsFinancialFunds = require("../../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const counterModel = require("../../../../models/Settings/counterModel");

const ApiError = require("../../../../utils/apiError");

function padZero(value) {
  return value < 10 ? `0${value}` : value;
}

function buildDateTime(dateValue) {
  const now = new Date();
  const formattedTime = `${padZero(now.getHours())}:${padZero(
    now.getMinutes()
  )}:${padZero(now.getSeconds())}.${String(now.getMilliseconds()).padStart(
    3,
    "0"
  )}`;

  return `${dateValue}T${formattedTime}Z`;
}

exports.createFundTransferService = async ({ req, companyId, session }) => {
  const { id: fromFundId } = req.params;

  const {
    fund: toFundId,
    fundFromAmount,
    fundToAmount,
    description,
    transferRate,
    journalCounter,
  } = req.body;

  if (!fromFundId) {
    throw new ApiError("Source fund id is required", 400);
  }

  if (!toFundId) {
    throw new ApiError("Destination fund id is required", 400);
  }

  if (String(fromFundId) === String(toFundId)) {
    throw new ApiError(
      "Source fund and destination fund cannot be the same",
      400
    );
  }

  const fromAmount = Number(fundFromAmount || 0);
  const toAmount = Number(fundToAmount || 0);

  if (fromAmount <= 0) {
    throw new ApiError("Source fund amount must be greater than zero", 400);
  }

  if (toAmount <= 0) {
    throw new ApiError(
      "Destination fund amount must be greater than zero",
      400
    );
  }

  const transferDate = buildDateTime(req.body.date);
  req.body.date = transferDate;

  const fromFund = await financialFundsModel
    .findOne({ _id: fromFundId, companyId })
    .session(session);

  if (!fromFund) {
    throw new ApiError("Source fund not found", 404);
  }

  const toFund = await financialFundsModel
    .findOne({ _id: toFundId, companyId })
    .session(session);

  if (!toFund) {
    throw new ApiError("Destination fund not found", 404);
  }

  if (Number(fromFund.fundBalance || 0) < fromAmount) {
    throw new ApiError("Insufficient source fund balance", 400);
  }

  const fromExchangeRate = Number(fromFund?.fundCurrency?.exchangeRate || 1);
  const toExchangeRate = Number(toFund?.fundCurrency?.exchangeRate || 1);

  if (fromExchangeRate <= 0 || toExchangeRate <= 0) {
    throw new ApiError("Invalid fund exchange rate", 400);
  }

  const fromAmountMainCurrency = fromAmount / fromExchangeRate;
  const toAmountMainCurrency = toAmount / toExchangeRate;

  const differenceMainCurrency = toAmountMainCurrency - fromAmountMainCurrency;

  let differenceType = "none";
  if (differenceMainCurrency > 0.000001) differenceType = "gain";
  if (differenceMainCurrency < -0.000001) differenceType = "loss";

  const totalMainCurrency = fromAmountMainCurrency;

  fromFund.fundBalance = Number(fromFund.fundBalance || 0) - fromAmount;
  toFund.fundBalance = Number(toFund.fundBalance || 0) + toAmount;

  await fromFund.save({ session });
  await toFund.save({ session });

  const counter = await counterModel.findOneAndUpdate(
    { companyId, name: "FundTransfer" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  const transferDocs = await FundTransferModel.create(
    [
      {
        companyId,
        counter: counter.seq,

        fromFund: {
          id: fromFund._id.toString(),
          name: fromFund.fundName,
          currencyId: fromFund?.fundCurrency?._id?.toString() || "",
          currencyCode: fromFund?.fundCurrency?.currencyCode || "",
          exchangeRate: fromExchangeRate,
          amount: fromAmount,
          amountMainCurrency: fromAmountMainCurrency,
        },

        toFund: {
          id: toFund._id.toString(),
          name: toFund.fundName,
          currencyId: toFund?.fundCurrency?._id?.toString() || "",
          currencyCode: toFund?.fundCurrency?.currencyCode || "",
          exchangeRate: toExchangeRate,
          amount: toAmount,
          amountMainCurrency: toAmountMainCurrency,
        },

        transferRate: Number(transferRate || 0),
        totalMainCurrency,
        differenceMainCurrency:
          Math.abs(differenceMainCurrency) <= 0.000001
            ? 0
            : differenceMainCurrency,
        differenceType,

        date: transferDate,
        description: description || "",
        journalCounter: journalCounter || "",
        file: req.body.file || "",
        postedBy: req.user?._id || null,
        postedAt: new Date(),
      },
    ],
    { session }
  );

  const transfer = transferDocs[0];

  await reportsFinancialFunds.create(
    [
      {
        date: transferDate,
        amount: fromAmount,
        type: "Withdrawal transfer",
        exchangeRate: fromExchangeRate,
        financialFundId: fromFund._id,
        financialFundRest: fromFund.fundBalance,
        paymentType: "Withdrawal",
        description: description || "",
        ref: transfer._id,
        companyId,
      },
      {
        date: transferDate,
        amount: toAmount,
        type: "Deposit transfer",
        exchangeRate: toExchangeRate,
        financialFundId: toFund._id,
        financialFundRest: toFund.fundBalance,
        paymentType: "Deposit",
        description: description || "",
        ref: transfer._id,
        companyId,
      },
    ],
    { session }
  );

  return transfer;
};

exports.cancelFundTransferService = async ({
  transferId,
  companyId,
  cancelledBy,
  cancellationReason,
  session,
}) => {
  if (!transferId) {
    throw new ApiError("Transfer id is required", 400);
  }

  const transfer = await FundTransferModel.findOne({
    _id: transferId,
    companyId,
  }).session(session);

  if (!transfer) {
    throw new ApiError("Fund transfer not found", 404);
  }

  if (transfer.cancelledAt) {
    throw new ApiError("Fund transfer is already cancelled", 400);
  }

  const fromFund = await financialFundsModel
    .findOne({ _id: transfer.fromFund.id, companyId })
    .session(session);

  if (!fromFund) {
    throw new ApiError("Source fund not found", 404);
  }

  const toFund = await financialFundsModel
    .findOne({ _id: transfer.toFund.id, companyId })
    .session(session);

  if (!toFund) {
    throw new ApiError("Destination fund not found", 404);
  }

  const fromAmount = Number(transfer?.fromFund?.amount || 0);
  const toAmount = Number(transfer?.toFund?.amount || 0);

  if (Number(toFund.fundBalance || 0) < toAmount) {
    throw new ApiError(
      "Cannot cancel transfer because destination fund balance is insufficient",
      400
    );
  }

  fromFund.fundBalance = Number(fromFund.fundBalance || 0) + fromAmount;
  toFund.fundBalance = Number(toFund.fundBalance || 0) - toAmount;

  await fromFund.save({ session });
  await toFund.save({ session });

  await reportsFinancialFunds.create(
    [
      {
        date: new Date(),
        amount: fromAmount,
        type: "Deposit transfer reverse",
        exchangeRate: Number(transfer?.fromFund?.exchangeRate || 1),
        financialFundId: fromFund._id,
        financialFundRest: fromFund.fundBalance,
        paymentType: "Deposit",
        description:
          cancellationReason ||
          `Reverse fund transfer ${transfer.counter || transfer._id}`,
        ref: transfer._id,
        companyId,
      },
      {
        date: new Date(),
        amount: toAmount,
        type: "Withdrawal transfer reverse",
        exchangeRate: Number(transfer?.toFund?.exchangeRate || 1),
        financialFundId: toFund._id,
        financialFundRest: toFund.fundBalance,
        paymentType: "Withdrawal",
        description:
          cancellationReason ||
          `Reverse fund transfer ${transfer.counter || transfer._id}`,
        ref: transfer._id,
        companyId,
      },
    ],
    { session }
  );

  transfer.cancelledBy = cancelledBy || null;
  transfer.cancelledAt = new Date();
  transfer.cancellationReason = cancellationReason || "Transfer cancelled";

  await transfer.save({ session });

  return transfer;
};

exports.getAllFundTransfersService = async ({ req, companyId }) => {
  const pageSize = parseInt(req.query.limit, 10) || 10;
  const page = parseInt(req.query.page, 10) || 1;
  const skip = (page - 1) * pageSize;

  const keyword = req.query.keyword?.trim() || "";
  const status = req.query.status?.trim() || "";
  const fromFundId = req.query.fromFundId?.trim() || "";
  const toFundId = req.query.toFundId?.trim() || "";
  const currencyId = req.query.currencyId?.trim() || "";
  const differenceType = req.query.differenceType?.trim() || "";
  const postedBy = req.query.postedBy?.trim() || "";
  const startDate = req.query.startDate?.trim() || "";
  const endDate = req.query.endDate?.trim() || "";

  const andConditions = [{ companyId }];

  if (keyword) {
    andConditions.push({
      $or: [
        { counter: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { "fromFund.name": { $regex: keyword, $options: "i" } },
        { "toFund.name": { $regex: keyword, $options: "i" } },
        { "fromFund.currencyCode": { $regex: keyword, $options: "i" } },
        { "toFund.currencyCode": { $regex: keyword, $options: "i" } },
      ],
    });
  }

  if (status === "cancelled") {
    andConditions.push({ cancelledAt: { $ne: null } });
  } else if (status === "active") {
    andConditions.push({ cancelledAt: null });
  }

  if (fromFundId) {
    andConditions.push({ "fromFund.id": fromFundId });
  }

  if (toFundId) {
    andConditions.push({ "toFund.id": toFundId });
  }

  if (currencyId) {
    andConditions.push({
      $or: [
        { "fromFund.currencyId": currencyId },
        { "toFund.currencyId": currencyId },
      ],
    });
  }

  if (differenceType && ["none", "gain", "loss"].includes(differenceType)) {
    andConditions.push({ differenceType });
  }

  if (postedBy) {
    andConditions.push({ postedBy });
  }

  if (startDate || endDate) {
    const dateFilter = {};

    if (startDate) {
      dateFilter.$gte = new Date(`${startDate}T00:00:00.000Z`);
    }

    if (endDate) {
      dateFilter.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    andConditions.push({ date: dateFilter });
  }

  const query =
    andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

  const total = await FundTransferModel.countDocuments(query);

  const data = await FundTransferModel.find(query)
    .populate("postedBy", "fullName")
    .populate("cancelledBy", "fullName")
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(pageSize)
    .lean();

  return {
    page,
    limit: pageSize,
    total,
    Pages: Math.ceil(total / pageSize),
    data,
  };
};

exports.getOneFundTransferService = async ({ transferId, companyId }) => {
  if (!transferId) {
    throw new ApiError("Transfer id is required", 400);
  }

  const transfer = await FundTransferModel.findOne({
    _id: transferId,
    companyId,
  })
    .populate("postedBy", "fullName")
    .populate("cancelledBy", "fullName")
    .lean();

  if (!transfer) {
    throw new ApiError("Fund transfer not found", 404);
  }

  return transfer;
};
