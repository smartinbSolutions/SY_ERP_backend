const mongoose = require("mongoose");
const purchaseinvoicesModel = require("../../../../models/purchaseinvoicesModel");
const salesinvoicesModel = require("../../../../models/orderModel");

const suppliersModel = require("../../../../models/suppliersModel");
const customarModel = require("../../../../models/customarModel");
const paymentModel = require("../../../../models/paymentModel");
const financialFundsModel = require("../../../../models/financialFundsModel");
const ReportsFinancialFundsModel = require("../../../../models/reportsFinancialFunds");
const { createInvoiceHistory } = require("../../../invoiceHistoryService");
const {
  createPaymentHistory,
  createPaymentHistoryV2,
} = require("../../../paymentHistoryService");
const {
  getNextCounterValue,
} = require("../../../../utils/getNextCounterValue");
const accountingTreeModel = require("../../../../models/accountingTreeModel");
const expensesModel = require("../../../../models/expensesModel");

// Supplier effects

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
  effectSide,
  session,
}) => {
  const amountMainCurrency = Number(totalMainCurrency || 0);
  const amountTransactionCurrency = Number(paymentInFundCurrency || 0);
  const balanceEffectType =
    effectSide === "destination" ? "Deposit" : "Withdrawal";

  if (effectSide === "destination") {
    supplier.TotalUnpaid =
      Number(supplier.TotalUnpaid || 0) - amountMainCurrency;

    if (Number(supplier.TotalUnpaid || 0) < 0) {
      supplier.TotalUnpaid = 0;
    }

    await supplier.save({ session });

    await createPaymentHistoryV2({
      companyId,
      entryType: "payment",
      transactionDate: date,
      amountTransactionCurrency,
      amountMainCurrency,
      supplierId: supplier._id,
      referenceId: refId,
      sourceModule: "payment",
      actionType: "create",
      paymentId,
      balanceEffectType,
      description,
      transactionCurrency: currencyCode,
      session,
    });

    return;
  }

  if (effectSide === "source") {
    const updatedSupplier = await suppliersModel.findOneAndUpdate(
      { _id: supplier.id || supplier._id, companyId },
      { $inc: { TotalUnpaid: amountMainCurrency } },
      { new: true, session },
    );

    if (!updatedSupplier) {
      throw new Error("Supplier not found");
    }

    await createPaymentHistoryV2({
      companyId,
      entryType: "payment",
      transactionDate: date,
      amountTransactionCurrency,
      amountMainCurrency,
      supplierId: updatedSupplier._id,
      referenceId: refId,
      sourceModule: "payment",
      actionType: "create",
      paymentId,
      balanceEffectType,
      description,
      transactionCurrency: currencyCode,
      session,
    });

    return;
  }

  throw new Error("Invalid supplier effect side");
};

