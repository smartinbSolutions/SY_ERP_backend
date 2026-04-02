const mongoose = require("mongoose");
const purchaseinvoicesModel = require("../../../../models/purchaseinvoicesModel");

const suppliersModel = require("../../../../models/suppliersModel");
const customarModel = require("../../../../models/customarModel");
const paymentModel = require("../../../../models/paymentModel");
const financialFundsModel = require("../../../../models/financialFundsModel");
const ReportsFinancialFundsModel = require("../../../../models/reportsFinancialFunds");
const { createInvoiceHistory } = require("../../../invoiceHistoryService");
const { createPaymentHistory } = require("../../../paymentHistoryService");
const {
  getNextCounterValue,
} = require("../../../../utils/getNextCounterValue");
const accountingTreeModel = require("../../../../models/accountingTreeModel");

const handleSupplierPaymentEntity = async ({
  supplier,
  companyId,
  totalMainCurrency,
  paymentInFundCurrency,
  paymentId,
  refId = "",
  date,
  description,
  currencyCode,
  paymentText,
  effectSide, // "source" | "destination"
  session,
}) => {
  const amount = Number(totalMainCurrency || 0);

  if (effectSide === "destination") {
    supplier.TotalUnpaid = Number(supplier.TotalUnpaid || 0) - amount;

    if (supplier.TotalUnpaid < 0) {
      supplier.TotalUnpaid = 0;
    }

    await supplier.save({ session });

    await createPaymentHistory(
      "payment",
      date,
      Math.abs(amount),
      Number(paymentInFundCurrency || 0),
      "supplier",
      supplier._id,
      refId,
      companyId,
      description,
      paymentId,
      paymentText,
      "",
      currencyCode,
      session
    );

    return;
  }

  if (effectSide === "source") {
    const updatedSupplier = await suppliersModel.findOneAndUpdate(
      { _id: supplier.id || supplier._id, companyId },
      { $inc: { TotalUnpaid: -amount } },
      { new: true, session }
    );

    if (!updatedSupplier) {
      throw new Error("Supplier not found");
    }

    await createPaymentHistory(
      "payment",
      date,
      Math.abs(amount),
      Number(paymentInFundCurrency || 0),
      "supplier",
      updatedSupplier._id,
      refId,
      companyId,
      description,
      paymentId,
      paymentText,
      "",
      currencyCode,
      session
    );

    return;
  }

  throw new Error("Invalid supplier effect side");
};
const handleCustomerPaymentEntity = async ({
  customer,
  companyId,
  totalMainCurrency,
  paymentInFundCurrency,
  paymentId,
  refId = "",
  date,
  description,
  currencyCode,
  paymentText,
  isWithDraw,
  session,
}) => {
  const amount = Number(totalMainCurrency || 0);
  const unpaidDelta = isWithDraw === true ? amount : -amount;

  const updatedCustomer = await customarModel.findOneAndUpdate(
    { _id: customer.id || customer._id, companyId },
    { $inc: { TotalUnpaid: unpaidDelta } },
    { new: true, session }
  );

  if (!updatedCustomer) {
    throw new Error("Customer not found");
  }

  await createPaymentHistory(
    "payment",
    date,
    Math.abs(amount),
    Number(paymentInFundCurrency || 0),
    "customer",
    updatedCustomer._id,
    refId,
    companyId,
    description,
    paymentId,
    paymentText,
    "",
    currencyCode,
    session
  );
};
const handleFundPaymentEntity = async ({
  fund,
  companyId,
  paymentInFundCurrency,
  paymentId,
  refId = "",
  date,
  description,
  paymentText,
  sourceExchangeRate = 1,
  isWithDraw,
  session,
}) => {
  const fundDelta =
    isWithDraw === true
      ? -Number(paymentInFundCurrency || 0)
      : Number(paymentInFundCurrency || 0);

  const financialFund = await financialFundsModel.findOneAndUpdate(
    { _id: fund.id || fund._id, companyId },
    { $inc: { fundBalance: fundDelta } },
    { new: true, session }
  );

  if (!financialFund) {
    throw new Error("Financial fund not found");
  }

  await ReportsFinancialFundsModel.create(
    [
      {
        date,
        amount: Number(paymentInFundCurrency || 0),
        ref: refId,
        type: paymentText,
        financialFundId: financialFund._id,
        financialFundRest: financialFund.fundBalance,
        exchangeRate: sourceExchangeRate,
        paymentType: paymentText,
        payment: paymentId,
        description,
        companyId,
      },
    ],
    { session }
  );
};

const handleAccountPaymentEntity = async ({ account, companyId, session }) => {
  const foundAccount = await accountingTreeModel
    .findOne({
      _id: account.id || account._id,
      companyId,
    })
    .session(session);

  if (!foundAccount) {
    throw new Error("Account not found");
  }

  return foundAccount;
};

