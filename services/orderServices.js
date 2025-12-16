const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const mongoose = require("mongoose");
const productModel = require("../models/productModel");
const orderModel = require("../models/orderModel");
const FinancialFundsModel = require("../models/financialFundsModel");
const ReportsFinancialFundsModel = require("../models/reportsFinancialFunds");
const returnOrderModel = require("../models/returnOrderModel");
const { createInvoiceHistory } = require("./invoiceHistoryService");
const { createProductMovement } = require("../utils/productMovement");

const customersModel = require("../models/customarModel");
const { createPaymentHistory } = require("./paymentHistoryService");

const paymentModel = require("../models/paymentModelOld");
const posReceiptsModel = require("../models/orderModelFish");

const unTracedproductLogModel = require("../models/unTracedproductLogModel");
const salesPointModel = require("../models/salesPointModel");

const invoiceHistoryModel = require("../models/invoiceHistoryModel");
const paymentHistoryModel = require("../models/paymentHistoryModel");
const suppliersModel = require("../models/suppliersModel");
const accountingTreeModel = require("../models/accountingTreeModel");
const companyInfoModel = require("../models/companyInfoModel");
const { generateCounter } = require("../utils/counterFormat");
const prodcutBatchModel = require("../models/prodcutBatchModel");

const financailSource = async (
  taker,
  source,
  companyId,
  data,
  orderID,
  paymentId
) => {
  let paymentType = "Deposit";
  try {
    const amount = Number(data.paymentInMainCurrency);
    if (taker === "supplier") {
      await suppliersModel.findByIdAndUpdate(
        source.id,
        { $inc: { TotalUnpaid: -amount } },
        { new: true }
      );
      paymentType = "Deposit";
    } else if (taker === "customer") {
      await customersModel.findByIdAndUpdate(
        source.id,
        { $inc: { TotalUnpaid: -amount } },
        { new: true }
      );
      paymentType = "Withdrawal";
    } else if (taker === "account") {
      await accountingTreeModel.findByIdAndUpdate(
        source.id,
        {
          $inc: { debtor: amount },
        },
        { new: true }
      );
      paymentType = "Deposit";
    } else {
      throw new Error("Invalid taker type.");
    }
    if (taker !== "account")
      await createPaymentHistory(
        "payment",
        data.paymentDate,
        data.paymentInMainCurrency,
        data.paymentInFundCurrency,
        taker,
        source.id,
        orderID,
        companyId,
        data.paymentDescription,
        paymentId,
        paymentType,
        "",
        data.financialFundsCurrencyCode
      );
  } catch (e) {
    console.log(`Error: ${e}`);
  }
};

exports.DashBordSalse = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { isDraft: invoiceDraft } = req.body;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const nextCounterPayment =
    (await paymentModel.countDocuments({ companyId, paymentText: "Deposit" })) +
    1;
  const cartItems = req.body.invoicesItems;

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;

  const futureDateOb = new Date(ts);
  futureDateOb.setSeconds(futureDateOb.getSeconds() + 1);
  const formattedDateAdd3 = `${padZero(futureDateOb.getHours())}:${padZero(
    futureDateOb.getMinutes()
  )}:${padZero(futureDateOb.getSeconds())}.${padZero(
    futureDateOb.getMilliseconds(),
    3
  )}`;
  const isoDate = `${req.body.paymentDate}T${formattedDateAdd3}Z`;
  req.body.paymentDate = isoDate;

  const isoorderDate = `${req.body.invoiceDate}T${formattedDate}Z`;
  req.body.orderDate = isoorderDate;
  if (!cartItems || cartItems.length === 0) {
    return next(new ApiError("The cart is empty", 400));
  }

  const timeIsoString = new Date().toISOString();

  const customarsPromise = customersModel.findOne({
    _id: req.body.customer.id,
    companyId,
  });
  const nextCounterOrder = await orderModel
    .countDocuments({ companyId })
    .then((count) => count + 1);

  req.body.type = "sales";
  req.body.counters = req.body.counter;
  req.body.counter = Number(req.body.counter) + nextCounterOrder;
  const financailSources = req.body.financailSource;
  req.body.financailFund = req.body.financailSource;
  let financialFunds;
  if (req.body.paymentsStatus === "paid" && financailSources.type === "fund") {
    financialFunds = await FinancialFundsModel.findById(
      req.body.financailSource.id
    ).populate({ path: "fundCurrency" });
    if (!financialFunds) {
      return next(
        new ApiError(
          `There is no such financial funds with id ${req.body.financailSource.id}`,
          404
        )
      );
    }
    financialFunds.fundBalance += Number(req.body.paymentInFundCurrency);
  }
  const [customars, nextCounter, reportCounter] = await Promise.all([
    customarsPromise,
    nextCounterOrder,
  ]);
  req.body.returnCartItem = req.body.invoicesItems;
  let order;
  let payment;
  req.body.employee = {
    name: req.user.name,
    id: req.user._id,
  };

  if (req.body.paymentsStatus === "paid") {
    req.body.paid = "paid";
    if (req.body.totalRemainderMainCurrency > 0.5) {
      req.body.paymentsStatus = "unpaid";
    }

    order = await orderModel.create(req.body);

    payment = await paymentModel.create({
      customerId: req.body.customer.id,
      customerName: req.body.customer.name,
      total: req.body.paymentInInvoiceCurrency,
      totalMainCurrency: req.body.paymentInMainCurrency,
      exchangeRate: financailSources.exchangeRate,
      financialFundsCurrencyCode: financailSources.code,
      financialFundsName: financailSources.name,
      financialFundsId: financailSources.id,
      date: req.body.paymentDate || timeIsoString,
      invoiceNumber: Number(req.body.counters) + nextCounter,
      invoiceID: order._id,
      counter: Number(req.body.counters) + nextCounterPayment,
      description: req.body.paymentDescription,
      paymentInFundCurrency: req.body.paymentInFundCurrency,
      paymentCurrency: req.body.currency.currencyCode,
      type: "sales",
      paymentText: "Deposit",
      companyId,
      payid: {
        id: order._id,
        status: req.body.paymentsStatus,
        invoiceTotal: req.body.invoiceGrandTotal,
        invoiceName: req.body.invoiceName,
        invoiceCurrencyCode: req.body.currency.currencyCode,
        paymentInFundCurrency: req.body.paymentInFundCurrency,
        paymentMainCurrency: req.body.paymentInMainCurrency,
        paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
      },
      financailType: financailSources.type,
    });
    order.payments.push({
      payment: req.body.paymentInFundCurrency,
      paymentMainCurrency: req.body.paymentInMainCurrency,
      financialFunds: financailSources.name,
      financialFundsCurrencyCode: financailSources.code,
      date: req.body.paymentDate || timeIsoString,
      paymentID: payment._id,
      paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
    });
    customars.total += Number(req.body.totalInMainCurrency);
    customars.TotalUnpaid += Number(req.body.totalRemainderMainCurrency);
    await order.save();
    if (financailSources.type === "fund") {
      const reportsFinancialFundsPromise = ReportsFinancialFundsModel.create({
        date: req.body.paymentDate,
        ref: order._id,
        amount: req.body.paymentInFundCurrency,
        exchangeAmount: req.body.totalInMainCurrency,
        type: "sales",
        financialFundId: req.body.financailFund.id,
        financialFundRest: financialFunds.fundBalance,
        exchangeRate: req.body.exchangeRate,
        paymentType: "Deposit",
        payment: payment._id,
        description: req.body.paymentDescription,
        companyId,
      });

      const financialFundsSavePromise = financialFunds.save();

      await Promise.all([
        reportsFinancialFundsPromise,
        financialFundsSavePromise,
        // createExpensePromise,
      ]);
    } else {
      await financailSource(
        financailSources.type,
        financailSources,
        companyId,
        req.body,
        order._id,
        payment._id
      );
    }
  } else if (req.body.paymentsStatus === "unpaid" && !invoiceDraft) {
    let total =
      Number(req.body.totalRemainderMainCurrency) ||
      req.body.totalInMainCurrency;

    customars.total += total;
    if (customars.TotalUnpaid <= -1) {
      const t = Number(total) + Number(customars.TotalUnpaid);
      if (t > 0) {
        total = t;
        customars.TotalUnpaid = Number(t);
      } // } else if (t < 0) {
      //   customars.TotalUnpaid = t;
      //   req.body.paymentsStatus = "paid";
      //   req.body.totalRemainder
      // } else {
      //   total = 0;
      //   customars.TotalUnpaid = 0;
      //   req.body.paymentsStatus = "paid";
      // }
    } else {
      customars.TotalUnpaid += total;
    }

    order = await orderModel.create(req.body);
  } else if (req.body.paymentsStatus === "unpaid" && invoiceDraft) {
    req.body.isDraft = true;
    order = await orderModel.create(req.body);
  } else {
    console.log("Really? Not paid or unpaid?");
  }
  const productQRCodes = cartItems
    .filter(
      (item) => item.type !== "unTracedproduct" && item.type !== "expense"
    )
    .map((item) => item.id);

  const products = await productModel.find({
    _id: { $in: productQRCodes },
  });

  const productMap = new Map(
    products.map((prod) => [prod._id.toString(), prod])
  );
  const movementMap = new Map();

  for (const item of cartItems) {
    if (
      item.type === "unTracedproduct" ||
      item.type === "expense" ||
      item.type === "variants" ||
      invoiceDraft
    )
      continue;

    const existing = movementMap.get(item.id);
    if (!existing) {
      movementMap.set(item.id, { ...item });
    } else {
      existing.soldQuantity += item.soldQuantity;
    }
  }
  await Promise.all(
    Array.from(movementMap.entries()).map(async ([id, item]) => {
      const product = productMap.get(id);
    })
  );

  const bulkOption = await Promise.all(
    cartItems.map(async (item) => {
      if (invoiceDraft) return null;
      if (
        item.type !== "unTracedproduct" &&
        item.type !== "expense" &&
        item.type !== "variants"
      ) {
        const product = productMap.get(item.id);
        if (!product) return null;

        const soldQty = item.soldQuantity;

        const oldQty = product.stocks.reduce(
          (total, stock) => total + stock.productQuantity,
          0
        );

        if (soldQty > oldQty) {
          throw new Error("Insufficient stock");
        }

        let qtyToSell = soldQty;
        let totalCost = 0;
        let buyingPrice = 0;
        const totalStockQuantity = product.stocks.reduce(
          (total, stock) => total + stock.productQuantity,
          0
        );
        const fifoMovements = [];

        const batches = await prodcutBatchModel
          .find({
            productId: item.id,
            companyId,
            stockId: item.stock._id,
            quantity: { $gt: 0 },
          })
          .sort({ createdAt: 1 });

        for (const batch of batches) {
          if (qtyToSell <= 0) break;

          const used = Math.min(batch.quantity, qtyToSell);

          batch.quantity -= used;
          await batch.save();

          totalCost += used * batch.buyingprice;
          qtyToSell -= used;
          buyingPrice = batch.buyingprice;

          fifoMovements.push({
            quantity: used,
            buyingPrice: batch.buyingprice,
            batchId: batch._id,
          });
        }

        if (qtyToSell > 0) {
          throw new Error("Not enough batch stock");
        }

        for (const fm of fifoMovements) {
          await createProductMovement(
            product._id,
            order.id,
            totalStockQuantity - fm.quantity,
            fm.quantity,
            0,
            0,
            "movement",
            "out",
            "Sales Invoice",
            companyId,
            "",
            "",
            "",
            fm.costBuyingPrice,
            item.sellingPrice
          );
        }
        const soldAvgCost = totalCost / soldQty;

        const oldAvgCost = product.costBuyingPrice || 0;
        const remainingQty = oldQty - soldQty;

        const newAvgCost =
          remainingQty > 0
            ? (oldQty * oldAvgCost - soldQty * soldAvgCost) / remainingQty
            : 0;

        return {
          updateOne: {
            filter: {
              _id: item.id,
              "stocks.stockId": item.stock._id,
            },
            update: {
              $inc: {
                "stocks.$.productQuantity": -soldQty,
                soldByMonth: soldQty,
                soldByWeek: soldQty,
                sold: soldQty,
              },
              $set: {
                costBuyingPrice: Number(newAvgCost.toFixed(4)),
              },
            },
          },
        };
      } else if (item.type === "variants") {
        return {
          updateOne: {
            filter: {
              _id: item.id,
              companyId,
              "variants.qr": item.qr,
              "variants.stocks.stockId": item.stock._id,
            },
            update: {
              $inc: {
                "variants.$[v].stocks.$[s].quantity": -item.soldQuantity,
                soldByMonth: +item.soldQuantity,
                soldByWeek: +item.soldQuantity,
                sold: +item.soldQuantity,
              },
            },
            arrayFilters: [
              { "v.qr": item.qr },
              { "s.stockId": item.stock._id },
            ],
          },
        };
      } else if (item.type === "unTracedproduct") {
        await unTracedproductLogModel.create({
          name: item.name,
          sellingPrice: item.sellingPrice || item.orginalBuyingPrice,
          type: "sales",
          quantity: item.soldQuantity,
          tax: item.tax,
          totalWithoutTax: item.totalWithoutTax,
          total: item.total,
          companyId,
        });

        return null;
      } else if (item.type === "expense") {
        console.log("This item is an expense and cannot create a log for it");
        return null;
      }
    })
  );

  // Filter out null or undefined operations
  const validBulkOptions = bulkOption.filter((option) => option !== null);

  // Perform bulkWrite
  if (!invoiceDraft && validBulkOptions.length > 0) {
    await productModel.bulkWrite(validBulkOptions);
  }

  if (!invoiceDraft) {
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

    await customars.save();
  }

  const history = createInvoiceHistory(
    companyId,
    order._id,
    "create",
    req.user._id,
    req.body.orderDate || timeIsoString
  );

  if (req.body.paid === "paid" && !invoiceDraft) {
    await createPaymentHistory(
      "payment",
      req.body.paymentDate || timeIsoString,
      req.body.paymentInMainCurrency,
      req.body.paymentInFundCurrency,
      "customer",
      req.body.customer.id,
      order._id,
      companyId,
      req.body.paymentDescription,
      payment.id,
      "Deposit",
      "",
      financailSources.code
    );
  }

  res.status(201).json({ status: "success", data: order, history });
});

