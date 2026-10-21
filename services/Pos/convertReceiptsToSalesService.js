// convertReceiptsToSalesService.js
// Group of POS receipts (one sales point) → one sales invoice (primary currency) → one journal.
// No inventory / fund / customer effects: the receipts already applied them.
//
// dryRun = true  → computes + logs every step, writes NOTHING, returns the preview
// dryRun = false → writes invoice, journal, stamps receipts
// debug  = true  → console output for each step

const financialFundsModel = require("../../models/Accounting/CurrentAssets/financialFundsModel");
const orderModel = require("../../models/Accounting/Sales/orderModel");
const accountingTreeModel = require("../../models/accountingTreeModel");
const linkPanelModel = require("../../models/linkPanelModel");
const posReceiptModel = require("../../models/Pos/pos.receipt.model");
const salesPointModel = require("../../models/Pos/salesPointModel");
const counterModel = require("../../models/Settings/counterModel");
const ApiError = require("../../utils/apiError");
const { buildCounter } = require("../../utils/buildCounter");
const {
  createJournalEntryService,
} = require("../Accounting/JournalEntries/journalEntries.Service");
const { createInvoiceHistory } = require("../invoiceHistoryService");

const INVENTORY_TYPES = ["Normal", "product", "unTracedproduct", "rawmaterial"];

const round = (n, d = 6) => Math.round((Number(n) || 0) * 10 ** d) / 10 ** d;

// ── Journal line from a populated account doc ────────────────────────────────
const toJournalLine = (
  acc,
  accountType,
  {
    mainDebit = 0,
    mainCredit = 0,
    accountDebit,
    accountCredit,
    accountExRate,
    desc = "",
  },
) => {
  const rate = Number(acc?.currency?.exchangeRate) || 1;
  return {
    id: acc._id,
    name: acc.name,
    code: acc.code,
    accountCurrency: acc.currency?.currencyCode || "",
    isPrimary: acc.currency?.is_primary === true,
    accountExRate: accountExRate ?? rate,
    MainDebit: round(mainDebit),
    MainCredit: round(mainCredit),
    accountDebit: round(accountDebit ?? mainDebit * rate),
    accountCredit: round(accountCredit ?? mainCredit * rate),
    Desc: desc,
    accountType,
  };
};

const mergeBatches = (target, batches = []) => {
  for (const b of batches) {
    const hit = target.find((t) => t.id === b.id);
    if (hit) hit.quantity += Number(b.quantity || 0);
    else target.push({ id: b.id, quantity: Number(b.quantity || 0) });
  }
  return target;
};

