const resolvePaymentAmounts = ({
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

  let paymentAmountMain = Number(payment.amountMainCurrency || 0);
  let paymentAmountFund = Number(payment.amount || 0);
  let paymentAmountInvoice = Number(payment.amountInvoiceCurrency || 0);

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

      paymentAmountMain = paymentAmountFund / fundRate;
    }
  }

  const willBePaid = isSameCurrency
    ? paymentAmountFund >= invoiceRemainderForeign - 0.01
    : paymentAmountInvoice >= invoiceRemainderForeign - 0.01;

  const appliedDocumentCurrency = isSameCurrency
    ? willBePaid
      ? invoiceRemainderForeign
      : paymentAmountFund
    : paymentAmountInvoice > 0
      ? paymentAmountInvoice
      : paymentAmountFund * fundToInvoiceRate;

  const effectivePaymentRate = isSameCurrency ? fundRate : fundToInvoiceRate;

  const usdAtInvoiceRate = appliedDocumentCurrency / invoiceRate;

  const usdAtPaymentRate = isSameCurrency
    ? appliedDocumentCurrency / effectivePaymentRate
    : paymentAmountFund / fundRate;

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

const computeFxDiff = (foreignApplied, invoiceRate, paymentRate) => {
  const safeInvoiceRate = Number(invoiceRate) || 1;
  const safePaymentRate = Number(paymentRate) || 1;

  const usdAtInvoiceRate = foreignApplied / safeInvoiceRate;

  const usdAtPaymentRate = foreignApplied / safePaymentRate;

  const fxDiff = usdAtPaymentRate - usdAtInvoiceRate;

  return {
    usdAtInvoiceRate,
    usdAtPaymentRate,
    fxDiff,
  };
};

module.exports = {
  resolvePaymentAmounts,
  computeFxDiff,
};
