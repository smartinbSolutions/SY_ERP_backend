const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const multer = require("multer");
const { createPaymentHistory } = require("./paymentHistoryService");
const suppliersModel = require("../models/suppliersModel");
const purchaseinvoicesModel = require("../models/purchaseinvoicesModel");
const accountingTreeModel = require("../models/accountingTreeModel");
const customarModel = require("../models/customarModel");
const financialFundsModel = require("../models/financialFundsModel");
const paymentModel = require("../models/paymentModel");
const salesrModel = require("../models/orderModel");
const expensesModel = require("../models/expensesModel");
const ReportsFinancialFundsModel = require("../models/reportsFinancialFunds");
const { createInvoiceHistory } = require("./invoiceHistoryService");
const RefundPurchaseInvoicesModel = require("../models/refundPurchaseInviceModel");
const staffModel = require("../models/Hr/staffModel");
const salaryHistoryModel = require("../models/Hr/salaryHistoryModel");
const returnOrderModel = require("../models/returnOrderModel");
const paymentHistoryModel = require("../models/paymentHistoryModel");
const { default: mongoose } = require("mongoose");

const multerStorage = multer.diskStorage({
  destination: function (req, file, callback) {
    // Specify the destination folder for storing the files
    callback(null, "./uploads/invoice");
  },
  filename: function (req, file, callback) {
    // Specify the filename for the uploaded file
    const originalname = file.originalname;
    const lastDotIndex = originalname.lastIndexOf(".");
    const fileExtension =
      lastDotIndex !== -1 ? originalname.slice(lastDotIndex + 1) : "";
    const filename = `payment-${Date.now()}.${fileExtension}`;
    callback(null, filename);
  },
});

const upload = multer({
  storage: multerStorage,
  fileFilter: (req, file, callback) => {
    const allowedMimes = ["application/pdf"];
    if (allowedMimes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new ApiError("Invalid file type. Only PDFs are allowed."));
    }
  },
});

exports.uploadFile = upload.single("file");

const financailSource = async (
  destinationType,
  destination,
  companyId,
  data,
  next,
  paymentInFundCurrency,
  paymentId,
  req,
  ref = ""
) => {
  try {
    let fund = 0,
      amount = 0;

    if (req.body.isWithDraw === true) {
      fund -= paymentInFundCurrency;
      amount += data.totalMainCurrency;
      console.log("70");
    } else {
      fund += paymentInFundCurrency;
      amount -= data.totalMainCurrency;
    }

    if (destinationType === "supplier") {
      await suppliersModel.findOneAndUpdate(
        { _id: destination.id, companyId },
        { $inc: { TotalUnpaid: -amount } },
        { new: true }
      );
      await createPaymentHistory(
        "payment",
        data.date,
        Math.abs(amount),
        paymentInFundCurrency,
        destinationType,
        destination.id,
        ref,
        companyId,
        req.body.description,
        paymentId,
        req.body.isWithDraw === true ? "Withdrawal" : "Deposit",
        "",
        req.body.destinationCurrencyCode
      );
    } else if (destinationType === "customer") {
      await customarModel.findOneAndUpdate(
        { _id: destination.id, companyId },
        { $inc: { TotalUnpaid: amount } },
        { new: true }
      );
      await createPaymentHistory(
        "payment",
        data.date,
        amount,
        paymentInFundCurrency,
        destinationType,
        destination.id,
        ref,
        companyId,
        req.body.description,
        paymentId,
        req.body.isWithDraw === true ? "Withdrawal" : "Deposit",
        "",
        req.body.destinationCurrencyCode
      );
    } else if (destinationType === "account") {
      const account = await accountingTreeModel.findOne({
        _id: destination.id,
        companyId,
      });
    } else if (destinationType === "fund") {
      const financialFunds = await financialFundsModel.findOneAndUpdate(
        { _id: destination.id, companyId },
        { $inc: { fundBalance: fund } },
        { new: true }
      );

      await ReportsFinancialFundsModel.create({
        date: data.date,
        amount: paymentInFundCurrency,
        ref: data._id,
        type: data.paymentType,
        financialFundId: financialFunds._id,
        financialFundRest: financialFunds.fundBalance,
        exchangeRate: data.currencyExchangeRate,
        paymentType: data.paymentType,
        payment: paymentId,
        description: req.body.description,
        companyId,
      });
    } else {
      throw new Error("Invalid destinationType type.");
    }
  } catch (e) {
    console.log(`Error: ${e}`);
    throw e;
  }
};

