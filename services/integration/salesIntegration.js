const ApiError = require("../../utils/apiError");
const asyncHandler = require("express-async-handler");
const orderModel = require("../../models/orderModel");
const productModel = require("../../models/productModel");
const customersModel = require("../../models/customarModel");
const { createInvoiceHistory } = require("../invoiceHistoryService");
const { createPaymentHistory } = require("../paymentHistoryService");
const { createProductMovement } = require("../../utils/productMovement");
const companyInfoModel = require("../../models/companyInfoModel");
const { generateCounter } = require("../../utils/counterFormat");
const axios = require("axios");
const unTracedproductLogModel = require("../../models/unTracedproductLogModel");

exports.EcommerceOrderIntegration = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  const cartItems = req.body.invoicesItems;
  if (!cartItems || cartItems.length === 0) {
    return next(new ApiError("The order has no items", 400));
  }

  // Date formatting helpers
  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;

  const isoOrderDate = `${req.body.orderDate || formattedDate}`;
  req.body.orderDate = isoOrderDate;

  const timeIsoString = new Date().toISOString();

  // Generate counters
  const nextCounterOrder = await orderModel
    .countDocuments({ companyId })
    .then((count) => count + 1);
  req.body.type = "ecommerce";
  const company = await companyInfoModel.findById(companyId);

  const { dateFormat, counterFormat } = company.prefix;
  const counter = generateCounter({
    dateFormat,
    counterFormat,
    date: new Date(),
  });

  req.body.counter = Number(counter) + Number(nextCounterOrder);

  // Customer handling
  let customer = await customersModel.findOne({
    _id: req.body.customer.id,
    companyId,
  });
  if (!customer) {
    customer = await customersModel.create({
      ...req.body.customer,
      companyId,
      total: 0,
      TotalUnpaid: 0,
    });
  }

  req.body.returnCartItem = req.body.invoicesItems;
  req.body.employee = req.user ? req.user._id : null;

  // CALCULATE TOTALS
  let invoiceSubtotal = 0;
  let invoiceDiscount = 0;
  let invoiceTaxTotal = 0;
  let invoiceGrandTotal = 0;
  const taxSummaryMap = new Map();

  req.body.invoicesItems = cartItems.map((item) => {
    const lineSubtotal = Number(item.sellingPrice) * Number(item.soldQuantity);

    let discount = 0;
    if (item.discountType === "percentage") {
      discount = (lineSubtotal * (item.discountPercentege || 0)) / 100;
    } else if (item.discountType === "amount") {
      discount = item.discountAmount || 0;
    }

    const totalWithoutTax = lineSubtotal - discount;
    const taxRate = item.tax?.tax || 0;
    const taxValue = (totalWithoutTax * taxRate) / 100;
    const total = totalWithoutTax + taxValue;

    // Update item fields
    item.totalWithoutTax = totalWithoutTax;
    item.discountAmount = discount;
    item.taxValue = taxValue;
    item.total = total;

    // Accumulate totals
    invoiceSubtotal += lineSubtotal;
    invoiceDiscount += discount;
    invoiceTaxTotal += taxValue;
    invoiceGrandTotal += total;

    // Build tax summary
    if (taxRate > 0) {
      if (!taxSummaryMap.has(taxRate)) {
        taxSummaryMap.set(taxRate, {
          taxId: item.tax?._id || "",
          taxRate: taxRate,
          totalTaxValue: 0,
          discountTaxValue: 0,
          salesAccountTax: item.tax?.salesAccountTax || "",
        });
      }
      const taxObj = taxSummaryMap.get(taxRate);
      taxObj.totalTaxValue += taxValue;
      taxObj.discountTaxValue += taxValue;
    }

    return item;
  });

  // Store totals on the order
  req.body.invoiceSubTotal = invoiceSubtotal;
  req.body.invoiceDiscount = invoiceDiscount;
  req.body.invoiceTax = invoiceTaxTotal;
  req.body.invoiceGrandTotal = invoiceGrandTotal;

  // Tax summary array
  req.body.taxSummary = Array.from(taxSummaryMap.values());

  // Manual discount (if client sends it)
  const manualDiscount = Number(req.body.manuallInvoiceDiscountValue || 0);
  req.body.manuallInvoiceDiscount = manualDiscount > 0 ? 1 : 0;
  req.body.manuallInvoiceDiscountValue = manualDiscount;

  // Grand total after manual discount
  req.body.invoiceGrandTotal = req.body.invoiceGrandTotal - manualDiscount;

  // Remainders
  req.body.totalInMainCurrency = req.body.invoiceGrandTotal;
  req.body.totalRemainderMainCurrency = req.body.invoiceGrandTotal;

  // Create Order
  let order = await orderModel.create(req.body);

  // unpaid order, just update balances
  let total =
    Number(req.body.totalRemainderMainCurrency) || req.body.totalInMainCurrency;
  customer.total += total;
  customer.TotalUnpaid += total;
  await order.save();

  // Handle product stock deduction
  const productQRCodes = cartItems
    .filter(
      (item) => item.type !== "unTracedproduct" && item.type !== "expense"
    )
    .map((item) => item.qr);

  const products = await productModel.find({ qr: { $in: productQRCodes } });
  const productMap = new Map(products.map((prod) => [prod.qr, prod]));
  const movementMap = new Map();

  for (const item of cartItems) {
    if (item.type === "unTracedproduct" || item.type === "expense") continue;

    const existing = movementMap.get(item.qr);
    if (!existing) {
      movementMap.set(item.qr, { ...item });
    } else {
      existing.soldQuantity += item.soldQuantity;
    }
  }

  await Promise.all(
    Array.from(movementMap.entries()).map(async ([qr, item]) => {
      const product = productMap.get(qr);
      const totalStockQuantity = product.stocks.reduce(
        (total, stock) => total + stock.productQuantity,
        0
      );

      await createProductMovement(
        product._id,
        order.id,
        totalStockQuantity - item.soldQuantity,
        item.soldQuantity,
        0,
        0,
        "movement",
        "out",
        "E-commerce Invoice",
        companyId
      );
    })
  );

  const bulkOption = await Promise.all(
    cartItems.map(async (item) => {
      if (item.type !== "unTracedproduct" && item.type !== "expense") {
        const product = productMap.get(item.qr);

        return {
          updateOne: {
            filter: { qr: item.qr, "stocks.stockId": item.stock._id },
            update: {
              $inc: {
                quantity: -item.soldQuantity,
                "stocks.$.productQuantity": -item.soldQuantity,
                soldByMonth: +item.soldQuantity,
                soldByWeek: +item.soldQuantity,
                sold: +item.soldQuantity,
              },
            },
          },
        };
      } else if (item.type === "unTracedproduct") {
        await unTracedproductLogModel.create({
          name: item.name,
          sellingPrice: item.sellingPrice || item.orginalBuyingPrice,
          type: "ecommerce",
          quantity: item.soldQuantity,
          tax: item.tax,
          totalWithoutTax: item.totalWithoutTax,
          total: item.total,
          companyId,
        });
        return null;
      } else if (item.type === "expense") {
        return null;
      }
    })
  );

  const validBulkOptions = bulkOption.filter((option) => option !== null);
  if (validBulkOptions.length > 0) {
    await productModel.bulkWrite(validBulkOptions);
  }

  await customer.save();

  // Histories
  const history = createInvoiceHistory(
    companyId,
    order._id,
    "create",
    req.user ? req.user._id : null,
    req.body.orderDate || timeIsoString
  );

  await createPaymentHistory(
    "invoice",
    req.body.orderDate || timeIsoString,
    req.body.totalInMainCurrency,
    req.body.invoiceGrandTotal,
    "customer",
    req.body.customer.id,
    order._id,
    companyId,
    req.body.description,
    "",
    "",
    "",
    req.body.currency.currencyCode
  );

  res.status(201).json({
    status: "success",
    message: "E-commerce order created successfully",
    data: order,
    history,
  });
});

