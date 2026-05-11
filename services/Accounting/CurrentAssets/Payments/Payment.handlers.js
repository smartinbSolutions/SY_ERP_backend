const mongoose = require("mongoose");
const purchaseinvoicesModel = require("../../../../models/purchaseinvoicesModel");
const salesinvoicesModel = require("../../../../models/orderModel");

const suppliersModel = require("../../../../models/suppliersModel");
const customarModel = require("../../../../models/customarModel");
const paymentModel = require("../../../../models/Accounting/CurrentAssets/payments.model");
const financialFundsModel = require("../../../../models/Accounting/CurrentAssets/financialFundsModel");
const ReportsFinancialFundsModel = require("../../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const { createInvoiceHistory } = require("../../../invoiceHistoryService");
const { createPaymentHistoryV2 } = require("../../../paymentHistoryService");
const {
  getNextCounterValue,
} = require("../../../../utils/getNextCounterValue");
const accountingTreeModel = require("../../../../models/accountingTreeModel");
const expensesModel = require("../../../../models/expensesModel");

const linkPanelModel = require("../../../../models/linkPanelModel");
const {
  createJournalEntryService,
} = require("../../../Accounting/JournalEntries/journalEntries.Service");
const currencyModel = require("../../../../models/currencyModel");
const counterModel = require("../../../../models/Settings/counterModel");

// ─────────────────────────────────────────────────────────────────
// SHARED HELPER — reused by both handlers
// ─────────────────────────────────────────────────────────────────
const TOLERANCE = 0.01; // 1 cent — handles floating point cross-currency gaps

const resolvePaymentAmounts = ({
  fund,
  payment,
  invoiceRemainderMain,
  invoiceRemainderForeign,
  invoiceRate,
  invoiceCurrencyCode,
}) => {
  const DEBUG = true;
  const log = (...args) => DEBUG && console.log(...args);

  const isSameCurrency = fund?.currencyCode === invoiceCurrencyCode;
  const paymentRate = Number(fund?.exchangeRate || 1);

  log("STEP 1 - INPUT");
  log({
    fund,
    payment,
    invoiceRemainderMain,
    invoiceRemainderForeign,
    invoiceRate,
    invoiceCurrencyCode,
  });

  log("STEP 2 - CURRENCY CHECK");
  log("isSameCurrency:", isSameCurrency);
  log("paymentRate:", paymentRate);

  // ── Frontend amounts ──────────────────────────────────────────
  let paymentAmountMain = Number(payment.amountMainCurrency || 0);
  let paymentAmountFund = Number(payment.amount || 0);
  let paymentAmountInvoice = Number(payment.amountInvoiceCurrency || 0);

  log("STEP 3 - RAW FRONTEND AMOUNTS");
  log({ paymentAmountMain, paymentAmountFund, paymentAmountInvoice });

  // ── Cap logic ────────────────────────────────────────────────
  if (isSameCurrency) {
    const foreignFullyCovered = paymentAmountFund >= invoiceRemainderForeign;

    log("STEP 4A - SAME CURRENCY CHECK");
    log("foreignFullyCovered:", foreignFullyCovered);

    if (foreignFullyCovered) {
      log("STEP 4A - APPLY CAP (SAME CURRENCY)");
      paymentAmountFund = invoiceRemainderForeign;
      paymentAmountMain = invoiceRemainderMain;
      paymentAmountInvoice = invoiceRemainderForeign;
    }
  } else {
    const mainFullyCovered = paymentAmountMain >= invoiceRemainderMain;

    log("STEP 4B - CROSS CURRENCY CHECK");
    log("mainFullyCovered:", mainFullyCovered);

    if (mainFullyCovered) {
      log("STEP 4B - FULL COVER CAP");
      paymentAmountMain = invoiceRemainderMain;
      paymentAmountInvoice = invoiceRemainderForeign;
    } else if (paymentAmountMain > invoiceRemainderMain) {
      log("STEP 4B - OVERPAY CAP");
      paymentAmountMain = invoiceRemainderMain;
      paymentAmountInvoice = invoiceRemainderForeign;
    }
  }

  log("STEP 5 - POST CAP VALUES");
  log({ paymentAmountMain, paymentAmountFund, paymentAmountInvoice });

  const willBePaid = paymentAmountMain >= invoiceRemainderMain;

  log("STEP 6 - WILL BE PAID");
  log("willBePaid:", willBePaid);

  // ── Applied document currency ────────────────────────────────
  const appliedDocumentCurrency = isSameCurrency
    ? willBePaid
      ? invoiceRemainderForeign
      : paymentAmountFund * invoiceRate
    : paymentAmountInvoice > 0
    ? paymentAmountInvoice
    : paymentAmountMain * invoiceRate;

  log("STEP 7 - APPLIED DOCUMENT CURRENCY");
  log("appliedDocumentCurrency:", appliedDocumentCurrency);

  // ── FX CALC ──────────────────────────────────────────────────
  const usdValueAtInvoiceRate = appliedDocumentCurrency / invoiceRate;
  const usdValueAtPaymentRate = paymentAmountFund * paymentRate;

  const fxDiff = usdValueAtInvoiceRate - usdValueAtPaymentRate;

  log("STEP 8 - FX INPUTS");
  log({ usdValueAtInvoiceRate, usdValueAtPaymentRate });

  log("STEP 9 - FX RESULT");
  log("fxDiff:", fxDiff);

  return {
    isSameCurrency,
    paymentRate,
    paymentAmountMain,
    paymentAmountFund,
    paymentAmountInvoice,
    appliedDocumentCurrency,
    fxDiff,
    willBePaid,
  };
};

const documentModelMap = {
  purchase_invoice: purchaseinvoicesModel,
  sales_invoice: salesinvoicesModel,
  expense: expensesModel,
  // add more here as needed
};

const reverseAllocation = async ({ allocation, paymentId, session }) => {
  const Model = documentModelMap[allocation.documentType];

  if (!Model) {
    console.warn(
      `⚠️ No model for documentType: ${allocation.documentType} — skipping`
    );
    return;
  }

  const doc = await Model.findById(allocation.documentId).session(session);

  if (!doc) {
    console.warn(`⚠️ Document not found: ${allocation.documentId} — skipping`);
    return;
  }

  // restore remainder
  doc.totalRemainderMainCurrency =
    Number(doc.totalRemainderMainCurrency || 0) +
    Number(allocation.allocatedAmountMainCurrency || 0);

  doc.totalRemainder =
    Number(doc.totalRemainder || 0) +
    Number(allocation.allocatedAmountDocumentCurrency || 0);

  // always unpaid — remainder is now > 0
  doc.paid = "unpaid";
  doc.paymentsStatus = "unpaid";
  doc.paymentStatus = "unpaid";

  // remove this payment from the payments array
  if (Array.isArray(doc.payments)) {
    doc.payments = doc.payments.filter(
      (p) => p.paymentID?.toString() !== paymentId.toString()
    );
  }

  await doc.save({ session });

  console.log(
    `   ✅ ${allocation.documentType} ${allocation.documentId}` +
      ` — restored ${allocation.allocatedAmountMainCurrency} USD`
  );
};

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
  fxDiff = 0, // ← add this param (comes from settlement)
}) => {
  const amountMainCurrency = Number(totalMainCurrency || 0);
  const amountTransactionCurrency = Number(paymentInFundCurrency || 0);
  const absFxDiff = Math.abs(fxDiff);
  const balanceEffectType =
    effectSide === "destination" ? "Deposit" : "Withdrawal";

  if (effectSide === "destination") {
    // ── Normal payment history row ─────────────────────────────────────
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
    console.log("absFxDiff", absFxDiff);
    // ── FX adjustment row — only if there is a diff ────────────────────
    if (absFxDiff > 0.001) {
      await createPaymentHistoryV2({
        companyId,
        entryType: "fx_adjustment",
        transactionDate: date,
        amountTransactionCurrency: 0, // no foreign amount, pure USD adjustment
        amountMainCurrency: absFxDiff,
        supplierId: supplier._id,
        referenceId: refId,
        sourceModule: "payment",
        actionType: "create",
        paymentId,
        balanceEffectType: fxDiff > 0 ? "Deposit" : "Withdrawal",
        // fxDiff > 0 = loss  → we are writing off the residual (Deposit clears it)
        // fxDiff < 0 = gain  → we over-paid in USD terms (Withdrawal adds back)
        description: `FX ${
          fxDiff > 0 ? "Loss" : "Gain"
        } adjustment — rate moved from invoice to payment date`,
        transactionCurrency: currencyCode,
        session,
      });
    }

    return;
  }

  // source side (incoming from supplier) stays the same for now
  if (effectSide === "source") {
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
  let totalFxDiff = 0;

  // ── Fetch all currencies once to get TODAY's rates ──────────────────────
  const allCurrencies = await currencyModel
    .find({ companyId })
    .session(session);

  const getTodayRate = (currencyId) => {
    if (!currencyId) return 1;
    const found = allCurrencies.find(
      (c) => c._id.toString() === currencyId.toString()
    );
    return Number(found?.exchangeRate || 1);
  };
  // ────────────────────────────────────────────────────────────────────────

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

  console.log("========================================");
  console.log("   SETTLEMENT START");
  console.log("========================================");
  console.log(`   Payment Amount (Main/USD): ${remainingPaymentMain}`);
  console.log(
    `   Fund:                      ${fund?.name} (${fund?.currencyCode}) @ ${fund?.exchangeRate}`
  );
  console.log(`   Total Open Docs:           ${openDocs.length}`);
  console.log("========================================\n");

  for (const item of openDocs) {
    if (remainingPaymentMain <= 0) {
      console.log("⛔ No remaining payment — stopping.\n");
      break;
    }

    // ─────────────────────────────────────────
    // PURCHASE INVOICE
    // ─────────────────────────────────────────
    if (item.kind === "purchase_invoice") {
      const purchase = item.doc;

      const purchaseRemainderMain = Number(
        purchase.totalRemainderMainCurrency || 0
      );
      const purchaseRemainderForeign = Number(purchase.totalRemainder || 0);

      if (purchaseRemainderMain <= 0) {
        console.log(
          `[SKIP] Purchase Invoice ${purchase.counter} — remainder is 0\n`
        );
        continue;
      }

      // Rate when invoice was created
      const invoiceRate = Number(purchase.exchangeRate || 1);

      // Payment rate:
      // if fund currency matches invoice currency → use fund rate (user entered)
      // if fund currency is different             → use today's rate from currencies DB
      const isSameCurrency =
        fund?.currencyCode === purchase?.currency?.currencyCode;
      const paymentRate = isSameCurrency
        ? Number(fund?.exchangeRate || 1)
        : getTodayRate(purchase?.currency?.id);

      // How much foreign currency is available in this payment
      const availableForeignAmount = remainingPaymentMain * paymentRate;

      // If same currency AND payment covers the full foreign amount → fully close
      // This handles the case: invoice = 1008 TRY, payment = 1008 TRY at rate 45
      // Even though 1008/45 = 22.4 USD < 24 USD remainder, the invoice IS fully paid
      const foreignFullyCovered =
        isSameCurrency &&
        availableForeignAmount >= purchaseRemainderForeign - 0.000001;

      const appliedMain = foreignFullyCovered
        ? purchaseRemainderMain // fully close invoice at its booked USD value
        : Math.min(purchaseRemainderMain, remainingPaymentMain); // partial — limit by USD

      // Foreign currency amount being closed
      const appliedDocumentCurrency = foreignFullyCovered
        ? purchaseRemainderForeign // close exact foreign remainder
        : appliedMain * invoiceRate;

      // Fund currency amount (actual TRY/EUR leaving the fund)
      const appliedFundCurrency = appliedDocumentCurrency; // same as foreign closed

      // FX Calculation:
      // appliedMain       = USD value at invoice rate (what was booked)
      // usdValueAtPayment = USD value of same foreign amount at payment rate
      // diff              = FX gain or loss
      const usdValueAtPaymentRate = appliedDocumentCurrency / paymentRate;
      const fxDiff = appliedMain - usdValueAtPaymentRate;
      // fxDiff > 0 → FX Loss  (you booked more USD, paying less today)
      // fxDiff < 0 → FX Gain  (you booked less USD, paying more today)

      totalFxDiff += fxDiff;

      const newRemainderMain = purchaseRemainderMain - appliedMain;
      const newRemainderForeign =
        purchaseRemainderForeign - appliedDocumentCurrency;
      const willBePaid = foreignFullyCovered || newRemainderMain <= 0.000001;

      console.log(
        `[PURCHASE INVOICE] ${purchase.invoiceName} (${purchase.counter})`
      );
      console.log(
        `   Currency:                  ${
          purchase?.currency?.currencyCode || "USD"
        }`
      );
      console.log(
        `   Same Currency as Fund:     ${isSameCurrency ? "YES" : "NO"}`
      );
      console.log(`   Invoice Rate (at booking): ${invoiceRate}`);
      console.log(`   Payment Rate:              ${paymentRate}`);
      console.log(`   ── Amounts ──`);
      console.log(
        `   Remainder (USD):           ${purchaseRemainderMain.toFixed(6)}`
      );
      console.log(
        `   Remainder (Foreign):       ${purchaseRemainderForeign.toFixed(6)}`
      );
      console.log(
        `   Available Foreign:         ${availableForeignAmount.toFixed(6)}`
      );
      console.log(`   Applied (USD):             ${appliedMain.toFixed(6)}`);
      console.log(
        `   Applied (Foreign):         ${appliedDocumentCurrency.toFixed(6)}`
      );
      console.log(
        `   Applied (Fund/Cash Out):   ${appliedFundCurrency.toFixed(6)}`
      );
      console.log(`   ── FX ──`);
      console.log(`   USD at invoice rate:       ${appliedMain.toFixed(6)}`);
      console.log(
        `   USD at payment rate:       ${usdValueAtPaymentRate.toFixed(6)}`
      );
      console.log(
        `   FX Diff:                   ${fxDiff.toFixed(6)} ${
          fxDiff > 0 ? "⚠️  LOSS" : fxDiff < 0 ? "✅ GAIN" : "➖ NONE"
        }`
      );
      console.log(`   ── After Settlement ──`);
      console.log(
        `   New Remainder (USD):       ${newRemainderMain.toFixed(6)}`
      );
      console.log(
        `   New Remainder (Foreign):   ${newRemainderForeign.toFixed(6)}`
      );
      console.log(
        `   Status:                    ${
          willBePaid ? "✅ FULLY PAID" : "⏳ PARTIALLY PAID"
        }`
      );
      console.log("");

      purchase.totalRemainderMainCurrency = willBePaid ? 0 : newRemainderMain;
      purchase.totalRemainder = willBePaid ? 0 : newRemainderForeign;
      if (willBePaid) purchase.paid = "paid";

      purchase.payments.push({
        payment: appliedFundCurrency,
        paymentMainCurrency: appliedMain,
        financialFunds: fund.name,
        financialFundsCurrencyCode: fund.currencyCode,
        paymentID: payment._id,
        date,
        paymentInInvoiceCurrency: appliedDocumentCurrency,
        financialFundsId: fund.id,
        fxDiff,
        invoiceRate,
        paymentRate,
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
        fxDiff,
        invoiceRate,
        paymentRate,
        willBePaid,
      });

      // deduct actual USD equivalent paid from remaining
      remainingPaymentMain -= usdValueAtPaymentRate;
      continue;
    }

    // ─────────────────────────────────────────
    // EXPENSE (OTHER)
    // ─────────────────────────────────────────
    if (item.kind === "expense") {
      const expense = item.doc;

      const expenseRemainderMain = Number(
        expense.totalRemainderMainCurrency || 0
      );
      const expenseRemainderForeign = Number(expense.totalRemainder || 0);

      if (expenseRemainderMain <= 0) {
        console.log(`[SKIP] Expense ${expense.counter} — remainder is 0\n`);
        continue;
      }

      const invoiceRate = Number(expense.currency?.exchangeRate || 1);

      const isSameCurrency =
        fund?.currencyCode === expense?.currency?.currencyCode;
      const paymentRate = isSameCurrency
        ? Number(fund?.exchangeRate || 1)
        : getTodayRate(expense?.currency?.id);

      const availableForeignAmount = remainingPaymentMain * paymentRate;

      const foreignFullyCovered =
        isSameCurrency &&
        availableForeignAmount >= expenseRemainderForeign - 0.000001;

      const appliedMain = foreignFullyCovered
        ? expenseRemainderMain
        : Math.min(expenseRemainderMain, remainingPaymentMain);

      const appliedDocumentCurrency = foreignFullyCovered
        ? expenseRemainderForeign
        : appliedMain * invoiceRate;

      const appliedFundCurrency = appliedDocumentCurrency;

      const usdValueAtPaymentRate = appliedDocumentCurrency / paymentRate;
      const fxDiff = appliedMain - usdValueAtPaymentRate;

      totalFxDiff += fxDiff;

      const newRemainderMain = expenseRemainderMain - appliedMain;
      const newRemainderForeign =
        expenseRemainderForeign - appliedDocumentCurrency;
      const willBePaid = foreignFullyCovered || newRemainderMain <= 0.000001;

      console.log(`[EXPENSE] ${expense.expenseName} (${expense.counter})`);
      console.log(
        `   Currency:                  ${
          expense?.currency?.currencyCode || "USD"
        }`
      );
      console.log(
        `   Same Currency as Fund:     ${isSameCurrency ? "YES" : "NO"}`
      );
      console.log(`   Invoice Rate (at booking): ${invoiceRate}`);
      console.log(`   Payment Rate:              ${paymentRate}`);
      console.log(`   ── Amounts ──`);
      console.log(
        `   Remainder (USD):           ${expenseRemainderMain.toFixed(6)}`
      );
      console.log(
        `   Remainder (Foreign):       ${expenseRemainderForeign.toFixed(6)}`
      );
      console.log(
        `   Available Foreign:         ${availableForeignAmount.toFixed(6)}`
      );
      console.log(`   Applied (USD):             ${appliedMain.toFixed(6)}`);
      console.log(
        `   Applied (Foreign):         ${appliedDocumentCurrency.toFixed(6)}`
      );
      console.log(
        `   Applied (Fund/Cash Out):   ${appliedFundCurrency.toFixed(6)}`
      );
      console.log(`   ── FX ──`);
      console.log(`   USD at invoice rate:       ${appliedMain.toFixed(6)}`);
      console.log(
        `   USD at payment rate:       ${usdValueAtPaymentRate.toFixed(6)}`
      );
      console.log(
        `   FX Diff:                   ${fxDiff.toFixed(6)} ${
          fxDiff > 0 ? "⚠️  LOSS" : fxDiff < 0 ? "✅ GAIN" : "➖ NONE"
        }`
      );
      console.log(`   ── After Settlement ──`);
      console.log(
        `   New Remainder (USD):       ${newRemainderMain.toFixed(6)}`
      );
      console.log(
        `   New Remainder (Foreign):   ${newRemainderForeign.toFixed(6)}`
      );
      console.log(
        `   Status:                    ${
          willBePaid ? "✅ FULLY PAID" : "⏳ PARTIALLY PAID"
        }`
      );
      console.log("");

      expense.totalRemainderMainCurrency = willBePaid ? 0 : newRemainderMain;
      expense.totalRemainder = willBePaid ? 0 : newRemainderForeign;
      if (willBePaid) expense.paymentStatus = "paid";

      expense.payments.push({
        payment: appliedFundCurrency,
        paymentMainCurrency: appliedMain,
        financialFunds: fund.name,
        financialFundsCurrencyCode: fund.currencyCode,
        paymentID: payment._id,
        date,
        paymentInInvoiceCurrency: appliedDocumentCurrency,
        financialFundsId: fund.id,
        fxDiff,
        invoiceRate,
        paymentRate,
      });
      await expense.save({ session });

      allocations.push({
        documentId: expense._id.toString(),
        documentType: "expense",
        documentName: expense.expenseName || "",
        documentCounter: expense.counter || "",
        documentCurrencyCode: expense?.currency?.currencyCode || "",
        allocatedAmountMainCurrency: appliedMain,
        allocatedAmountDocumentCurrency: appliedDocumentCurrency,
        documentTotal: Number(expense.expenceTotal || 0),
        fxDiff,
        invoiceRate,
        paymentRate,
        willBePaid,
      });

      remainingPaymentMain -= usdValueAtPaymentRate;
    }
  }

  console.log("========================================");
  console.log("   SETTLEMENT SUMMARY");
  console.log("========================================");
  console.log(`   Docs Processed:            ${allocations.length}`);
  console.log(
    `   Remaining Payment (USD):   ${remainingPaymentMain.toFixed(6)}`
  );
  console.log(
    `   Total FX Diff:             ${totalFxDiff.toFixed(6)} ${
      totalFxDiff > 0
        ? "⚠️  NET LOSS"
        : totalFxDiff < 0
        ? "✅ NET GAIN"
        : "➖ NO FX IMPACT"
    }`
  );
  console.log("   Allocations:");
  allocations.forEach((a, i) => {
    console.log(
      `   [${i + 1}] ${a.documentType} | ${a.documentName} (${
        a.documentCounter
      })`
    );
    console.log(
      `       Applied USD:     ${a.allocatedAmountMainCurrency.toFixed(4)}`
    );
    console.log(
      `       Applied Foreign: ${a.allocatedAmountDocumentCurrency.toFixed(
        4
      )} ${a.documentCurrencyCode}`
    );
    console.log(
      `       FX Diff:         ${a.fxDiff.toFixed(4)} ${
        a.fxDiff > 0 ? "LOSS" : a.fxDiff < 0 ? "GAIN" : "NONE"
      }`
    );
    console.log(`       Will Be Paid:    ${a.willBePaid ? "YES ✅" : "NO ⏳"}`);
  });
  console.log("========================================\n");

  return {
    allocations,
    remainingPaymentMain,
    totalFxDiff,
  };
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
  effectSide,
  session,
  fxDiff = 0,
}) => {
  const amountMainCurrency = Number(totalMainCurrency || 0);
  const amountTransactionCurrency = Number(paymentInFundCurrency || 0);
  const absFxDiff = Math.abs(fxDiff);

  const balanceEffectType =
    effectSide === "destination" ? "Deposit" : "Withdrawal";

  // ─────────────────────────────────────────────
  // DESTINATION (Customer receives / payment settlement)
  // ─────────────────────────────────────────────
  if (effectSide === "destination") {
    // FX adjustment (same logic as supplier but mirrored effect already in fxDiff sign)
    if (absFxDiff > 0.001) {
      await createPaymentHistoryV2({
        companyId,
        entryType: "fx_adjustment",
        transactionDate: date,
        amountTransactionCurrency: 0,
        amountMainCurrency: absFxDiff,
        customerId: updatedCustomer._id,
        referenceId: refId,
        sourceModule: "payment",
        actionType: "create",
        paymentId,
        balanceEffectType: fxDiff > 0 ? "Deposit" : "Withdrawal",
        description: `FX ${
          fxDiff > 0 ? "Loss" : "Gain"
        } adjustment — rate movement impact`,
        transactionCurrency: currencyCode,
        session,
      });
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
      balanceEffectType: "Deposit",
      description,
      transactionCurrency: currencyCode,
      session,
    });

    return;
  }

  // ─────────────────────────────────────────────
  // SOURCE (Customer pays you / receivable created)
  // ─────────────────────────────────────────────
  if (effectSide === "source") {
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
  let totalFxDiff = 0;

  // ── Fetch all currencies once to get TODAY's rates ──────────────────────
  const allCurrencies = await currencyModel
    .find({ companyId })
    .session(session);

  const getTodayRate = (currencyId) => {
    if (!currencyId) return 1;
    const found = allCurrencies.find(
      (c) => c._id.toString() === currencyId.toString()
    );
    return Number(found?.exchangeRate || 1);
  };
  // ────────────────────────────────────────────────────────────────────────

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

  console.log("========================================");
  console.log("   CUSTOMER SETTLEMENT START");
  console.log("========================================");
  console.log(`   Customer:                  ${customer.name || customer._id}`);
  console.log(`   Payment Amount (Main/USD): ${remainingPaymentMain}`);
  console.log(`   Currencies Loaded:         ${allCurrencies.length}`);
  allCurrencies.forEach((c) => {
    console.log(
      `     ${c.currencyName} (${c.currencyCode}): rate = ${c.exchangeRate} ${
        c.is_primary ? "⭐ PRIMARY" : ""
      }`
    );
  });
  console.log(`   Total Open Invoices:       ${openDocs.length}`);
  console.log("========================================\n");

  for (const item of openDocs) {
    if (remainingPaymentMain <= 0) {
      console.log("⛔ No remaining payment — stopping.\n");
      break;
    }

    const invoice = item.doc;

    const invoiceRemainderMain = Number(
      invoice.totalRemainderMainCurrency || 0
    );

    if (invoiceRemainderMain <= 0) {
      console.log(`[SKIP] Sales Invoice ${invoice.counter} — remainder is 0\n`);
      continue;
    }

    // How much USD we apply to this invoice
    const appliedMain = Math.min(invoiceRemainderMain, remainingPaymentMain);

    // Rate when invoice was created (stored on the invoice)
    const invoiceRate = Number(invoice?.currency?.exchangeRate || 1);
    console.log("invoice?.currency?._id", invoice?.currency);
    // Rate TODAY — from currencies collection
    const paymentRate = getTodayRate(invoice?.currency?.id);
    // console.log("invoice", invoice);
    console.log("invoiceRemainderMain", invoiceRemainderMain);
    console.log("remainingPaymentMain", remainingPaymentMain);
    console.log("appliedMain", appliedMain);
    // Foreign currency amount being closed
    const appliedDocumentCurrency = appliedMain * invoiceRate;

    // Fund currency amount
    const appliedFundCurrency =
      appliedMain *
      Number(payment?.payment?.exchangeRate || payment?.exchangeRate || 1);

    console.log("appliedDocumentCurrency", appliedDocumentCurrency);
    console.log("paymentRate", paymentRate);
    // FX Calculation:
    // Invoice was booked: appliedMain USD = appliedDocumentCurrency foreign
    // Today:              appliedDocumentCurrency foreign = appliedDocumentCurrency / paymentRate USD
    const usdValueAtPaymentRate = appliedDocumentCurrency / paymentRate;
    const fxDiff = appliedMain - usdValueAtPaymentRate;
    // fxDiff > 0 → FX Loss  (you invoiced more USD, received less today)
    // fxDiff < 0 → FX Gain  (foreign currency strengthened, you receive more USD)

    totalFxDiff += fxDiff;

    const newRemainderMain = invoiceRemainderMain - appliedMain;
    const newRemainderForeign =
      Number(invoice.totalRemainder || 0) - appliedDocumentCurrency;
    const willBePaid = newRemainderMain <= 0.000001;

    console.log(`[SALES INVOICE] ${invoice.invoiceName} (${invoice.counter})`);
    console.log(
      `   Currency:                  ${
        invoice?.currency?.currencyCode || "USD"
      }`
    );
    console.log(`   Invoice Rate (at booking): ${invoiceRate}`);
    console.log(`   Payment Rate (today):      ${paymentRate}`);
    console.log(`   ── Amounts ──`);
    console.log(
      `   Remainder (USD):           ${invoiceRemainderMain.toFixed(6)}`
    );
    console.log(`   Applied (USD):             ${appliedMain.toFixed(6)}`);
    console.log(
      `   Applied (Foreign):         ${appliedDocumentCurrency.toFixed(6)}`
    );
    console.log(
      `   Applied (Fund Currency):   ${appliedFundCurrency.toFixed(6)}`
    );
    console.log(`   ── FX ──`);
    console.log(`   USD at invoice rate:       ${appliedMain.toFixed(6)}`);
    console.log(
      `   USD at payment rate:       ${usdValueAtPaymentRate.toFixed(6)}`
    );
    console.log(
      `   FX Diff:                   ${fxDiff.toFixed(6)} ${
        fxDiff > 0 ? "⚠️  LOSS" : fxDiff < 0 ? "✅ GAIN" : "➖ NONE"
      }`
    );
    console.log(`   ── After Settlement ──`);
    console.log(`   New Remainder (USD):       ${newRemainderMain.toFixed(6)}`);
    console.log(
      `   New Remainder (Foreign):   ${newRemainderForeign.toFixed(6)}`
    );
    console.log(
      `   Status:                    ${
        willBePaid ? "✅ FULLY PAID" : "⏳ PARTIALLY PAID"
      }`
    );

    // ── EFFECTS COMMENTED OUT ──────────────────────────────────────────
    invoice.totalRemainderMainCurrency = newRemainderMain;
    invoice.totalRemainder = newRemainderForeign;
    if (willBePaid) {
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
      fxDiff,
      invoiceRate,
      paymentRate,
    });
    await invoice.save({ session });
    // ──────────────────────────────────────────────────────────────────

    allocations.push({
      documentId: invoice._id.toString(),
      documentType: "sales_invoice",
      documentName: invoice.invoiceName || "",
      documentCounter: invoice.counter || "",
      documentCurrencyCode: invoice?.currency?.currencyCode || "",
      allocatedAmountMainCurrency: appliedMain,
      allocatedAmountDocumentCurrency: appliedDocumentCurrency,
      documentTotal: Number(
        invoice.invoiceGrandTotal || invoice.invoiceGrandTotalMainCurrency || 0
      ),
      fxDiff,
      invoiceRate,
      paymentRate,
      willBePaid,
    });

    remainingPaymentMain -= appliedMain;
  }

  console.log("========================================");
  console.log("   CUSTOMER SETTLEMENT SUMMARY");
  console.log("========================================");
  console.log(`   Invoices Processed:        ${allocations.length}`);
  console.log(
    `   Remaining Payment (USD):   ${remainingPaymentMain.toFixed(6)}`
  );
  console.log(
    `   Total FX Diff:             ${totalFxDiff.toFixed(6)} ${
      totalFxDiff > 0
        ? "⚠️  NET LOSS"
        : totalFxDiff < 0
        ? "✅ NET GAIN"
        : "➖ NO FX IMPACT"
    }`
  );
  console.log("   Allocations:");
  allocations.forEach((a, i) => {
    console.log(
      `   [${i + 1}] ${a.documentType} | ${a.documentName} (${
        a.documentCounter
      })`
    );
    console.log(
      `       Applied USD:     ${a.allocatedAmountMainCurrency.toFixed(4)}`
    );
    console.log(
      `       Applied Foreign: ${a.allocatedAmountDocumentCurrency.toFixed(
        4
      )} ${a.documentCurrencyCode}`
    );
    console.log(
      `       FX Diff:         ${a.fxDiff.toFixed(4)} ${
        a.fxDiff > 0 ? "LOSS" : a.fxDiff < 0 ? "GAIN" : "NONE"
      }`
    );
    console.log(`       Will Be Paid:    ${a.willBePaid ? "YES ✅" : "NO ⏳"}`);
  });
  console.log("========================================\n");

  return {
    allocations,
    remainingPaymentMain,
    totalFxDiff,
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

const handlePurchasePayment = async (
  req,
  companyId,
  next,
  normalizedPayment,
  externalSession = null
) => {
  const ownsSession = !externalSession;
  const session = externalSession || (await mongoose.startSession());

  const run = async () => {
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
      journalAccounts,
      invoiceId,
    } = normalizedPayment;

    if (!fund?.id) throw new Error("Fund id is required");
    if (!party?.id || !party?.type) throw new Error("Party is required");
    if (!["customer", "supplier"].includes(party.type))
      throw new Error(
        "Fund payment context supports only customer or supplier as party"
      );
    if (!["incoming", "outgoing"].includes(paymentNature))
      throw new Error(
        "Fund payment context supports only incoming or outgoing paymentNature"
      );

    // ── Fetch invoice ────────────────────────────────────────────
    const purchase = await purchaseinvoicesModel
      .findOne({
        _id: invoiceId,
        status: { $nin: ["cancelled", "draft"] },
        companyId,
      })
      .session(session);

    if (!purchase) throw new Error(`Purchase invoice not found`);

    // ── Fetch supplier ───────────────────────────────────────────
    const supplier = await suppliersModel
      .findOne({ _id: purchase.supllier.id, companyId })
      .session(session);

    if (!supplier) throw new Error("Supplier not found");

    // ── Invoice amounts ──────────────────────────────────────────
    const invoiceRemainderMain = Number(
      purchase.totalRemainderMainCurrency || 0
    );
    const invoiceRemainderForeign = Number(purchase.totalRemainder || 0);
    const invoiceRate = Number(
      purchase.exchangeRate || purchase?.currency?.exchangeRate || 1
    );

    // ── Resolve payment amounts ───────────────────────────────────
    // Caps amounts, calculates appliedDocumentCurrency + fxDiff
    // Trusts frontend amountInvoiceCurrency for cross-currency (real-time rate)
    const {
      isSameCurrency,
      paymentRate,
      paymentAmountMain,
      paymentAmountFund,
      paymentAmountInvoice,
      appliedDocumentCurrency,
      fxDiff,
      willBePaid,
    } = resolvePaymentAmounts({
      fund,
      payment,
      invoiceRemainderMain,
      invoiceRemainderForeign,
      invoiceRate,
      invoiceCurrencyCode: purchase?.currency?.currencyCode,
    });

    console.log("========================================");
    console.log(
      `   ${
        paymentNature === "outgoing"
          ? "PURCHASE PAYMENT"
          : "PURCHASE REFUND RECEIPT"
      }`
    );
    console.log("========================================");
    console.log(
      `   Invoice:       ${purchase.invoiceName} (${purchase.counter})`
    );
    console.log(`   Currency:      ${purchase?.currency?.currencyCode}`);
    console.log(`   Invoice Rate:  ${invoiceRate}`);
    console.log(
      `   Fund:          ${fund.name} (${fund.currencyCode}) @ ${paymentRate}`
    );
    console.log(`   Same Currency: ${isSameCurrency ? "YES" : "NO"}`);
    console.log(
      `   Fund Amt:      ${paymentAmountFund.toFixed(4)} ${fund.currencyCode}`
    );
    console.log(`   Main Amt:      ${paymentAmountMain.toFixed(4)}`);
    console.log(
      `   Invoice Amt:   ${appliedDocumentCurrency.toFixed(4)} ${
        purchase?.currency?.currencyCode
      }`
    );
    console.log(
      `   FX Diff:       ${fxDiff.toFixed(6)} ${
        fxDiff > 0.001 ? "⚠️ LOSS" : fxDiff < -0.001 ? "✅ GAIN" : "➖ NONE"
      }`
    );
    console.log(`   Will Be Paid:  ${willBePaid ? "✅ YES" : "⏳ PARTIAL"}`);
    console.log("========================================\n");

    // ── Create payment doc ───────────────────────────────────────
    const paymentSeq = await getNextCounterValue({
      companyId,
      name: "Payment",
      session,
    });

    const paymentPayload = {
      companyId,
      counter: Number(counter || 0) + Number(paymentSeq),
      party: { id: party.id, name: party.name, type: party.type },
      fund: {
        id: fund.id,
        name: fund.name,
        currencyId: fund.currencyId || "",
        currencyCode: fund.currencyCode || "",
        exchangeRate: Number(fund.exchangeRate || 1),
      },
      paymentNature,
      payment: {
        amount: paymentAmountFund,
        currencyId: payment?.currencyId || "",
        currencyCode: payment?.currencyCode || "",
        exchangeRate: Number(payment?.exchangeRate || 1),
        amountMainCurrency: paymentAmountMain,
      },
      date,
      description,
      journalCounter,
      file: normalizedPayment.file || "",
      allocations: [
        {
          documentId: purchase._id,
          documentName: purchase.invoiceName,
          documentCounter: purchase.counter || "",
          documentCurrencyCode: purchase.currency?.currencyCode || "",
          allocatedAmountMainCurrency: paymentAmountMain,
          allocatedAmountDocumentCurrency: appliedDocumentCurrency,
          documentTotal: purchase.invoiceGrandTotal,
          documentType: "purchase_invoice",
          fxDiff,
          invoiceRate,
          paymentRate,
        },
      ],
      postedBy: postedBy || null,
      postedAt: postedAt || new Date(),
    };

    const paymentDocs = await paymentModel.create([paymentPayload], {
      session,
    });
    const newPayment = paymentDocs[0];
    let createdPayment = paymentDocs;

    // ── Update invoice ───────────────────────────────────────────
    purchase.totalRemainderMainCurrency = willBePaid
      ? 0
      : invoiceRemainderMain - paymentAmountMain;
    purchase.totalRemainder = willBePaid
      ? 0
      : invoiceRemainderForeign - appliedDocumentCurrency;
    if (willBePaid) purchase.paid = "paid";

    purchase.payments.push({
      payment: paymentAmountFund,
      paymentMainCurrency: paymentAmountMain,
      financialFunds: fund.name,
      financialFundsCurrencyCode: fund.currencyCode,
      paymentID: newPayment._id,
      exchangeRate: fund.exchangeRate,
      date,
      paymentInInvoiceCurrency: appliedDocumentCurrency,
      financialFundsId: fund.id,
      fxDiff,
      invoiceRate,
      paymentRate,
    });

    await purchase.save({ session });

    await createInvoiceHistory(
      companyId,
      purchase._id,
      "payment",
      normalizedPayment.userId || req?.user?._id,
      date,
      `${paymentAmountFund} ${fund.currencyCode}`,
      "invoice",
      session
    );

    // ── Supplier entity effect ───────────────────────────────────
    await handleSupplierPaymentEntity({
      supplier,
      companyId,
      totalMainCurrency: paymentAmountMain,
      paymentInFundCurrency: paymentAmountFund,
      paymentId: newPayment._id,
      refId: purchase._id,
      date,
      description,
      currencyCode: fund.currencyCode,
      effectSide: "destination",
      session,
      fxDiff,
    });

    // ── Fund entity effect ───────────────────────────────────────
    await handleFundPaymentEntity({
      fund,
      companyId,
      paymentInFundCurrency: paymentAmountFund,
      paymentId: newPayment._id,
      refId: purchase._id,
      date,
      description,
      effectSide: paymentNature === "outgoing" ? "source" : "destination",
      sourceExchangeRate: invoiceRate,
      paymentNature,
      session,
    });

    // ── Journal ──────────────────────────────────────────────────
    if (journalAccounts && ownsSession) {
      await savePaymentJournal({
        journalAccounts,
        paymentAmountMain,
        totalFxDiff: fxDiff,
        date,
        description,
        journalCounter,
        companyId,
        session,
        payment: newPayment,
        partyName: party.name,
        paymentNature,
      });
    }

    return { createdPayment, fxDiff };
  };

  try {
    if (ownsSession) {
      let result;
      await session.withTransaction(async () => {
        result = await run();
      });
      return result;
    } else {
      return await run();
    }
  } catch (err) {
    throw err;
  } finally {
    if (ownsSession) await session.endSession();
  }
};