exports.createPayment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }
  const date = Date.now();
  const date_ob = new Date(date);

  const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;

  const isoDate = `${req.body.date}T${formattedDate}Z`;
  req.body.date = isoDate;

  const count = await paymentModel.countDocuments({
    companyId,
    paymentText: req.body.paymentType,
  });
  req.body.isWithDraw === true
    ? (req.body.paymentType = "Withdrawal")
    : (req.body.paymentType = "Deposit");
  req.body.counter = Number(req.body.counter) + Number(count) + 1;
  req.body.paymentInDestinationCurrency = req.body.paymentInFundCurrency;
  switch (req.body.sourceType) {
    case "fund":
      const fundPayment = await handleFundPayment(req, companyId, next);
      return res.status(201).json({
        message: "Fund payment created successfully",
        payment: fundPayment,
      });
    case "supplier":
      const supplierPayment = await handleSupplierPayment(req, companyId, next);
      return res.status(201).json({
        message: "Supplier payment created successfully",
        payment: supplierPayment,
      });
    case "customer":
      const customerPayment = await handleCustomerPayment(req, companyId, next);
      return res.status(201).json({
        message: "Customer payment created successfully",
        payment: customerPayment,
      });
    case "purchase":
      const purchasePayment = await handlePurchasePayment(req, companyId, next);
      return res.status(201).json({
        message: "Purchase payment created successfully",
        payment: purchasePayment,
      });
    case "sales":
      const salesPayment = await handleSalesPayment(req, companyId, next);
      return res.status(201).json({
        message: "Sales payment created successfully",
        payment: salesPayment,
      });
    case "refundPurchase":
      const refundPurchasePayment = await handleRefundPurchasePayment(
        req,
        companyId,
        next
      );
      return res.status(201).json({
        message: "Refund Purchase payment created successfully",
        payment: refundPurchasePayment,
      });
    case "expense":
      const expensePayment = await handleExpensePayment(req, companyId, next);
      return res.status(201).json({
        message: "Expense payment created successfully",
        payment: expensePayment,
      });
    case "account":
      const accountPayment = await handleAccountPayment(req, companyId, next);
      return res.status(201).json({
        message: "Account payment created successfully",
        payment: accountPayment,
      });
    case "salary":
      const salaryPayment = await handleSalaryPayment(req, companyId, next);
      return res.status(201).json({
        message: "Salary payment created successfully",
        payment: salaryPayment,
      });
    case "refundSales":
      const refundSalesPayment = await handleRefundSalesPayment(
        req,
        companyId,
        next
      );
      return res.status(201).json({
        message: "Refund Sales payment created successfully",
        payment: refundSalesPayment,
      });

    default:
      throw new Error("Invalid destinationType type");
  }
});

/////////////////////////////////////
const handleSupplierPayment = async (req, companyId, next) => {
  try {
    const {
      totalMainCurrency,
      isWithDraw,
      destinationExchangeRate,
      destination,
      destinationCurrencyCode,
      paymentInFundCurrency,
      date,
      description,
      destinationType,
    } = req.body;

    const supplier = await suppliersModel.findOne({
      _id: req.body.source.id,
      companyId,
    });
    if (!supplier) throw new Error("Supplier not found");

    let remainingPayment = totalMainCurrency;
    const paymentInvoice = [];
    req.body.paymentType = isWithDraw ? "Withdrawal" : "Deposit";
    const payment = await paymentModel.create(req.body);

    // ====== المشتريات ======
    const purchases = await purchaseinvoicesModel.find({
      paid: "unpaid",
      "supplier.id": req.body.source.id,
      type: { $ne: "cancel" },
      companyId,
    });

    const bulkPurchaseUpdates = [];

    for (const purchase of purchases) {
      if (remainingPayment <= 0 && isWithDraw) break;

      const paymentAmount = Math.min(
        purchase.totalRemainderMainCurrency,
        remainingPayment
      );

      const currencyRate = purchase?.currency?.exchangeRate || 1;
      const updateObj = {
        $set: {
          totalRemainderMainCurrency:
            purchase.totalRemainderMainCurrency - paymentAmount,
          totalRemainder:
            purchase.totalRemainder - paymentAmount * currencyRate,
        },
        $push: {
          payments: {
            payment: paymentAmount * (destinationExchangeRate || 1),
            paymentMainCurrency: paymentAmount,
            financialFunds: destination.name,
            financialFundsCurrencyCode,
            paymentID: payment._id,
            date,
            paymentInInvoiceCurrency: paymentAmount * currencyRate,
          },
        },
      };

      if (purchase.totalRemainderMainCurrency <= paymentAmount)
        updateObj.$set.paid = "paid";

      remainingPayment -= paymentAmount;

      paymentInvoice.push({
        id: purchase._id,
        status: updateObj.$set.paid || purchase.paid,
        paymentInFundCurrency: paymentInFundCurrency,
        paymentMainCurrency: paymentAmount,
        invoiceTotal: purchase.totalPurchasePriceMainCurrency,
        invoiceName: purchase.invoiceName,
        invoiceCurrencyCode: purchase?.currency?.currencyCode || "N/A",
        financialFundsId: destination.id,
        invoiceType: "purchase",
        paymentInvoiceCurrency: paymentAmount * currencyRate,
      });

      bulkPurchaseUpdates.push({
        updateOne: { filter: { _id: purchase._id }, update: updateObj },
      });
    }

    if (bulkPurchaseUpdates.length)
      await purchaseinvoicesModel.bulkWrite(bulkPurchaseUpdates);

    // ====== المصاريف ======
    const expenses = await expensesModel.find({
      paymentStatus: "unpaid",
      "supplier.id": req.body.source.id,
      companyId,
    });

    const bulkExpenseUpdates = [];

    for (const expense of expenses) {
      if (remainingPayment <= 0 && isWithDraw) break;

      const expenseAmount = Math.min(
        expense.totalRemainderMainCurrency,
        remainingPayment
      );
      const exRate = expense?.currency?.exchangeRate || 1;

      const updateObj = {
        $set: {
          totalRemainderMainCurrency:
            expense.totalRemainderMainCurrency - expenseAmount,
          totalRemainder: expense.totalRemainder - expenseAmount * exRate,
        },
        $push: {
          payments: {
            payment: expenseAmount * (destinationExchangeRate || 1),
            paymentMainCurrency: expenseAmount,
            financialFunds: destination.name,
            paymentID: payment._id,
            date,
            paymentInInvoiceCurrency: expenseAmount * exRate,
          },
        },
      };

      if (expense.totalRemainderMainCurrency <= expenseAmount)
        updateObj.$set.paymentStatus = "paid";

      remainingPayment -= expenseAmount;

      paymentInvoice.push({
        id: expense._id,
        status: updateObj.$set.paymentStatus || expense.paymentStatus,
        paymentInFundCurrency: paymentInFundCurrency,
        paymentMainCurrency: expenseAmount,
        invoiceTotal: expense.expenceTotalMainCurrency,
        invoiceName: expense.expenseName,
        invoiceCurrencyCode: expense?.currency?.currencyCode || "N/A",
        financialFundsId: destination.id,
        invoiceType: "expense",
        paymentInvoiceCurrency: expenseAmount * exRate,
      });

      bulkExpenseUpdates.push({
        updateOne: { filter: { _id: expense._id }, update: updateObj },
      });
    }
    if (req.body.isWithDraw === true) {
      paymentType = "Withdrawal";
      supplier.TotalUnpaid -= totalMainCurrency;
    } else {
      paymentType = "Deposit";
      supplier.TotalUnpaid += totalMainCurrency;
    }
    await supplier.save();

    if (bulkExpenseUpdates.length)
      await expensesModel.bulkWrite(bulkExpenseUpdates);

    await createPaymentHistory(
      "payment",
      date,
      totalMainCurrency,
      paymentInFundCurrency,
      "supplier",
      req.body.source.id,
      0,
      companyId,
      description,
      payment.id,
      req.body.paymentType,
      "",
      destinationCurrencyCode
    );
    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req
    );
    return payment;
  } catch (err) {
    console.error("❌ handleSupplierPayment Error:", err);
    throw err;
  }
};