// URLs used by createEFatura
const url = "https://efaturaservice.turkcellesirket.com/v1/";
const urlV2 = "https://efaturaservice.turkcellesirket.com/v2/";
// const url = "https://efaturaservicetest.isim360.com/v1/";
// const urlV2 = "https://efaturaservicetest.isim360.com/v2/";

exports.EcommerceOrderIntegrationFull = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  const cartItems = req.body.invoicesItems;
  if (!cartItems || cartItems.length === 0) {
    return next(new ApiError("The order has no items", 400));
  }

  const timeIsoString = new Date().toISOString();

  // === Create the Sales Order in DB ===
  const nextCounterOrder = await orderModel
    .countDocuments({ companyId })
    .then((count) => count + 1);

  req.body.type = "ecommerce";
  const company = await companyInfoModel.findById(companyId);

  if (!company.turkcellApiKey || company.turkcellApiKey.length === 0) {
    return next(new ApiError("Turkcell API key is missing", 401));
  }

  const { dateFormat, counterFormat } = company.prefix;
  const counter = generateCounter({
    dateFormat,
    counterFormat,
    date: new Date(),
  });

  req.body.counter = Number(counter) + Number(nextCounterOrder);

  // Customer handling
  let customer = await customersModel.findOne({
    _id: req.body.customer.id,
    companyId,
  });
  if (!customer) {
    customer = await customersModel.create({
      ...req.body.customer,
      companyId,
      total: 0,
      TotalUnpaid: 0,
    });
  }

  // Totals calculation
  let invoiceSubtotal = 0;
  let invoiceDiscount = 0;
  let invoiceTaxTotal = 0;
  let invoiceGrandTotal = 0;
  const taxSummaryMap = new Map();

  req.body.invoicesItems = cartItems.map((item) => {
    const lineSubtotal = Number(item.sellingPrice) * Number(item.soldQuantity);

    let discount = 0;
    if (item.discountType === "percentage") {
      discount = (lineSubtotal * (item.discountPercentege || 0)) / 100;
    } else if (item.discountType === "amount") {
      discount = item.discountAmount || 0;
    }

    const totalWithoutTax = lineSubtotal - discount;
    const taxRate = item.tax?.tax || 0;
    const taxValue = (totalWithoutTax * taxRate) / 100;
    const total = totalWithoutTax + taxValue;

    // Update item fields
    item.totalWithoutTax = totalWithoutTax;
    item.discountAmount = discount;
    item.taxValue = taxValue;
    item.total = total;

    // Accumulate totals
    invoiceSubtotal += lineSubtotal;
    invoiceDiscount += discount;
    invoiceTaxTotal += taxValue;
    invoiceGrandTotal += total;

    if (taxRate > 0) {
      if (!taxSummaryMap.has(taxRate)) {
        taxSummaryMap.set(taxRate, {
          taxId: item.tax?._id || "",
          taxRate,
          totalTaxValue: 0,
          discountTaxValue: 0,
          salesAccountTax: item.tax?.salesAccountTax || "",
        });
      }
      const taxObj = taxSummaryMap.get(taxRate);
      taxObj.totalTaxValue += taxValue;
      taxObj.discountTaxValue += taxValue;
    }

    return item;
  });

  req.body.invoiceSubTotal = invoiceSubtotal;
  req.body.invoiceDiscount = invoiceDiscount;
  req.body.invoiceTax = invoiceTaxTotal;
  req.body.invoiceGrandTotal = invoiceGrandTotal;

  req.body.taxSummary = Array.from(taxSummaryMap.values());

  const manualDiscount = Number(req.body.manuallInvoiceDiscountValue || 0);
  req.body.manuallInvoiceDiscount = manualDiscount > 0 ? 1 : 0;
  req.body.manuallInvoiceDiscountValue = manualDiscount;
  req.body.invoiceGrandTotal = req.body.invoiceGrandTotal - manualDiscount;

  req.body.totalInMainCurrency = req.body.invoiceGrandTotal;
  req.body.totalRemainderMainCurrency = req.body.invoiceGrandTotal;
  req.body.returnCartItem = req.body.invoicesItems;
  req.body.employee = req.user ? req.user._id : null;

  let order = await orderModel.create(req.body);

  customer.total += req.body.totalRemainderMainCurrency;
  customer.TotalUnpaid += req.body.totalRemainderMainCurrency;
  await order.save();

  await customer.save();

  createInvoiceHistory(
    companyId,
    order._id,
    "create",
    req.user ? req.user._id : null,
    req.body.orderDate || timeIsoString
  );

  // === Build E-Fatura Payload ===
  const currentDate = new Date().toISOString().split("T")[0];
  const year = req.body.orderDate
    ? req.body.orderDate.slice(0, 4)
    : currentDate.slice(0, 4);

  const prefix = (req.body.invoiceNumber || "INV")
    .substring(0, 3)
    .toUpperCase();
  let suffix = req.body.suffix
    ? String(req.body.suffix).padStart(9, "0")
    : String(Math.floor(Math.random() * 1e9)).padStart(9, "0");

  const validEttn = req.body.invoiceNumber || `${prefix}${year}${suffix}`;
  const validInvoiceNumber =
    req.body.invoiceNumber || `${prefix}${year}${suffix}`;

  const invoiceLines = cartItems.map((inv) => ({
    inventoryCard: inv?.name,
    amount: inv?.soldQuantity,
    unitCode: inv?.unitCode || "C62",
    unitPrice: parseFloat(inv?.sellingPrice) || 1.0,
    description: inv?.note || "",
    discountRate: inv?.discountPercentege || 0.0,
    discountAmount: inv?.discountAmount || 0.0,
    vatRate: parseFloat(inv?.tax?.tax) || 0.0,
  }));

  const efaturaForm = {
    recordType: req.body.recordType !== undefined ? req.body.recordType : 1,
    status: 0,
    localReferenceId: validInvoiceNumber,
    useManualInvoiceId: true,
    note: req.body.description || "",
    addressBook: {
      name: req.body.customer?.name,
      receiverPersonSurName: req.body.customer?.surname || "",
      identificationNumber: req.body.customer?.taxNumber,
      alias: req.body.customer?.company || "",
      receiverDistrict: req.body.customer?.district || "",
      receiverCity: req.body.customer?.city,
      receiverCountry: req.body.customer?.country,
      receiverEmail: req.body.customer?.email,
      receiverTaxOffice: req.body.customer?.taxAdministration,
    },
    generalInfoModel: {
      ettn: validEttn,
      invoiceProfileType:
        req.body.invoiceProfileType !== undefined
          ? req.body.invoiceProfileType
          : 0,
      type: req.body.invoiceType !== undefined ? req.body.invoiceType : 1,
      invoiceNumber: validInvoiceNumber,
      issueDate: req.body.orderDate?.split("T")[0] || currentDate,
      prefix,
      currencyCode: req.body.currency?.currencyAbbr,
      exchangeRate: parseFloat(req.body.currency?.exchangeRate) || 1,
    },
    invoiceLines,
    orderInfoModel: {
      orderNumber: order._id,
      orderDate: req.body.orderDate?.split("T")[0] || currentDate,
    },
    apiKey: company.turkcellApiKey,
  };

  try {
    const efaturaResponse = await axios.post(
      `${efaturaForm.recordType === 1 ? url : urlV2}${
        efaturaForm.recordType === 1 ? "outboxinvoice" : "earchive"
      }/create`,
      efaturaForm,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": company.turkcellApiKey,
        },
      }
    );

    // Only create the order if E-Fatura succeeds
    let order = await orderModel.create(req.body);

    // Update customer totals
    customer.total += req.body.totalRemainderMainCurrency;
    customer.TotalUnpaid += req.body.totalRemainderMainCurrency;
    await customer.save();

    createInvoiceHistory(
      companyId,
      order._id,
      "create",
      req.user ? req.user._id : null,
      req.body.orderDate || timeIsoString
    );

    // Update order with E-Fatura info
    await orderModel.findByIdAndUpdate(order._id, {
      efaturaGenerated: true,
      ettn: efaturaResponse?.data?.id,
      efaturaStatus: "0",
    });

    return res.status(201).json({
      status: "success",
      message: "E-commerce order & E-Fatura created successfully",
      data: {
        order,
        efatura: efaturaResponse?.data,
      },
    });
  } catch (error) {
    console.error("E-Fatura Error Response:", error?.response?.data || error);
    return res.status(500).json({
      status: "error",
      message: "E-Fatura creation failed, order not saved",
      efaturaError: error?.response?.data,
    });
  }
});