const handleSupplierPayment = async (
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
        journalAccounts,
      } = normalizedPayment;

      if (!fund?.id) throw new Error("Fund id is required");
      if (!party?.id || !party?.type) throw new Error("Party is required");
      if (!["customer", "supplier"].includes(party.type))
        throw new Error(
          "Fund payment context supports only customer or supplier as party"
        );
      if (!["incoming", "outgoing"].includes(paymentNature))
        throw new Error(
          "Fund payment context supports only incoming or outgoing paymentNature"
        );

      const supplier = await suppliersModel
        .findOne({ _id: party?.id, companyId })
        .session(session);

      if (!supplier) throw new Error("Supplier not found");

      let paymentAmountMain = Number(payment.amountMainCurrency || 0);
      let paymentAmountInvoice = Number(payment.amount || 0);

      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      const paymentPayload = {
        companyId,
        counter: Number(counter || 0) + Number(paymentSeq),
        party: { id: party.id, name: party.name, type: party.type },
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
      const newPayment = paymentDocs[0];
      createdPayment = newPayment;

      /*
        |--------------------------------------------------------------------------
        | SETTLE OPEN DOCUMENTS FIRST — so we have totalFxDiff
        | only when outgoing (paying supplier)
        |--------------------------------------------------------------------------
        */
      let totalFxDiff = 0;

      if (paymentNature === "outgoing") {
        const {
          allocations,
          remainingPaymentMain,
          totalFxDiff: fxDiff,
        } = await settleSupplierOpenDocuments({
          supplier,
          fund,
          payment: newPayment,
          paymentAmountMain,
          date,
          companyId,
          session,
        });

        totalFxDiff = fxDiff;

        newPayment.allocations = allocations;
        await newPayment.save({ session });
      }

      /*
        |--------------------------------------------------------------------------
        | SUPPLIER SIDE EFFECT — after settlement so fxDiff is known
        |--------------------------------------------------------------------------
        */
      await handleSupplierPaymentEntity({
        supplier,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: payment.amount,
        paymentId: newPayment._id,
        refId: "",
        date,
        description,
        currencyCode: fund.currencyCode,
        effectSide: paymentNature === "outgoing" ? "destination" : "source",
        session,
        fxDiff: totalFxDiff, // ← now available, 0 if no FX or incoming
      });

      /*
        |--------------------------------------------------------------------------
        | FUND SIDE EFFECT
        |--------------------------------------------------------------------------
        */
      await handleFundPaymentEntity({
        fund,
        companyId,
        paymentInFundCurrency: paymentAmountInvoice,
        paymentId: newPayment._id,
        refId: "",
        date,
        description,
        effectSide: paymentNature === "incoming" ? "destination" : "source",
        sourceExchangeRate: 1,
        session,
      });

      /*
        |--------------------------------------------------------------------------
        | JOURNAL — always saved if accounts were sent
        |--------------------------------------------------------------------------
        */
      if (journalAccounts) {
        await savePaymentJournal({
          journalAccounts,
          paymentAmountMain,
          totalFxDiff,
          date,
          description,
          journalCounter,
          companyId,
          session,
          payment: newPayment,
          partyName: party.name,
          paymentNature,
        });
      }
    });

    return createdPayment;
  } catch (err) {
    throw err;
  } finally {
    await session.endSession();
  }
};