const handlePurchasePayment = async (req, companyId, next) => {
  try {
    const {
      source,
      totalMainCurrency,
      totalInPaymentCurrency,
      paymentInFundCurrency,
      exchangeRate,
      date,
      description,
      destination,
      destinationCurrencyCode,
      destinationType,
    } = req.body;

    const purchase = await purchaseinvoicesModel.findOne({
      _id: source.id,
      status: { $nin: ["cancelled", "draft"] },
      companyId,
    });
    if (!purchase) throw new Error("Purchase invoice not found");

    const supplier = await suppliersModel.findOne({
      _id: purchase.supllier.id,
      companyId,
    });
    if (!supplier) throw new Error("Supplier not found");

    req.body.type = "purchase";
    req.body.paymentText = "Withdrawal";
    const payment = await paymentModel.create(req.body);

    let paymentAmount = totalMainCurrency;
    let invoicePaymentCurrency = totalInPaymentCurrency;

    if (paymentAmount > purchase.totalRemainderMainCurrency) {
      paymentAmount = purchase.totalRemainderMainCurrency;
      invoicePaymentCurrency = purchase.totalRemainder;
    }

    purchase.totalRemainderMainCurrency -= paymentAmount;
    purchase.totalRemainder -= invoicePaymentCurrency;

    if (purchase.totalRemainderMainCurrency <= 0.9) {
      purchase.paid = "paid";
      purchase.totalRemainderMainCurrency = 0;
      purchase.totalRemainder = 0;
    }

    supplier.TotalUnpaid -= paymentAmount;

    purchase.payments.push({
      payment: paymentInFundCurrency || paymentAmount,
      paymentMainCurrency: paymentAmount,
      financialFunds: destination.name,
      paymentID: payment._id,
      financialFundsCurrencyCode: destinationCurrencyCode,
      exchangeRate,
      date,
      paymentInInvoiceCurrency: invoicePaymentCurrency,
      financialFundsId: destination.id,
    });

    await createInvoiceHistory(
      companyId,
      purchase._id,
      "payment",
      req.user._id,
      date,
      `${paymentInFundCurrency} ${destinationCurrencyCode}`,
      "invoice"
    );

    await supplier.save();
    await purchase.save();

    await createPaymentHistory(
      "payment",
      date,
      paymentAmount,
      paymentInFundCurrency,
      "supplier",
      supplier._id,
      purchase._id,
      companyId,
      description,
      payment.id,
      "Withdrawal",
      "",
      destinationCurrencyCode
    );
    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req,
      purchase._id
    );
    return payment;
  } catch (err) {
    throw err;
  }
};