const settleSupplierOpenDocuments = async ({
  supplier,
  source,
  sourceExchangeRate,
  sourceCurrencyCode,
  payment,
  paymentAmountMain,
  date,
  companyId,
  session,
}) => {
  let remainingPaymentMain = Number(paymentAmountMain || 0);
  const payidRows = [];

  const purchases = await purchaseinvoicesModel
    .find({
      paid: "unpaid",
      "supllier.id": supplier._id.toString(),
      type: { $ne: "cancel" },
      companyId,
      status: { $ne: "draft" },
    })
    .session(session);

  const expenses = await expensesModel
    .find({
      paymentStatus: "unpaid",
      "supllier.id": supplier._id.toString(),
      companyId,
    })
    .session(session);

  const openDocs = [
    ...purchases.map((purchase) => ({
      kind: "purchase",
      doc: purchase,
      sortDate: new Date(purchase.date || purchase.createdAt || 0),
      createdAt: new Date(purchase.createdAt || 0),
    })),
    ...expenses.map((expense) => ({
      kind: "expense",
      doc: expense,
      sortDate: new Date(expense.date || expense.createdAt || 0),
      createdAt: new Date(expense.createdAt || 0),
    })),
  ].sort((a, b) => {
    const dateDiff = a.sortDate - b.sortDate;
    if (dateDiff !== 0) return dateDiff;
    return a.createdAt - b.createdAt;
  });

  for (const item of openDocs) {
    if (remainingPaymentMain <= 0) break;

    if (item.kind === "purchase") {
      const purchase = item.doc;

      const purchaseRemainderMain = Number(
        purchase.totalRemainderMainCurrency || 0,
      );

      if (purchaseRemainderMain <= 0) continue;

      const appliedMain = Math.min(purchaseRemainderMain, remainingPaymentMain);
      const purchaseCurrencyRate = Number(
        purchase?.currency?.exchangeRate || 1,
      );
      const appliedInvoice = appliedMain * purchaseCurrencyRate;
      const appliedSource = appliedMain * Number(sourceExchangeRate || 1);

      purchase.totalRemainderMainCurrency = purchaseRemainderMain - appliedMain;
      purchase.totalRemainder =
        Number(purchase.totalRemainder || 0) - appliedInvoice;

      if (purchase.totalRemainderMainCurrency <= 0.000001) {
        purchase.totalRemainderMainCurrency = 0;
        purchase.totalRemainder = 0;
        purchase.paid = "paid";
      }

      purchase.payments.push({
        payment: appliedSource,
        paymentMainCurrency: appliedMain,
        financialFunds: source.name,
        financialFundsCurrencyCode: sourceCurrencyCode,
        paymentID: payment._id,
        date,
        paymentInInvoiceCurrency: appliedInvoice,
        financialFundsId: source.id,
      });

      await purchase.save({ session });

      payidRows.push({
        id: purchase._id,
        status: purchase.paid,
        paymentInFundCurrency: appliedSource,
        paymentMainCurrency: appliedMain,
        invoiceTotal: purchase.totalPurchasePriceMainCurrency,
        invoiceName: purchase.invoiceName,
        invoiceCurrencyCode: purchase?.currency?.currencyCode || "N/A",
        invoiceType: "purchase",
        paymentInvoiceCurrency: appliedInvoice,
      });

      remainingPaymentMain -= appliedMain;
      continue;
    }

    if (item.kind === "expense") {
      const expense = item.doc;

      const expenseRemainderMain = Number(
        expense.totalRemainderMainCurrency || 0,
      );

      if (expenseRemainderMain <= 0) continue;

      const appliedMain = Math.min(expenseRemainderMain, remainingPaymentMain);
      const expenseCurrencyRate = Number(expense?.currency?.exchangeRate || 1);
      const appliedInvoice = appliedMain * expenseCurrencyRate;
      const appliedSource = appliedMain * Number(sourceExchangeRate || 1);

      expense.totalRemainderMainCurrency = expenseRemainderMain - appliedMain;
      expense.totalRemainder =
        Number(expense.totalRemainder || 0) - appliedInvoice;

      if (expense.totalRemainderMainCurrency <= 0.000001) {
        expense.totalRemainderMainCurrency = 0;
        expense.totalRemainder = 0;
        expense.paymentStatus = "paid";
      }

      expense.payments.push({
        payment: appliedSource,
        paymentMainCurrency: appliedMain,
        financialFunds: source.name,
        financialFundsCurrencyCode: sourceCurrencyCode,
        paymentID: payment._id,
        date,
        paymentInInvoiceCurrency: appliedInvoice,
        financialFundsId: source.id,
      });

      await expense.save({ session });

      payidRows.push({
        id: expense._id,
        status: expense.paymentStatus,
        paymentInFundCurrency: appliedSource,
        paymentMainCurrency: appliedMain,
        invoiceTotal: expense.expenceTotalMainCurrency,
        invoiceName: expense.expenseName,
        invoiceCurrencyCode: expense?.currency?.currencyCode || "N/A",
        invoiceType: "expense",
        paymentInvoiceCurrency: appliedInvoice,
      });

      remainingPaymentMain -= appliedMain;
    }
  }

  return {
    payidRows,
    remainingPaymentMain,
  };
};

// Customer effects

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
  effectSide,
  session,
}) => {
  const amountMainCurrency = Number(totalMainCurrency || 0);
  const amountTransactionCurrency = Number(paymentInFundCurrency || 0);

  if (effectSide === "destination") {
    const updatedCustomer = await customarModel.findOneAndUpdate(
      { _id: customer.id || customer._id, companyId },
      { $inc: { TotalUnpaid: -amountMainCurrency } },
      { new: true, session },
    );
    console.log(updatedCustomer);

    if (!updatedCustomer) {
      throw new Error("Customer not found");
    }

    // if (Number(customer.TotalUnpaid || 0) < 0) {
    //   updatedCustomer.TotalUnpaid = 0;
    //   await updatedCustomer.save({ session });
    // }

    await createPaymentHistoryV2({
      companyId,
      entryType: "payment",
      transactionDate: date,
      amountTransactionCurrency,
      amountMainCurrency,
      customerId: updatedCustomer._id,
      referenceId: refId,
      sourceModule: "payment",
      actionType: "create",
      paymentId,
      balanceEffectType: "Deposit",
      description,
      transactionCurrency: currencyCode,
      session,
    });

    return;
  }

  if (effectSide === "source") {
    const updatedCustomer = await customarModel.findOneAndUpdate(
      { _id: customer.id || customer._id, companyId },
      { $inc: { TotalUnpaid: +amountMainCurrency } },
      { new: true, session },
    );

    if (!updatedCustomer) {
      throw new Error("Customer not found");
    }

    await createPaymentHistoryV2({
      companyId,
      entryType: "payment",
      transactionDate: date,
      amountTransactionCurrency,
      amountMainCurrency,
      customerId: updatedCustomer._id,
      referenceId: refId,
      sourceModule: "payment",
      actionType: "create",
      paymentId,
      balanceEffectType: "Withdrawal",
      description,
      transactionCurrency: currencyCode,
      session,
    });

    return;
  }

  throw new Error("Invalid customer effect side");
};