const handlePurchasePayment = async (
  req,
  companyId,
  next,
  normalizedPayment
) => {
  const session = await mongoose.startSession();

  try {
    let createdPayment = null;

    await session.withTransaction(async () => {
      const {
        source,
        sourceType,
        destination,
        destinationType,
        paymentInSourceCurrency,
        sourceCurrencyCode,
        sourceExchangeRate,
        paymentInInvoiceCurrency,
        invoiceExchangeRate,
        paymentInMainCurrency,
        invoiceId,
        date,
        description,
        paymentType,
        isWithDraw,
      } = normalizedPayment;

      if (!source?.id) {
        throw new Error("Payment source is required");
      }

      if (destinationType !== "supplier") {
        throw new Error("Purchase payment destination must be supplier");
      }

      const purchase = await purchaseinvoicesModel
        .findOne({
          _id: invoiceId,
          status: { $nin: ["cancelled", "draft"] },
          companyId,
        })
        .session(session);

      if (!purchase) {
        throw new Error("Purchase invoice not found");
      }

      const supplier = await suppliersModel
        .findOne({
          _id: purchase.supllier.id,
          companyId,
        })
        .session(session);

      if (!supplier) {
        throw new Error("Supplier not found");
      }

      let paymentAmountMain = Number(paymentInMainCurrency || 0);
      let paymentAmountInvoice = Number(paymentInInvoiceCurrency || 0);

      if (
        paymentAmountMain > Number(purchase.totalRemainderMainCurrency || 0)
      ) {
        paymentAmountMain = Number(purchase.totalRemainderMainCurrency || 0);
        paymentAmountInvoice = Number(purchase.totalRemainder || 0);
      }

      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      req.body.type = "purchase";
      req.body.paymentText = "Withdrawal";

      const paymentPayload = {
        ...req.body,
        source,
        destination,
        sourceType,
        destinationType,
        totalInPaymentCurrency: paymentAmountInvoice,
        totalMainCurrency: paymentAmountMain,
        paymentInDestinationCurrency: paymentInSourceCurrency,
        destinationExchangeRate: sourceExchangeRate,
        destinationCurrencyCode: sourceCurrencyCode,
        type: "purchase",
        paymentType,
        description,
        date,
        companyId,
        counter: Number(req.body.counter || 0) + Number(paymentSeq),
        payid: [
          {
            id: purchase._id,
            status: purchase.paid,
            invoiceTotal: purchase.invoiceGrandTotal,
            invoiceName: purchase.invoiceName,
            invoiceCurrencyCode: purchase.currency?.currencyCode || "",
            paymentInFundCurrency: paymentInSourceCurrency,
            paymentMainCurrency: paymentAmountMain,
            paymentInvoiceCurrency: paymentAmountInvoice,
          },
        ],
      };

      const paymentDocs = await paymentModel.create([paymentPayload], {
        session,
      });
      const payment = paymentDocs[0];
      createdPayment = payment;

      purchase.totalRemainderMainCurrency =
        Number(purchase.totalRemainderMainCurrency || 0) - paymentAmountMain;

      purchase.totalRemainder =
        Number(purchase.totalRemainder || 0) - paymentAmountInvoice;

      if (purchase.totalRemainderMainCurrency <= 0.9) {
        purchase.paid = "paid";
        purchase.totalRemainderMainCurrency = 0;
        purchase.totalRemainder = 0;
      }

      purchase.payments.push({
        payment: Number(paymentInSourceCurrency || paymentAmountMain),
        paymentMainCurrency: paymentAmountMain,
        financialFunds: source.name,
        paymentID: payment._id,
        financialFundsCurrencyCode: sourceCurrencyCode,
        exchangeRate: sourceExchangeRate,
        date,
        paymentInInvoiceCurrency: paymentAmountInvoice,
        financialFundsId: source.id,
      });

      await purchase.save({ session });

      await createInvoiceHistory(
        companyId,
        purchase._id,
        "payment",
        req.user._id,
        date,
        `${paymentInSourceCurrency} ${sourceCurrencyCode}`,
        "invoice",
        session
      );

      await handleSupplierPaymentEntity({
        supplier,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: paymentInSourceCurrency,
        paymentId: payment._id,
        refId: purchase._id,
        date,
        description,
        currencyCode: sourceCurrencyCode,
        paymentText: "Deposit",
        effectSide: "destination",
        session,
      });

      if (sourceType === "fund") {
        await handleFundPaymentEntity({
          fund: source,
          companyId,
          paymentInFundCurrency: paymentInSourceCurrency,
          paymentId: payment._id,
          refId: purchase._id,
          date,
          description,
          paymentText: "Withdrawal",
          sourceExchangeRate,
          isWithDraw,
          session,
        });
      } else if (sourceType === "supplier") {
        const sourceSupplier = await suppliersModel
          .findOne({
            _id: source.id,
            companyId,
          })
          .session(session);

        if (!sourceSupplier) {
          throw new Error("Source supplier not found");
        }

        await handleSupplierPaymentEntity({
          supplier: sourceSupplier,
          companyId,
          totalMainCurrency: paymentAmountMain,
          paymentInFundCurrency: paymentInSourceCurrency,
          paymentId: payment._id,
          refId: purchase._id,
          date,
          description,
          currencyCode: sourceCurrencyCode,
          paymentText: "Withdrawal",
          effectSide: "source",
          session,
        });
      } else if (sourceType === "customer") {
        const sourceCustomer = await customarModel
          .findOne({
            _id: source.id,
            companyId,
          })
          .session(session);

        if (!sourceCustomer) {
          throw new Error("Source customer not found");
        }

        await handleCustomerPaymentEntity({
          customer: sourceCustomer,
          companyId,
          totalMainCurrency: paymentAmountMain,
          paymentInFundCurrency: paymentInSourceCurrency,
          paymentId: payment._id,
          refId: purchase._id,
          date,
          description,
          currencyCode: sourceCurrencyCode,
          paymentText: "Withdrawal",
          isWithDraw,
          session,
        });
      } else if (sourceType === "account") {
        await handleAccountPaymentEntity({
          account: source,
          companyId,
          session,
        });
      } else {
        throw new Error("Invalid purchase payment sourceType");
      }
    });

    return createdPayment;
  } catch (err) {
    throw err;
  } finally {
    await session.endSession();
  }
};

module.exports = { handlePurchasePayment };