const handleRefundPurchasePayment = async (req, companyId, next) => {
  try {
    const {
      source,
      totalMainCurrency,
      totalInPaymentCurrency,
      paymentInFundCurrency,
      exchangeRate,
      date,
      description,
      destination,
      destinationCurrencyCode,
      destinationType,
    } = req.body;
    const refundPurchase = await RefundPurchaseInvoicesModel.findOne({
      _id: source.id,
      companyId,
    });

    if (!refundPurchase) throw new Error("Sales invoice not found");

    const supplier = await suppliersModel.findOne({
      _id: refundPurchase.supplier.id,
      companyId,
    });

    if (!supplier) throw new Error("supplier not found");

    req.body.type = "refund purchase";
    req.body.paymentText = "Deposit";
    const payment = await paymentModel.create(req.body);

    let paymentAmount = totalMainCurrency;
    let invoicePaymentCurrency = totalInPaymentCurrency;

    if (paymentAmount > refundPurchase.totalRemainderMainCurrency) {
      paymentAmount = refundPurchase.totalRemainderMainCurrency;
      invoicePaymentCurrency = refundPurchase.totalRemainder;
    }

    refundPurchase.totalRemainderMainCurrency -= paymentAmount;
    refundPurchase.totalRemainder -= invoicePaymentCurrency;

    if (refundPurchase.totalRemainderMainCurrency <= 0.9) {
      refundPurchase.paid = "paid";
      refundPurchase.totalRemainderMainCurrency = 0;
      refundPurchase.totalRemainder = 0;
    }

    // supplier.TotalUnpaid -= paymentAmount;

    refundPurchase.payments.push({
      payment: paymentInFundCurrency || paymentAmount,
      paymentMainCurrency: paymentAmount,
      financialFunds: destination.name,
      paymentID: payment._id,
      financialFundsCurrencyCode: destinationCurrencyCode,
      exchangeRate,
      date,
      paymentInInvoiceCurrency: invoicePaymentCurrency,
      financialFundsId: destination.id,
    });

    await createInvoiceHistory(
      companyId,
      refundPurchase._id,
      "payment",
      req.user._id,
      date,
      `${paymentInFundCurrency} ${destinationCurrencyCode}`,
      "invoice"
    );

    await supplier.save();
    await refundPurchase.save();

    await createPaymentHistory(
      "payment",
      date,
      paymentAmount,
      paymentInFundCurrency,
      "supplier",
      supplier._id,
      refundPurchase._id,
      companyId,
      description,
      payment.id,
      "Deposit",
      "",
      destinationCurrencyCode
    );
    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req
    );
    return payment;
  } catch (err) {
    throw err;
  }
};

const handleCustomerPayment = async (req, companyId, next) => {
  try {
    const {
      source,
      totalMainCurrency,
      totalInPaymentCurrency,
      paymentInFundCurrency,
      exchangeRate,
      date,
      description,
      destination,
      destinationCurrencyCode,
      isWithDraw,
      destinationType,
    } = req.body;

    const customer = await customarModel.findOne({
      _id: source.id,
      companyId,
    });
    if (!customer) throw new Error("customer not found");

    const payment = await paymentModel.create(req.body);
    const sales = await salesrModel.find({
      paymentsStatus: "unpaid",
      "customer.id": source.id,
      type: { $ne: "cancel" },
      companyId,
    });
    let remainingPayment = totalMainCurrency;
    let paymentInvoice = [];
    req.body.paymentType = isWithDraw ? "Withdrawal" : "Deposit";
    const bulkUpdateOperations = sales
      .map((sale) => {
        const paymentAmount = Math.min(
          sale.totalRemainderMainCurrency,
          remainingPayment
        );
        if (paymentAmount === 0) return null;
        const newTotalRemainderMainCurrency = parseFloat(
          (sale.totalRemainderMainCurrency - paymentAmount).toFixed(2)
        );

        const newTotalRemainder = parseFloat(
          (
            sale.totalRemainder -
            paymentAmount * sale.currencyExchangeRate
          ).toFixed(2)
        );

        const updateObj = {
          $set: {
            totalRemainderMainCurrency: newTotalRemainderMainCurrency,
            totalRemainder: newTotalRemainder,
          },
          $push: {
            payments: {
              payment: totalInPaymentCurrency,
              paymentInFundCurrency: paymentInFundCurrency,
              paymentMainCurrency: paymentAmount,
              financialFunds: destination.name,
              financialFundsCurrencyCode: req.body.destinationCurrencyCode,
              paymentID: payment._id,
              invoiceTotal: paymentAmount * sale?.currency.exchangeRate,
              date: req.body.date || formattedDate,
              paymentInInvoiceCurrency:
                paymentAmount * sale?.currency.exchangeRate,
            },
          },
        };
        if (newTotalRemainderMainCurrency <= 0.9) {
          updateObj.$set.paymentsStatus = "paid";
        }

        remainingPayment -= paymentAmount;

        paymentInvoice.push({
          id: sale._id,
          status: updateObj.$set.paymentsStatus || sale.paymentsStatus,
          paymentInFundCurrency: paymentInFundCurrency,
          paymentMainCurrency: paymentAmount,
          invoiceTotal: sale.totalInMainCurrency,
          invoiceName: sale.invoiceName,
          invoiceCurrencyCode: sale.currency.currencyCode,
          financialFundsId: destination.id,
          paymentInvoiceCurrency:
            paymentAmount * (sale.currency.exchangeRate || 1),
        });

        return {
          updateOne: {
            filter: { _id: sale._id },
            update: updateObj,
          },
        };
      })
      .filter(Boolean);

    if (bulkUpdateOperations.length > 0 && req.body.isWithDraw === false) {
      await salesrModel.bulkWrite(bulkUpdateOperations);
    } else {
      paymentInvoice = {
        id: "",
        status: "",
        paymentInFundCurrency: paymentInFundCurrency,
        paymentMainCurrency: totalMainCurrency,
        invoiceTotal: "0",
        invoiceName: "0",
        invoiceCurrencyCode: "N/A",
      };
    }

    if (req.body.isWithDraw === true) {
      paymentType = "Withdrawal";
      customer.TotalUnpaid += totalMainCurrency;
    } else {
      paymentType = "Deposit";
      customer.TotalUnpaid -= totalMainCurrency;
    }
    await customer.save();
    await createPaymentHistory(
      "payment",
      date,
      totalMainCurrency,
      paymentInFundCurrency,
      "customer",
      source.id,
      salesrModel.counter,
      companyId,
      description,
      payment.id,
      paymentType,
      "",
      destinationCurrencyCode
    );
    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req
    );
    return payment;
  } catch (err) {
    console.error("❌ handlecustomerPayment Error:", err);
    throw err;
  }
};

