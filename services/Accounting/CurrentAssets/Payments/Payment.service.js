const paymentsModel = require("../../../../models/Accounting/CurrentAssets/payments.model");
const paymentModel = require("../../../../models/paymentModel");
const {
  handlePurchasePayment,
  handleSupplierPayment,
  handleSalesPayment,
  handleExpensePayment,
  handleCustomerPayment,
  handleFundPayment,
  handleSalaryPayment,
} = require("./Payment.handlers");

const padZero = (value) => {
  return value < 10 ? `0${value}` : value;
};

const normalizePaymentRequest = async ({ req, companyId }) => {
  req.body.companyId = companyId;

  const now = new Date();
  const formattedTime = `${padZero(now.getHours())}:${padZero(
    now.getMinutes()
  )}:${padZero(now.getSeconds())}.${String(now.getMilliseconds()).padStart(
    3,
    "0"
  )}`;

  req.body.date = `${req.body.date}T${formattedTime}Z`;

  return {
    paymentContext: req.body.paymentContext,

    companyId,
    counter: req.body.counter,
    journalCounter: req.body.journalCounter || "",
    date: req.body.date,
    description: req.body.description || "",
    file: req.body.file || "",

    party: {
      id: req.body.party?.id || "",
      name: req.body.party?.name || "",
      type: req.body.party?.type || "",
    },

    fund: {
      id: req.body.fund?.id || "",
      name: req.body.fund?.name || "",
      currencyId: req.body.fund?.currencyId || "",
      currencyCode: req.body.fund?.currencyCode || "",
      exchangeRate: Number(req.body.fund?.exchangeRate || 1),
    },

    paymentNature: req.body.paymentNature,

    payment: {
      amount: Number(req.body.payment?.amount || 0),
      currencyId: req.body.payment?.currencyId || "",
      currencyCode: req.body.payment?.currencyCode || "",
      exchangeRate: Number(req.body.payment?.exchangeRate || 1),
      amountMainCurrency: Number(req.body.payment?.amountMainCurrency || 0),
    },

    allocations: Array.isArray(req.body.allocations)
      ? req.body.allocations
      : req.body.allocations
      ? JSON.parse(req.body.allocations)
      : [],

    postedBy: req.user?._id || null,
    postedAt: new Date(),
  };
};

const paymentHandlers = {
  fund: {
    handler: handleFundPayment,
    message: "Fund payment created successfully",
  },
  supplier: {
    handler: handleSupplierPayment,
    message: "Supplier payment created successfully",
  },
  customer: {
    handler: handleCustomerPayment,
    message: "Customer payment created successfully",
  },
  purchase: {
    handler: handlePurchasePayment,
    message: "Purchase payment created successfully",
  },
  sales: {
    handler: handleSalesPayment,
    message: "Sales payment created successfully",
  },
  expense: {
    handler: handleExpensePayment,
    message: "Expense payment created successfully",
  },
  salary: {
    handler: handleSalaryPayment,
    message: "Salary payment created successfully",
  },
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

exports.getOnePaymentService = async ({ paymentId, companyId }) => {
  if (!paymentId) {
    throw new ApiError("Payment id is required", 400);
  }

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const payment = await paymentsModel
    .findOne({
      _id: paymentId,
      companyId,
    })
    .populate("postedBy", "fullName")
    .populate("cancelledBy", "fullName")
    .lean();

  if (!payment) {
    throw new ApiError("Payment not found", 404);
  }

  return payment;
};
