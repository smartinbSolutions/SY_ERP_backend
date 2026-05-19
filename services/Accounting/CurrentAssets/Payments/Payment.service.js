const paymentsModel = require("../../../../models/Accounting/CurrentAssets/payments.model");
const journalEntryModel = require("../../../../models/journalEntryModel");
const counterModel = require("../../../../models/Settings/counterModel");
const { createPaymentHistoryV2 } = require("../../../paymentHistoryService");
const {
  createJournalEntryService,
} = require("../../JournalEntries/journalEntries.Service");

const {
  handlePurchasePayment,
  handleSupplierPayment,
  handleSalesPayment,
  handleExpensePayment,
  handleCustomerPayment,
  handleFundPayment,
  handleSalaryPayment,
  handleFundPaymentEntity,
  buildReversalJournal,
  reverseAllocation,
  handlePurchaseRefundPayment,
} = require("./Payment.handlers");

const PAYMENT_ACCOUNT_TYPES = [
  "Supplier_Payment",
  "Customer_Payment",
  "Cash",
  "FX_Loss",
  "FX_Gain",
];

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
      fundToInvoiceRate: Number(data?.payment?.fundToInvoiceRate || 1),
      amountMainCurrency: Number(data.payment?.amountMainCurrency || 0),
      amountInvoiceCurrency: Number(data.payment?.amountInvoiceCurrency || 0),
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
  refund_purchase: {
    handler: handlePurchaseRefundPayment,
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
  console.log("normalizedPayment", normalizedPayment);
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
    .populate("postedBy", "name")
    .populate("cancelledBy", "name")
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

exports.cancelPaymentService = async ({
  paymentId,
  companyId,
  userId,
  reason = "",
  session,
}) => {
  // ── Step 1 — Validate ──────────────────────────────────────────
  const payment = await paymentsModel
    .findOne({ _id: paymentId, companyId })
    .session(session);

  if (!payment) throw new ApiError("Payment not found", 404);
  if (payment.status === "cancelled")
    throw new ApiError("Payment is already cancelled", 400);
  if (payment.auditing === true)
    throw new ApiError("Audited payment cannot be cancelled", 400);

  const padZero = (v) => String(v).padStart(2, "0");
  const now = new Date();
  const formattedTime = `${padZero(now.getHours())}:${padZero(
    now.getMinutes()
  )}:${padZero(now.getSeconds())}.${String(now.getMilliseconds()).padStart(
    3,
    "0"
  )}`;
  const today = now.toISOString().split("T")[0];
  const cancelDate = `${today}T${formattedTime}Z`;

  const isOutgoing = payment.paymentNature === "outgoing";
  const isCash = !payment.party?.id;
  const amountFund = Number(payment.payment?.amount || 0);
  const amountMain = Number(payment.payment?.amountMainCurrency || 0);

  console.log("========================================");
  console.log("   CANCEL PAYMENT");
  console.log("========================================");
  console.log(`   Counter:     ${payment.counter}`);
  console.log(`   Nature:      ${payment.paymentNature}`);
  console.log(
    `   Amount:      ${amountMain} USD (${amountFund} ${payment.fund?.currencyCode})`
  );
  console.log(
    `   Party:       ${payment.party?.name || "Cash"} (${
      payment.party?.type || "none"
    })`
  );
  console.log(`   Allocations: ${payment.allocations?.length || 0}`);
  console.log("========================================\n");

  // ── Step 2 — Reverse fund effect ──────────────────────────────
  // outgoing → money left fund → reverse: money enters (destination)
  // incoming → money entered   → reverse: money leaves  (source)
  await handleFundPaymentEntity({
    fund: payment.fund,
    companyId,
    paymentInFundCurrency: amountFund,
    paymentId: payment._id,
    refId: payment._id,
    date: cancelDate,
    description: `payment ${payment.counter} has been cancelled for ${reason}`,
    effectSide: isOutgoing ? "destination" : "source",
    sourceExchangeRate: 1,
    paymentNature: payment.paymentNature,
    session,
  });

  console.log("✅ Step 2 — Fund effect reversed");

  // ── Step 3 — Reverse party ledger ─────────────────────────────
  if (!isCash && payment.party?.id) {
    const isSupplier = payment.party?.type === "supplier";

    await createPaymentHistoryV2({
      companyId,
      entryType: "payment",
      transactionDate: cancelDate,
      amountTransactionCurrency: amountFund,
      amountMainCurrency: amountMain,
      supplierId: isSupplier ? payment.party.id : undefined,
      customerId: !isSupplier ? payment.party.id : undefined,
      referenceId: payment._id,
      sourceModule: "payment",
      actionType: "cancel",
      paymentId: payment._id,
      // opposite balance effect
      balanceEffectType: isOutgoing ? "Withdrawal" : "Deposit",
      description: `payment ${payment.counter} has been cancelled for ${reason}`,
      transactionCurrency: payment.fund?.currencyCode,
      session,
    });

    console.log("✅ Step 3 — Party ledger reversed");
  }

  // ── Step 4 — Reverse invoice allocations ──────────────────────
  if (Array.isArray(payment.allocations) && payment.allocations.length > 0) {
    console.log(`   Reversing ${payment.allocations.length} allocation(s):`);
    for (const allocation of payment.allocations) {
      await reverseAllocation({
        allocation,
        paymentId: payment._id,
        session,
      });
    }
    console.log("✅ Step 4 — All allocations reversed");
  }

  // ── Step 5 — Fetch journal and reverse payment entries ────────────
  if (payment.journalCounter) {
    const originalJournal = await journalEntryModel
      .findOne({ companyId, linkCounter: payment.journalCounter })
      .session(session);

    if (!originalJournal) {
      console.log("⚠️  Step 5 — No journal found for payment — skipping");
    } else {
      // filter to payment-only entries — excludes invoice entries (Purchase, Tax, Stock etc)
      const paymentEntries = (originalJournal.journalAccounts || [])
        .filter((acc) => PAYMENT_ACCOUNT_TYPES.includes(acc.accountType))
        .map((line, i) => {
          const plain = line.toObject
            ? line.toObject()
            : { ...(line._doc || line) };
          return {
            ...plain,
            MainDebit: Number(plain.MainCredit || 0),
            MainCredit: Number(plain.MainDebit || 0),
            accountDebit: Number(plain.accountCredit || 0),
            accountCredit: Number(plain.accountDebit || 0),
            counter: i + 1,
          };
        });

      if (paymentEntries.length === 0) {
        console.log(
          "⚠️  Step 5 — No payment entries found in journal — skipping"
        );
      } else {
        const totalDebit = paymentEntries.reduce(
          (s, e) => s + Number(e.MainDebit || 0),
          0
        );
        const totalCredit = paymentEntries.reduce(
          (s, e) => s + Number(e.MainCredit || 0),
          0
        );

        console.log(`   Reversal entries: ${paymentEntries.length}`);
        console.log(
          `   DR: ${totalDebit.toFixed(4)}  CR: ${totalCredit.toFixed(4)}`
        );

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          throw new ApiError(
            `Reversal journal not balanced — DR: ${totalDebit}, CR: ${totalCredit}`,
            400
          );
        }

        const nextCounterJournal = await counterModel.findOneAndUpdate(
          { companyId, name: "Journal" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true, session }
        );

        await createJournalEntryService({
          data: {
            journalName: `Payment Reversal - ${payment.counter}`,
            journalDate: cancelDate,
            journalDesc:
              reason ||
              `Reversal of payment ${payment.counter} — ${
                payment.party?.name || "Cash"
              }`,
            journalType: isOutgoing
              ? "Payment Reversal Out"
              : "Payment Reversal In",
            linkCounter: `payment-reversal-${payment._id}-${Date.now()}`,
            refCounter: String(payment.counter || ""),
            refId: payment._id,
            party: payment.party?.id || null,
            filesArray: [],
            journalAccounts: paymentEntries,
            counter: 0,
          },
          companyId,
          nextCounterJournal,
          session,
        });

        console.log("✅ Step 5 — Reversal journal created");
      }
    }
  } else {
    console.log("⚠️  Step 5 — No journalCounter on payment — skipping");
  }

  // ── Step 6 — Mark payment cancelled ───────────────────────────
  payment.status = "cancelled";
  payment.cancelledAt = cancelDate;
  payment.cancelledBy = userId;
  payment.cancellationReason = reason;

  payment.allocations = payment.allocations.map((a) => ({
    ...(a.toObject ? a.toObject() : { ...a }),
    cancelled: true,
    cancelledAt: cancelDate,
  }));
  await payment.save({ session });

  console.log("✅ Step 6 — Payment marked cancelled");
  console.log("========================================\n");

  return payment;
};
