const financialFundsModel = require("../../../../models/Accounting/CurrentAssets/financialFundsModel");
const FundTransferModel = require("../../../../models/Accounting/CurrentAssets/fundTransfer.model");
const reportsFinancialFunds = require("../../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const journalEntryModel = require("../../../../models/journalEntryModel");
const counterModel = require("../../../../models/Settings/counterModel");

const ApiError = require("../../../../utils/apiError");
const {
  createJournalService,
} = require("../../../Accounting/JournalEntries/journalEntries.Service");

function padZero(value) {
  return value < 10 ? `0${value}` : value;
}

function buildDateTime(dateValue) {
  const now = new Date();
  const formattedTime = `${padZero(now.getHours())}:${padZero(
    now.getMinutes(),
  )}:${padZero(now.getSeconds())}.${String(now.getMilliseconds()).padStart(
    3,
    "0",
  )}`;

  return `${dateValue}T${formattedTime}Z`;
}

exports.createFundTransferService = async ({ req, companyId, session }) => {
  const {
    fromFund,
    toFund,
    fromFundAmount,
    toFundAmount,
    description,
    transferRate,
    journalCounter,
    sourceMainAmount,
    destinationMainAmount,
    differenceMainCurrency,
    differenceType,
  } = req.body;

  const fromFundId = fromFund?.id;
  const toFundId = toFund?.id;

  if (!fromFundId) {
    throw new ApiError("Source fund id is required", 400);
  }

  if (!toFundId) {
    throw new ApiError("Destination fund id is required", 400);
  }

  if (String(fromFundId) === String(toFundId)) {
    throw new ApiError(
      "Source fund and destination fund cannot be the same",
      400,
    );
  }

  const fromAmount = Number(fromFundAmount || 0);
  const toAmount = Number(toFundAmount || 0);

  //   if (fromAmount <= 0) {
  //     throw new ApiError("Source fund amount must be greater than zero", 400);
  //   }

  //   if (toAmount <= 0) {
  //     throw new ApiError(
  //       "Destination fund amount must be greater than zero",
  //       400
  //     );
  //   }

  const transferDate = buildDateTime(req.body.date);
  req.body.date = transferDate;

  const fromFundDoc = await financialFundsModel
    .findOne({ _id: fromFundId, companyId })
    .populate("fundCurrency")
    .session(session);

  if (!fromFundDoc) {
    throw new ApiError("Source fund not found", 404);
  }

  const toFundDoc = await financialFundsModel
    .findOne({ _id: toFundId, companyId })
    .populate("fundCurrency")
    .session(session);

  if (!toFundDoc) {
    throw new ApiError("Destination fund not found", 404);
  }

  //   if (Number(fromFundDoc.fundBalance || 0) < fromAmount) {
  //     throw new ApiError("Insufficient source fund balance", 400);
  //   }

  const fromExchangeRate = Number(fromFundDoc?.fundCurrency?.exchangeRate || 1);
  const toExchangeRate = Number(toFundDoc?.fundCurrency?.exchangeRate || 1);

  if (fromExchangeRate <= 0 || toExchangeRate <= 0) {
    throw new ApiError("Invalid fund exchange rate", 400);
  }

  const calculatedSourceMainAmount = fromAmount / fromExchangeRate;
  const calculatedDestinationMainAmount = toAmount / toExchangeRate;
  const calculatedDifferenceMainCurrency =
    calculatedDestinationMainAmount - calculatedSourceMainAmount;

  let calculatedDifferenceType = "none";
  if (calculatedDifferenceMainCurrency > 0.000001) {
    calculatedDifferenceType = "gain";
  }
  if (calculatedDifferenceMainCurrency < -0.000001) {
    calculatedDifferenceType = "loss";
  }

  const finalSourceMainAmount = Number(
    sourceMainAmount ?? calculatedSourceMainAmount,
  );
  const finalDestinationMainAmount = Number(
    destinationMainAmount ?? calculatedDestinationMainAmount,
  );
  const finalDifferenceMainCurrency = Number(
    differenceMainCurrency ?? calculatedDifferenceMainCurrency,
  );
  const finalDifferenceType = differenceType || calculatedDifferenceType;

  const totalMainCurrency = finalSourceMainAmount;

  fromFundDoc.fundBalance = Number(fromFundDoc.fundBalance || 0) - fromAmount;
  toFundDoc.fundBalance = Number(toFundDoc.fundBalance || 0) + toAmount;

  await fromFundDoc.save({ session });
  await toFundDoc.save({ session });

  const counter = await counterModel.findOneAndUpdate(
    { companyId, name: "FundTransfer" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  const transferDocs = await FundTransferModel.create(
    [
      {
        companyId,
        counter: counter.seq,

        fromFund: {
          id: fromFundDoc._id.toString(),
          name: fromFundDoc.fundName,
          currencyId: fromFundDoc?.fundCurrency?._id?.toString() || "",
          currencyCode: fromFundDoc?.fundCurrency?.currencyCode || "",
          exchangeRate: fromExchangeRate,
          amount: fromAmount,
          amountMainCurrency: finalSourceMainAmount,
        },

        toFund: {
          id: toFundDoc._id.toString(),
          name: toFundDoc.fundName,
          currencyId: toFundDoc?.fundCurrency?._id?.toString() || "",
          currencyCode: toFundDoc?.fundCurrency?.currencyCode || "",
          exchangeRate: toExchangeRate,
          amount: toAmount,
          amountMainCurrency: finalDestinationMainAmount,
        },

        transferRate: Number(transferRate || 0),
        totalMainCurrency,
        differenceMainCurrency:
          Math.abs(finalDifferenceMainCurrency) <= 0.000001
            ? 0
            : finalDifferenceMainCurrency,
        differenceType: finalDifferenceType,

        date: transferDate,
        description: description || "",
        journalCounter: journalCounter || "",
        file: req.body.file || "",
        postedBy: req.user?._id || null,
        postedAt: new Date(),
      },
    ],
    { session },
  );

  const transfer = transferDocs[0];

  await reportsFinancialFunds.create(
    [
      {
        date: transferDate,
        amount: fromAmount,
        type: "Withdrawal transfer",
        exchangeRate: fromExchangeRate,
        financialFundId: fromFundDoc._id,
        financialFundRest: fromFundDoc.fundBalance,
        paymentType: "Withdrawal",
        description: description || "",
        refId: transfer._id,
        companyId,
        source: "transfer",
        refType: "transfer",
        direction: "out",
      },
      {
        date: transferDate,
        amount: toAmount,
        exchangeRate: toExchangeRate,
        financialFundId: toFundDoc._id,
        financialFundRest: toFundDoc.fundBalance,
        description: description || "",
        refId: transfer._id,
        companyId,
        source: "transfer",
        refType: "transfer",
        direction: "in",
      },
    ],
    { session },
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

  if (transfer.status === "cancelled") {
    throw new ApiError("Fund transfer is already cancelled", 400);
  }

  const cancellationDate = buildDateTime(
    new Date().toISOString().split("T")[0],
  );

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

  //   if (Number(toFund.fundBalance || 0) < toAmount) {
  //     throw new ApiError(
  //       "Cannot cancel transfer because destination fund balance is insufficient",
  //       400
  //     );
  //   }

  fromFund.fundBalance = Number(fromFund.fundBalance || 0) + fromAmount;
  toFund.fundBalance = Number(toFund.fundBalance || 0) - toAmount;

  await fromFund.save({ session });
  await toFund.save({ session });

  await reportsFinancialFunds.create(
    [
      {
        date: cancellationDate,
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
        date: cancellationDate,
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
    { session },
  );

  await reverseFundTransferJournal({
    companyId,
    transfer,
    cancellationDate,
    session,
  });

  transfer.status = "cancelled";
  transfer.cancelledBy = cancelledBy || null;
  transfer.cancelledAt = cancellationDate;
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

const reverseFundTransferJournal = async ({
  companyId,
  transfer,
  cancellationDate,
  session,
}) => {
  if (!transfer?.journalCounter) {
    throw new ApiError("Transfer journal reference is missing", 400);
  }

  const originalJournal = await journalEntryModel
    .findOne({
      companyId,
      linkCounter: transfer.journalCounter,
    })
    .session(session);

  if (!originalJournal) {
    throw new ApiError("Original transfer journal not found", 404);
  }

  if (originalJournal.status === "reversed") {
    throw new ApiError("Original transfer journal already reversed", 400);
  }

  const originalLines = originalJournal.journalAccounts || [];

  if (!Array.isArray(originalLines) || originalLines.length === 0) {
    throw new ApiError("Original transfer journal accounts are missing", 400);
  }

  const reversedLines = originalLines.map((line, index) => ({
    ...line,
    MainDebit: Number(line?.MainCredit || 0),
    MainCredit: Number(line?.MainDebit || 0),
    accountDebit: Number(line?.accountCredit || 0),
    accountCredit: Number(line?.accountDebit || 0),
    counter: index + 1,
  }));

  const totalDebit = reversedLines.reduce(
    (sum, item) => sum + Number(item?.MainDebit || 0),
    0,
  );

  const totalCredit = reversedLines.reduce(
    (sum, item) => sum + Number(item?.MainCredit || 0),
    0,
  );

  if (Number(totalDebit.toFixed(6)) !== Number(totalCredit.toFixed(6))) {
    throw new ApiError(
      `reversal journal is not balanced. debit=${totalDebit}, credit=${totalCredit}`,
      400,
    );
  }

  const journalCounterDoc = await counterModel.findOneAndUpdate(
    { companyId, name: "JournalEntry" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  const reversalLinkCounter = Date.now();

  const reversalJournal = await createJournalService({
    companyId,
    journalInfo: {
      journalName: `Fund Transfer Cancellation - ${transfer.counter || ""}`,
      journalDate: cancellationDate,
      journalDesc: `Reverse accounting effect of cancelled fund transfer ${
        transfer.counter || ""
      }`,
      journalType: "Fund Transfer Reversal",
      linkCounter: String(reversalLinkCounter),
      refCounter: String(transfer.counter || ""),
      counter: journalCounterDoc.seq,
      refId: transfer._id,
      party: "",
      receiptNumber: "",
      filesArray: [],
      journalDebit: totalDebit,
      journalCredit: totalCredit,
    },
    journalAccounts: reversedLines,
    session,
  });

  originalJournal.status = "reversed";
  originalJournal.reversedAt = cancellationDate;
  originalJournal.reverseJournalId = reversalJournal?._id || null;

  await originalJournal.save({ session });

  return reversalJournal;
};
