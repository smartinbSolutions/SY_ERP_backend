const paymentsModel = require("../../../../models/Accounting/CurrentAssets/payments.model");

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
  const data = req.body.paymentData || req.body;

  const now = new Date();
  const formattedTime = `${padZero(now.getHours())}:${padZero(
    now.getMinutes()
  )}:${padZero(now.getSeconds())}.${String(now.getMilliseconds()).padStart(
    3,
    "0"
  )}`;

  const baseDate = data.date || new Date().toISOString().split("T")[0];

  const fullDate = `${baseDate}T${formattedTime}Z`;

  return {
    paymentContext: data.paymentContext,
    invoiceId: data.invoiceId || "",
    companyId,
    counter: data.counter,
    journalCounter: data.journalCounter || "",
    date: fullDate,
    description: data.description || "",
    file: data.file || "",

    party: {
      id: data.party?.id || "",
      name: data.party?.name || "",
      type: data.party?.type || "",
    },

    fund: {
      id: data.fund?.id || "",
      name: data.fund?.name || "",
      currencyId: data.fund?.currencyId || "",
      currencyCode: data.fund?.currencyCode || "",
      exchangeRate: Number(data.fund?.exchangeRate || 1),
    },

    paymentNature: data.paymentNature,

    payment: {
      amount: Number(data.payment?.amount || 0),
      currencyId: data.payment?.currencyId || "",
      currencyCode: data.payment?.currencyCode || "",
      exchangeRate: Number(data.payment?.exchangeRate || 1),
      amountMainCurrency: Number(data.payment?.amountMainCurrency || 0),
    },

    allocations: Array.isArray(data.allocations)
      ? data.allocations
      : data.allocations
      ? JSON.parse(data.allocations)
      : [],

    postedBy: req.user?._id || null,
    postedAt: new Date(),

    // stays at root (same for both shapes)
    journalAccounts: req.body.journalAccounts
      ? typeof req.body.journalAccounts === "string"
        ? JSON.parse(req.body.journalAccounts)
        : req.body.journalAccounts
      : null,
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
  console.log(normalizedPayment.paymentContext);
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

exports.getAllPaymentsService = async ({
  companyId,
  paymentNature, // "outgoing" | "incoming" | undefined (all)
  paymentContext, // "purchase" | "supplier" | "sales" etc — optional filter
  page = 1,
  limit = 20,
  dateFrom,
  dateTo,
  partyId,
}) => {
  const filter = { companyId };

  if (paymentNature) filter.paymentNature = paymentNature;
  if (paymentContext) filter.paymentContext = paymentContext;
  if (partyId) filter["party.id"] = partyId;
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) filter.date.$lte = new Date(dateTo);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await paymentsModel.countDocuments(filter);

  const payments = await paymentsModel
    .find(filter)
    .sort({ date: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("postedBy", "fullName")
    .lean();

  return {
    data: payments,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};