// @desc    Get All order
// @route   GET /api/orders/cartId
// @access  privet/All
exports.findAllOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const filters = req.query?.filters ? JSON.parse(req.query?.filters) : {};

  const pageSize = req.query.limit || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  // Initialize the base query to exclude type "pos"
  let query = {
    type: { $ne: "openBalance" },
    companyId,
    // archives: req.query.archives,
  };
  if (filters?.startDate || filters?.endDate) {
    query.orderDate = {};
    if (filters?.startDate) {
      query.orderDate.$gte = filters.startDate;
    }
    if (filters?.endDate) {
      query.orderDate.$lte = filters.endDate;
    }
  }
  if (filters?.paymentStatus) {
    query.paymentsStatus = filters.paymentStatus;
  }
  // Add keyword filter if provided
  if (req.query.keyword) {
    query.$or = [
      { counter: { $regex: req.query.keyword, $options: "i" } },
      { invoiceName: { $regex: req.query.keyword, $options: "i" } },

      { "customer.name": { $regex: req.query.keyword, $options: "i" } },
    ];
  }
  if (filters?.tags?.length) {
    const tagIds = filters.tags.map((tag) => tag.id);
    query["tag.id"] = { $in: tagIds };
  }
  if (filters.paymentsStatus) {
    query.paymentsStatus = filters.paymentsStatus;
  }
  if (filters.employee) {
    query.employee = filters.employee;
  }
  if (filters?.businessPartners) {
    query["customer.name"] = {
      $regex: filters.businessPartners,
      $options: "i",
    };
  }

  if (filters?.filterTags?.length) {
    query["tag.name"] = { $in: filters.filterTags };
  }
  let mongooseQuery = orderModel.find(query);

  // Apply sorting
  mongooseQuery = mongooseQuery.sort({ orderDate: -1 });

  // Count total items without pagination
  const totalItems = await orderModel.countDocuments(query);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / pageSize);

  // Apply pagination
  mongooseQuery = mongooseQuery
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "employee" });

  const order = await mongooseQuery;

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: order.length,
    data: order,
  });
});

exports.findOneOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;

  const order = await orderModel.findById(id);

  if (!order) {
    return next(new ApiError(`No order found for this id ${id}`, 404));
  }

  const pageSize = req.query.limit || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  const totalItems = await invoiceHistoryModel.countDocuments({
    invoiceId: id,
    companyId,
  });
  const totalPages = Math.ceil(totalItems / pageSize);
  const invoiceHistory = await invoiceHistoryModel
    .find({
      invoiceId: id,
      companyId,
    })
    .populate({ path: "employeeId", select: "name email" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  res.status(200).json({
    status: "true",
    history: invoiceHistory,
    data: order,
  });
});