// ── Aggregate receipts into primary-currency values ─────────────────────────
const aggregateReceipts = (receipts, log = () => {}, debug = false) => {
  const lines = new Map(); // productId|priceMain|taxId|stock
  const taxSummary = new Map(); // taxId
  const funds = new Map(); // fundId
  const tags = new Map(); // tag id
  let subTotal = 0;
  let tax = 0;
  let cogs = 0;
  let serviceSubTotal = 0;
  let fxDiff = 0;
  const perReceipt = [];
  const issues = [];

  for (const r of receipts) {
    const rawRate = Number(r.currency?.exchangeRate);
    if (!(rawRate > 0)) issues.push(`${r.counter}: invalid currency rate`);

    const rate = rawRate > 0 ? rawRate : 1;
    const rSub = Number(r.invoiceSubTotal || 0) / rate;
    const rTax = Number(r.invoiceTax || 0) / rate;
    subTotal += rSub;
    tax += rTax;

    let rCogs = 0;
    let rCashMain = 0;
    let rFx = 0;

    // Lines
    for (const item of r.cartItems || []) {
      const qty = Number(item.soldQuantity || 0);
      if (!qty) continue;

      if (!item.id) {
        issues.push(`${r.counter}: line "${item.name}" has no product id`);
      }

      const priceMain = Number(item.sellingPrice || 0) / rate;
      const withoutTax = Number(item.totalWithoutTax || 0) / rate;
      const taxValue = Number(item.taxValue || 0) / rate;
      const total = Number(item.total || 0) / rate;
      const stockId = String(r.stock || "");

      if (INVENTORY_TYPES.includes(item.type)) {
        const c = Number(item.buyingpriceMainCurrence || 0) * qty;
        cogs += c;
        rCogs += c;
      }

      if (item.type === "Service") serviceSubTotal += withoutTax;

      const key = `${item.id}|${round(priceMain)}|${item.tax?._id || ""}|${stockId}`;
      const prev = lines.get(key);

      if (prev) {
        prev.soldQuantity += qty;
        prev.totalWithoutTax += withoutTax;
        prev.taxValue += taxValue;
        prev.total += total;
        mergeBatches(prev.batches, item.batches);
      } else {
        lines.set(key, {
          ...item,
          type: item.type === "Normal" ? "product" : item.type,
          sellingPrice: priceMain,
          convertedBuyingPrice: Number(item.buyingpriceMainCurrence || 0),
          soldQuantity: qty,
          totalWithoutTax: withoutTax,
          taxValue,
          total,
          discountAmount: 0,
          discountPercentege: 0,
          stock: { _id: stockId },
          batches: mergeBatches([], item.batches),
        });
      }
    }

    // Tax summary (by taxId)
    for (const t of r.taxSummary || []) {
      const key = t.taxId || "";
      const value = Number(t.discountTaxValue || 0) / rate;

      if (value > 0 && !t.salesAccountTax) {
        issues.push(`${r.counter}: tax ${t.taxRate}% has no sales tax account`);
      }

      const prev = taxSummary.get(key);
      if (prev) {
        prev.totalTaxValue += value;
        prev.discountTaxValue += value;
      } else {
        taxSummary.set(key, {
          taxId: t.taxId,
          taxRate: t.taxRate,
          salesAccountTax: t.salesAccountTax,
          totalTaxValue: value,
          discountTaxValue: value,
        });
      }
    }

    // Funds (by fundId) + FX
    for (const f of r.financialFund || []) {
      const fundAmt = Number(f.collectedAmount || 0);
      if (!fundAmt) continue;

      if (!f.fundId) {
        issues.push(`${r.counter}: fund "${f.fundName}" has no fund id`);
        continue;
      }

      const officialRate = Number(f.exchangeRate) || 1;
      const effectiveRate = Number(f.effectiveRate) || officialRate;

      const mainAmt = fundAmt / officialRate / rate; // real value received
      const appliedMain = fundAmt / effectiveRate / rate; // invoice value settled
      fxDiff += mainAmt - appliedMain;
      rFx += mainAmt - appliedMain;
      rCashMain += mainAmt;

      const prev = funds.get(f.fundId);
      if (prev) {
        prev.fundAmt += fundAmt;
        prev.mainAmt += mainAmt;
      } else {
        funds.set(f.fundId, {
          fundId: f.fundId,
          fundName: f.fundName,
          fundAmt,
          mainAmt,
        });
      }
    }

    for (const t of r.tags || []) {
      if (t?.id && !tags.has(t.id)) tags.set(t.id, { id: t.id, name: t.name });
    }

    const checkTotal = round(
      rSub + rTax - Number(r.totalInMainCurrency || 0),
      4,
    );
    const checkCash = round(
      rCashMain - rFx - Number(r.totalInMainCurrency || 0),
      4,
    );

    if (Math.abs(checkTotal) > 0.01) {
      issues.push(`${r.counter}: subtotal + tax ≠ total`);
    }
    if (Math.abs(checkCash) > 0.01) {
      issues.push(`${r.counter}: payments ≠ total`);
    }

    perReceipt.push({
      counter: r.counter,
      currency: r.currency?.currencyCode,
      rate,
      grandTotal: r.invoiceGrandTotal,
      totalInMainCurrency: r.totalInMainCurrency,
      subMain: round(rSub, 4),
      taxMain: round(rTax, 4),
      cashMain: round(rCashMain, 4),
      fx: round(rFx, 4),
      cogs: round(rCogs, 4),
      // sub + tax should equal totalInMainCurrency; cash − fx should equal it too
      checkTotal,
      checkCash,
    });
  }

  log("2a. per-receipt (checkTotal / checkCash must be 0)");
  if (debug && perReceipt.length) console.table(perReceipt);

  return {
    invoicesItems: [...lines.values()],
    taxSummary: [...taxSummary.values()],
    funds: [...funds.values()],
    tags: [...tags.values()],
    subTotal,
    tax,
    grandTotal: subTotal + tax,
    cogs,
    fxDiff,
    serviceSubTotal,
    issues,
  };
};

