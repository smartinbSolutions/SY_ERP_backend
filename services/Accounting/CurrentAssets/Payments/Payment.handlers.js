const mongoose = require("mongoose");
const purchaseinvoicesModel = require("../../../../models/purchaseinvoicesModel");
const salesinvoicesModel = require("../../../../models/orderModel");

const suppliersModel = require("../../../../models/suppliersModel");
const customarModel = require("../../../../models/customarModel");
const paymentModel = require("../../../../models/Accounting/CurrentAssets/payments.model");
const financialFundsModel = require("../../../../models/Accounting/CurrentAssets/financialFundsModel");
const ReportsFinancialFundsModel = require("../../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
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
  fund,
  payment,
  paymentAmountMain,
  date,
  companyId,
  session,
}) => {
  let remainingPaymentMain = Number(paymentAmountMain || 0);
  const allocations = [];

  const purchases = await purchaseinvoicesModel
    .find({
      paid: "unpaid",
      "supllier.id": supplier._id.toString(),
      companyId,
      status: { $nin: ["draft", "cancelled"] },
    })
    .session(session);

  const expenses = await expensesModel
    .find({
      paymentStatus: "unpaid",
      "supllier.id": supplier._id.toString(),
      status: { $ne: "cancelled" },
      companyId,
    })
    .session(session);

  const openDocs = [
    ...purchases.map((purchase) => ({
      kind: "purchase_invoice",
      doc: purchase,
      sortDate: new Date(purchase.date || purchase.createdAt || 0),
      createdAt: new Date(purchase.createdAt || 0),
    })),
    ...expenses.map((expense) => ({
      kind: "other",
      doc: expense,
      sortDate: new Date(expense.date || expense.createdAt || 0),
      createdAt: new Date(expense.createdAt || 0),
    })),
  ].sort((a, b) => {
    const dateDiff = a.sortDate - b.sortDate;
    if (dateDiff !== 0) return dateDiff;
    return a.createdAt - b.createdAt;
  });
  console.log("openDocs", openDocs);
  for (const item of openDocs) {
    if (remainingPaymentMain <= 0) break;

    if (item.kind === "purchase_invoice") {
      const purchase = item.doc;

      const purchaseRemainderMain = Number(
        purchase.totalRemainderMainCurrency || 0,
      );

      if (purchaseRemainderMain <= 0) continue;

      const appliedMain = Math.min(purchaseRemainderMain, remainingPaymentMain);
      const purchaseCurrencyRate = Number(
        purchase?.currency?.exchangeRate || 1,
      );
      const appliedDocumentCurrency = appliedMain * purchaseCurrencyRate;
      const appliedFundCurrency =
        appliedMain * Number(payment?.exchangeRate || 1);

      purchase.totalRemainderMainCurrency = purchaseRemainderMain - appliedMain;
      purchase.totalRemainder =
        Number(purchase.totalRemainder || 0) - appliedDocumentCurrency;

      if (purchase.totalRemainderMainCurrency <= 0.000001) {
        purchase.totalRemainderMainCurrency = 0;
        purchase.totalRemainder = 0;
        purchase.paid = "paid";
      }

      purchase.payments.push({
        payment: appliedFundCurrency,
        paymentMainCurrency: appliedMain,
        financialFunds: fund.name,
        financialFundsCurrencyCode: fund.currencyCode,
        paymentID: payment._id,
        date,
        paymentInInvoiceCurrency: appliedDocumentCurrency,
        financialFundsId: fund.id,
      });

      await purchase.save({ session });

      allocations.push({
        documentId: purchase._id.toString(),
        documentType: "purchase_invoice",
        documentName: purchase.invoiceName || "",
        documentCounter: purchase.counter || "",
        documentCurrencyCode: purchase?.currency?.currencyCode || "",
        allocatedAmountMainCurrency: appliedMain,
        allocatedAmountDocumentCurrency: appliedDocumentCurrency,
        documentTotal: Number(purchase.invoiceGrandTotal || 0),
      });

      remainingPaymentMain -= appliedMain;
      continue;
    }

    if (item.kind === "other") {
      const expense = item.doc;

      const expenseRemainderMain = Number(
        expense.totalRemainderMainCurrency || 0,
      );

      if (expenseRemainderMain <= 0) continue;

      const appliedMain = Math.min(expenseRemainderMain, remainingPaymentMain);
      const expenseCurrencyRate = Number(expense?.currency?.exchangeRate || 1);
      const appliedDocumentCurrency = appliedMain * expenseCurrencyRate;
      const appliedFundCurrency =
        appliedMain * Number(payment?.exchangeRate || 1);

      expense.totalRemainderMainCurrency = expenseRemainderMain - appliedMain;
      expense.totalRemainder =
        Number(expense.totalRemainder || 0) - appliedDocumentCurrency;

      if (expense.totalRemainderMainCurrency <= 0.000001) {
        expense.totalRemainderMainCurrency = 0;
        expense.totalRemainder = 0;
        expense.paymentStatus = "paid";
      }

      expense.payments.push({
        payment: appliedFundCurrency,
        paymentMainCurrency: appliedMain,
        financialFunds: fund.name,
        financialFundsCurrencyCode: fund.currencyCode,
        paymentID: payment._id,
        date,
        paymentInInvoiceCurrency: appliedDocumentCurrency,
        financialFundsId: fund.id,
      });

      await expense.save({ session });

      allocations.push({
        documentId: expense._id.toString(),
        documentType: "other",
        documentName: expense.expenseName || "",
        documentCounter: expense.counter || "",
        documentCurrencyCode: expense?.currency?.currencyCode || "",
        allocatedAmountMainCurrency: appliedMain,
        allocatedAmountDocumentCurrency: appliedDocumentCurrency,
        documentTotal: Number(expense.expenceTotal || 0),
      });

      remainingPaymentMain -= appliedMain;
    }
  }

  return {
    allocations,
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
  fund,
  payment,
  paymentAmountMain,
  date,
  companyId,
  session,
}) => {
  let remainingPaymentMain = Number(paymentAmountMain || 0);
  const allocations = [];

  const salesInvoices = await salesinvoicesModel
    .find({
      paymentsStatus: "unpaid",
      "customer.id": customer._id.toString(),
      companyId,
      status: { $nin: ["draft", "cancelled"] },
    })
    .session(session);

  const openDocs = salesInvoices
    .map((invoice) => ({
      kind: "sales_invoice",
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
    const appliedDocumentCurrency = appliedMain * invoiceCurrencyRate;
    const appliedFundCurrency =
      appliedMain *
      Number(payment?.payment?.exchangeRate || payment?.exchangeRate || 1);

    invoice.totalRemainderMainCurrency = invoiceRemainderMain - appliedMain;
    invoice.totalRemainder =
      Number(invoice.totalRemainder || 0) - appliedDocumentCurrency;

    if (invoice.totalRemainderMainCurrency <= 0.000001) {
      invoice.totalRemainderMainCurrency = 0;
      invoice.totalRemainder = 0;
      invoice.paid = "paid";
      invoice.paymentsStatus = "paid";
    }

    invoice.payments.push({
      payment: appliedFundCurrency,
      paymentMainCurrency: appliedMain,
      financialFunds: fund.name,
      financialFundsCurrencyCode: fund.currencyCode,
      paymentID: payment._id,
      date,
      paymentInInvoiceCurrency: appliedDocumentCurrency,
      financialFundsId: fund.id,
    });

    await invoice.save({ session });

    allocations.push({
      documentId: invoice._id.toString(),
      documentType: "sales_invoice",
      documentName: invoice.invoiceName || "",
      documentCounter: invoice.counter || "",
      documentCurrencyCode: invoice?.currency?.currencyCode || "",
      allocatedAmountMainCurrency: appliedMain,
      allocatedAmountDocumentCurrency: appliedDocumentCurrency,
      documentTotal: Number(
        invoice.invoiceGrandTotal || invoice.invoiceGrandTotalMainCurrency || 0,
      ),
    });

    remainingPaymentMain -= appliedMain;
  }

  return {
    allocations,
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
        party,
        fund,
        paymentNature,
        payment,
        date,
        description,
        journalCounter,
        counter,
        companyId,
        postedBy,
        postedAt,
      } = normalizedPayment;

      if (!fund?.id) {
        throw new Error("Fund id is required");
      }

      if (!party?.id || !party?.type) {
        throw new Error("Party is required");
      }
      if (!["customer", "supplier"].includes(party.type)) {
        throw new Error(
          "Fund payment context supports only customer or supplier as party",
        );
      }

      if (!["incoming", "outgoing"].includes(paymentNature)) {
        throw new Error(
          "Fund payment context supports only incoming or outgoing paymentNature",
        );
      }

      const purchase = await purchaseinvoicesModel
        .findOne({
          _id: req.body.invoiceId,
          status: { $nin: ["cancelled", "draft"] },
          companyId,
        })
        .session(session);

      if (!purchase) {
        throw new Error(
          `Purchase invoice not found for id ${req.body.invoiceId}`,
        );
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

      let paymentAmountMain = Number(payment.amountMainCurrency || 0);
      let paymentAmountInvoice = Number(payment.amount || 0);

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
        companyId,
        counter: Number(counter || 0) + Number(paymentSeq),
        party: {
          id: party.id,
          name: party.name,
          type: party.type,
        },
        fund: {
          id: fund.id,
          name: fund.name,
          currencyId: fund.currencyId || "",
          currencyCode: fund.currencyCode || "",
          exchangeRate: Number(fund.exchangeRate || 1),
        },
        paymentNature,
        payment: {
          amount: Number(payment?.amount || 0),
          currencyId: payment?.currencyId || "",
          currencyCode: payment?.currencyCode || "",
          exchangeRate: Number(payment?.exchangeRate || 1),
          amountMainCurrency: Number(payment?.amountMainCurrency || 0),
        },
        date,
        description,
        journalCounter,
        file: req.body.file || "",
        allocations: [
          {
            id: purchase._id,
            status: purchase.paid,
            invoiceTotal: purchase.invoiceGrandTotal,
            invoiceName: purchase.invoiceName,
            invoiceCurrencyCode: purchase.currency?.currencyCode || "",
            paymentInFundCurrency: payment.amount,
            paymentMainCurrency: payment.amountMainCurrency,
            // paymentInvoiceCurrency: paymentAmountInvoice,
          },
        ],
        postedBy: postedBy || null,
        postedAt: postedAt || new Date(),
      };
      const paymentDocs = await paymentModel.create([paymentPayload], {
        session,
      });
      const newPayment = paymentDocs[0];

      createdPayment = paymentDocs;

      purchase.totalRemainderMainCurrency =
        Number(purchase.totalRemainderMainCurrency || 0) -
        payment.amountMainCurrency;

      purchase.totalRemainder =
        Number(purchase.totalRemainder || 0) -
        payment.amountMainCurrency * purchase?.currency?.exchangeRate;

      if (purchase.totalRemainderMainCurrency <= 0.9) {
        purchase.paid = "paid";
        purchase.totalRemainderMainCurrency = 0;
        purchase.totalRemainder = 0;
      }

      purchase.payments.push({
        payment: Number(payment.amount || paymentAmountMain),
        paymentMainCurrency: payment.amountMainCurrency || paymentAmountMain,
        financialFunds: fund.name,
        paymentID: newPayment._id,
        financialFundsCurrencyCode: fund.currencyCode,
        exchangeRate: fund.exchangeRate,
        date,
        paymentInInvoiceCurrency:
          payment.amountMainCurrency * purchase.currency.exchangeRate ||
          paymentAmountInvoice,
        financialFundsId: fund._id,
      });

      await purchase.save({ session });

      await createInvoiceHistory(
        companyId,
        purchase._id,
        "payment",
        req.user._id,
        date,
        `${payment.amount} ${fund.currencyCode}`,
        "invoice",
        session,
      );

      await handleSupplierPaymentEntity({
        supplier,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: payment.amount,
        paymentId: newPayment._id,
        refId: purchase._id,
        date,
        description,
        currencyCode: fund.currencyCode,
        paymentText: "Deposit",
        effectSide: "destination",
        session,
      });

      await handleFundPaymentEntity({
        fund: fund,
        companyId,
        paymentInFundCurrency: payment.amount,
        paymentId: newPayment._id,
        refId: purchase._id,
        date,
        description,
        paymentText: "Withdrawal",
        sourceExchangeRate: purchase.currency?.exchangeRate || 1,
        paymentNature,
        session,
      });
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
        party,
        fund,
        paymentNature,
        payment,
        date,
        description,
        journalCounter,
        counter,
        companyId,
        postedBy,
        postedAt,
      } = normalizedPayment;

      if (!fund?.id) {
        throw new Error("Payment fund is required");
      }

      if (!party?.id || !party?.type) {
        throw new Error("Party is required");
      }
      if (party.type !== "customer") {
        throw new Error("Fund payment context supports only customer as party");
      }

      if (!["incoming", "outgoing"].includes(paymentNature)) {
        throw new Error(
          "Fund payment context supports only incoming or outgoing paymentNature",
        );
      }

      const sales = await salesinvoicesModel
        .findOne({
          _id: req.body.invoiceId,
          status: { $nin: ["cancelled", "draft"] },
          companyId,
        })
        .session(session);

      if (!sales) {
        throw new Error(`Sales invoice not found for id ${req.body.invoiceId}`);
      }

      const customer = await customarModel
        .findOne({
          _id: sales.customer.id,
          companyId,
        })
        .session(session);

      if (!customer) {
        throw new Error("Customer not found");
      }

      let paymentAmountMain = Number(payment.amountMainCurrency || 0);
      let paymentAmountInvoice = Number(payment.amount || 0);

      if (paymentAmountMain > Number(sales.totalRemainderMainCurrency || 0)) {
        paymentAmountMain = Number(sales.totalRemainderMainCurrency || 0);
        paymentAmountInvoice = Number(sales.totalRemainder || 0);
      }

      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      const paymentPayload = {
        companyId,
        counter: Number(counter || 0) + Number(paymentSeq),
        party: {
          id: party.id,
          name: party.name,
          type: party.type,
        },
        fund: {
          id: fund.id,
          name: fund.name,
          currencyId: fund.currencyId || "",
          currencyCode: fund.currencyCode || "",
          exchangeRate: Number(fund.exchangeRate || 1),
        },
        paymentNature,
        payment: {
          amount: Number(payment?.amount || 0),
          currencyId: payment?.currencyId || "",
          currencyCode: payment?.currencyCode || "",
          exchangeRate: Number(payment?.exchangeRate || 1),
          amountMainCurrency: Number(payment?.amountMainCurrency || 0),
        },
        date,
        description,
        journalCounter,
        file: req.body.file || "",
        allocations: [
          {
            id: sales._id,
            status: sales.paymentsStatus,
            invoiceTotal: sales.invoiceGrandTotal,
            invoiceName: sales.invoiceName,
            invoiceCurrencyCode: sales.currency?.currencyCode || "",
            paymentInFundCurrency: payment.amount,
            paymentMainCurrency: payment.amountMainCurrency,
            // paymentInvoiceCurrency: paymentAmountInvoice,
          },
        ],
        postedBy: postedBy || null,
        postedAt: postedAt || new Date(),
      };

      const paymentDocs = await paymentModel.create([paymentPayload], {
        session,
      });
      const newPayment = paymentDocs[0];
      createdPayment = newPayment;

      sales.totalRemainderMainCurrency =
        Number(sales.totalRemainderMainCurrency || 0) - paymentAmountMain;

      sales.totalRemainder =
        Number(sales.totalRemainder || 0) -
        paymentAmountMain * sales.currency.exchangeRate;

      if (sales.totalRemainderMainCurrency <= 0.9) {
        sales.paymentsStatus = "paid";
        sales.totalRemainderMainCurrency = 0;
        sales.totalRemainder = 0;
      }

      sales.payments.push({
        payment: Number(payment.amount || paymentAmountInvoice),
        paymentMainCurrency: payment.amountMainCurrency || paymentAmountMain,
        financialFunds: fund.name,
        paymentID: newPayment._id,
        financialFundsCurrencyCode: fund.currencyCode,
        exchangeRate: fund.exchangeRate,
        date,
        paymentInInvoiceCurrency:
          payment.amountMainCurrency * sales.currency.exchangeRate ||
          paymentAmountInvoice,
        financialFundsId: fund._id,
      });

      await sales.save({ session });

      await createInvoiceHistory(
        companyId,
        sales._id,
        "payment",
        req.user._id,
        date,
        `${newPayment.amount} ${fund.currencyCode}`,
        "invoice",
        session,
      );

      await handleCustomerPaymentEntity({
        customer,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: newPayment.amount,
        paymentId: newPayment._id,
        refId: sales._id,
        date,
        description,
        currencyCode: fund.currencyCode,
        effectSide: "source",
        session,
      });

      await handleFundPaymentEntity({
        fund: fund,
        companyId,
        paymentInFundCurrency: payment.amount,
        paymentId: newPayment._id,
        refId: sales._id,
        date,
        description,
        effectSide: "destination",
        sourceExchangeRate: sales.currency?.exchangeRate || 1,
        paymentNature,
        session,
      });
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
        party,
        fund,
        paymentNature,
        payment,
        date,
        description,
        journalCounter,
        counter,
        companyId,
        postedBy,
        postedAt,
      } = normalizedPayment;
      if (!fund?.id) {
        throw new Error("Fund id is required");
      }

      if (!party?.id || !party?.type) {
        throw new Error("Party is required");
      }
      if (party.type !== "supplier") {
        throw new Error("Expense payment destination must be supplier");
      }

      const expense = await expensesModel
        .findOne({
          _id: req.body.invoiceId,
          status: { $nin: ["cancelled", "draft"] },
          companyId,
        })
        .session(session);

      if (!expense) {
        throw new Error("Expense invoice not found");
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

      let paymentAmountMain = Number(payment.amountMainCurrency || 0);
      let paymentAmountInvoice = Number(payment.amount || 0);

      if (paymentAmountMain > Number(expense.totalRemainderMainCurrency || 0)) {
        paymentAmountMain = Number(expense.totalRemainderMainCurrency || 0);
        paymentAmountInvoice = Number(expense.totalRemainder || 0);
      }

      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      const paymentPayload = {
        companyId,
        counter: Number(counter || 0) + Number(paymentSeq),
        party: {
          id: party.id,
          name: party.name,
          type: party.type,
        },
        fund: {
          id: fund.id,
          name: fund.name,
          currencyId: fund.currencyId || "",
          currencyCode: fund.currencyCode || "",
          exchangeRate: Number(fund.exchangeRate || 1),
        },
        paymentNature,
        payment: {
          amount: Number(payment?.amount || 0),
          currencyId: payment?.currencyId || "",
          currencyCode: payment?.currencyCode || "",
          exchangeRate: Number(payment?.exchangeRate || 1),
          amountMainCurrency: Number(payment?.amountMainCurrency || 0),
        },
        date,
        description,
        journalCounter,
        file: req.body.file || "",
        allocations: [
          {
            documentId: expense._id,
            documentName: expense.name,
            documentCounter: expense.counter,
            documentCurrencyCode: expense.currency?.currencyCode || "",
            allocatedAmountMainCurrency: paymentAmountMain,
            allocatedAmountDocumentCurrency: paymentAmountInvoice,
            documentTotal: expense.expenceTotal,
            documentType: "other",
          },
        ],
        postedBy: postedBy || null,
        postedAt: postedAt || new Date(),
      };

      const paymentDocs = await paymentModel.create([paymentPayload], {
        session,
      });
      const newPayment = paymentDocs[0];
      createdPayment = newPayment;

      expense.totalRemainderMainCurrency =
        Number(expense.totalRemainderMainCurrency || 0) - paymentAmountMain;

      expense.totalRemainder =
        Number(expense.totalRemainder || 0) -
        payment.amountMainCurrency * expense?.currency?.exchangeRate;

      if (expense.totalRemainderMainCurrency <= 0.9) {
        expense.paymentStatus = "paid";
        expense.totalRemainderMainCurrency = 0;
        expense.totalRemainder = 0;
      }

      expense.payments.push({
        payment: Number(payment.amount || paymentAmountMain),
        paymentMainCurrency: payment.amountMainCurrency || paymentAmountMain,
        financialFunds: fund.name,
        paymentID: newPayment._id,
        financialFundsCurrencyCode: fund.currencyCode,
        exchangeRate: fund.exchangeRate,
        date,
        paymentInInvoiceCurrency:
          payment.amountMainCurrency * expense?.currency?.exchangeRate ||
          paymentAmountInvoice,
        financialFundsId: fund._id,
      });

      await expense.save({ session });

      await createInvoiceHistory(
        companyId,
        expense._id,
        "payment",
        req.user._id,
        date,
        `${payment.amount} ${fund.currencyCode}`,
        "invoice",
        session,
      );

      await handleSupplierPaymentEntity({
        supplier,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: payment.amount,
        paymentId: newPayment._id,
        refId: expense._id,
        date,
        description,
        currencyCode: fund.currencyCode,
        paymentText: "Deposit",
        effectSide: "destination",
        session,
      });

      await handleFundPaymentEntity({
        fund: fund,
        companyId,
        paymentInFundCurrency: payment.amount,
        paymentId: newPayment._id,
        refId: expense._id,
        date,
        description,
        paymentText: "Withdrawal",
        sourceExchangeRate: expense.currency?.exchangeRate || 1,
        paymentNature,
        session,
      });
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
        paymentContext,
        fund,
        sourceType,
        party,
        paymentNature,
        paymentInFundCurrency,
        invoiceId,
        fundCurrencyCode,
        totalMainCurrency,
        fundExchangeRate,
        totalInPaymentCurrency,
        invoiceExchangeRate,
        date,
        description,
        journalCounter,
        counter,
      } = normalizedPayment;

      if (!fund?.id) {
        throw new Error("Fund id is required");
      }

      if (!party?.id || !party?.type) {
        throw new Error("Party is required");
      }

      if (!["customer", "supplier"].includes(party.type)) {
        throw new Error(
          "Fund payment context supports only customer or supplier as party",
        );
      }

      if (!["incoming", "outgoing"].includes(paymentNature)) {
        throw new Error(
          "Fund payment context supports only incoming or outgoing paymentNature",
        );
      }

      const fundDoc = await financialFundsModel
        .findOne({ _id: fund.id, companyId })
        .session(session);

      if (!fundDoc) {
        throw new Error("Fund not found");
      }

      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      const paymentPayload = {
        companyId,
        counter: Number(counter || 0) + Number(paymentSeq),

        party: {
          id: party.id,
          name: party.name,
          type: party.type,
        },

        fund: {
          id: fund.id,
          name: fund.name,
          currencyId: fund.currencyId || "",
          currencyCode: fund.currencyCode || "",
          exchangeRate: Number(fund.exchangeRate || 1),
        },

        paymentNature,

        payment: {
          amount: Number(payment?.amount || 0),
          currencyId: payment?.currencyId || "",
          currencyCode: payment?.currencyCode || "",
          exchangeRate: Number(payment?.exchangeRate || 1),
          amountMainCurrency: Number(payment?.amountMainCurrency || 0),
        },

        date,
        description,
        journalCounter,
        file: req.body.file || "",
        allocations: [],
        postedBy: postedBy || null,
        postedAt: postedAt || new Date(),
      };

      const paymentDocs = await paymentModel.create([paymentPayload], {
        session,
      });

      const paymentDoc = paymentDocs[0];
      createdPayment = paymentDoc;

      const paymentAmountMain = Number(payment?.amountMainCurrency || 0);
      const paymentAmountFundCurrency = Number(payment?.amount || 0);
      const paymentCurrencyCode = payment?.currencyCode || "";

      await handleFundPaymentEntity({
        fund: fundDoc,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: paymentAmountFundCurrency,
        paymentId: paymentDoc._id,
        refId: "",
        date,
        description,
        currencyCode: paymentCurrencyCode,
        effectSide: paymentNature === "incoming" ? "destination" : "source",
        session,
      });

      if (party.type === "customer") {
        const customer = await customarModel
          .findOne({ _id: party.id, companyId })
          .session(session);

        if (!customer) {
          throw new Error("Customer not found");
        }

        await handleCustomerPaymentEntity({
          customer,
          companyId,
          totalMainCurrency: paymentAmountMain,
          paymentInFundCurrency: paymentAmountFundCurrency,
          paymentId: paymentDoc._id,
          refId: "",
          date,
          description,
          currencyCode: paymentCurrencyCode,
          effectSide: paymentNature === "incoming" ? "source" : "destination",
          session,
        });

        if (paymentNature === "incoming") {
          const { allocations } = await settleCustomerOpenDocuments({
            customer,
            fund,
            payment: paymentDoc,
            paymentAmountMain,
            date,
            companyId,
            session,
          });

          if (allocations.length > 0) {
            paymentDoc.allocations = allocations;
            await paymentDoc.save({ session });
          }
        }
      }

      if (party.type === "supplier") {
        const supplier = await suppliersModel
          .findOne({ _id: party.id, companyId })
          .session(session);

        if (!supplier) {
          throw new Error("Supplier not found");
        }

        await handleSupplierPaymentEntity({
          supplier,
          companyId,
          totalMainCurrency: paymentAmountMain,
          paymentInFundCurrency: paymentAmountFundCurrency,
          paymentId: paymentDoc._id,
          refId: "",
          date,
          description,
          currencyCode: paymentCurrencyCode,
          effectSide: paymentNature === "incoming" ? "source" : "destination",
          session,
        });

        if (paymentNature === "outgoing") {
          const { allocations } = await settleSupplierOpenDocuments({
            supplier,
            fund,
            payment: paymentDoc,
            paymentAmountMain,
            date,
            companyId,
            session,
          });

          if (allocations.length > 0) {
            paymentDoc.allocations = allocations;
            await paymentDoc.save({ session });
          }
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