const handleSalesPayment = async (req, companyId, next) => {
  try {
    const {
      source,
      totalMainCurrency,
      totalInPaymentCurrency,
      paymentInFundCurrency,
      exchangeRate,
      date,
      description,
      destination,
      paymentCurrency,
      destinationCurrencyCode,
      destinationType,
    } = req.body;
    const sales = await salesrModel.findOne({
      _id: source.id,
      type: { $ne: "cancel" },
      companyId,
    });

    if (!sales) throw new Error("Sales invoice not found");

    const customar = await customarModel.findOne({
      _id: sales.customer.id,
      companyId,
    });
    if (!customar) throw new Error("customar not found");

    req.body.type = "purchase";
    req.body.paymentText = "Deposit";
    const payment = await paymentModel.create(req.body);

    let paymentAmount = totalMainCurrency;
    let invoicePaymentCurrency = totalInPaymentCurrency;

    if (paymentAmount > sales.totalRemainderMainCurrency) {
      paymentAmount = sales.totalRemainderMainCurrency;
      invoicePaymentCurrency = sales.totalRemainder;
    }

    sales.totalRemainderMainCurrency -= paymentAmount;
    sales.totalRemainder -= invoicePaymentCurrency;

    if (sales.totalRemainderMainCurrency <= 0.9) {
      sales.paymentsStatus = "paid";
      sales.totalRemainderMainCurrency = 0;
      sales.totalRemainder = 0;
    }

    customar.TotalUnpaid -= paymentAmount;

    sales.payments.push({
      payment: paymentInFundCurrency || paymentAmount,
      paymentMainCurrency: paymentAmount,
      financialFunds: destination.name,
      paymentID: payment._id,
      financialFundsCurrencyCode: destinationCurrencyCode,
      exchangeRate,
      date,
      paymentInInvoiceCurrency: invoicePaymentCurrency,
      financialFundsId: destination.id,
    });

    await createInvoiceHistory(
      companyId,
      sales._id,
      "payment",
      req.user._id,
      date,
      `${paymentInFundCurrency} ${paymentCurrency}`,
      "invoice"
    );

    await customar.save();
    await sales.save();

    await createPaymentHistory(
      "payment",
      date,
      paymentAmount,
      paymentInFundCurrency,
      "customer",
      customar._id,
      sales._id,
      companyId,
      description,
      payment.id,
      "Deposit",
      "",
      destinationCurrencyCode
    );

    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req
    );
    return payment;
  } catch (err) {
    throw err;
  }
};

const handleRefundSalesPayment = async (req, companyId, next) => {
  try {
    const {
      source,
      totalMainCurrency,
      totalInPaymentCurrency,
      paymentInFundCurrency,
      exchangeRate,
      date,
      description,
      destination,
      paymentCurrency,
      destinationCurrencyCode,
      destinationType,
    } = req.body;
    const sales = await returnOrderModel.findOne({
      _id: source.id,
      companyId,
    });

    if (!sales) throw new Error("Sales invoice not found");

    const customar = await customarModel.findOne({
      _id: sales.customer.id,
      companyId,
    });
    console.log(sales.customer.id);

    if (!customar) throw new Error("customar not found");

    req.body.type = "Refund sales";
    req.body.paymentText = "Withdrawal";
    const payment = await paymentModel.create(req.body);

    let paymentAmount = totalMainCurrency;
    let invoicePaymentCurrency = totalInPaymentCurrency;

    if (paymentAmount > sales.totalRemainderMainCurrency) {
      paymentAmount = sales.totalRemainderMainCurrency;
      invoicePaymentCurrency = sales.totalRemainder;
    }

    sales.totalRemainderMainCurrency -= paymentAmount;
    sales.totalRemainder -= invoicePaymentCurrency;

    if (sales.totalRemainderMainCurrency <= 0.9) {
      sales.paid = "paid";
      sales.totalRemainderMainCurrency = 0;
      sales.totalRemainder = 0;
    }

    // customar.TotalUnpaid -= paymentAmount;

    sales.payments.push({
      payment: paymentInFundCurrency || paymentAmount,
      paymentMainCurrency: paymentAmount,
      financialFunds: destination.name,
      paymentID: payment._id,
      financialFundsCurrencyCode: destinationCurrencyCode,
      exchangeRate,
      date,
      paymentInInvoiceCurrency: invoicePaymentCurrency,
      financialFundsId: destination.id,
    });

    await createInvoiceHistory(
      companyId,
      sales._id,
      "payment",
      req.user._id,
      date,
      `${paymentInFundCurrency} ${paymentCurrency}`,
      "invoice"
    );

    await customar.save();
    await sales.save();

    await createPaymentHistory(
      "payment",
      date,
      paymentAmount,
      paymentInFundCurrency,
      "customer",
      customar._id,
      sales._id,
      companyId,
      description,
      payment.id,
      "Deposit",
      "",
      destinationCurrencyCode
    );
    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req
    );
    return payment;
  } catch (err) {
    throw err;
  }
};