// ── Service ──────────────────────────────────────────────────────────────────
exports.convertReceiptsToSalesService = async ({
  companyId,
  salesPointId,
  from, // Date
  to, // Date
  date, // "YYYY-MM-DD" — invoice + journal date
  counter, // zero-filled counter base
  counterDigits,
  primaryCurrency, // primary currency object, same shape as invoice.currency
  user,
  session,
  dryRun = true,
}) => {
  if (!primaryCurrency?.id && !primaryCurrency?._id) {
    throw new ApiError("Primary currency is required", 400);
  }

  // 1. Load
  const receipts = await posReceiptModel
    .find({
      companyId,
      salesPoint: salesPointId,
      journalized: false,
      status: { $ne: "cancelled" },
      createdAt: { $gte: from, $lte: to },
    })
    .session(session)
    .lean();

  if (!receipts.length) {
    throw new ApiError("No receipts to convert", 404);
  }

  const salesPointDoc = await salesPointModel
    .findOne({ _id: salesPointId, companyId })
    .select("name tags")
    .session(session)
    .lean();

  if (!salesPointDoc) throw new ApiError("Sales point not found", 404);

  // 2. Aggregate
  const agg = aggregateReceipts(receipts);

  if (agg.issues.length) {
    throw new ApiError(
      `Cannot convert, fix these receipts first: ${agg.issues.join("; ")}`,
      400,
    );
  }

  // 3. Accounts
  const linkings = await linkPanelModel
    .find({ companyId })
    .populate({ path: "accountData", populate: { path: "currency" } })
    .session(session);

  const linkOptional = (name) =>
    linkings.find((l) => l.name === name)?.accountData || null;

  const link = (name) => {
    const acc = linkOptional(name);
    if (!acc)
      throw new ApiError(`Link panel account "${name}" is not set`, 400);
    return acc;
  };

  const customerAcc = linkOptional("Walk-In Customer") || link("Customers");
  const salesAcc = link("Sales");

  const taxIds = [
    ...new Set(
      agg.taxSummary
        .filter((t) => t.discountTaxValue > 0 && t.salesAccountTax)
        .map((t) => t.salesAccountTax),
    ),
  ];
  const taxAccs = taxIds.length
    ? await accountingTreeModel
        .find({ _id: { $in: taxIds }, companyId })
        .populate("currency")
        .session(session)
    : [];

  const fundDocs = await financialFundsModel
    .find({ _id: { $in: agg.funds.map((f) => f.fundId) }, companyId })
    .populate({ path: "linkAccount", populate: { path: "currency" } })
    .session(session);

  const fundAccount = (fundId) => {
    const fund = fundDocs.find((d) => String(d._id) === String(fundId));
    if (!fund) throw new ApiError(`Fund ${fundId} not found`, 400);

    const acc = fund.linkAccount;
    if (!acc) {
      throw new ApiError(`Fund "${fund.fundName}" has no linked account`, 400);
    }
    if (String(acc.currency?._id) !== String(fund.fundCurrency)) {
      throw new ApiError(
        `Fund "${fund.fundName}" currency does not match its linked account`,
        400,
      );
    }
    return acc;
  };

  const byId = (list, id) => {
    const acc = list.find((a) => String(a._id) === String(id));
    if (!acc) throw new ApiError(`Account ${id} not found`, 400);
    return acc;
  };

  const invoiceFunds = agg.funds.map((f) => {
    const acc = fundAccount(f.fundId);
    return {
      id: f.fundId,
      name: f.fundName,
      currency: acc.currency?.currencyName || "",
      currencyID: String(acc.currency?._id || ""),
      exchangeRate: String(f.mainAmt ? f.fundAmt / f.mainAmt : 1),
      allocatedAmount: f.fundAmt,
    };
  });

  // 4. Journal lines
  const journalAccounts = [];

  journalAccounts.push(
    toJournalLine(customerAcc, "Customer", { mainDebit: agg.grandTotal }),
  );

  const goodsSubTotal = agg.subTotal - agg.serviceSubTotal;

  if (goodsSubTotal > 0.000001) {
    journalAccounts.push(
      toJournalLine(salesAcc, "Sales", { mainCredit: goodsSubTotal }),
    );
  }
  if (agg.serviceSubTotal > 0.000001) {
    journalAccounts.push(
      toJournalLine(link("Sales Service"), "Sales Service", {
        mainCredit: agg.serviceSubTotal,
      }),
    );
  }

  const taxByAccount = new Map();
  for (const t of agg.taxSummary) {
    if (!(t.discountTaxValue > 0) || !t.salesAccountTax) continue;
    taxByAccount.set(
      t.salesAccountTax,
      (taxByAccount.get(t.salesAccountTax) || 0) + t.discountTaxValue,
    );
  }
  for (const [accId, value] of taxByAccount) {
    journalAccounts.push(
      toJournalLine(byId(taxAccs, accId), "Tax", { mainCredit: value }),
    );
  }

  if (agg.cogs > 0) {
    journalAccounts.push(
      toJournalLine(link("cost of sold products"), "cost of sold products", {
        mainDebit: agg.cogs,
      }),
    );
    journalAccounts.push(
      toJournalLine(link("Stocks"), "Stock", { mainCredit: agg.cogs }),
    );
  }

  let cashMainTotal = 0;
  for (const f of agg.funds) {
    cashMainTotal += f.mainAmt;
    journalAccounts.push(
      toJournalLine(fundAccount(f.fundId), "Cash", {
        mainDebit: f.mainAmt,
        accountDebit: f.fundAmt,
        accountExRate: f.mainAmt ? f.fundAmt / f.mainAmt : 1,
      }),
    );
  }

  journalAccounts.push(
    toJournalLine(customerAcc, "Customer_Payment", {
      mainCredit: cashMainTotal,
    }),
  );

  // FX
  if (Math.abs(agg.fxDiff) > 0.001) {
    const isLoss = agg.fxDiff < 0;
    const absFx = Math.abs(agg.fxDiff);
    const fxAcc = link(
      isLoss ? "Foreign Exchange Loss" : "Foreign Exchange Gain",
    );

    journalAccounts.push(
      toJournalLine(fxAcc, isLoss ? "FX_Loss" : "FX_Gain", {
        mainDebit: isLoss ? absFx : 0,
        mainCredit: isLoss ? 0 : absFx,
        desc: `FX ${isLoss ? "Loss" : "Gain"} on POS receipts`,
      }),
    );
    journalAccounts.push(
      toJournalLine(customerAcc, "Customer_Payment", {
        mainDebit: isLoss ? 0 : absFx,
        mainCredit: isLoss ? absFx : 0,
        desc: `FX ${isLoss ? "Loss" : "Gain"} offset`,
      }),
    );
  }

  journalAccounts.forEach((a, i) => (a.counter = i + 1));

  const totalDebit = round(
    journalAccounts.reduce((s, a) => s + a.MainDebit, 0),
  );
  const totalCredit = round(
    journalAccounts.reduce((s, a) => s + a.MainCredit, 0),
  );

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new ApiError(
      `POS journal not balanced: Dr ${totalDebit} / Cr ${totalCredit}`,
      400,
    );
  }

  // 5. Sales invoice payload
  const orderDate = `${date}T${new Date().toISOString().split("T")[1]}`;
  const invoiceName = `POS ${salesPointDoc.name} ${date}`;
  const linkCounter = Date.now();

  const invoicePayload = {
    employee: { id: user._id, name: user.name },
    invoicesItems: agg.invoicesItems,
    returnCartItem: agg.invoicesItems,
    customer: { id: "", name: "", linkAccount: customerAcc._id },
    currency: primaryCurrency,
    currencyExchangeRate: 1,
    financailFund: invoiceFunds,
    paymentsStatus: "paid",
    totalInMainCurrency: agg.grandTotal,
    invoiceSubTotal: agg.subTotal,
    subtotalWithDiscount: agg.subTotal,
    invoiceDiscount: 0,
    manuallInvoiceDiscount: 0,
    manuallInvoiceDiscountValue: 0,
    invoiceGrandTotal: agg.grandTotal,
    taxSummary: agg.taxSummary,
    invoiceTax: agg.tax,
    invoiceName,
    tag: (salesPointDoc.tags || []).map((t) => ({
      id: t.id || String(t._id),
      name: t.name,
    })),
    companyId,
    orderDate,
    paymentDate: orderDate,
    totalRemainder: 0,
    totalRemainderMainCurrency: 0,
    status: "posted",
    isDraft: false,
    postedBy: user._id,
    postedAt: new Date(),
    source: "pos",
    salesPoint: salesPointId,
    journalCounter: linkCounter,
  };

  const journalInfo = {
    journalName: invoiceName,
    journalDate: date,
    journalDesc: `${invoiceName} (${receipts.length} receipts) with value ${round(
      agg.grandTotal,
      2,
    )} ${primaryCurrency?.currencyCode || ""}`,
    linkCounter,
    journalType: "Sales",
    counter,
    party: "",
  };

  // DRY RUN: stop before any write
  if (dryRun) {
    return {
      dryRun: true,
      receiptsCount: receipts.length,
      totals: {
        subTotal: agg.subTotal,
        tax: agg.tax,
        grandTotal: agg.grandTotal,
        cogs: agg.cogs,
        fxDiff: agg.fxDiff,
      },
      invoicePayload,
      journal: { journalInfo, journalAccounts, totalDebit, totalCredit },
    };
  }

  // 6. Create invoice
  const nextCounterSalesInvoices = await counterModel.findOneAndUpdate(
    { companyId, name: "Sales Invoice" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  invoicePayload.counter = buildCounter({
    base: counter,
    seq: nextCounterSalesInvoices.seq,
    digits: counterDigits,
  });

  const [invoice] = await orderModel.create([invoicePayload], { session });

  await createInvoiceHistory(
    companyId,
    invoice._id,
    "create",
    user._id,
    orderDate,
    `Sales invoice created from ${receipts.length} POS receipts`,
    "Sales",
    session,
  );

  // 7. Create journal
  const nextCounterJournal = await counterModel.findOneAndUpdate(
    { companyId, name: "Journal" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  const journal = await createJournalEntryService({
    data: {
      ...journalInfo,
      refId: invoice._id,
      refCounter: String(invoice.counter),
      journalAccounts,
    },
    companyId,
    nextCounterJournal,
    digits: counterDigits,
    session,
  });

  // 8. Stamp receipts (guard against a concurrent close)
  const stamped = await posReceiptModel.updateMany(
    { _id: { $in: receipts.map((r) => r._id) }, journalized: false },
    {
      $set: {
        journalized: true,
        journalizedAt: new Date(),
        journalRef: journal._id,
        salesRef: invoice._id,
      },
    },
    { session },
  );

  if (stamped.modifiedCount !== receipts.length) {
    throw new ApiError("Receipts changed during conversion, retry", 409);
  }

  return { dryRun: false, invoice, journal, receiptsCount: receipts.length };
};

exports.aggregateReceipts = aggregateReceipts; // exported for tests