const settleCustomerOpenDocuments = async ({
  customer,
  source,
  sourceExchangeRate,
  sourceCurrencyCode,
  payment,
  paymentAmountMain,
  date,
  companyId,
  session,
}) => {
  let remainingPaymentMain = Number(paymentAmountMain || 0);
  const payidRows = [];
  console.log("I am here now");
  const salesInvoices = await salesinvoicesModel
    .find({
      paymentsStatus: "unpaid",
      "customer.id": customer._id.toString(),
      type: { $ne: "cancel" },
      companyId,
      // status: { $nin: ["draft", "Draft"] },
    })
    .session(session);

  const openDocs = salesInvoices
    .map((invoice) => ({
      kind: "sales",
      doc: invoice,
      sortDate: new Date(invoice.date || invoice.createdAt || 0),
      createdAt: new Date(invoice.createdAt || 0),
    }))
    .sort((a, b) => {
      const dateDiff = a.sortDate - b.sortDate;
      if (dateDiff !== 0) return dateDiff;
      return a.createdAt - b.createdAt;
    });

  for (const item of openDocs) {
    if (remainingPaymentMain <= 0) break;

    const invoice = item.doc;

    const invoiceRemainderMain = Number(
      invoice.totalRemainderMainCurrency || 0,
    );

    if (invoiceRemainderMain <= 0) continue;

    const appliedMain = Math.min(invoiceRemainderMain, remainingPaymentMain);
    const invoiceCurrencyRate = Number(invoice?.currency?.exchangeRate || 1);
    const appliedInvoice = appliedMain * invoiceCurrencyRate;
    const appliedSource = appliedMain * Number(sourceExchangeRate || 1);

    invoice.totalRemainderMainCurrency = invoiceRemainderMain - appliedMain;
    invoice.totalRemainder =
      Number(invoice.totalRemainder || 0) - appliedInvoice;

    if (invoice.totalRemainderMainCurrency <= 0.000001) {
      invoice.totalRemainderMainCurrency = 0;
      invoice.totalRemainder = 0;
      invoice.paid = "paid";
    }

    invoice.payments.push({
      payment: appliedSource,
      paymentMainCurrency: appliedMain,
      financialFunds: source.name,
      financialFundsCurrencyCode: sourceCurrencyCode,
      paymentID: payment._id,
      date,
      paymentInInvoiceCurrency: appliedInvoice,
      financialFundsId: source.id,
    });

    await invoice.save({ session });

    payidRows.push({
      id: invoice._id,
      status: invoice.paid,
      paymentInFundCurrency: appliedSource,
      paymentMainCurrency: appliedMain,
      invoiceTotal: invoice.invoiceGrandTotalMainCurrency,
      invoiceName: invoice.invoiceName,
      invoiceCurrencyCode: invoice?.currency?.currencyCode || "N/A",
      invoiceType: "sale",
      paymentInvoiceCurrency: appliedInvoice,
    });

    remainingPaymentMain -= appliedMain;
  }

  return {
    payidRows,
    remainingPaymentMain,
  };
};

// Fund effects
const handleFundPaymentEntity = async ({
  fund,
  companyId,
  paymentInFundCurrency,
  paymentId,
  refId = "",
  date,
  description,
  effectSide, // "source" | "destination"
  sourceExchangeRate = 1,
  session,
}) => {
  const paymentText = effectSide === "destination" ? "Deposit" : "Withdrawal";

  const fundDelta =
    effectSide === "destination"
      ? Number(paymentInFundCurrency || 0)
      : -Number(paymentInFundCurrency || 0);

  const financialFund = await financialFundsModel.findOneAndUpdate(
    { _id: fund.id || fund._id, companyId },
    { $inc: { fundBalance: fundDelta } },
    { new: true, session },
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
    { session },
  );
};