exports.editOrderInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  const invoiceDraft = req.body.isDraft === true || req.body.isDraft === "true";
  req.body.isDraft = invoiceDraft;

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  const timeIsoString = new Date().toISOString();
  const { id } = req.params;
  const orders = await orderModel.findById(id);

  const wasDraft = orders.isDraft;
  const isDraft = req.body.isDraft;

  const ts = Date.now();
  const date_ob = new Date(ts);
  const futureDateOb = new Date(ts);
  futureDateOb.setSeconds(futureDateOb.getSeconds() + 1);
  const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;

  const formattedDateAdd3 = `${padZero(futureDateOb.getHours())}:${padZero(
    futureDateOb.getMinutes()
  )}:${padZero(futureDateOb.getSeconds())}.${padZero(
    futureDateOb.getMilliseconds(),
    3
  )}`;

  const isoDate = `${req.body.orderDate}T${formattedDate}Z`;
  const isoPaymentDate = `${req.body.paymentDate}T${formattedDateAdd3}Z`;
  req.body.paymentDate = isoPaymentDate;
  const nextCounterPayment =
    (await paymentModel.countDocuments({ companyId, paymentText: "Deposit" })) +
    1;
  req.body.orderDate = isoDate;

  const originalItems = orders.invoicesItems;

  // =======================================================
  // === Movement Logic (Fixed for Draft -> Final case) ====
  // =======================================================
  const movementMap = new Map();

  await paymentHistoryModel.deleteMany({
    ref: orders._id,
    companyId,
  });

  req.body.invoicesItems.forEach((item) => {
    if (
      item.type === "unTracedproduct" ||
      item.type === "expense" ||
      item.type === "Service"
    )
      return;

    let diff = 0;

    if (wasDraft && !isDraft) {
      // Draft finalized — apply all quantities
      diff = item.soldQuantity;
    } else {
      // Normal case (quantity changed)
      const oldItem = originalItems.find((o) => o.qr === item.qr);
      diff = item.soldQuantity - (oldItem?.soldQuantity || 0);
    }

    if (!movementMap.has(item.qr)) {
      movementMap.set(item.qr, { ...item, quantityDiff: diff });
    } else {
      const existing = movementMap.get(item.qr);
      existing.quantityDiff += diff;
    }
  });

  // Create product movement records
  await Promise.all(
    Array.from(movementMap.entries()).map(async ([qr, item]) => {
      const product = await productModel.findOne({ qr: { $in: [qr] } });

      if (product && product.type !== "Service" && item.quantityDiff !== 0) {
        const totalStockQuantity = product.stocks.reduce(
          (total, stock) => total + stock.productQuantity,
          0
        );

        await createProductMovement(
          product._id,
          id,
          totalStockQuantity - item.quantityDiff,
          item.quantityDiff,
          0,
          0,
          "movement",
          "out",
          "Sales Invoice",
          companyId,
          "",
          "",
          "",
          item.orginalBuyingPrice,
          item.sellingPrice
        );
      }
    })
  );

  // Untraced / expense handling
  await Promise.all(
    req.body.invoicesItems.map(async (item) => {
      if (item.type === "unTracedproduct") {
        await unTracedproductLogModel.create({
          name: item.name,
          sellingPrice: item.sellingPrice,
          type: "sales",
          quantity: item.soldQuantity,
          tax: item.tax,
          totalWithoutTax: item.totalWithoutTax,
          total: item.total,
          companyId,
        });
      } else if (item.type === "expense") {
        console.log("Expense item ignored in stock movement");
      }
    })
  );

  // =======================================================
  // === Bulk Stock Update (with ObjectId casting) =========
  // =======================================================
  const bulkProductUpdates = Array.from(movementMap.values())
    .filter(
      (item) =>
        item.type !== "unTracedproduct" &&
        item.type !== "expense" &&
        item.type !== "variants" &&
        item.quantityDiff !== 0
    )
    .map((item) => ({
      updateOne: {
        filter: {
          qr: item.qr,
          "stocks.stockId": new mongoose.Types.ObjectId(item.stock._id),
        },
        update: {
          $inc: {
            "stocks.$.productQuantity": -item.quantityDiff,
          },
        },
      },
    }));

  if (bulkProductUpdates.length > 0) {
    await productModel.bulkWrite(bulkProductUpdates);
  }

  // =======================================================
  // === Continue with existing payment + customer logic ===
  // =======================================================
  let newOrderInvoice;
  const orderCustomer = await customersModel.findOne({
    _id: orders.customer.id,
    companyId,
  });
  const customers = await customersModel.findOne({
    _id: req.body.customer.id,
    companyId,
  });

  req.body.returnCartItem = req.body.invoicesItems;
  const financailSources = req.body.financailSource;
  req.body.financailFund = req.body.financailSource;

  if (req.body.paymentsStatus === "paid") {
    req.body.paid = "paid";
    if (req.body.totalRemainderMainCurrency > 0.5) {
      req.body.paymentsStatus = "unpaid";
    }

    newOrderInvoice = await orderModel.findOneAndUpdate(
      { _id: id, companyId },
      { $set: { ...req.body, isDraft: false } },
      { new: true }
    );

    const payment = await paymentModel.create({
      customerId: req.body.customer.id,
      customerName: req.body.customer.name,
      total: req.body.paymentInInvoiceCurrency,
      totalMainCurrency: req.body.paymentInMainCurrency,
      exchangeRate: financailSources.exchangeRate,
      financialFundsCurrencyCode: financailSources.code,
      financialFundsName: financailSources.name,
      financialFundsID: financailSources.id,
      date: req.body.paymentDate || timeIsoString,
      invoiceNumber: newOrderInvoice.counter,
      invoiceID: id,
      counter: Number(req.body.counters) + nextCounterPayment,
      description: req.body.paymentDescription,
      paymentInFundCurrency: req.body.paymentInFundCurrency,
      paymentCurrency: req.body.currency.currencyCode,
      type: "sales",
      paymentText: "Deposit",
      companyId,
      payid: {
        id: id,
        status: req.body.paymentsStatus,
        invoiceTotal: req.body.invoiceGrandTotal,
        invoiceName: req.body.invoiceName,
        invoiceCurrencyCode: req.body.currency.currencyCode,
        paymentInFundCurrency: req.body.paymentInFundCurrency,
        paymentMainCurrency: req.body.paymentInMainCurrency,
        paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
      },
    });

    newOrderInvoice.payments.push({
      payment: req.body.paymentInFundCurrency,
      paymentMainCurrency: req.body.paymentInMainCurrency,
      financialFunds: financailSources.name,
      financialFundsCurrencyCode: financailSources.code,
      date: req.body.paymentDate,
      paymentID: payment._id,
      paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
    });

    await newOrderInvoice.save();

    if (financailSources.type === "fund") {
      const financialFund = await FinancialFundsModel.findById(
        req.body.financailFund.id
      );
      financialFund.fundBalance += req.body.paymentInFundCurrency;

      const fundValue = req?.body?.financailFund?.id || null;

      const reports = await ReportsFinancialFundsModel.create({
        date: req.body.paymentDate,
        ref: newOrderInvoice._id,
        amount: req.body.paymentInFundCurrency,
        type: "sales",
        exchangeRate: req.body.exchangeRate,
        exchangeAmount: req.body.paymentInMainCurrency,
        financialFundId: fundValue,
        financialFundRest: financialFund.fundBalance,
        paymentType: "Deposit",
        payment: payment._id,
        description: req.body.paymentDescription,
        companyId,
      });

      newOrderInvoice.reportsBalanceId = reports.id;

      await createPaymentHistory(
        "payment",
        req.body.paymentDate,
        req.body.paymentInMainCurrency,
        req.body.paymentInFundCurrency,
        "customer",
        req.body.customer.id,
        orders._id,
        companyId,
        req.body.paymentDescription,
        Number(req.body.counters) + nextCounterPayment,
        "Deposit",
        "",
        financailSources.code
      );
    } else {
      await financailSource(
        financailSources.type,
        financailSources,
        companyId,
        req.body,
        id,
        payment._id
      );
    }

    if (req.body.customer.id === orders.customer.id) {
      customers.total +=
        req.body.totalInMainCurrency - orders.totalInMainCurrency;
    } else {
      orderCustomer.total -= orders.totalInMainCurrency;
      await orderCustomer.save();
      customers.total += req.body.totalInMainCurrency;
    }

    customers.TotalUnpaid =
      customers.TotalUnpaid -
      orders.totalInMainCurrency +
      req.body.totalInMainCurrency -
      Number(req.body.paymentInMainCurrency);
    await customers.save();
  } else if (req.body.paymentsStatus === "unpaid") {
    req.body.isDraft = invoiceDraft;

    if (req.body.customer.id === orders.customer.id) {
      const test = req.body.totalInMainCurrency - orders.totalInMainCurrency;
      customers.TotalUnpaid += test;
      customers.total += test;
    } else {
      orderCustomer.total -= orders.totalInMainCurrency;
      orderCustomer.TotalUnpaid -= orders.totalInMainCurrency;
      customers.total += req.body.totalInMainCurrency;
      customers.TotalUnpaid += req.body.totalInMainCurrency;
    }

    await customers.save();
    await orderCustomer.save();

    req.body.totalRemainder = req.body.totalRemainder;
    req.body.totalRemainderMainCurrency = req.body.totalRemainderMainCurrency;

    newOrderInvoice = await orderModel.findOneAndUpdate(
      { _id: id, companyId },
      { $set: req.body },
      { new: true }
    );
  } else {
    return res.status(400).json({ message: "Invalid paymentsStatus value" });
  }

  if (!invoiceDraft) {
    await createPaymentHistory(
      "invoice",
      req.body.orderDate,
      req.body.totalInMainCurrency,
      req.body.invoiceGrandTotal,
      "customer",
      req.body.customer.id,
      orders._id,
      companyId,
      req.body.description,
      "",
      "",
      "",
      req.body.currency.currencyCode
    );
  }

  const history = createInvoiceHistory(
    companyId,
    id,
    "edit",
    req.user._id,
    new Date().toISOString()
  );

  res.status(200).json({
    status: "success",
    message: "Order updated successfully",
    data: orders,
    history,
  });
});