const handleExpensePayment = async (req, companyId, next) => {
  try {
    const {
      source,
      totalMainCurrency,
      totalInPaymentCurrency,
      paymentInFundCurrency,
      exchangeRate,
      date,
      description,
      destination,
      destinationCurrencyCode,
      destinationType,
    } = req.body;
    const expense = await expensesModel.findOne({
      _id: source.id,
      type: { $ne: "cancel" },
      companyId,
    });

    if (!expense) throw new Error("expense invoice not found");

    const supplier = await suppliersModel.findOne({
      _id: expense.supllier.id,
      companyId,
    });
    if (!supplier) throw new Error("supplier not found");

    req.body.type = "expense";
    req.body.paymentText = "Withdrawal";
    const payment = await paymentModel.create(req.body);

    let paymentAmount = totalMainCurrency;
    let invoicePaymentCurrency = totalInPaymentCurrency;

    if (paymentAmount > expense.totalRemainderMainCurrency) {
      paymentAmount = expense.totalRemainderMainCurrency;
      invoicePaymentCurrency = expense.totalRemainder;
    }

    expense.totalRemainderMainCurrency -= paymentAmount;
    expense.totalRemainder -= invoicePaymentCurrency;

    if (expense.totalRemainderMainCurrency <= 0.9) {
      expense.paymentStatus = "paid";
      expense.totalRemainderMainCurrency = 0;
      expense.totalRemainder = 0;
    }

    supplier.TotalUnpaid -= paymentAmount;

    expense.payments.push({
      payment: paymentInFundCurrency || paymentAmount,
      paymentMainCurrency: paymentAmount,
      financialFunds: destination.name,
      paymentID: payment._id,
      financialFundsCurrencyCode: destinationCurrencyCode,
      exchangeRate,
      date,
      paymentInInvoiceCurrency: invoicePaymentCurrency,
      financialFundsId: destination.id,
    });

    await createInvoiceHistory(
      companyId,
      expense._id,
      "payment",
      req.user._id,
      date,
      `${paymentInFundCurrency} ${destinationCurrencyCode}`,
      "invoice"
    );

    await supplier.save();
    await expense.save();

    await createPaymentHistory(
      "payment",
      date,
      paymentAmount,
      paymentInFundCurrency,
      "supplier",
      supplier._id,
      expense._id,
      companyId,
      description,
      payment.id,
      "Deposit",
      "",
      destinationCurrencyCode
    );
    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req
    );
    return payment;
  } catch (err) {
    throw err;
  }
};

const handleSalaryPayment = async (req, companyId, next) => {
  try {
    const {
      source,
      totalMainCurrency,
      totalInPaymentCurrency,
      paymentInFundCurrency,
      exchangeRate,
      date,
      description,
      destination,
      paymentCurrency,
      destinationCurrencyCode,
      destinationType,
    } = req.body;
    const staff = await staffModel
      .findOne({
        _id: source.id,
        companyId,
      })
      .populate({ path: "currency", select: "currencyCode exchangeRate" });

    if (!staff) throw new Error("staff  not found");
    req.body.paymentText = "Withdrawal";
    req.body.type = "salary";
    payment = await paymentModel.create(req.body);

    await salaryHistoryModel.create({
      employeeId: staff._id,
      paidAmountMainCurreny: totalMainCurrency,
      paidAmount: totalInPaymentCurrency,
      paidAmountFundCurrency: paymentInFundCurrency,
      paymentDate: date,
      transactionId: payment._id,
      salaryCurrency: staff.currency.currencyCode,
      desc: req.body.description,
      financialFundsId: destination.id,
      financialFunds: destination.name,
      financialFundsCurrencyCode: destinationCurrencyCode,
      companyId,
    });

    await createPaymentHistory(
      "payment",
      date,
      paymentInFundCurrency,
      0,
      "Salary",
      staff._id,
      0,
      companyId,
      description,
      payment.id,
      req.body.paymentText,
      "",
      destinationCurrencyCode
    );
    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req
    );
    return payment;
  } catch (err) {
    throw err;
  }
};