// Account effects
const handleAccountPaymentEntity = async ({
  account,
  companyId,
  effectSide, // keep for consistency even if unused for now
  session,
}) => {
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

// handelrs
const handlePurchasePayment = async (
  req,
  companyId,
  next,
  normalizedPayment,
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
        session,
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
          effectSide: "source",
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

const handleSupplierPayment = async (
  req,
  companyId,
  next,
  normalizedPayment,
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
        paymentInMainCurrency,
        date,
        description,
        paymentType,
      } = normalizedPayment;

      const isSupplierDestination = destinationType === "supplier";
      const isSupplierSource = sourceType === "supplier";

      if (!isSupplierDestination && !isSupplierSource) {
        throw new Error(
          "Supplier payment context requires supplier as source or destination",
        );
      }

      const supplierId = isSupplierDestination ? destination?.id : source?.id;

      if (!supplierId) {
        throw new Error("Supplier id is required");
      }

      if (!source?.id || !destination?.id) {
        throw new Error("Source and destination are required");
      }

      const supplier = await suppliersModel
        .findOne({ _id: supplierId, companyId })
        .session(session);

      if (!supplier) {
        throw new Error("Supplier not found");
      }

      const paymentAmountMain = Number(paymentInMainCurrency || 0);
      const paymentAmountInvoice = Number(paymentInInvoiceCurrency || 0);
      const paymentAmountSource = Number(paymentInSourceCurrency || 0);

      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      req.body.type = "supplier";
      req.body.paymentText = paymentType;

      const paymentPayload = {
        ...req.body,
        source,
        destination,
        sourceType,
        destinationType,
        totalInPaymentCurrency: paymentAmountInvoice,
        totalMainCurrency: paymentAmountMain,
        paymentInDestinationCurrency: paymentAmountSource, // legacy field
        destinationExchangeRate: sourceExchangeRate, // legacy field
        destinationCurrencyCode: sourceCurrencyCode, // legacy field
        type: "supplier",
        paymentType,
        description,
        date,
        companyId,
        counter: Number(req.body.counter || 0) + Number(paymentSeq),
        payid: [],
      };

      const paymentDocs = await paymentModel.create([paymentPayload], {
        session,
      });
      const payment = paymentDocs[0];
      createdPayment = payment;

      /*
        |--------------------------------------------------------------------------
        | SUPPLIER SIDE EFFECT
        |--------------------------------------------------------------------------
        */
      await handleSupplierPaymentEntity({
        supplier,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: paymentAmountSource,
        paymentId: payment._id,
        refId: "",
        date,
        description,
        currencyCode: sourceCurrencyCode,
        effectSide: isSupplierDestination ? "destination" : "source",
        session,
      });

      /*
        |--------------------------------------------------------------------------
        | IF SUPPLIER IS DESTINATION, SETTLE OPEN PURCHASES + EXPENSES
        |--------------------------------------------------------------------------
        */
      if (isSupplierDestination) {
        const { payidRows } = await settleSupplierOpenDocuments({
          supplier,
          source,
          sourceExchangeRate,
          sourceCurrencyCode,
          payment,
          paymentAmountMain,
          date,
          companyId,
          session,
        });

        payment.payid = payidRows;
        await payment.save({ session });
      }

      /*
        |--------------------------------------------------------------------------
        | OPPOSITE SIDE ENTITY EFFECT
        |--------------------------------------------------------------------------
        */
      if (isSupplierDestination) {
        if (sourceType === "fund") {
          await handleFundPaymentEntity({
            fund: source,
            companyId,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            effectSide: "source",
            sourceExchangeRate,
            session,
          });
        } else if (sourceType === "customer") {
          const customer = await customarModel
            .findOne({ _id: source.id, companyId })
            .session(session);

          if (!customer) {
            throw new Error("Customer not found");
          }
          console.log("I am here");
          await handleCustomerPaymentEntity({
            customer,
            companyId,
            totalMainCurrency: paymentAmountMain,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            currencyCode: sourceCurrencyCode,
            effectSide: "source",
            session,
          });
          console.log("I am here too");
          const { payidRows } = await settleCustomerOpenDocuments({
            customer,
            source,
            sourceExchangeRate,
            sourceCurrencyCode,
            payment,
            paymentAmountMain,
            date,
            companyId,
            session,
          });

          payment.payid = payidRows;
          await payment.save({ session });
        } else if (sourceType === "account") {
          await handleAccountPaymentEntity({
            account: source,
            companyId,
            effectSide: "source",
            session,
          });
        } else {
          throw new Error("Invalid supplier payment sourceType");
        }
      } else {
        if (destinationType === "fund") {
          await handleFundPaymentEntity({
            fund: destination,
            companyId,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            effectSide: "destination",
            sourceExchangeRate,
            session,
          });
        } else if (destinationType === "customer") {
          const customer = await customarModel
            .findOne({ _id: destination.id, companyId })
            .session(session);

          if (!customer) {
            throw new Error("Customer not found");
          }

          await handleCustomerPaymentEntity({
            customer,
            companyId,
            totalMainCurrency: paymentAmountMain,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            currencyCode: sourceCurrencyCode,
            effectSide: "destination",
            session,
          });
        } else if (destinationType === "account") {
          await handleAccountPaymentEntity({
            account: destination,
            companyId,
            effectSide: "destination",
            session,
          });
        } else {
          throw new Error("Invalid supplier payment destinationType");
        }
      }
    });

    return createdPayment;
  } catch (err) {
    throw err;
  } finally {
    await session.endSession();
  }
};