const handleSalesPayment = async (
  req,
  companyId,
  next,
  normalizedPayment,
  externalSession = null // ← optional external session
) => {
  const ownsSession = !externalSession;
  const session = externalSession || (await mongoose.startSession());

  const run = async () => {
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
      journalAccounts,
      invoiceId,
    } = normalizedPayment;

    if (!fund?.id) throw new Error("Payment fund is required");
    if (!party?.id || !party?.type) throw new Error("Party is required");
    if (party.type !== "customer")
      throw new Error("Fund payment context supports only customer as party");
    if (!["incoming", "outgoing"].includes(paymentNature))
      throw new Error(
        "Fund payment context supports only incoming or outgoing paymentNature"
      );

    // ── Fetch invoice ──────────────────────────────────────────
    const sales = await salesinvoicesModel
      .findOne({
        _id:
          invoiceId || req.body?.paymentData?.invoiceId || req.body?.invoiceId,
        status: { $nin: ["cancelled", "draft"] },
        companyId,
      })
      .session(session);

    if (!sales) throw new Error(`Sales invoice not found for id ${invoiceId}`);

    // ── Fetch customer ─────────────────────────────────────────
    const customer = await customarModel
      .findOne({ _id: sales.customer.id, companyId })
      .session(session);

    if (!customer) throw new Error("Customer not found");

    // ── Resolve amounts with FX + tolerance ───────────────────
    const invoiceRemainderMain = Number(sales.totalRemainderMainCurrency || 0);
    const invoiceRemainderForeign = Number(sales.totalRemainder || 0);
    const invoiceRate = Number(
      sales.exchangeRate || sales?.currency?.exchangeRate || 1
    );

    // in both handleSalesPayment and handleExpensePayment
    const {
      isSameCurrency,
      paymentRate,
      paymentAmountMain,
      paymentAmountFund,
      paymentAmountInvoice, // ← add this
      appliedDocumentCurrency,
      fxDiff,
      willBePaid,
    } = resolvePaymentAmounts({
      fund,
      payment, // ← payment already has amountInvoiceCurrency from frontend
      invoiceRemainderMain,
      invoiceRemainderForeign,
      invoiceRate,
      invoiceCurrencyCode: sales?.currency?.currencyCode, // or expense?.currency?.currencyCode
    });

    console.log("========================================");
    console.log("   SALES INVOICE PAYMENT");
    console.log("========================================");
    console.log(`   Invoice:          ${sales.invoiceName} (${sales.counter})`);
    console.log(`   Currency:         ${sales?.currency?.currencyCode}`);
    console.log(`   Invoice Rate:     ${invoiceRate}`);
    console.log(
      `   Fund:             ${fund.name} (${fund.currencyCode}) @ ${paymentRate}`
    );
    console.log(
      `   Direction:        ${
        paymentNature === "incoming"
          ? "💰 Receiving from customer"
          : "💸 Paying customer"
      }`
    );
    console.log(`   Same Currency:    ${isSameCurrency ? "YES" : "NO"}`);
    console.log(`   Remainder (USD):     ${invoiceRemainderMain.toFixed(6)}`);
    console.log(
      `   Remainder (Foreign): ${invoiceRemainderForeign.toFixed(6)}`
    );
    console.log(`   Applied (USD):       ${paymentAmountMain.toFixed(6)}`);
    console.log(`   Applied (Fund):      ${paymentAmountFund.toFixed(6)}`);
    console.log(
      `   Applied (Foreign):   ${appliedDocumentCurrency.toFixed(6)}`
    );
    console.log(
      `   FX Diff:             ${fxDiff.toFixed(6)} ${
        fxDiff > 0.001 ? "⚠️  LOSS" : fxDiff < -0.001 ? "✅ GAIN" : "➖ NONE"
      }`
    );
    console.log(
      `   Will Be Paid:        ${willBePaid ? "✅ YES" : "⏳ PARTIAL"}`
    );
    console.log("========================================\n");

    // ── Create payment doc ─────────────────────────────────────
    const paymentSeq = await getNextCounterValue({
      companyId,
      name: "Payment",
      session,
    });

    const paymentPayload = {
      companyId,
      counter: Number(counter || 0) + Number(paymentSeq),
      party: { id: party.id, name: party.name, type: party.type },
      fund: {
        id: fund.id,
        name: fund.name,
        currencyId: fund.currencyId || "",
        currencyCode: fund.currencyCode || "",
        exchangeRate: Number(fund.exchangeRate || 1),
      },
      paymentNature,
      payment: {
        amount: paymentAmountFund,
        currencyId: payment?.currencyId || "",
        currencyCode: payment?.currencyCode || "",
        exchangeRate: Number(payment?.exchangeRate || 1),
        amountMainCurrency: paymentAmountMain,
      },
      date,
      description,
      journalCounter,
      file: req.body?.file || "",
      allocations: [
        {
          documentId: sales._id,
          documentName: sales.invoiceName,
          documentCounter: sales.counter,
          documentCurrencyCode: sales.currency?.currencyCode || "",
          allocatedAmountMainCurrency: paymentAmountMain,
          allocatedAmountDocumentCurrency: appliedDocumentCurrency,
          documentTotal: sales.invoiceGrandTotal,
          documentType: "sales_invoice",
          fxDiff,
          invoiceRate,
          paymentRate,
        },
      ],
      postedBy: postedBy || null,
      postedAt: postedAt || new Date(),
    };

    const paymentDocs = await paymentModel.create([paymentPayload], {
      session,
    });
    const newPayment = paymentDocs[0];
    let createdPayment = newPayment;

    // ── Update invoice ─────────────────────────────────────────
    sales.totalRemainderMainCurrency = willBePaid
      ? 0
      : invoiceRemainderMain - paymentAmountMain;
    sales.totalRemainder = willBePaid
      ? 0
      : invoiceRemainderForeign - appliedDocumentCurrency;

    if (willBePaid) {
      sales.paymentsStatus = "paid";
      sales.paid = "paid";
    }

    sales.payments.push({
      payment: paymentAmountFund,
      paymentMainCurrency: paymentAmountMain,
      financialFunds: fund.name,
      paymentID: newPayment._id,
      financialFundsCurrencyCode: fund.currencyCode,
      exchangeRate: fund.exchangeRate,
      date,
      paymentInInvoiceCurrency: appliedDocumentCurrency,
      financialFundsId: fund.id,
      fxDiff,
      invoiceRate,
      paymentRate,
    });

    await sales.save({ session });

    await createInvoiceHistory(
      companyId,
      sales._id,
      "payment",
      req.user._id,
      date,
      `${paymentAmountFund} ${fund.currencyCode}`,
      "invoice",
      session
    );

    // ── Customer entity effect ─────────────────────────────────
    await handleCustomerPaymentEntity({
      customer,
      companyId,
      totalMainCurrency: paymentAmountMain,
      paymentInFundCurrency: paymentAmountFund,
      paymentId: newPayment._id,
      refId: sales._id,
      date,
      description,
      currencyCode: fund.currencyCode,
      effectSide: paymentNature === "outgoing" ? "destination" : "source",
      session,
      fxDiff,
    });

    // ── Fund entity effect ─────────────────────────────────────
    // incoming = customer pays us  → money ENTERS fund → destination
    // outgoing = we pay customer   → money LEAVES fund → source
    await handleFundPaymentEntity({
      fund,
      companyId,
      paymentInFundCurrency: paymentAmountFund,
      paymentId: newPayment._id,
      refId: sales._id,
      date,
      description,
      effectSide: paymentNature === "incoming" ? "destination" : "source",
      sourceExchangeRate: invoiceRate,
      paymentNature,
      session,
    });

    // ── Journal ────────────────────────────────────────────────
    // only for standalone payments — not when called from invoice creation
    if (journalAccounts && ownsSession) {
      await savePaymentJournal({
        journalAccounts,
        paymentAmountMain,
        totalFxDiff: fxDiff,
        date,
        description,
        journalCounter,
        companyId,
        session,
        payment: newPayment,
        partyName: party.name,
        paymentNature,
      });
    }

    return createdPayment;
  };

  try {
    if (ownsSession) {
      let result;
      await session.withTransaction(async () => {
        result = await run();
      });
      return result;
    } else {
      return await run();
    }
  } catch (err) {
    throw err;
  } finally {
    if (ownsSession) await session.endSession();
  }
};