const handleAccountPayment = async (req, companyId, next) => {
  try {
    const {
      source,
      totalMainCurrency,
      totalInPaymentCurrency,
      paymentInFundCurrency,
      exchangeRate,
      date,
      description,
      destination,
      paymentCurrency,
      destinationCurrencyCode,
      destinationType,
    } = req.body;

    payment = await paymentModel.create(req.body);
    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req
    );
    return payment;
  } catch (err) {
    throw err;
  }
};

const handleFundPayment = async (req, companyId, next) => {
  try {
    const {
      source,
      totalMainCurrency,
      totalInPaymentCurrency,
      paymentInFundCurrency,
      exchangeRate,
      date,
      description,
      destination,
      paymentCurrency,
      destinationCurrencyCode,
      destinationType,
    } = req.body;
    const financialFunds = await financialFundsModel.findOneAndUpdate(
      {
        _id: source.id,
        companyId,
      },
      { $inc: { fundBalance: -totalInPaymentCurrency } },
      { new: true }
    );
    payment = await paymentModel.create(req.body);

    await ReportsFinancialFundsModel.create({
      date: date,
      amount: paymentInFundCurrency,
      ref: payment._id,
      type: "Withdrawal",
      financialFundId: source.id,
      financialFundRest: financialFunds.fundBalance,
      exchangeRate: exchangeRate,
      paymentType: "Withdrawal",
      payment: payment._id,
      description: description,
      companyId,
    });
    await financailSource(
      destinationType,
      destination,
      companyId,
      req.body,
      next,
      paymentInFundCurrency,
      payment._id,
      req
    );
    return payment;
  } catch (err) {
    throw err;
  }
};
exports.getPayment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const filters = req.query?.filters ? JSON.parse(req.query.filters) : {};
  const pageSize = parseInt(req.query.limit) || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let query = { companyId };

  // Date filter
  if (filters?.startDate || filters?.endDate) {
    query.date = {};
    if (filters.startDate) query.date.$gte = filters.startDate;
    if (filters.endDate) query.date.$lte = filters.endDate;
  }

  // Filter by payment type
  if (req.query.type) {
    query.paymentText = req.query.type;
  }

  // Payment Status
  if (filters.paymentStatus) query.status = filters.paymentStatus;

  // Employee filter
  if (filters.employee) query.employee = filters.employee;

  // Tags filter
  if (filters?.tags?.length) {
    const tagIds = filters.tags.map((tag) => tag.id);
    query["tags.id"] = { $in: tagIds };
  }

  // Business Partners filter
  if (filters?.businessPartners) {
    query["customer.name"] = {
      $regex: filters.businessPartners,
      $options: "i",
    };
  }

  // Keyword search
  if (req.query.keyword) {
    const keyword = req.query.keyword;
    query.$or = [
      { counter: { $regex: keyword, $options: "i" } },
      { invoiceName: { $regex: keyword, $options: "i" } },
      { customerName: { $regex: keyword, $options: "i" } },
      { supplierName: { $regex: keyword, $options: "i" } },
    ];
  }

  // Query the database
  const paymentsQuery = paymentModel.find(query).sort({ date: -1 }).lean();
  if (pageSize > 0) paymentsQuery.skip(skip).limit(pageSize);

  const [payments, totalItems] = await Promise.all([
    paymentsQuery,
    paymentModel.countDocuments(query),
  ]);

  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1;

  if (!payments) {
    return next(new ApiError("Not found any Payment here", 404));
  }

  res.status(200).json({
    status: "success",
    totalPages,
    results: payments.length,
    data: payments,
  });
});

exports.getOnePayment = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  // Build query based on ID type
  const buildQuery = (id) => {
    const query = { companyId };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id;
    } else if (!isNaN(id)) {
      query.counter = Number(id);
    } else {
      query.stringId = id;
    }
    return query;
  };

  const query = buildQuery(id);

  // Search in primary model
  let payment = await paymentModel.findOne(query).lean();

  // Fallback to new model if not found
  if (!payment) {
    payment = await paymentModelNew.findOne(query).lean();
  }

  if (!payment) {
    return res.status(404).json({
      status: "fail",
      message: "Payment not found",
    });
  }

  res.status(200).json({
    status: "success",
    data: payment,
  });
});