const handleSalesPayment = async (req, companyId, next, normalizedPayment) => {
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

      if (destinationType !== "customer") {
        throw new Error("Order payment destination must be customer");
      }

      const order = await salesinvoicesModel
        .findOne({
          _id: invoiceId,
          status: { $nin: ["cancelled", "draft"] },
          companyId,
        })
        .session(session);

      if (!order) {
        throw new Error("Order invoice not found");
      }

      const customer = await customarModel
        .findOne({
          _id: order.customer.id,
          companyId,
        })
        .session(session);

      if (!customer) {
        throw new Error("Customer not found");
      }

      let paymentAmountMain = Number(paymentInMainCurrency || 0);
      let paymentAmountInvoice = Number(paymentInInvoiceCurrency || 0);

      if (paymentAmountMain > Number(order.totalRemainderMainCurrency || 0)) {
        paymentAmountMain = Number(order.totalRemainderMainCurrency || 0);
        paymentAmountInvoice = Number(order.totalRemainder || 0);
      }

      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      req.body.type = "sales";
      req.body.paymentText = "Deposit";

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
        type: "sales",
        paymentType,
        description,
        date,
        companyId,
        counter: Number(req.body.counter || 0) + Number(paymentSeq),
        payid: [
          {
            id: order._id,
            status: order.paymentsStatus,
            invoiceTotal: order.invoiceGrandTotal,
            invoiceName: order.invoiceName,
            invoiceCurrencyCode: order.currency?.currencyCode || "",
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

      order.totalRemainderMainCurrency =
        Number(order.totalRemainderMainCurrency || 0) - paymentAmountMain;

      order.totalRemainder =
        Number(order.totalRemainder || 0) - paymentAmountInvoice;

      if (order.totalRemainderMainCurrency <= 0.9) {
        order.paymentsStatus = "paid";
        order.totalRemainderMainCurrency = 0;
        order.totalRemainder = 0;
      }

      order.payments.push({
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

      await order.save({ session });

      await createInvoiceHistory(
        companyId,
        order._id,
        "payment",
        req.user._id,
        date,
        `${paymentInSourceCurrency} ${sourceCurrencyCode}`,
        "invoice",
        session,
      );

      await handleCustomerPaymentEntity({
        customer,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: paymentInSourceCurrency,
        paymentId: payment._id,
        refId: order._id,
        date,
        description,
        currencyCode: sourceCurrencyCode,
        paymentText: "Withdrawal",
        effectSide: "destination",
        session,
      });

      if (sourceType === "fund") {
        await handleFundPaymentEntity({
          fund: source,
          companyId,
          paymentInFundCurrency: paymentInSourceCurrency,
          paymentId: payment._id,
          refId: order._id,
          date,
          description,
          effectSide: "destination",
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
          refId: order._id,
          date,
          description,
          currencyCode: sourceCurrencyCode,
          paymentText: "Withdrawal",
          effectSide: "destination",
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
          refId: order._id,
          date,
          description,
          currencyCode: sourceCurrencyCode,
          effectSide: "destination",
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

const handleExpensePayment = async (
  req,
  companyId,
  next,
  normalizedPayment,
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

      const expense = await expensesModel
        .findOne({
          _id: invoiceId,
          status: { $nin: ["cancelled", "draft"] },
          companyId,
        })
        .session(session);

      if (!expense) {
        throw new Error("Purchase invoice not found");
      }

      const supplier = await suppliersModel
        .findOne({
          _id: expense.supllier.id,
          companyId,
        })
        .session(session);

      if (!supplier) {
        throw new Error("Supplier not found");
      }

      let paymentAmountMain = Number(paymentInMainCurrency || 0);
      let paymentAmountInvoice = Number(paymentInInvoiceCurrency || 0);

      if (paymentAmountMain > Number(expense.totalRemainderMainCurrency || 0)) {
        paymentAmountMain = Number(expense.totalRemainderMainCurrency || 0);
        paymentAmountInvoice = Number(expense.totalRemainder || 0);
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
        type: "expense",
        paymentType,
        description,
        date,
        companyId,
        counter: Number(req.body.counter || 0) + Number(paymentSeq),
        payid: [
          {
            id: expense._id,
            status: expense.paymentStatus,
            invoiceTotal: expense.expenceTotal,
            invoiceName: expense.expenseName,
            invoiceCurrencyCode: expense.currency?.currencyCode || "",
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

      expense.totalRemainderMainCurrency =
        Number(expense.totalRemainderMainCurrency || 0) - paymentAmountMain;

      expense.totalRemainder =
        Number(expense.totalRemainder || 0) - paymentAmountInvoice;

      if (expense.totalRemainderMainCurrency <= 0.9) {
        expense.paymentStatus = "paid";
        expense.totalRemainderMainCurrency = 0;
        expense.totalRemainder = 0;
      }

      expense.payments.push({
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

      await expense.save({ session });

      await createInvoiceHistory(
        companyId,
        expense._id,
        "payment",
        req.user._id,
        date,
        `${paymentInSourceCurrency} ${sourceCurrencyCode}`,
        "invoice",
        session,
      );

      await handleSupplierPaymentEntity({
        supplier,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: paymentInSourceCurrency,
        paymentId: payment._id,
        refId: expense._id,
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
          refId: expense._id,
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
          refId: expense._id,
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
          refId: expense._id,
          date,
          description,
          currencyCode: sourceCurrencyCode,
          effectSide: "source",
          session,
        });
      } else if (sourceType === "account") {
        await handleAccountPaymentEntity({
          account: source,
          companyId,
          session,
        });
      } else {
        throw new Error("Invalid expense payment sourceType");
      }
    });

    return createdPayment;
  } catch (err) {
    throw err;
  } finally {
    await session.endSession();
  }
};

const handleCustomerPayment = async (
  req,
  companyId,
  next,
  normalizedPayment,
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
        paymentInMainCurrency,
        date,
        description,
        paymentType,
      } = normalizedPayment;

      const isCustomerDestination = destinationType === "customer";
      const isCustomerSource = sourceType === "customer";

      if (!isCustomerDestination && !isCustomerSource) {
        throw new Error(
          "Customer payment context requires customer as source or destination",
        );
      }

      const customerId = isCustomerDestination ? destination?.id : source?.id;

      if (!customerId) {
        throw new Error("Customer id is required");
      }

      if (!source?.id || !destination?.id) {
        throw new Error("Source and destination are required");
      }

      const customer = await customarModel
        .findOne({ _id: customerId, companyId })
        .session(session);

      if (!customer) {
        throw new Error("Customer not found");
      }

      const paymentAmountMain = Number(paymentInMainCurrency || 0);
      const paymentAmountInvoice = Number(paymentInInvoiceCurrency || 0);
      const paymentAmountSource = Number(paymentInSourceCurrency || 0);

      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      req.body.type = "customer";
      req.body.paymentText = paymentType;

      const paymentPayload = {
        ...req.body,
        source,
        destination,
        sourceType,
        destinationType,
        totalInPaymentCurrency: paymentAmountInvoice,
        totalMainCurrency: paymentAmountMain,
        paymentInDestinationCurrency: paymentAmountSource, // legacy field
        destinationExchangeRate: sourceExchangeRate, // legacy field
        destinationCurrencyCode: sourceCurrencyCode, // legacy field
        type: "customer",
        paymentType,
        description,
        date,
        companyId,
        counter: Number(req.body.counter || 0) + Number(paymentSeq),
        payid: [],
      };

      const paymentDocs = await paymentModel.create([paymentPayload], {
        session,
      });
      const payment = paymentDocs[0];
      createdPayment = payment;

      await handleCustomerPaymentEntity({
        customer,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: paymentAmountSource,
        paymentId: payment._id,
        refId: "",
        date,
        description,
        currencyCode: sourceCurrencyCode,
        effectSide: isCustomerDestination ? "destination" : "source",
        session,
      });

      /*
        |--------------------------------------------------------------------------
        | IF SUPPLIER IS DESTINATION, SETTLE OPEN PURCHASES + EXPENSES
        |--------------------------------------------------------------------------
        */
      if (isCustomerDestination) {
        const { payidRows } = await settleCustomerOpenDocuments({
          customer,
          source,
          sourceExchangeRate,
          sourceCurrencyCode,
          payment,
          paymentAmountMain,
          date,
          companyId,
          session,
        });

        payment.payid = payidRows;
        await payment.save({ session });
      }

      /*
        |--------------------------------------------------------------------------
        | OPPOSITE SIDE ENTITY EFFECT
        |--------------------------------------------------------------------------
        */
      if (isCustomerDestination) {
        if (sourceType === "fund") {
          await handleFundPaymentEntity({
            fund: source,
            companyId,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            effectSide: "source",
            sourceExchangeRate,
            session,
          });
        } else if (sourceType === "supplier") {
          const supplier = await suppliersModel
            .findOne({ _id: source.id, companyId })
            .session(session);

          if (!supplier) {
            throw new Error("Supplier not found");
          }
          await handleSupplierPaymentEntity({
            supplier,
            companyId,
            totalMainCurrency: paymentAmountMain,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            currencyCode: sourceCurrencyCode,
            effectSide: "source",
            session,
          });
          console.log("I am here too");
          const { payidRows } = await settleSupplierOpenDocuments({
            supplier,
            source,
            sourceExchangeRate,
            sourceCurrencyCode,
            payment,
            paymentAmountMain,
            date,
            companyId,
            session,
          });

          payment.payid = payidRows;
          await payment.save({ session });
        } else if (sourceType === "account") {
          await handleAccountPaymentEntity({
            account: source,
            companyId,
            effectSide: "source",
            session,
          });
        } else {
          throw new Error("Invalid supplier payment sourceType");
        }
      } else {
        if (destinationType === "fund") {
          await handleFundPaymentEntity({
            fund: destination,
            companyId,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            effectSide: "destination",
            sourceExchangeRate,
            session,
          });
        } else if (destinationType === "supplier") {
          const supplier = await suppliersModel
            .findOne({ _id: destination.id, companyId })
            .session(session);

          if (!supplier) {
            throw new Error("Supplier not found");
          }

          await handleSupplierPaymentEntity({
            supplier,
            companyId,
            totalMainCurrency: paymentAmountMain,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            currencyCode: sourceCurrencyCode,
            effectSide: "destination",
            session,
          });
        } else if (destinationType === "account") {
          await handleAccountPaymentEntity({
            account: destination,
            companyId,
            effectSide: "destination",
            session,
          });
        } else {
          throw new Error("Invalid supplier payment destinationType");
        }
      }
    });

    return createdPayment;
  } catch (err) {
    throw err;
  } finally {
    await session.endSession();
  }
};

const handleFundPayment = async (req, companyId, next, normalizedPayment) => {
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
        paymentInMainCurrency,
        date,
        description,
        paymentType,
      } = normalizedPayment;

      const isFundAndBankDestination = destinationType === "fund";
      const isFundAndBankSource = sourceType === "fund";

      if (!isFundAndBankDestination && !isFundAndBankSource) {
        throw new Error(
          "Fund payment context requires fund as source or destination",
        );
      }
      const fundId = isFundAndBankDestination ? destination?.id : source?.id;

      if (!fundId) {
        throw new Error("Fund Or Bank id is required");
      }
      if (!source?.id || !destination?.id) {
        throw new Error("Source and destination are required");
      }
      const fundAndBank = await financialFundsModel
        .findOne({ _id: fundId, companyId })
        .session(session);

      if (!fundAndBank) {
        throw new Error("Fund Or Bank not found");
      }
      const paymentAmountMain = Number(paymentInMainCurrency || 0);
      const paymentAmountInvoice = Number(paymentInInvoiceCurrency || 0);
      const paymentAmountSource = Number(paymentInSourceCurrency || 0);
      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });
      req.body.type = "fund";
      req.body.paymentText = paymentType;

      const paymentPayload = {
        ...req.body,
        source,
        destination,
        sourceType,
        destinationType,
        totalInPaymentCurrency: paymentAmountInvoice,
        totalMainCurrency: paymentAmountMain,
        paymentInDestinationCurrency: paymentAmountSource, // legacy field
        destinationExchangeRate: sourceExchangeRate, // legacy field
        destinationCurrencyCode: sourceCurrencyCode, // legacy field
        type: "fund",
        paymentType,
        description,
        date,
        companyId,
        counter: Number(req.body.counter || 0) + Number(paymentSeq),
        payid: [],
      };

      const paymentDocs = await paymentModel.create([paymentPayload], {
        session,
      });

      const payment = paymentDocs[0];
      createdPayment = payment;

      await handleFundPaymentEntity({
        fund: fundAndBank,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: paymentAmountSource,
        paymentId: payment._id,
        refId: "",
        date,
        description,
        currencyCode: sourceCurrencyCode,
        effectSide: isFundAndBankDestination ? "destination" : "source",
        session,
      });

      if (isFundAndBankDestination) {
        if (sourceType === "customer") {
          const customer = await customarModel
            .findOne({ _id: source.id, companyId })
            .session(session);

          if (!customer) {
            throw new Error("Customer not found");
          }
          await handleCustomerPaymentEntity({
            customer,
            companyId,
            totalMainCurrency: paymentAmountMain,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            currencyCode: sourceCurrencyCode,
            effectSide: "source",
            session,
          });
        } else if (sourceType === "supplier") {
          const supplier = await suppliersModel
            .findOne({ _id: source.id, companyId })
            .session(session);

          if (!supplier) {
            throw new Error("Supplier not found");
          }
          await handleSupplierPaymentEntity({
            supplier,
            companyId,
            totalMainCurrency: paymentAmountMain,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            currencyCode: sourceCurrencyCode,
            effectSide: "source",
            session,
          });
        } else if (sourceType === "account") {
          await handleAccountPaymentEntity({
            account: source,
            companyId,
            effectSide: "source",
            session,
          });
        } else {
          throw new Error("Invalid supplier payment sourceType");
        }
      } else {
        if (destinationType === "customer") {
          const customer = await customarModel
            .findOne({ _id: destination.id, companyId })
            .session(session);

          if (!customer) {
            throw new Error("Supplier not found");
          }

          await handleCustomerPaymentEntity({
            customer,
            companyId,
            totalMainCurrency: paymentAmountMain,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            currencyCode: sourceCurrencyCode,
            effectSide: "destination",
            session,
          });
        } else if (destinationType === "supplier") {
          const supplier = await suppliersModel
            .findOne({ _id: destination.id, companyId })
            .session(session);

          if (!supplier) {
            throw new Error("Supplier not found");
          }

          await handleSupplierPaymentEntity({
            supplier,
            companyId,
            totalMainCurrency: paymentAmountMain,
            paymentInFundCurrency: paymentAmountSource,
            paymentId: payment._id,
            refId: "",
            date,
            description,
            currencyCode: sourceCurrencyCode,
            effectSide: "destination",
            session,
          });
        } else if (destinationType === "account") {
          await handleAccountPaymentEntity({
            account: destination,
            companyId,
            effectSide: "destination",
            session,
          });
        } else {
          throw new Error("Invalid supplier payment destinationType");
        }
      }
    });
  } catch (err) {
    throw err;
  } finally {
    await session.endSession();
  }
};