exports.patchOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId)
    return res.status(400).json({ message: "companyId is missing" });

  const { id } = req.params;
  if (!id) return res.status(400).json({ message: "id is missing" });

  const order = await orderModel.findOne({ _id: id, companyId });
  if (!order) return res.status(404).json({ message: "order not found" });

  const { description, tag } = req.body;

  if (req.file) order.file = req.file.filename;
  if (description !== undefined) order.description = description;
  if (tag !== undefined) order.tag = JSON.parse(tag);

  await order.save();

  const history = createInvoiceHistory(
    companyId,
    id,
    "edit",
    req.user._id,
    new Date().toISOString()
  );

  res.status(200).json({
    status: "success",
    message: "Order patched successfully",
    data: order,
    history,
  });
});

exports.returnOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const nextCounterPayment =
    (await paymentModel.countDocuments({
      companyId,
      paymentText: "Withdrawal",
    })) + 1;
  const nextCounter =
    (await returnOrderModel.countDocuments({ companyId })) + 1;
  const conuter = req.body.counter;
  req.body.counter = req.body.counter + nextCounter;

  const financialFundsId = req.body.financailFund.id || null;
  const financialFunds = await FinancialFundsModel.findOne({
    _id: financialFundsId,
    companyId,
  });
  const orderId = req.body.orderId;
  const orders = await orderModel.findOne({ _id: orderId, companyId });

  // Helper function to pad zero
  const padZero = (value) => (value < 10 ? `0${value}` : value);
  const ts = Date.now();

  const currentDateTime = new Date(ts);
  const formattedDate = `${padZero(currentDateTime.getHours())}:${padZero(
    currentDateTime.getMinutes()
  )}:${padZero(currentDateTime.getSeconds())}.${padZero(
    currentDateTime.getMilliseconds(),
    3
  )}`;
  const futureDateOb = new Date(ts);
  futureDateOb.setSeconds(futureDateOb.getSeconds() + 1);
  const formattedDateAdd3 = `${padZero(futureDateOb.getHours())}:${padZero(
    futureDateOb.getMinutes()
  )}:${padZero(futureDateOb.getSeconds())}.${padZero(
    futureDateOb.getMilliseconds(),
    3
  )}`;
  const isoDate = `${req.body.paymentDate}T${formattedDateAdd3}Z`;
  req.body.paymentDate = isoDate;
  req.body.date = `${req.body.date}T${formattedDate}Z`;
  req.body.employee = req.user._id;

  req.body.salesRef = orders.counter;
  req.body.type = "refund sales";
  try {
    await customersModel.findOneAndUpdate(
      { _id: orders.customer.id, companyId },
      {
        $inc: {
          TotalUnpaid: -req.body.totalInMainCurrency || 0,
          total: -req.body.totalInMainCurrency || 0,
        },
      },
      { new: true }
    );

    const order = await returnOrderModel.create(req.body);

    const bulkUpdateOptions = req.body.invoicesItems
      .filter(
        (item) => item.type !== "unTracedproduct" && item.type !== "expense"
      )
      .map((item) => ({
        updateOne: {
          filter: { qr: item.qr, "stocks.stockId": item.stock._id },
          update: {
            $inc: {
              quantity: +item.soldQuantity,
              "stocks.$.productQuantity": +item.soldQuantity,
            },
          },
        },
      }));

    await productModel.bulkWrite(bulkUpdateOptions);
    await returnOrderModel.bulkWrite(bulkUpdateOptions);

    const movementMap = new Map();
    const originalItems = orders.invoicesItems;
    req.body.invoicesItems.forEach((item, index) => {
      if (item.type === "unTracedproduct" || item.type === "expense") return;

      const diff = item.soldQuantity - originalItems[index].soldQuantity;
      if (!movementMap.has(item.qr)) {
        movementMap.set(item.qr, { ...item, quantityDiff: diff });
      } else {
        const existing = movementMap.get(item.qr);
        existing.quantityDiff += diff;
      }
    });

    await Promise.all(
      Array.from(movementMap.entries()).map(async ([qr, item]) => {
        const product = await productModel.findOne({ qr, companyId });

        if (product && product.type !== "Service") {
          const totalStockQuantity = product.stocks.reduce(
            (total, stock) => total + stock.productQuantity,
            0
          );

          await createProductMovement(
            product._id,
            order._id,
            totalStockQuantity,
            item.quantityDiff,
            0,
            0,
            "movement",
            "in",
            "Refund Sales Invoice",
            companyId,
            "",
            "",
            "",
            item.orginalBuyingPrice,
            item.sellingPrice
          );
        }
      })
    );
    await Promise.all(
      req.body.invoicesItems.map(async (item) => {
        if (item.type === "unTracedproduct") {
          await unTracedproductLogModel.create({
            name: item.name,
            sellingPrice: item.sellingPrice,
            type: "sales",
            quantity: item.soldQuantity,
            tax: item.tax,
            totalWithoutTax: item.totalWithoutTax,
            total: item.total,
            companyId,
          });

          return null;
        } else if (item.type === "expense") {
          console.log("Hi");
          return null;
        }
      })
    );

    if (req?.body?.paymentsStatus === "paid") {
      financialFunds.fundBalance -= req.body.paymentInFundCurrency;
      if (req.body.totalRemainderMainCurrency > 0.5) {
        req.body.paymentsStatus = "unpaid";
      }
      await financialFunds.save();
      const payment = await paymentModel.create({
        customerId: order.customer.id,
        customerName: order.customer.name,
        total: req.body.paymentInInvoiceCurrency,
        totalMainCurrency: req.body.paymentInMainCurrency,
        exchangeRate: financialFunds.fundCurrency.exchangeRate,
        financialFundsCurrencyCode: req.body.financailFund.code,
        financialFundsName: financialFunds.fundName,
        financialFundsID: req.body.financailFund.id,
        date: req.body.date || timeIsoString,
        invoiceNumber: order.counter,
        invoiceID: order._id,
        counter: conuter + nextCounterPayment,
        description: req.body.paymentDescription,
        paymentInFundCurrency: req.body.paymentInFundCurrency,
        paymentText: "Withdrawal",
        type: "sales refund",
        paymentCurrency: req.body.currencyCode,
        companyId,
        payid: {
          id: order._id,
          status: req.body.paymentsStatus,
          invoiceTotal: req.body.invoiceGrandTotal,
          invoiceName: req.body.invoiceName,
          invoiceCurrencyCode: req.body.currency.currencyCode,
          paymentInFundCurrency: req.body.paymentInFundCurrency,
          paymentMainCurrency: req.body.paymentInMainCurrency,
          paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
        },
      });
      order.payments.push({
        payment: req.body.paymentInFundCurrency,
        paymentMainCurrency: req.body.paymentInMainCurrency,
        financialFunds: financialFunds.fundName,
        financialFundsCurrencyCode: req.body.financailFund.code,
        date: req.body.paymentDate,
        paymentID: payment._id,
        paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
      });
      await ReportsFinancialFundsModel.create({
        date: req.body.paymentDate,
        order: order._id,
        type: "refund-sales",
        financialFundId: req.body.financailFund.id,
        financialFundRest: financialFunds.fundBalance,
        amount: req.body.paymentInFundCurrency,
        exchangeRate: req.body.exchangeRate,
        totalPriceMainCurrence: req.body.totalInMainCurrency,
        paymentType: "Withdrawal",
        payment: payment._id,
        companyId,
      });
      await order.save();
    }
    await createPaymentHistory(
      "Refund Invoice",
      req.body.date,
      req.body.totalInMainCurrency,
      req.body.paymentInFundCurrency,
      "customer",
      req.body.customer.id,
      order._id,
      companyId,
      "",
      "",
      "Deposit",
      "refund Sales",
      req.body.currency.currencyCode
    );
    const returnCartItemUpdates = req.body.invoicesItems
      .map((incomingItem) => {
        const matchingIndex = orders.returnCartItem.findIndex((item) =>
          incomingItem.type !== "unTracedproduct"
            ? item.qr === incomingItem.qr
            : item.name === incomingItem.name
        );

        if (matchingIndex !== -1) {
          const newQuantity =
            orders.returnCartItem[matchingIndex].soldQuantity -
            incomingItem.soldQuantity;
          const newTotal =
            orders.returnCartItem[matchingIndex].total - incomingItem.total;
          const newTotalWithoutTax =
            orders.returnCartItem[matchingIndex].totalWithoutTax -
            incomingItem.totalWithoutTax;
          return {
            updateOne: {
              filter: { _id: orderId },
              update: {
                $set: {
                  [`returnCartItem.${matchingIndex}.soldQuantity`]: newQuantity,
                  [`returnCartItem.${matchingIndex}.total`]: newTotal,
                  [`returnCartItem.${matchingIndex}.totalWithoutTax`]:
                    newTotalWithoutTax,
                },
              },
            },
          };
        }
        return null;
      })
      .filter(Boolean);

    await orderModel.bulkWrite(returnCartItemUpdates);
    const ts = Date.now();
    const date_ob = new Date(ts);
    const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
      date_ob.getMinutes()
    )}:${padZero(date_ob.getSeconds())}.${padZero(
      date_ob.getMilliseconds(),
      3
    )}`;

    req.body.date = `${req.body.date}T${formattedDate}Z`;
    const history = createInvoiceHistory(
      companyId,
      orderId,
      "return",
      req.user._id,
      req.body.date
    );

    await createInvoiceHistory(
      companyId,
      order._id,
      "create",
      req.user._id,
      req.body.date
    );

    res.status(200).json({
      status: "success",
      message: "The product has been returned",
      data: order,
      history,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get All order
// @route   GET /api/getReturnOrder
// @access  privet
exports.getReturnOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const filters = req.query?.filters ? JSON.parse(req.query?.filters) : {};

  const pageSize = parseInt(req.query.limit) || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let query = { companyId };

  // Date filter
  if (filters?.startDate || filters?.endDate) {
    query.date = {};
    if (filters?.startDate) query.date.$gte = filters.startDate;
    if (filters?.endDate) query.date.$lte = filters.endDate;
  }

  // Tags filter
  if (filters?.tags?.length) {
    const tagIds = filters.tags.map((tag) => tag.id);
    query["tag.id"] = { $in: tagIds };
  }
  if (req.query.keyword) {
    query.$or = [
      { counter: { $regex: req.query.keyword, $options: "i" } },
      { invoiceName: { $regex: req.query.keyword, $options: "i" } },

      { "customer.name": { $regex: req.query.keyword, $options: "i" } },
    ];
  }
  // Payment Status filter
  if (filters.paymentStatus) {
    query.paymentsStatus = filters.paymentStatus;
  }

  // Employee filter
  if (filters.employee) {
    query["employee.name"] = filters.employee;
  }

  // Customer name filter
  if (filters?.businessPartners) {
    query["customer.name"] = {
      $regex: filters.businessPartners,
      $options: "i",
    };
  }
  if (filters?.filterTags?.length) {
    query["tag.name"] = { $in: filters.filterTags };
  }
  // Query the database with pagination and sorting
  const totalItems = await returnOrderModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);

  const mongooseQuery = await returnOrderModel
    .find(query)
    .skip(skip)
    .limit(pageSize)
    .sort({ date: -1 })
    .populate("employee");

  res.status(200).json({
    status: "success",
    results: mongooseQuery.length,
    Pages: totalPages,
    data: mongooseQuery,
  });
});

// @desc    Get one order
// @route   GET /api/getReturnOrder/:id
// @access  privet
exports.getOneReturnOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;
  const order = await returnOrderModel.findOne({ _id: id, companyId });
  if (!order) {
    return next(new ApiError(`No order for this id ${id}`, 404));
  }
  res.status(200).json({ status: "true", data: order });
});

exports.canceledOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const padZero = (value) => (value < 10 ? `0${value}` : value);

  const currentDateTime = new Date();
  const formattedDate = `${currentDateTime.getFullYear()}-${padZero(
    currentDateTime.getMonth() + 1
  )}-${padZero(currentDateTime.getDate())} ${padZero(
    currentDateTime.getHours()
  )}:${padZero(currentDateTime.getMinutes())}:${padZero(
    currentDateTime.getSeconds()
  )}`;

  const { id } = req.params;

  const canceled = await orderModel.findById(id);
  if (canceled.payments.length <= 0 && canceled.type !== "cancel") {
    const bulkProductCancel = canceled.invoicesItems.map((item) => ({
      updateOne: {
        filter: { qr: item.qr, "stocks.stockId": item.stock._id },
        update: {
          $inc: {
            "stocks.$.productQuantity": +item.soldQuantity,
          },
        },
      },
    }));
    try {
      await productModel.bulkWrite(bulkProductCancel);

      await orderModel.findOneAndUpdate(
        { _id: id, companyId },
        {
          totalRemainderMainCurrency: 0,
          totalRemainder: 0,
          type: "sales cancelled",
        },
        { new: true }
      );
      const movementMap = new Map();

      for (const item of canceled.invoicesItems) {
        if (item.type !== "unTracedproduct" && item.type !== "expense") {
          if (!movementMap.has(item.qr)) {
            movementMap.set(item.qr, item.soldQuantity);
          } else {
            movementMap.set(
              item.qr,
              movementMap.get(item.qr) + item.soldQuantity
            );
          }
        }
      }

      await Promise.all(
        Array.from(movementMap.entries()).map(async ([qr, totalSoldQty]) => {
          const product = await productModel.findOne({ qr, companyId });
          if (!product) return;

          const totalStockQuantity = product.stocks.reduce(
            (total, stock) => total + stock.productQuantity,
            0
          );

          await createProductMovement(
            product._id,
            id,
            totalStockQuantity,
            totalSoldQty,
            0,
            0,
            "movement",
            "in",
            "refund Sales",
            companyId,
            "",
            "",
            "",
            product.buyingprice,
            product.taxPrice
          );
        })
      );

      await Promise.all(
        canceled.invoicesItems.map(async (item) => {
          if (item.type === "unTracedproduct") {
            await unTracedproductLogModel.create({
              name: item.name,
              sellingPrice: item.sellingPrice,
              type: "sales",
              quantity: item.soldQuantity,
              tax: item.tax,
              totalWithoutTax: item.totalWithoutTax,
              total: item.total,
              companyId,
            });
          } else if (item.type === "expense") {
            console.log("Hi");
          }
        })
      );

      await ReportsFinancialFundsModel.findOneAndDelete({
        order: id,
        companyId,
      });
      let total = 0;
      for (let index = 0; index < canceled.payments.length; index++) {
        const fund = await FinancialFundsModel.findOneAndUpdate(
          {
            fundName: canceled.payments[index].financailFund,
            companyId,
          },
          { $inc: { fundBalance: +canceled.payments[index].payment } }
        );
        total += canceled.payments[index].paymentMainCurrency;
      }
      await paymentHistoryModel.deleteMany({
        ref: id,
        companyId,
      });
      await customersModel.findOneAndUpdate(
        { _id: canceled.customer.id, companyId },
        {
          $inc: {
            TotalUnpaid: -canceled.totalInMainCurrency,
            total: -canceled.totalInMainCurrency,
          },
        }
      );
      const history = createInvoiceHistory(
        companyId,
        id,
        "cancel",
        req.user._id,
        formattedDate
      );
    } catch (e) {
      return next(new ApiError(`Error: ${e}`, 500));
    }
    res.status(200).json({
      status: "true",
      message: "Order Canceled successfully",
    });
  } else {
    return next(
      new ApiError("Have a Payment pless delete the Payment or Canceled ", 500)
    );
  }
});

exports.mergeReceipts = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { startDate, endDate, id } = req.body;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const company = await companyInfoModel.findById(companyId);

  const nextCounter = (await orderModel.countDocuments({ companyId })) + 1;
  const salesPoints = await salesPointModel
    .findOne({ _id: id, companyId })
    .populate("salesPointCurrency");

  const receipts = await posReceiptsModel.find({
    createdAt: {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
      $lte: new Date(`${endDate}T23:59:59.999Z`),
    },
    type: "pos",
    salesPoint: id,
    companyId,
    merged: { $ne: true },
  });
  const { dateFormat, counterFormat } = company.prefix;
  const counter = generateCounter({
    dateFormat,
    counterFormat,
    date: new Date(),
  });

  const cartItems = [];
  const fish = [];
  const taxSummaryMap = new Map();
  const financialFundsMap = new Map();
  let totalInMainCurrency = 0,
    invoiceGrandTotal = 0,
    invoiceSubTotal = 0,
    invoiceTax = 0;
  for (const order of receipts) {
    for (const item of order.cartItems) {
      cartItems.push({
        qr: item.qr,
        name: item.name,
        sellingPrice: item.sellingPrice,
        soldQuantity: item.soldQuantity,
        orginalBuyingPrice: item.orginalBuyingPrice,
        convertedBuyingPrice: item.convertedBuyingPrice || 0,
        total: item.total,
        totalWithoutTax: item.totalWithoutTax,
        unit: item.unit,
        tax: {
          _id: item.tax._id,
          tax: item.tax.tax,
          name: item.tax.name,
          salesAccountTax: item.tax.salesAccountTax,
        },
        discountAmount: item.discountAmount,
        discountPercentege: item.discountPercentege,
        taxValue: item.taxValue,
      });

      fish.push(order.counter);
      order.merged = true;
      await order.save();
    }
    totalInMainCurrency += order.totalInMainCurrency;
    invoiceGrandTotal += order.invoiceGrandTotal;
    invoiceSubTotal += order.invoiceSubTotal;
    invoiceTax += order.invoiceTax;

    if (order.taxSummary) {
      for (const item of order.taxSummary) {
        try {
          if (taxSummaryMap.has(item.taxId)) {
            const taxData = taxSummaryMap.get(item.taxId);
            taxData.totalTaxValue += item.totalTaxValue || 0;
            taxData.discountTaxValue += item.discountTaxValue || 0;
          } else {
            taxSummaryMap.set(item.taxId, {
              taxId: item.taxId,
              taxRate: item.taxRate,
              totalTaxValue: item.totalTaxValue || 0,
              discountTaxValue: item.discountTaxValue || 0,
              salesAccountTax: item.salesAccountTax,
            });
          }
        } catch (err) {
          console.error("Error processing tax summary item:", err);
        }
      }
    }
    if (order.financialFund) {
      for (const item of order.financialFund) {
        try {
          if (financialFundsMap.has(item.fundId)) {
            const fundData = financialFundsMap.get(item.fundId);
            fundData.allocatedAmount += item.allocatedAmount - item.change || 0;
          } else {
            financialFundsMap.set(item.fundId, {
              id: item.fundId,
              name: item.fundName,
              currencyCode: item.currencyCode || 0,
              exchangeRate: item.exchangeRate || 0,
              currency: item.currency,
              currencyID: item.currencyID,
              allocatedAmount: item.allocatedAmount - item.change,
            });
          }
        } catch (err) {
          console.error("Error processing tax summary item:", err);
        }
      }
    }
  }

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }
  const ts = Date.now();
  const date_ob = new Date(ts);

  const date = `${date_ob.getFullYear()}-${padZero(
    date_ob.getMonth() + 1
  )}-${padZero(date_ob.getDate())}T${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${date_ob.getMilliseconds()}Z`;

  const aggregatedFunds = Array.from(financialFundsMap.values());
  const taxSummary = Array.from(taxSummaryMap.values());

  const newOrderData = {
    invoicesItems: cartItems,
    invoiceGrandTotal: invoiceGrandTotal,
    orderDate: date,
    type: "bills",
    totalInMainCurrency: totalInMainCurrency,
    counter: counter + nextCounter,
    paymentsStatus: "paid",
    invoiceName: `Post-Merged-${nextCounter}`,
    currency: {
      id: salesPoints.salesPointCurrency._id,
      currencyCode: salesPoints.salesPointCurrency.currencyCode,
      exchangeRate: salesPoints.salesPointCurrency.exchangeRate,
      currencyAbbr: salesPoints.salesPointCurrency.currencyAbbr,
      currencyName: salesPoints.salesPointCurrency.currencyName,
    },
    exchangeRate: 1,
    receipts: fish,
    financailFund: aggregatedFunds,
    manuallInvoiceDiscountValue: 0,
    manuallInvoiceDiscount: 0,
    taxSummary: taxSummary,
    invoiceSubTotal: invoiceSubTotal,
    invoiceTax: invoiceTax,
    discountType: "value",
    companyId,
    description: `This invoice was made from date ${startDate} To ${endDate}`,
  };
  if (cartItems.length === 0) {
    return next(
      new ApiError(
        "No receipts found in the specified date range or all receipts have already been merged.",
        400
      )
    );
  }
  const sales = await orderModel.create(newOrderData);

  res.status(201).json({
    status: "success",
    message: "All receipts merged successfully",
    data: sales,
  });
});
exports.findCustomer = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const customerid = req.params.id;

  const pageSize = req.query.limit || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const filter = {
    "customer.id": customerid,
    paymentsStatus: "unpaid",
    type: "sales",
    companyId,
  };

  const sales = await orderModel
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  const totalItems = await orderModel.countDocuments(filter);

  const totalPages = Math.ceil(totalItems / pageSize);

  res.status(200).json({
    results: sales.length,
    Pages: totalPages,
    totalItems,
    data: sales,
  });
});

exports.archiveOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const order = await orderModel.findOneAndUpdate(
    { _id: id, companyId },
    { archived: req.body.archived },
    { new: true }
  );

  if (!order) {
    return next(new ApiError("Order not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Order archived successfully",
    data: order,
  });
});

/*
// @desc    Post Marge Salse invoice
// @route   GET /api/margeorder
// @access  privet
// const margeOrderFish = asyncHandler(async (databaseName) => {
//   const db = mongoose.connection.useDb(databaseName);
//   db.model("Employee", emoloyeeShcema);
//   const FinancialFundsModel = db.model("FinancialFunds", financialFundsSchema);
//   db.model("ReportsFinancialFunds", reportsFinancialFundsSchema);
//   db.model("Product", productSchema);
//   db.model("ReportsSales", ReportsSalesSchema);
//   const orderModel = db.model("Sales", orderSchema);
//   const salsePos = db.model("orderFishPos", orderFishSchema);
//   const salsePointModel = db.model("salesPoints", SalesPointSchema);
//   const accountingTree = db.model("AccountingTree", AccountingTreeSchema);
//   const journalEntryModel = db.model("journalEntry", journalEntrySchema);
//   const LinkPanelModel = db.model("linkPanel", LinkPanelSchema);
//   db.model("Currency", currencySchema);

//   function padZero(value) {
//     return value < 10 ? `0${value}` : value;
//   }

//   const ts = Date.now();
//   const date_ob = new Date(ts);
//   const date = padZero(date_ob.getDate());
//   const month = padZero(date_ob.getMonth() + 1);
//   const year = date_ob.getFullYear();
//   const hours = padZero(date_ob.getHours());
//   const minutes = padZero(date_ob.getMinutes());
//   const seconds = padZero(date_ob.getSeconds());

//   const formattedDate = `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
//   const specificDate = new Date();
//   const specificDateString = specificDate;

//   const salesPoints = await salsePointModel
//     .find()
//     .populate("salesPointCurrency");
//   let journalEntries = [];
//   const journalEntriesTaxMap = new Map();
//   const journalEntriesFundMap = new Map();
//   const nextCounterPayment = (await journalEntryModel.countDocuments()) + 1;

//   for (const salesPoint of salesPoints) {
//     if (salesPoint.isOpen === true) {
//       const orders = await salsePos.find({
//         createdAt: { $gte: specificDateString },
//         type: "pos",
//         salesPoint: salesPoint._id,
//       });
//       await salesPoint.save();
//       const cartItems = [];
//       const fish = [];
//       let totalOrderPrice = 0;
//       let invoiceGrandTotal = 0;
//       let totalBeforTaxOrderPrice = 0;
//       let totalTax = 0;
//       let totalBuyingPrice = 0;
//       let totalInvoiceDiscount = 0;
//       let totalinFundPayment = 0;
//       let exchangeRate = 1;
//       const financialFundsMap = new Map();
//       const taxSummaryMap = new Map();

//       for (const order of orders) {
//         exchangeRate = order.currency.exchangeRate || 1;
//         for (const item of order.cartItems) {
//           const priceBeforTax = item.totalWithoutTax;
//           cartItems.push({
//             qr: item.qr,
//             name: item.name,
//             sellingPrice: item.sellingPrice,
//             soldQuantity: item.soldQuantity,
//             orginalBuyingPrice: item.orginalBuyingPrice,
//             convertedBuyingPrice: item.convertedBuyingPrice || 0,
//             total: item.total,
//             totalWithoutTax: priceBeforTax * item.soldQuantity,
//             tax: { _id: item.tax._id, tax: item.tax.tax },
//             discountAmount: item.discountAmount,
//             discountPercentege: item.discountPercentege,
//             taxValue: item.taxValue,
//           });

//           totalInvoiceDiscount += item.discountAmount / exchangeRate || 0;
//           fish.push(order.counter);
//           totalOrderPrice += item.total;
//           totalBuyingPrice += item.orginalBuyingPrice * item.soldQuantity;
//           totalTax += item.taxValue / exchangeRate;
//           totalBeforTaxOrderPrice += item.totalWithoutTax;
//         }
//         invoiceGrandTotal += order.invoiceGrandTotal;

//         if (order.taxSummary) {
//           for (const item of order.taxSummary) {
//             try {
//               const taxAccount = await accountingTree
//                 .findOneAndUpdate(
//                   { _id: item.salesAccountTax },
//                   {},
//                   { new: true }
//                 )
//                 .populate({ path: "currency" });

//               if (!taxAccount) {
//                 console.log(
//                   `Tax account not found for: ${item.salesAccountTax}`
//                 );
//                 continue;
//               }

//               if (taxSummaryMap.has(item.taxId)) {
//                 const taxData = taxSummaryMap.get(item.taxId);
//                 taxData.totalTaxValue += item.totalTaxValue || 0;
//                 taxData.discountTaxValue += item.discountTaxValue || 0;
//               } else {
//                 taxSummaryMap.set(item.taxId, {
//                   taxId: item.taxId,
//                   taxRate: item.taxRate,
//                   totalTaxValue: item.totalTaxValue || 0,
//                   discountTaxValue: item.discountTaxValue || 0,
//                 });
//               }

//               const total = item.discountTaxValue || 0;
//               if (taxAccount && taxAccount._id) {
//                 const existingEntry = journalEntriesTaxMap.get(
//                   taxAccount._id.toString()
//                 );

//                 if (existingEntry) {
//                   existingEntry.MainCredit += total;
//                   existingEntry.accountCredit +=
//                     (total / exchangeRate) * taxAccount.currency.exchangeRate;
//                 } else {
//                   journalEntriesTaxMap.set(taxAccount._id.toString(), {
//                     counter: 40,
//                     id: taxAccount.id,
//                     name: taxAccount.name,
//                     code: taxAccount.code,
//                     MainCredit: total / exchangeRate,
//                     accountCredit:
//                       (total / exchangeRate) * taxAccount.currency.exchangeRate,
//                     MainDebit: 0,
//                     accountDebit: 0,
//                     accountExRate: taxAccount.currency.exchangeRate,
//                     accountCurrency: taxAccount.currency.currencyCode,
//                     isPrimary: taxAccount.currency.is_primary,
//                     description: "Credit cost account for total before tax",
//                   });
//                 }
//               } else {
//                 console.log("taxAccount is missing _id.");
//               }
//             } catch (err) {
//               console.error("Error processing tax summary item:", err);
//             }
//           }
//         }

//         if (order.financialFund) {
//           for (const fund of order.financialFund) {
//             const fundId = fund.fundId;
//             if (financialFundsMap.has(fundId)) {
//               financialFundsMap.get(fundId).allocatedAmount +=
//                 fund.allocatedAmount;
//             } else {
//               financialFundsMap.set(fundId, {
//                 value: fundId,
//                 allocatedAmount: fund.allocatedAmount / fund.exchangeRate || 0,
//                 label: fund.fundName,
//               });
//             }

//             // const fundAccount = await accountingTree
//             //   .findOneAndUpdate(
//             //     { _id: fund.accountId },
//             //     { $inc: { creditor: fund.allocatedAmount } },
//             //     { new: true }
//             //   )
//             //   .populate({ path: "currency" });

//             // if (fundAccount && fundAccount._id) {
//             //   const existingEntry = journalEntriesFundMap.get(
//             //     fundAccount._id.toString()
//             //   );

//             //   if (existingEntry) {
//             //     existingEntry.MainCredit +=
//             //       fund.allocatedAmount / fund.exchangeRate;
//             //     existingEntry.accountCredit +=
//             //       (fund.allocatedAmount / fund.exchangeRate) *
//             //       fundAccount.currency.exchangeRate;
//             //   } else {
//             //     journalEntriesFundMap.set(fundAccount._id.toString(), {
//             //       counter: 40,
//             //       id: fundAccount.id,
//             //       name: fundAccount.name,
//             //       code: fundAccount.code,
//             //       MainCredit: fund.allocatedAmount / fund.exchangeRate,
//             //       accountCredit:
//             //         (fund.allocatedAmount / fund.exchangeRate) *
//             //         fundAccount.currency.exchangeRate,
//             //       MainDebit: 0,
//             //       accountDebit: 0,
//             //       accountExRate: fundAccount.currency.exchangeRate,
//             //       accountCurrency: fundAccount.currency.currencyCode,
//             //       isPrimary: fundAccount.currency.is_primary,
//             //       description: "Credit cost account for total before tax",
//             //     });
//             //   }
//             // } else {
//             //   console.log("fundAccount is missing _id.");
//             // }

//             totalinFundPayment += fund.allocatedAmount / fund.exchangeRate;
//           }
//         }
//       }

//       const aggregatedFunds = Array.from(financialFundsMap.values());
//       const taxSummary = Array.from(taxSummaryMap.values());

//       const nextCounter = (await orderModel.countDocuments()) + 1;
//       const findContLick = await LinkPanelModel.findOne({
//         name: "cost of sold products",
//       });
//       const salesLick = await LinkPanelModel.findOne({
//         name: "Sales",
//       });
//       const monetaryLink = await LinkPanelModel.findOne({ name: "monetary" });
//       const stocksLink = await LinkPanelModel.findOne({ name: "Stocks" });
//       const discountGranted = await LinkPanelModel.findOne({
//         name: "Discount granted",
//       });
//       const customersLink = await LinkPanelModel.findOne({
//         name: "Walk-In Customer",
//       });

//       // const costAccount = await accountingTree
//       //   .findOneAndUpdate(
//       //     { _id: findContLick.accountData },
//       //     { $inc: { debtor: totalBuyingPrice||0 } },
//       //     { new: true }
//       //   )
//       //   .populate({ path: "currency" });

//       // const monetaryAccount = await accountingTree
//       //   .findOneAndUpdate(
//       //     { _id: monetaryLink.accountData },
//       //     { $inc: { creditor: totalBeforTaxOrderPrice||0 } },
//       //     { new: true }
//       //   )
//       //   .populate({ path: "currency" });

//       // const stockAccount = await accountingTree
//       //   .findOneAndUpdate(
//       //     { _id: stocksLink.accountData },
//       //     { $inc: { creditor: totalBuyingPrice||0 } },
//       //     { new: true }
//       //   )
//       //   .populate({ path: "currency" });

//       // const customerAccount = await accountingTree
//       //   .findOneAndUpdate(
//       //     { _id: customersLink.accountData },
//       //     { $inc: { debtor: totalOrderPrice||0 } },
//       //     { new: true }
//       //   )
//       //   .populate({ path: "currency" });

//       // const discountGrantedAccount = await accountingTree
//       //   .findOneAndUpdate(
//       //     { _id: discountGranted?.accountData },
//       //     { $inc: { creditor: totalInvoiceDiscount||0 } },
//       //     { new: true }
//       //   )
//       //   .populate({ path: "currency" });
//       // const salesAccount = await accountingTree
//       //   .findOneAndUpdate(
//       //     { _id: salesLick?.accountData },
//       //     { $inc: { creditor: totalBeforTaxOrderPrice||0 } },
//       //     { new: true }
//       //   )
//       //   .populate({ path: "currency" });
//       let counter = 1;
//       // if (customerAccount) {
//       //   journalEntries.push({
//       //     counter: counter++,
//       //     id: customerAccount._id,
//       //     name: customerAccount.name,
//       //     code: customerAccount.code,
//       //     MainDebit: totalOrderPrice,
//       //     accountDebit:
//       //       totalOrderPrice * customerAccount.currency.exchangeRate,
//       //     MainCredit: 0,
//       //     accountCredit: 0,
//       //     accountExRate: customerAccount.currency.exchangeRate,
//       //     accountCurrency: customerAccount.currency.currencyCode,
//       //     isPrimary: customerAccount.currency.is_primary,
//       //     description: "Credit cost account for total before tax",
//       //   });
//       // }

//       // if (totalInvoiceDiscount > 0 && discountGrantedAccount !== null) {
//       //   journalEntries.push({
//       //     counter: counter++,
//       //     id: discountGrantedAccount._id,
//       //     name: discountGrantedAccount.name,
//       //     code: discountGrantedAccount.code,
//       //     MainCredit: 0,
//       //     accountCredit: 0,
//       //     MainDebit: totalInvoiceDiscount,
//       //     accountDebit:
//       //       totalInvoiceDiscount *
//       //       discountGrantedAccount.currency.exchangeRate,
//       //     accountExRate: discountGrantedAccount.currency.exchangeRate,
//       //     accountCurrency: discountGrantedAccount.currency.currencyCode,
//       //     isPrimary: discountGrantedAccount.currency.is_primary,
//       //     description: "Credit cost account for total before tax",
//       //   });
//       // }

//       // for (const [key, entry] of journalEntriesTaxMap.entries()) {
//       //   journalEntries.push({
//       //     counter: counter++,
//       //     id: entry.id,
//       //     name: entry.name,
//       //     code: entry.code,
//       //     MainCredit: entry.MainCredit,
//       //     accountCredit: entry.accountCredit,
//       //     MainDebit: 0,
//       //     accountDebit: 0,
//       //     accountExRate: entry.accountExRate,
//       //     accountCurrency: entry.accountCurrency,
//       //     isPrimary: entry.isPrimary,
//       //     description: entry.description,
//       //   });
//       // }
//       // if (salesAccount) {
//       //   journalEntries.push({
//       //     counter: counter++,
//       //     id: salesAccount._id,
//       //     name: salesAccount.name,
//       //     code: salesAccount.code,
//       //     MainCredit: totalBeforTaxOrderPrice,
//       //     accountCredit:
//       //       totalBeforTaxOrderPrice * salesAccount.currency.exchangeRate,
//       //     MainDebit: 0,
//       //     accountDebit: 0,

//       //     accountExRate: salesAccount.currency.exchangeRate,
//       //     accountCurrency: salesAccount.currency.currencyCode,
//       //     isPrimary: salesAccount.currency.is_primary,
//       //     description: "Credit cost account for total before tax",
//       //   });
//       // }
//       // if (monetaryAccount) {
//       //   journalEntries.push({
//       //     counter: counter++,
//       //     id: monetaryAccount._id,
//       //     name: monetaryAccount.name,
//       //     code: monetaryAccount.code,
//       //     MainCredit: totalBeforTaxOrderPrice,
//       //     accountCredit:
//       //       totalBeforTaxOrderPrice * monetaryAccount.currency.exchangeRate,
//       //     MainDebit: 0,
//       //     accountDebit: 0,
//       //     accountExRate: monetaryAccount.currency.exchangeRate,
//       //     accountCurrency: monetaryAccount.currency.currencyCode,
//       //     isPrimary: monetaryAccount.currency.is_primary,
//       //     description: "Credit monetary account for total before tax",
//       //   });
//       // }

//       // journalEntries.push({
//       //   counter: counter++,
//       //   id: costAccount._id,
//       //   name: costAccount.name,
//       //   code: costAccount.code,
//       //   MainDebit: totalBuyingPrice,
//       //   accountDebit: totalBuyingPrice * costAccount.currency.exchangeRate,
//       //   MainCredit: 0,
//       //   accountCredit: 0,
//       //   accountExRate: costAccount.currency.exchangeRate,
//       //   accountCurrency: costAccount.currency.currencyCode,
//       //   isPrimary: costAccount.currency.is_primary,
//       //   description: "Credit cost account for total before tax",
//       // });

//       // journalEntries.push({
//       //   counter: counter++,
//       //   id: stockAccount._id,
//       //   name: stockAccount.name,
//       //   code: stockAccount.code,
//       //   MainCredit: totalBuyingPrice,
//       //   accountCredit: totalBuyingPrice * stockAccount.currency.exchangeRate,
//       //   MainDebit: 0,
//       //   accountDebit: 0,
//       //   accountExRate: stockAccount.currency.exchangeRate,
//       //   accountCurrency: stockAccount.currency.currencyCode,
//       //   isPrimary: stockAccount.currency.is_primary,
//       //   description: "Credit cost account for total before tax",
//       // });
//       // journalEntries.push({
//       //   counter: counter++,
//       //   id: customerAccount._id,
//       //   name: customerAccount.name,
//       //   code: customerAccount.code,
//       //   MainDebit: totalOrderPrice,
//       //   accountDebit: totalOrderPrice * customerAccount.currency.exchangeRate,
//       //   MainCredit: 0,
//       //   accountCredit: 0,
//       //   accountExRate: customerAccount.currency.exchangeRate,
//       //   accountCurrency: customerAccount.currency.currencyCode,
//       //   isPrimary: customerAccount.currency.is_primary,
//       //   description: "Credit cost account for total before tax",
//       // });
//       // for (const [key, entry] of journalEntriesFundMap.entries()) {
//       //   journalEntries.push({
//       //     counter: counter++,
//       //     id: entry.id,
//       //     name: entry.name,
//       //     code: entry.code,
//       //     MainCredit: entry.MainCredit,
//       //     accountCredit: entry.accountCredit,
//       //     MainDebit: 0,
//       //     accountDebit: 0,
//       //     accountExRate: entry.accountExRate,
//       //     accountCurrency: entry.accountCurrency,
//       //     isPrimary: entry.isPrimary,
//       //     description: entry.description,
//       //   });
//       // }

//       const newOrderData = {
//         invoicesItems: cartItems,
//         invoiceGrandTotal: invoiceGrandTotal,
//         orderDate: formattedDate,
//         type: "bills",
//         totalInMainCurrency: totalOrderPrice,
//         counter: nextCounter,
//         paymentsStatus: "paid",
//         currency: {
//           value: salesPoint._id,
//           currencyCode: salesPoint.salesPointCurrency.currencyCode,
//           exchangeRate: salesPoint.salesPointCurrency.exchangeRate,
//         },
//         exchangeRate: 1,
//         fish: fish,
//         financailFund: aggregatedFunds,
//         manuallInvoiceDiscountValue: 0,
//         manuallInvoiceDiscount: 0,
//         taxSummary: taxSummary,
//         invoiceDiscount: totalInvoiceDiscount * exchangeRate,
//         invoiceSubTotal: totalBeforTaxOrderPrice * exchangeRate,
//         invoiceTax: totalTax * exchangeRate,
//         discountType: "value",
//       };
//       // const journalEntryCounter =
//       //   (await journalEntryModel.countDocuments()) + 1;

//       // await journalEntryModel.create({
//       //   journalName: "POS " + journalEntryCounter,
//       //   journalDebit:
//       //     totalOrderPrice +
//       //     totalBuyingPrice +
//       //     totalOrderPrice +
//       //     totalInvoiceDiscount,
//       //   journalCredit:
//       //     totalBuyingPrice +
//       //     totalBeforTaxOrderPrice +
//       //     totalTax +
//       //     totalinFundPayment,
//       //   journalAccounts: journalEntries,
//       //   counter: nextCounterPayment,
//       //   journalRefNum: journalEntryCounter,
//       // });

//       const newOrders = await orderModel.insertMany(newOrderData);
//       journalEntries = [];
//     }
//   }
// });

// const margeOrderRefundFish = asyncHandler(async (databaseName) => {
//   const db = mongoose.connection.useDb(databaseName);
//   db.model("Employee", emoloyeeShcema);
//   db.model("FinancialFunds", financialFundsSchema);
//   db.model("ReportsFinancialFunds", reportsFinancialFundsSchema);
//   db.model("Product", productSchema);
//   db.model("ReportsSales", ReportsSalesSchema);
//   const orderModel = db.model("returnOrder", returnOrderSchema);
//   const salsePos = db.model("RefundPosSales", refundPosSalesSchema);

//   function padZero(value) {
//     return value < 10 ? `0${value}` : value;
//   }
//   let ts = Date.now();
//   let date_ob = new Date(ts);
//   let date = padZero(date_ob.getDate());
//   let month = padZero(date_ob.getMonth() + 1);
//   let year = date_ob.getFullYear();
//   let hours = padZero(date_ob.getHours());
//   let minutes = padZero(date_ob.getMinutes());
//   let seconds = padZero(date_ob.getSeconds());

//   const formattedDate =
//     year +
//     "-" +
//     month +
//     "-" +
//     date +
//     " " +
//     hours +
//     ":" +
//     minutes +
//     ":" +
//     seconds;
//   const specificDate = new Date();
//   const specificDateString = specificDate.toISOString().split("T")[0];

//   // Find orders where paidAt matches the specified date and type is 'pos'
//   const orders = await salsePos.find({
//     paidAt: {
//       $gte: specificDateString,
//     },
//   });
//   const cartItems = [];
//   const fish = [];
//   let totalOrderPrice = 0;

//   const financialFundsMap = new Map();

//   for (const order of orders) {
//     order.cartItems.forEach((item) => {
//       cartItems.push(item);
//       fish.push(order.counter);
//       totalOrderPrice += item.taxPrice * item.quantity;
//     });
//     await order.financialFunds?.forEach((fund) => {
//       const fundId = fund.fundId.toString();

//       if (financialFundsMap.has(fundId)) {
//         financialFundsMap.get(fundId).allocatedAmount += fund.allocatedAmount;
//       } else {
//         financialFundsMap.set(fundId, {
//           fundId: fund.fundId,
//           allocatedAmount: fund.allocatedAmount || 0,
//           exchangeRateIcon: fund.exchangeRateIcon,
//         });
//       }
//     });

//     if (order.onefinancialFunds) {
//       const fundId = order.onefinancialFunds.toString();
//       if (financialFundsMap.has(fundId)) {
//         financialFundsMap.get(fundId).allocatedAmount +=
//           order.priceExchangeRate;
//       } else {
//         financialFundsMap.set(fundId, {
//           fundId: fundId,
//           allocatedAmount: order.priceExchangeRate || 0,
//         });
//       }
//     }
//   }
//   // Convert the map of financial funds to an array
//   const aggregatedFunds = Array.from(financialFundsMap.values());

//   const nextCounter = (await orderModel.countDocuments()) + 1;

//   const newOrderData = {
//     invoicesItems: cartItems,
//     priceExchangeRate: totalOrderPrice,
//     date: formattedDate,
//     type: "bills",
//     totalOrderPrice: totalOrderPrice,
//     counter: "ref " + nextCounter,
//     paid: "paid",
//     exchangeRate: 1,
//     fish: fish,
//     financialFunds: aggregatedFunds,
//   };

//   const newOrders = await orderModel.insertMany(newOrderData);
// });
// cron.schedule("59 23 * * *", async () => {
//   console.log("Running Marge order task for all databases...");

//   // Fetch all subscriber databases
//   // for (const dbName of subscriberDatabases) {
//   // margeOrderRefundFish("noontek_gaziantep");
//   margeOrderFish("noontek_gaziantep");

//   // }
// });
*/