exports.deletePayment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });

  const { id } = req.params;
  const isObjectIdValid = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectIdValid ? { _id: id } : { counter: id };

  const payment = await paymentModel.findOneAndDelete({ companyId, ...query });
  if (!payment) return next(new Error(`No Payment found with id ${id}`));

  const updateSupplier = async (amount) => {
    if (!payment) return;
    await suppliersModel.findByIdAndUpdate(payment.source.id, {
      $inc: { TotalUnpaid: amount },
    });
  };

  const updateCustomer = async (amount) => {
    if (!payment) return;
    await customarModel.findByIdAndUpdate(payment.source.id, {
      $inc: { TotalUnpaid: amount },
    });
  };

  const updateAccount = async (amount) => {
    if (!payment) return;

    const isDeposit = payment.paymentType === "Deposit";

    await accountingTreeModel.findByIdAndUpdate(payment.accountId, {
      $inc: {
        debtor: isDeposit ? amount : -amount,
        creditor: isDeposit ? -amount : amount,
      },
    });
  };

  const updateFund = async (amount) => {
    if (!payment) return;
    await financialFundsModel.findByIdAndUpdate(payment.source.id, {
      $inc: { fundBalance: amount },
    });
    await ReportsFinancialFundsModel.deleteMany({
      payment: payment._id,
      companyId,
    });
  };

  if (payment.payid && payment.payid.length > 0) {
    for (const item of payment.payid) {
      if (!mongoose.Types.ObjectId.isValid(item.id)) continue;

      switch (item.sourceType) {
        case "purchase":
          const purchase = await purchaseinvoicesModel.findById(item.id);
          if (purchase) {
            purchase.paid = "unpaid";
            purchase.totalRemainderMainCurrency +=
              item.paymentMainCurrency || 0;
            purchase.totalRemainder += item.paymentInInvoiceCurrency || 0;
            purchase.payments = purchase.payments.filter(
              (p) => p.paymentID.toString() !== payment._id.toString()
            );
            await purchase.save();
          }
          break;

        case "expense":
          const expense = await expensesModel.findById(item.id);
          if (expense) {
            expense.paymentStatus = "unpaid";
            expense.totalRemainderMainCurrency += item.paymentMainCurrency || 0;
            expense.totalRemainder += item.paymentInInvoiceCurrency || 0;
            expense.payments = expense.payments.filter(
              (p) => p.paymentID.toString() !== payment._id.toString()
            );
            await expense.save();
          }
          break;

        case "refundPurchase":
          const refundPurchase = await RefundPurchaseInvoicesModel.findById(
            item.id
          );
          if (refundPurchase) {
            refundPurchase.paid = "unpaid";
            refundPurchase.totalRemainderMainCurrency +=
              item.paymentMainCurrency || 0;
            refundPurchase.totalRemainder += item.paymentInInvoiceCurrency || 0;
            refundPurchase.payments = refundPurchase.payments.filter(
              (p) => p.paymentID.toString() !== payment._id.toString()
            );
            await refundPurchase.save();
          }
          break;

        case "sales":
          const sale = await salesrModel.findById(item.id);
          if (sale) {
            sale.paymentsStatus = "unpaid";
            sale.totalRemainderMainCurrency += item.paymentMainCurrency || 0;
            sale.totalRemainder += item.paymentInInvoiceCurrency || 0;
            sale.payments = sale.payments.filter(
              (p) => p.paymentID.toString() !== payment._id.toString()
            );
            await sale.save();
          }
          break;
        case "refundSales":
          const refundSale = await returnOrderModel.findById(item.id);
          if (refundSale) {
            refundSale.paid = "unpaid";
            refundSale.totalRemainderMainCurrency +=
              item.paymentMainCurrency || 0;
            refundSale.totalRemainder += item.paymentInInvoiceCurrency || 0;
            refundSale.payments = refundSale.payments.filter(
              (p) => p.paymentID.toString() !== payment._id.toString()
            );
            await refundSale.save();
          }
          break;
      }
    }
  } else {
    const type = payment.sourceType;
    const paymentAmount =
      payment.paymentType === "Deposit"
        ? payment.paymentInDestinationCurrency
        : -payment.paymentInDestinationCurrency;
    switch (type) {
      case "supplier":
        await updateSupplier(-paymentAmount);
        break;

      case "customer":
        await updateCustomer(paymentAmount);
        break;

      case "account":
        await updateAccount(paymentAmount);
        break;
    }
  }

  switch (payment.destinationType) {
    case "supplier":
      await updateSupplier(
        payment.paymentType === "Deposit"
          ? -payment.paymentInDestinationCurrency
          : payment.paymentInDestinationCurrency
      );
      break;
    case "customer":
      await updateCustomer(
        payment.paymentType === "Deposit"
          ? payment.paymentInDestinationCurrency
          : -payment.paymentInDestinationCurrency
      );
      break;
    case "account":
      await updateAccount(
        payment.paymentType === "Deposit"
          ? payment.paymentInDestinationCurrency
          : -payment.paymentInDestinationCurrency
      );
      break;
    case "fund":
      await updateFund(
        payment.paymentType === "Deposit"
          ? payment.paymentInDestinationCurrency
          : -payment.paymentInDestinationCurrency
      );
      break;
  }

  await paymentHistoryModel.deleteMany({ idPaymet: payment._id, companyId });

  res
    .status(200)
    .json({ message: "Payment deleted successfully", data: payment });
});

exports.deletePaymentTransferFund = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;

  const payment = await paymentModel.findOne({ _id: id, companyId });
  if (!payment) {
    return next(new ApiError(`no Payment: ${id}`, 404));
  }

  const fundReports = await ReportsFinancialFundsModel.find({
    ref: id,
    companyId,
  });

  if (!fundReports || fundReports.length < 2) {
    return next(new ApiError(`no Fund Reports`, 400));
  }

  const updates = fundReports.map((report) => {
    return financialFundsModel.findOneAndUpdate(
      { _id: report.financialFundId, companyId },
      {
        $inc: {
          fundBalance:
            report.type === "Withdrawal transfer"
              ? report.amount
              : -report.amount,
        },
      },
      { new: true }
    );
  });

  await Promise.all(updates);
  await ReportsFinancialFundsModel.deleteMany({ ref: id, companyId });

  await paymentModel.findOneAndDelete({ _id: id, companyId });

  res.status(200).json({ status: "success", data: payment });
});