const handleSalaryPayment = async (req, companyId, next, normalizedPayment) => {
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
        totalInPaymentCurrency,
        invoiceId,
        date,
        description,
        paymentType,
        isWithDraw,
        totalMainCurrency,
      } = normalizedPayment;

      console.log(source);

      if (!source?.id) {
        throw new Error("Payment source is required");
      }

      if (destinationType !== "salary") {
        throw new Error("Staff payment destination must be salary");
      }

      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      req.body.type = "salary";
      req.body.paymentText = "Withdrawal";

      const paymentPayload = {
        ...req.body,
        source,
        destination,
        sourceType,
        destinationType,
        totalInPaymentCurrency: totalInPaymentCurrency,
        totalMainCurrency: totalMainCurrency,
        paymentInDestinationCurrency: paymentInSourceCurrency,
        destinationExchangeRate: sourceExchangeRate,
        destinationCurrencyCode: sourceCurrencyCode,
        type: "salary",
        paymentType,
        description,
        date,
        companyId,
        counter: Number(req.body.counter || 0) + Number(paymentSeq),
      };

      const paymentDocs = await paymentModel.create([paymentPayload], {
        session,
      });
      const payment = paymentDocs[0];
      createdPayment = payment;

      if (sourceType === "fund") {
        await handleFundPaymentEntity({
          fund: source,
          companyId,
          paymentInFundCurrency: paymentInSourceCurrency,
          paymentId: payment._id,
          refId: destination.id,
          date,
          description,
          paymentText: "Withdrawal",
          sourceExchangeRate,
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
        throw new Error("Invalid expense payment sourceType");
      }
    });
  } catch (err) {
    throw err;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  handlePurchasePayment,
  handleSupplierPayment,
  handleSalesPayment,
  handleExpensePayment,
  handleCustomerPayment,
  handleFundPayment,
  handleSalaryPayment,
};
