const paymentModel = require("../../../../models/paymentModel");
const { handlePurchasePayment } = require("./Payment.handlers");

// handlers
// const { handleFundPayment } = require("./handlers/handleFundPayment");
// const { handleSupplierPayment } = require("./handlers/handleSupplierPayment");
// const { handleCustomerPayment } = require("./handlers/handleCustomerPayment");

// const { handleSalesPayment } = require("./handlers/handleSalesPayment");
// const {
//   handleRefundPurchasePayment,
// } = require("./handlers/handleRefundPurchasePayment");
// const { handleExpensePayment } = require("./handlers/handleExpensePayment");
// const { handleAccountPayment } = require("./handlers/handleAccountPayment");
// const { handleSalaryPayment } = require("./handlers/handleSalaryPayment");
// const {
//   handleRefundSalesPayment,
// } = require("./handlers/handleRefundSalesPayment");

const padZero = (value) => {
  return value < 10 ? `0${value}` : value;
};

const normalizePaymentRequest = async ({ req, companyId }) => {
  req.body.companyId = companyId;

  const now = new Date();

  const formattedDate = `${padZero(now.getHours())}:${padZero(
    now.getMinutes()
  )}:${padZero(now.getSeconds())}.${String(now.getMilliseconds()).padStart(
    3,
    "0"
  )}`;

  req.body.date = `${req.body.date}T${formattedDate}Z`;

  req.body.paymentType =
    req.body.isWithDraw === true ? "Withdrawal" : "Deposit";

  // legacy compatibility with current schema
  req.body.paymentInDestinationCurrency = req.body.paymentInFundCurrency;

  return {
    paymentContext: req.body.paymentContext,
    source: req.body.source,
    sourceType: req.body.sourceType,
    destination: req.body.destination,
    destinationType: req.body.destinationType,

    paymentInSourceCurrency: Number(req.body.paymentInFundCurrency || 0),
    sourceCurrencyCode: req.body.destinationCurrencyCode || "",
    sourceExchangeRate: Number(req.body.destinationExchangeRate || 1),

    paymentInInvoiceCurrency: Number(req.body.totalInPaymentCurrency || 0),
    invoiceExchangeRate: Number(req.body.invoiceExchangeRate || 1),

    paymentInMainCurrency: Number(req.body.totalMainCurrency || 0),

    invoiceId: req.body.invoiceId || "",
    date: req.body.date,
    description: req.body.description || "",
    paymentType: req.body.paymentType,
    isWithDraw: req.body.isWithDraw === true,
    counter: req.body.counter,
    companyId,
    journalCounter: req.body.journalCounter,
  };
};

const paymentHandlers = {
  // fund: {
  //   handler: handleFundPayment,
  //   message: "Fund payment created successfully",
  // },
  // supplier: {
  //   handler: handleSupplierPayment,
  //   message: "Supplier payment created successfully",
  // },
  // customer: {
  //   handler: handleCustomerPayment,
  //   message: "Customer payment created successfully",
  // },
  purchase: {
    handler: handlePurchasePayment,
    message: "Purchase payment created successfully",
  },
  // sales: {
  //   handler: handleSalesPayment,
  //   message: "Sales payment created successfully",
  // },
  // refundPurchase: {
  //   handler: handleRefundPurchasePayment,
  //   message: "Refund Purchase payment created successfully",
  // },
  // expense: {
  //   handler: handleExpensePayment,
  //   message: "Expense payment created successfully",
  // },
  // account: {
  //   handler: handleAccountPayment,
  //   message: "Account payment created successfully",
  // },
  // salary: {
  //   handler: handleSalaryPayment,
  //   message: "Salary payment created successfully",
  // },
  // refundSales: {
  //   handler: handleRefundSalesPayment,
  //   message: "Refund Sales payment created successfully",
  // },
};

exports.processPaymentService = async ({ req, companyId, next }) => {
  const normalizedPayment = await normalizePaymentRequest({ req, companyId });

  const route = paymentHandlers[normalizedPayment.paymentContext];

  if (!route) {
    throw new Error("Invalid paymentContext type");
  }

  const payment = await route.handler(req, companyId, next, normalizedPayment);

  return {
    message: route.message,
    payment,
  };
};
