export const resolvePaymentAmounts = ({
  fund,
  payment,
  invoiceRemainderMain,
  invoiceRemainderForeign,
  invoiceRate,
  invoiceCurrencyCode,
}) => {
  const isSameCurrency = fund?.currencyCode === invoiceCurrencyCode;
  const fundRate = Number(fund?.exchangeRate || 1);
  const fundToInvoiceRate = Number(payment.fundToInvoiceRate || invoiceRate);

  // ── Frontend amounts ──────────────────────────────────────────
  let paymentAmountMain = Number(payment.amountMainCurrency || 0);
  let paymentAmountFund = Number(payment.amount || 0);
  let paymentAmountInvoice = Number(payment.amountInvoiceCurrency || 0);

  // ── Cap logic ─────────────────────────────────────────────────
  if (isSameCurrency) {
    const foreignFullyCovered = paymentAmountFund >= invoiceRemainderForeign;
    if (foreignFullyCovered) {
      paymentAmountFund = invoiceRemainderForeign;
      paymentAmountMain = invoiceRemainderMain;
      paymentAmountInvoice = invoiceRemainderForeign;
    }
  } else {
    const invoiceFullyCovered =
      paymentAmountInvoice >= invoiceRemainderForeign - 0.01;

    if (invoiceFullyCovered) {
      paymentAmountInvoice = invoiceRemainderForeign;
      paymentAmountFund = invoiceRemainderForeign / fundToInvoiceRate;
      // ← divide by fundRate to get primary ($)
      // e.g. 540€ / 0.85 = 635.29 $  (NOT 540 × 0.85 = 459)
      paymentAmountMain = paymentAmountFund / fundRate;
    }
  }

  const willBePaid = isSameCurrency
    ? paymentAmountFund >= invoiceRemainderForeign - 0.01
    : paymentAmountInvoice >= invoiceRemainderForeign - 0.01;

  // ── Applied document currency ─────────────────────────────────
  const appliedDocumentCurrency = isSameCurrency
    ? willBePaid
      ? invoiceRemainderForeign
      : paymentAmountFund
    : paymentAmountInvoice > 0
    ? paymentAmountInvoice
    : paymentAmountFund * fundToInvoiceRate;

  // ── Effective payment rate ────────────────────────────────────
  const effectivePaymentRate = isSameCurrency ? fundRate : fundToInvoiceRate;

  // ── FX Diff ───────────────────────────────────────────────────
  // booked:  appliedDoc / invoiceRate         → $ at booking rate
  // actual:  same currency → appliedDoc / effectivePaymentRate
  //          cross currency → paymentAmountFund / fundRate  (actual $ from fund)
  //
  // fxDiff > 0 = LOSS  (paid more $ than expected)
  // fxDiff < 0 = GAIN  (paid less $ than expected)
  const usdAtInvoiceRate = appliedDocumentCurrency / invoiceRate;
  const usdAtPaymentRate = isSameCurrency
    ? appliedDocumentCurrency / effectivePaymentRate // ₺ / rate → $
    : paymentAmountFund / fundRate; // € / 0.85 → actual $ ✅

  const fxDiff = usdAtPaymentRate - usdAtInvoiceRate;

  return {
    isSameCurrency,
    paymentRate: effectivePaymentRate,
    fundRate,
    paymentAmountMain,
    paymentAmountFund,
    paymentAmountInvoice,
    appliedDocumentCurrency,
    fxDiff,
    willBePaid,
  };
};
export const computeFxDiff = (foreignApplied, invoiceRate, paymentRate) => {
  const safeInvoiceRate = Number(invoiceRate) || 1;
  const safePaymentRate = Number(paymentRate) || 1;

  const usdAtInvoiceRate = foreignApplied / safeInvoiceRate; // what was booked
  const usdAtPaymentRate = foreignApplied / safePaymentRate; // what it costs now
  const fxDiff = usdAtPaymentRate - usdAtInvoiceRate;

  return { usdAtInvoiceRate, usdAtPaymentRate, fxDiff };
};