const handleExpensePayment = async (
  req, // kept for signature compatibility with other handlers
  companyId,
  next,
  normalizedPayment,
  externalSession = null
) => {
  const ownsSession = !externalSession;
  const session = externalSession || (await mongoose.startSession());

  const run = async () => {
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
      journalAccounts,
      invoiceId,
      // ── extracted in controller — no req needed inside ──────────
      isCash = false,
      userId = null,
    } = normalizedPayment;

    if (!fund?.id) throw new Error("Fund id is required");
    if (!isCash && (!party?.id || !party?.type))
      throw new Error("Party is required");
    if (!isCash && party?.type !== "supplier")
      throw new Error("Expense payment destination must be supplier");

    // ── Fetch expense ──────────────────────────────────────────
    const expense = await expensesModel
      .findOne({
        _id: invoiceId, // ← from normalizedPayment, not req
        status: { $nin: ["cancelled", "draft"] },
        companyId,
      })
      .session(session);

    if (!expense) throw new Error("Expense invoice not found");

    // ── Fetch supplier (if not cash) ──────────────────────────
    let supplier = null;
    if (!isCash) {
      // ← from normalizedPayment, not req
      supplier = await suppliersModel
        .findOne({ _id: expense.supllier.id, companyId })
        .session(session);
      if (!supplier) throw new Error("Supplier not found");
    }

    // ── Resolve amounts with FX + tolerance ───────────────────
    const invoiceRemainderMain = Number(
      expense.totalRemainderMainCurrency || 0
    );
    const invoiceRemainderForeign = Number(expense.totalRemainder || 0);
    const invoiceRate = Number(expense.currency?.exchangeRate || 1);

    const {
      isSameCurrency,
      paymentRate,
      paymentAmountMain,
      paymentAmountFund,
      paymentAmountInvoice, // ← add this
      appliedDocumentCurrency,
      fxDiff,
      willBePaid,
    } = resolvePaymentAmounts({
      fund,
      payment, // ← payment already has amountInvoiceCurrency from frontend
      invoiceRemainderMain,
      invoiceRemainderForeign,
      invoiceRate,
      invoiceCurrencyCode: expense?.currency?.currencyCode,
    });

    console.log("========================================");
    console.log("   EXPENSE PAYMENT");
    console.log("========================================");
    console.log(
      `   Expense:          ${expense.expenseName} (${expense.counter})`
    );
    console.log(`   Currency:         ${expense?.currency?.currencyCode}`);
    console.log(`   Invoice Rate:     ${invoiceRate}`);
    console.log(
      `   Fund:             ${fund.name} (${fund.currencyCode}) @ ${paymentRate}`
    );
    console.log(`   isCash:           ${isCash ? "YES" : "NO"}`);
    console.log(`   Same Currency:    ${isSameCurrency ? "YES" : "NO"}`);
    console.log(`   Payment (USD):    ${paymentAmountMain.toFixed(6)}`);
    console.log(
      `   FX Diff:          ${fxDiff.toFixed(6)} ${
        fxDiff > 0.001 ? "⚠️  LOSS" : fxDiff < -0.001 ? "✅ GAIN" : "➖ NONE"
      }`
    );
    console.log(`   Will Be Paid:     ${willBePaid ? "✅ YES" : "⏳ PARTIAL"}`);
    console.log("========================================\n");

    // ── Create payment doc ─────────────────────────────────────
    const paymentSeq = await getNextCounterValue({
      companyId,
      name: "Payment",
      session,
    });

    const paymentPayload = {
      companyId,
      counter: Number(counter || 0) + Number(paymentSeq),
      party: { id: party.id, name: party.name, type: party.type },
      fund: {
        id: fund.id,
        name: fund.name,
        currencyId: fund.currencyId || "",
        currencyCode: fund.currencyCode || "",
        exchangeRate: Number(fund.exchangeRate || 1),
      },
      paymentNature,
      payment: {
        amount: paymentAmountFund,
        currencyId: payment?.currencyId || "",
        currencyCode: payment?.currencyCode || "",
        exchangeRate: Number(payment?.exchangeRate || 1),
        amountMainCurrency: paymentAmountMain,
      },
      date,
      description,
      journalCounter,
      allocations: [
        {
          documentId: expense._id,
          documentName: expense.expenseName,
          documentCounter: expense.counter,
          documentCurrencyCode: expense.currency?.currencyCode || "",
          allocatedAmountMainCurrency: paymentAmountMain,
          allocatedAmountDocumentCurrency: appliedDocumentCurrency,
          documentTotal: expense.expenceTotal,
          documentType: "expense",
          fxDiff,
          invoiceRate,
          paymentRate,
        },
      ],
      postedBy: postedBy || null,
      postedAt: postedAt || new Date(),
    };

    const paymentDocs = await paymentModel.create([paymentPayload], {
      session,
    });
    const newPayment = paymentDocs[0];
    let createdPayment = newPayment;

    // ── Update expense ─────────────────────────────────────────
    expense.totalRemainderMainCurrency = willBePaid
      ? 0
      : invoiceRemainderMain - paymentAmountMain;
    expense.totalRemainder = willBePaid
      ? 0
      : invoiceRemainderForeign - appliedDocumentCurrency;
    if (willBePaid) expense.paymentStatus = "paid";

    expense.payments.push({
      payment: paymentAmountFund,
      paymentMainCurrency: paymentAmountMain,
      financialFunds: fund.name,
      paymentID: newPayment._id,
      financialFundsCurrencyCode: fund.currencyCode,
      exchangeRate: fund.exchangeRate,
      date,
      paymentInInvoiceCurrency: appliedDocumentCurrency,
      financialFundsId: fund.id,
      fxDiff,
      invoiceRate,
      paymentRate,
    });

    await expense.save({ session });

    await createInvoiceHistory(
      companyId,
      expense._id,
      "payment",
      userId, // ← from normalizedPayment, not req.user._id
      date,
      `${paymentAmountFund} ${fund.currencyCode}`,
      "invoice",
      session
    );

    // ── Supplier entity effect (if not cash) ──────────────────
    if (!isCash && supplier) {
      // ← from normalizedPayment, not req
      await handleSupplierPaymentEntity({
        supplier,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: paymentAmountFund,
        paymentId: newPayment._id,
        refId: expense._id,
        date,
        description,
        currencyCode: fund.currencyCode,
        effectSide: "destination",
        session,
        fxDiff,
      });
    }

    // ── Fund entity effect ─────────────────────────────────────
    await handleFundPaymentEntity({
      fund,
      companyId,
      paymentInFundCurrency: paymentAmountFund,
      paymentId: newPayment._id,
      refId: expense._id,
      date,
      description,
      effectSide: "source",
      sourceExchangeRate: invoiceRate,
      paymentNature,
      session,
    });

    // ── Journal — standalone only, not from invoice creation ──
    if (journalAccounts && ownsSession) {
      await savePaymentJournal({
        journalAccounts,
        paymentAmountMain,
        totalFxDiff: fxDiff,
        date,
        description,
        journalCounter,
        companyId,
        session,
        payment: newPayment,
        partyName: party.name,
        paymentNature,
      });
    }

    return createdPayment;
  };

  try {
    if (ownsSession) {
      let result;
      await session.withTransaction(async () => {
        result = await run();
      });
      return result;
    } else {
      return await run();
    }
  } catch (err) {
    throw err;
  } finally {
    if (ownsSession) await session.endSession();
  }
};
const handleCustomerPayment = async (
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
        party,
        fund,
        paymentNature,
        payment,
        date,
        description,
        journalCounter,
        counter,
        postedBy,
        postedAt,
        journalAccounts, // ✅ added for consistency with supplier
      } = normalizedPayment;

      if (!fund?.id) throw new Error("Fund id is required");

      if (!party?.id || !party?.type) throw new Error("Party is required");

      if (!["customer", "supplier"].includes(party.type)) {
        throw new Error(
          "Fund payment context supports only customer or supplier as party"
        );
      }

      if (!["incoming", "outgoing"].includes(paymentNature)) {
        throw new Error(
          "Fund payment context supports only incoming or outgoing paymentNature"
        );
      }

      const customer = await customarModel
        .findOne({ _id: party?.id, companyId })
        .session(session);

      if (!customer) throw new Error("Customer not found");
      console.log("payment", payment);
      const paymentAmountMain = Number(payment.amountMainCurrency || 0);
      const paymentAmountInvoice = Number(payment.amount || 0);

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

      const newPayment = paymentDocs[0];
      createdPayment = newPayment;

      /*
        |--------------------------------------------------------------------------
        | SETTLE OPEN DOCUMENTS
        |--------------------------------------------------------------------------
        */
      let totalFxDiff = 0;
      if (paymentNature !== "outgoing") {
        const {
          allocations,
          remainingPaymentMain,
          totalFxDiff: fxDiff,
        } = await settleCustomerOpenDocuments({
          customer,
          fund,
          payment: newPayment,
          paymentAmountMain,
          date,
          companyId,
          session,
        });
        totalFxDiff = fxDiff;
        newPayment.allocations = allocations;
        await newPayment.save({ session });
      }

      /*
        |--------------------------------------------------------------------------
        | CUSTOMER SIDE EFFECT
        |--------------------------------------------------------------------------
        */
      await handleCustomerPaymentEntity({
        customer,
        companyId,
        totalMainCurrency: paymentAmountMain,
        paymentInFundCurrency: payment.amount,
        paymentId: newPayment._id,
        refId: "",
        date,
        description,
        currencyCode: fund.currencyCode,
        effectSide: paymentNature === "outgoing" ? "destination" : "source",
        session,
        fxDiff: totalFxDiff,
      });

      /*
        |--------------------------------------------------------------------------
        | FUND SIDE EFFECT
        |--------------------------------------------------------------------------
        */
      await handleFundPaymentEntity({
        fund,
        companyId,
        paymentInFundCurrency: paymentAmountInvoice,
        paymentId: newPayment._id,
        refId: "",
        date,
        description,
        effectSide: paymentNature === "incoming" ? "destination" : "source",
        sourceExchangeRate: 1,
        session,
      });

      /*
        |--------------------------------------------------------------------------
        | JOURNAL (optional but now consistent with supplier)
        |--------------------------------------------------------------------------
        */
      if (journalAccounts) {
        await savePaymentJournal({
          journalAccounts,
          paymentAmountMain,
          totalFxDiff: 0, // or compute later if you add FX for customer side
          date,
          description,
          journalCounter,
          companyId,
          session,
          payment: newPayment,
          partyName: party.name,
          paymentNature,
        });
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
  const { party } = normalizedPayment;
  if (!party?.type) {
    throw new Error("Party type is required");
  }

  if (party.type === "customer") {
    return await handleCustomerPayment(req, companyId, next, normalizedPayment);
  }

  if (party.type === "supplier") {
    return await handleSupplierPayment(req, companyId, next, normalizedPayment);
  }

  throw new Error("Invalid party type");
};

const handleSalaryPayment = async (req, companyId, next, normalizedPayment) => {
  const session = await mongoose.startSession();

  try {
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

      if (paymentNature !== "outgoing") {
        throw new Error(
          "Fund payment context supports only outgoing paymentNature"
        );
      }

      let paymentAmountMain = Number(payment.amountMainCurrency || 0);
      let paymentAmountInvoice = Number(payment.amount || 0);

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
      const newPayment = paymentDocs[0];

      await handleFundPaymentEntity({
        fund: fund,
        companyId,
        paymentInFundCurrency: paymentAmountInvoice,
        paymentId: newPayment._id,
        refId: party.id,
        date,
        description,
        effectSide: "source",
        sourceExchangeRate: 1,
        session,
      });
    });
  } catch (err) {
    throw err;
  } finally {
    await session.endSession();
  }
};

const savePaymentJournal = async ({
  journalAccounts, // { cashAccountId, partyAccountId }
  paymentAmountMain, // total payment in USD
  totalFxDiff, // from settleSupplierOpenDocuments (+ = loss, - = gain)
  date,
  description,
  journalCounter,
  companyId,
  session,
  payment, // the created payment doc
  partyName, // supplier or customer name
  paymentNature, // "outgoing" | "incoming"
}) => {
  // ── 1. Fetch the two accounts by ID ─────────────────────────────────────
  const [cashAccount, partyAccount] = await Promise.all([
    accountingTreeModel
      .findById(journalAccounts.cashAccountId)
      .populate("currency")
      .session(session),
    accountingTreeModel
      .findById(journalAccounts.partyAccountId)
      .populate("currency")
      .session(session),
  ]);

  if (!cashAccount)
    throw new Error(`Cash account not found: ${journalAccounts.cashAccountId}`);
  if (!partyAccount)
    throw new Error(
      `Party account not found: ${journalAccounts.partyAccountId}`
    );

  // ── 2. Resolve party accountType ────────────────────────────────────────
  // used for filtering in cancelPaymentService
  const partyAccountType =
    payment.party?.type === "customer"
      ? "Customer_Payment"
      : "Supplier_Payment";

  // ── 3. Fetch FX accounts (only if FX diff exists) ────────────────────────
  let fxGainAccount = null;
  let fxLossAccount = null;

  if (Math.abs(totalFxDiff) > 0.000001) {
    const linkings = await linkPanelModel
      .find({ companyId })
      .populate("accountData")
      .session(session);

    const fxGainLink = linkings.find((l) => l.name === "Foreign Exchange Gain");
    const fxLossLink = linkings.find((l) => l.name === "Foreign Exchange Loss");

    fxGainAccount = fxGainLink?.accountData || null;
    fxLossAccount = fxLossLink?.accountData || null;

    if (!fxGainAccount)
      throw new Error("Foreign Exchange Gain account not linked");
    if (!fxLossAccount)
      throw new Error("Foreign Exchange Loss account not linked");
  }

  // ── 4. Build journal entries ─────────────────────────────────────────────
  // outgoing = paying supplier/customer:
  //   DR  Party           full invoice amount   accountType: Supplier_Payment / Customer_Payment
  //   CR  Cash (fund)     payment amount        accountType: Cash
  //   DR  FX Loss         if loss               accountType: FX_Loss
  //   CR  Party offset    FX diff               accountType: Supplier_Payment / Customer_Payment
  //
  // incoming = receiving from party:
  //   DR  Cash (fund)     payment amount        accountType: Cash
  //   CR  Party           full invoice amount   accountType: Supplier_Payment / Customer_Payment
  //   CR  FX Gain         if gain               accountType: FX_Gain
  //   DR  Party offset    FX diff               accountType: Supplier_Payment / Customer_Payment

  const isOutgoing = paymentNature === "outgoing";
  const absFxDiff = Math.abs(totalFxDiff);
  const isLoss = totalFxDiff > 0.000001;
  const isGain = totalFxDiff < -0.000001;

  const journalEntries = [];
  let entryCounter = 1;

  if (isOutgoing) {
    // DR Party — closing what we owe
    journalEntries.push({
      counter: entryCounter++,
      id: partyAccount._id,
      name: partyAccount.name,
      code: partyAccount.code,
      accountDebit:
        paymentAmountMain * (Number(partyAccount.currency?.exchangeRate) || 1),
      accountCredit: 0,
      MainDebit: paymentAmountMain,
      MainCredit: 0,
      accountCurrency: partyAccount.currency?.currencyCode || "",
      accountExRate: Number(partyAccount.currency?.exchangeRate) || 1,
      isPrimary: partyAccount.currency?.is_primary === "true",
      Desc: description,
      accountType: partyAccountType, // ← Supplier_Payment or Customer_Payment
    });

    // CR Cash — paying out
    journalEntries.push({
      counter: entryCounter++,
      id: cashAccount._id,
      name: cashAccount.name,
      code: cashAccount.code,
      accountDebit: 0,
      accountCredit:
        paymentAmountMain * (Number(cashAccount.currency?.exchangeRate) || 1),
      MainDebit: 0,
      MainCredit: paymentAmountMain,
      accountCurrency: cashAccount.currency?.currencyCode || "",
      accountExRate: Number(cashAccount.currency?.exchangeRate) || 1,
      isPrimary: cashAccount.currency?.is_primary === "true",
      Desc: description,
      accountType: "Cash", // ← Cash
    });
  } else {
    // DR Cash — receiving
    journalEntries.push({
      counter: entryCounter++,
      id: cashAccount._id,
      name: cashAccount.name,
      code: cashAccount.code,
      accountDebit:
        paymentAmountMain * (Number(cashAccount.currency?.exchangeRate) || 1),
      accountCredit: 0,
      MainDebit: paymentAmountMain,
      MainCredit: 0,
      accountCurrency: cashAccount.currency?.currencyCode || "",
      accountExRate: Number(cashAccount.currency?.exchangeRate) || 1,
      isPrimary: cashAccount.currency?.is_primary === "true",
      Desc: description,
      accountType: "Cash", // ← Cash
    });

    // CR Party
    journalEntries.push({
      counter: entryCounter++,
      id: partyAccount._id,
      name: partyAccount.name,
      code: partyAccount.code,
      accountDebit: 0,
      accountCredit:
        paymentAmountMain * (Number(partyAccount.currency?.exchangeRate) || 1),
      MainDebit: 0,
      MainCredit: paymentAmountMain,
      accountCurrency: partyAccount.currency?.currencyCode || "",
      accountExRate: Number(partyAccount.currency?.exchangeRate) || 1,
      isPrimary: partyAccount.currency?.is_primary === "true",
      Desc: description,
      accountType: partyAccountType, // ← Supplier_Payment or Customer_Payment
    });
  }

  // ── 5. FX Loss entries ───────────────────────────────────────────────────
  if (isLoss && fxLossAccount) {
    // DR FX Loss account
    journalEntries.push({
      counter: entryCounter++,
      id: fxLossAccount._id,
      name: fxLossAccount.name,
      code: fxLossAccount.code,
      accountDebit: absFxDiff,
      accountCredit: 0,
      MainDebit: absFxDiff,
      MainCredit: 0,
      accountCurrency: fxLossAccount.currency?.currencyCode || "",
      accountExRate: Number(fxLossAccount.currency?.exchangeRate) || 1,
      isPrimary: fxLossAccount.currency?.is_primary === "true",
      Desc: "FX Loss on payment",
      accountType: "FX_Loss", // ← FX_Loss
    });

    // CR Party — FX offset
    journalEntries.push({
      counter: entryCounter++,
      id: partyAccount._id,
      name: partyAccount.name,
      code: partyAccount.code,
      accountDebit: 0,
      accountCredit: absFxDiff,
      MainDebit: 0,
      MainCredit: absFxDiff,
      accountCurrency: partyAccount.currency?.currencyCode || "",
      accountExRate: Number(partyAccount.currency?.exchangeRate) || 1,
      isPrimary: partyAccount.currency?.is_primary === "true",
      Desc: "FX Loss offset",
      accountType: partyAccountType, // ← same as party
    });
  }

  // ── 6. FX Gain entries ───────────────────────────────────────────────────
  if (isGain && fxGainAccount) {
    // CR FX Gain account
    journalEntries.push({
      counter: entryCounter++,
      id: fxGainAccount._id,
      name: fxGainAccount.name,
      code: fxGainAccount.code,
      accountDebit: 0,
      accountCredit: absFxDiff,
      MainDebit: 0,
      MainCredit: absFxDiff,
      accountCurrency: fxGainAccount.currency?.currencyCode || "",
      accountExRate: Number(fxGainAccount.currency?.exchangeRate) || 1,
      isPrimary: fxGainAccount.currency?.is_primary === "true",
      Desc: "FX Gain on payment",
      accountType: "FX_Gain", // ← FX_Gain
    });

    // DR Party — FX offset
    journalEntries.push({
      counter: entryCounter++,
      id: partyAccount._id,
      name: partyAccount.name,
      code: partyAccount.code,
      accountDebit: absFxDiff,
      accountCredit: 0,
      MainDebit: absFxDiff,
      MainCredit: 0,
      accountCurrency: partyAccount.currency?.currencyCode || "",
      accountExRate: Number(partyAccount.currency?.exchangeRate) || 1,
      isPrimary: partyAccount.currency?.is_primary === "true",
      Desc: "FX Gain offset",
      accountType: partyAccountType, // ← same as party
    });
  }

  // ── 7. Build journal meta ────────────────────────────────────────────────
  const journalName = isOutgoing
    ? `Payment to ${partyName}`
    : `Payment from ${partyName}`;

  const journalDesc = isOutgoing
    ? `Payment to ${partyName} — FX ${
        isLoss ? "Loss" : isGain ? "Gain" : "None"
      }: ${totalFxDiff.toFixed(4)} USD`
    : `Payment from ${partyName} — FX ${
        isLoss ? "Loss" : isGain ? "Gain" : "None"
      }: ${totalFxDiff.toFixed(4)} USD`;

  const journalInfo = {
    journalName,
    journalDate: date,
    journalDesc,
    linkCounter: journalCounter,
    journalType: isOutgoing ? "Payment Out" : "Payment In",
    refCounter: payment.counter,
    refId: payment._id,
    party: payment.party?.id,
    companyId,
  };

  // ── 8. Validate balanced ─────────────────────────────────────────────────
  const totalDebit = journalEntries.reduce(
    (sum, e) => sum + Number(e.MainDebit || 0),
    0
  );
  const totalCredit = journalEntries.reduce(
    (sum, e) => sum + Number(e.MainCredit || 0),
    0
  );

  console.log("========================================");
  console.log("   PAYMENT JOURNAL");
  console.log("========================================");
  console.log(`   Name:     ${journalName}`);
  console.log(`   Date:     ${date}`);
  console.log(
    `   FX Diff:  ${totalFxDiff.toFixed(4)} ${
      isLoss ? "⚠️ LOSS" : isGain ? "✅ GAIN" : "➖ NONE"
    }`
  );
  console.log("   Entries:");
  journalEntries.forEach((e) => {
    console.log(`   [${e.counter}] ${e.name} (${e.code}) [${e.accountType}]`);
    console.log(
      `       DR: ${Number(e.MainDebit).toFixed(4)}  CR: ${Number(
        e.MainCredit
      ).toFixed(4)}`
    );
  });
  console.log(
    `   Total DR: ${totalDebit.toFixed(4)}  CR: ${totalCredit.toFixed(4)}`
  );
  console.log(
    `   Balanced: ${
      Math.abs(totalDebit - totalCredit) < 0.001 ? "✅ YES" : "❌ NO"
    }`
  );
  console.log("========================================\n");

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `Journal is not balanced — DR: ${totalDebit} CR: ${totalCredit}`
    );
  }

  // ── 9. Save journal ──────────────────────────────────────────────────────
  const nextCounterJournal = await counterModel.findOneAndUpdate(
    { companyId, name: "Journal" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  await createJournalEntryService({
    data: {
      ...journalInfo,
      journalAccounts: journalEntries,
      counter: payment.counter || 0,
    },
    companyId,
    nextCounterJournal,
    session,
  });

  return {
    journalInfo,
    journalEntries,
    totalDebit,
    totalCredit,
    totalFxDiff,
  };
};

const buildReversalJournal = async ({
  payment,
  companyId,
  date,
  description,
  session,
}) => {
  const amountMain = Number(payment.payment?.amountMainCurrency || 0);
  const isOutgoing = payment.paymentNature === "outgoing";
  const partyId = payment.party?.id;
  const partyName = payment.party?.name;
  const partyType = payment.party?.type;

  // fetch accounts from journal linkings
  const linkings = await linkPanelModel
    .find({ companyId })
    .populate("accountData")
    .session(session);

  // resolve cash account from fund linkAccount
  // for simplicity — use journal account IDs stored on payment if available
  // otherwise fall back to linkings
  const journalAccountIds = payment.journalAccounts || null;

  if (!journalAccountIds?.cashAccountId || !journalAccountIds?.partyAccountId) {
    console.warn(
      "⚠️ No journal account IDs on payment — skipping journal reversal"
    );
    return null;
  }

  const [cashAccount, partyAccount] = await Promise.all([
    accountingTreeModel
      .findById(journalAccountIds.cashAccountId)
      .session(session),
    accountingTreeModel
      .findById(journalAccountIds.partyAccountId)
      .session(session),
  ]);

  if (!cashAccount || !partyAccount) {
    console.warn(
      "⚠️ Cash or party account not found — skipping journal reversal"
    );
    return null;
  }

  // ── Build reversed entries ─────────────────────────────────────
  // Original outgoing: DR Party  CR Cash
  // Reversal outgoing: DR Cash   CR Party
  //
  // Original incoming: DR Cash   CR Party
  // Reversal incoming: DR Party  CR Cash

  const entries = [];
  let counter = 1;

  if (isOutgoing) {
    // reversal: DR Cash, CR Party
    entries.push({
      counter: counter++,
      id: cashAccount._id,
      name: cashAccount.name,
      code: cashAccount.code,
      MainDebit: amountMain,
      MainCredit: 0,
      accountDebit:
        amountMain * (Number(cashAccount.currency?.exchangeRate) || 1),
      accountCredit: 0,
      accountCurrency: cashAccount.currency?.currencyCode || "",
      accountExRate: Number(cashAccount.currency?.exchangeRate) || 1,
      isPrimary: cashAccount.currency?.is_primary === "true",
      Desc: description || `Payment reversal`,
    });
    entries.push({
      counter: counter++,
      id: partyAccount._id,
      name: partyAccount.name,
      code: partyAccount.code,
      MainDebit: 0,
      MainCredit: amountMain,
      accountDebit: 0,
      accountCredit:
        amountMain * (Number(partyAccount.currency?.exchangeRate) || 1),
      accountCurrency: partyAccount.currency?.currencyCode || "",
      accountExRate: Number(partyAccount.currency?.exchangeRate) || 1,
      isPrimary: partyAccount.currency?.is_primary === "true",
      Desc: description || `Payment reversal`,
    });
  } else {
    // reversal: DR Party, CR Cash
    entries.push({
      counter: counter++,
      id: partyAccount._id,
      name: partyAccount.name,
      code: partyAccount.code,
      MainDebit: amountMain,
      MainCredit: 0,
      accountDebit:
        amountMain * (Number(partyAccount.currency?.exchangeRate) || 1),
      accountCredit: 0,
      accountCurrency: partyAccount.currency?.currencyCode || "",
      accountExRate: Number(partyAccount.currency?.exchangeRate) || 1,
      isPrimary: partyAccount.currency?.is_primary === "true",
      Desc: description || `Payment reversal`,
    });
    entries.push({
      counter: counter++,
      id: cashAccount._id,
      name: cashAccount.name,
      code: cashAccount.code,
      MainDebit: 0,
      MainCredit: amountMain,
      accountDebit: 0,
      accountCredit:
        amountMain * (Number(cashAccount.currency?.exchangeRate) || 1),
      accountCurrency: cashAccount.currency?.currencyCode || "",
      accountExRate: Number(cashAccount.currency?.exchangeRate) || 1,
      isPrimary: cashAccount.currency?.is_primary === "true",
      Desc: description || `Payment reversal`,
    });
  }

  return entries;
};

module.exports = {
  handlePurchasePayment,
  handleSupplierPayment,
  handleSalesPayment,
  handleExpensePayment,
  handleCustomerPayment,
  handleFundPayment,
  handleFundPaymentEntity,
  handleSalaryPayment,
  buildReversalJournal,
  reverseAllocation,
};
