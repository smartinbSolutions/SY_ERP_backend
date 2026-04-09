const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const multer = require("multer");
const ApiError = require("../utils/apiError");
const { v4: uuidv4 } = require("uuid");
const expensesModel = require("../models/expensesModel");
const FinancialFundsModel = require("../models/financialFundsModel");
const ReportsFinancialFundsModel = require("../models/reportsFinancialFunds");
const { createInvoiceHistory } = require("./invoiceHistoryService");
const SupplierModel = require("../models/suppliersModel");
const { createPaymentHistory } = require("./paymentHistoryService");
const paymentModel = require("../models/paymentModel");
const PaymentHistoryModel = require("../models/paymentHistoryModel");
const PurchaseInvoicesModel = require("../models/purchaseinvoicesModel");
const invoiceHistoryModel = require("../models/invoiceHistoryModel");
const counterModel = require("../models/Settings/counterModel");
const journalEntryModel = require("../models/journalEntryModel");
const { createJournalService } = require("./journalEntryServices");

const multerStorage = multer.diskStorage({
  destination: function (req, file, callback) {
    // Specify the destination folder for storing the files
    callback(null, "./uploads/expenses");
  },
  filename: function (req, file, callback) {
    // Specify the filename for the uploaded file
    const originalname = file.originalname;
    const lastDotIndex = originalname.lastIndexOf(".");
    const fileExtension =
      lastDotIndex !== -1 ? originalname.slice(lastDotIndex + 1) : "";
    const filename = `ex-${uuidv4()}-${Date.now()}-${
      Math.floor(Math.random() * (10000000000 - 1 + 1)) + 1
    }.${fileExtension}`;

    callback(null, filename);
  },
});

const upload = multer({
  storage: multerStorage,
  fileFilter: (req, file, callback) => {
    const allowedMimes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedMimes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new ApiError("Invalid file type. Only images and PDFs are allowed."),
      );
    }
  },
});

exports.uploadFile = upload.single("expenseFile");

// @desc Create invoice expenses
// @route POST /api/expenses
exports.createInvoiceExpenses = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  const ts = Date.now();
  const date_ob = new Date(ts);
  const futureDateOb = new Date(ts);
  const formattedDate = `${date_ob.getFullYear()}-${padZero(
    date_ob.getMonth(),
  )}-${padZero(date_ob.getDate())} ${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes(),
  )}:${padZero(date_ob.getSeconds())}:${padZero(date_ob.getMilliseconds())}`;
  futureDateOb.setSeconds(futureDateOb.getSeconds() + 1);

  const formattedPayment = `${padZero(futureDateOb.getHours())}:${padZero(
    futureDateOb.getMinutes(),
  )}:${padZero(futureDateOb.getSeconds())}.${padZero(
    futureDateOb.getMilliseconds(),
    3,
  )}`;

  const formattedDateAdd3 = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes(),
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;
  let expense;
  const isoDate = `${req.body.date}T${formattedDateAdd3}Z`;
  req.body.date = isoDate;
  const isoPaymentDate = `${req.body.paymentDate}T${formattedPayment}Z`;
  req.body.paymentDate = isoPaymentDate;
  const nextCounter = (await expensesModel.countDocuments({ companyId })) + 1;
  req.body.invoiceNumber = nextCounter;
  req.body.expenseFile = req.file?.filename;
  req.body.supllier = JSON.parse(req.body.supllier);
  req.body.currency = JSON.parse(req.body.currency);
  req.body.tag = JSON.parse(req.body.tag);
  req.body.employeeID = req.user._id;
  req.body.employeeName = req.user.name;
  req.body.counters = req.body.counter;
  req.body.counter = Number(req.body.counter) + nextCounter;
  // Create the expense document
  if (typeof req.body.categorts === "string") {
    req.body.categorts = JSON.parse(req.body.categorts);
  }
  const supplier = await SupplierModel.findOne({
    _id: req.body.supllier.id,
    companyId,
  });

  // Set the full URL for the expense file

  if (req.body.paymentStatus === "paid") {
    if (req.body.totalRemainderMainCurrency > 0.5) {
      req.body.paymentStatus = "unpaid";
    }

    const financialFunds = await FinancialFundsModel.findOne({
      _id: req.body.financialFund,
      companyId,
    }).populate("fundCurrency");

    const nextCounterPayment =
      (await paymentModel.countDocuments({
        companyId,
        paymentText: "Withdrawal",
      })) + 1;
    if (req.body.totalRemainderMainCurrency > 0.5) {
      req.body.paymentStatus = "unpaid";
    }

    expense = await expensesModel.create(req.body);

    const paymentInFundCurrency = req.body.paymentInFundCurrency;
    financialFunds.fundBalance -= Number(paymentInFundCurrency);

    const payment = await paymentModel.create({
      source: {
        id: financialFunds._id,
        name: financialFunds.fundName,
      },
      destination: {
        id: supplier._id,
        name: supplier.name,
      },
      sourceType: "expense",
      destinationType: "fund",
      totalInPaymentCurrency: req.body.paymentInInvoiceCurrency,
      totalMainCurrency: req.body.paymentInMainCurrency,
      paymentInDestinationCurrency: req.body.paymentInFundCurrency,
      paymentCurrency: {
        id: req.body.currency.id,
        name: req.body.currency.name,
        code: req.body.currency.currencyCode,
        exchangeRate: req.body.currency.exchangeRate,
      },
      destinationExchangeRate: financialFunds.fundCurrency.exchangeRate,
      destinationCurrencyCode: financialFunds.fundCurrency.currencyCode,
      type: "expense",
      paymentType: "Withdrawal",
      description: req.body.paymentDisc,
      date: req.body.paymentDate || formattedDate,
      counter: Number(req.body.counters) + nextCounterPayment.seq,
      companyId,
      payid: [
        {
          id: expense._id,
          status: req.body.paymentStatus,
          invoiceTotal: req.body.expenceTotal,
          invoiceName: req.body.expenseName,
          invoiceCurrencyCode: req.body.currency.currencyCode,
          paymentInFundCurrency: req.body.paymentInFundCurrency,
          paymentMainCurrency: req.body.paymentInMainCurrency,
          paymentInvoiceCurrency: req.body.paymentInInvoiceCurrency,
        },
      ],
    });

    if (financialFunds) {
      await ReportsFinancialFundsModel.create({
        date: req.body.paymentDate || formattedDate,
        amount: paymentInFundCurrency,
        ref: expense._id,
        type: "expense",
        financialFundId: financialFunds._id,
        financialFundRest: financialFunds.fundBalance,
        exchangeRate: req.body.currencyExchangeRate,
        paymentType: "Withdrawal",
        payment: payment._id,
        description: req.body.paymentDisc,
        companyId,
      });
      await financialFunds.save();
    }

    await expensesModel.findOneAndUpdate(
      { _id: expense._id, companyId },
      {
        payments: [
          {
            payment: req.body.paymentInFundCurrency,
            paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
            paymentMainCurrency: req.body.paymentInMainCurrency,
            financialFunds: financialFunds.fundName,
            financialFundsCurrencyCode:
              financialFunds.fundCurrency.currencyCode,
            date: req.body.paymentDate || formattedDate,
            paymentID: payment._id,
          },
        ],
      },
    );
    await createPaymentHistory(
      "payment",
      req.body.paymentDate,
      req.body.paymentInMainCurrency,
      req.body.paymentInFundCurrency,
      "supplier",
      req.body.supllier.id,
      expense._id,
      companyId,
      req.body.description,
      payment._id,
      "Deposit",
      "expense",
      financialFunds.fundCurrency.currencyCode,
    );
  } else {
    expense = await expensesModel.create(req.body);
  }
  supplier.TotalUnpaid =
    Number(supplier.TotalUnpaid) +
      Number(req.body.totalRemainderMainCurrency) || 0;

  supplier.total += Number(req.body.expenceTotalMainCurrency);
  // Call history functions
  await createPaymentHistory(
    "invoice",
    req.body.date || formattedDate,
    req.body.expenceTotalMainCurrency,
    req.body.expenceTotal,
    "supplier",
    req.body.supllier.id,
    expense._id,
    companyId,
    req.body.description,
    "",
    "",
    "expence",
    req.body.currency.currencyCode,
  );
  supplier.save();
  await createInvoiceHistory(
    companyId,
    expense._id,
    "create",
    req.user._id,
    req.body.date,
  );

  // Send response
  res.status(200).json({ status: "success", data: expense });
});

exports.getInvoiceExpenses = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const filters = req.query?.filters ? JSON.parse(req.query?.filters) : {};

  const pageSize = parseInt(req.query.limit) || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  let query = {
    companyId,
    //  archives: req.query.archives
  };

  if (req.query.keyword) {
    query.$or = [
      { counter: { $regex: req.query.keyword, $options: "i" } },
      { expenseName: { $regex: req.query.keyword, $options: "i" } },
      { "supllier.name": { $regex: req.query.keyword, $options: "i" } },
      { receiptNumber: { $regex: req.query.keyword, $options: "i" } },
    ];
  }
  if (filters?.startDate || filters?.endDate) {
    query.date = {};
    if (filters?.startDate) {
      query.date.$gte = filters.startDate;
    }
    if (filters?.endDate) {
      query.date.$lte = filters.endDate;
    }
  }
  if (filters?.tags?.length) {
    const tagIds = filters.tags.map((tag) => tag.id);
    query["tag.id"] = { $in: tagIds };
  }

  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }
  if (filters.employee) {
    query.employeeID = filters.employee;
  }
  if (filters?.businessPartners) {
    query["supllier.name"] = {
      $regex: filters.businessPartners,
      $options: "i",
    };
  }
  const tagIds = Object.keys(req.query)
    .filter((key) => !isNaN(key))
    .map((key) => req.query[key]);

  if (tagIds.length > 0) {
    query["tag.id"] = { $in: tagIds };
  }

  const totalItems = await expensesModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);

  const expenses = await expensesModel
    .find(query)
    .sort({ date: -1 })
    .skip(skip)
    .limit(pageSize)
    .lean(); // Use lean() for better performance if Mongoose doc features are not needed

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: expenses.length,
    data: expenses,
  });
});

exports.getInvoiceExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const expense = await expensesModel.findOne({
    _id: id,
    companyId,
  });
  if (!expense) {
    return next(
      new ApiError(`There is no expense with this id or counter: ${id}`, 404),
    );
  }

  const pageSize = req.query.limit || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  const totalItems = await invoiceHistoryModel.countDocuments({
    invoiceId: expense._id, // Always use the actual MongoID
  });

  const totalPages = Math.ceil(totalItems / pageSize);
  const casehistory = await invoiceHistoryModel
    .find({ invoiceId: expense._id, companyId })
    .populate({ path: "employeeId", select: "name email" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    data: expense,
    history: casehistory,
  });
});

//@desc Update specific invoice expense
// @route Put /api/expenses/:id
// @access Private
exports.updateInvoiceExpense = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  const { id } = req.params;
  const expence = await expensesModel.findOne({ _id: id, companyId });
  const expenceSupplier = await SupplierModel.findOne({
    _id: expence.supllier.id,
    companyId,
  });

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }
  req.body.expenseFile = req?.file?.filename;

  req.body.tag = JSON.parse(req.body.tag || []);

  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes(),
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds())}`;
  req.body.supllier = JSON.parse(req.body.supllier);
  req.body.currency = JSON.parse(req.body.currency);
  req.body.date = `${req.body.date}T${formattedDate}Z`;
  let expense;
  const futureDateOb = new Date(ts);
  futureDateOb.setSeconds(futureDateOb.getSeconds() + 1);

  const futureFormattedDate = `${padZero(futureDateOb.getHours())}:${padZero(
    futureDateOb.getMinutes(),
  )}:${padZero(futureDateOb.getSeconds())}.${padZero(
    futureDateOb.getMilliseconds(),
  )}`;
  req.body.paymentDate = `${req.body.paymentDate}T${futureFormattedDate}Z`;

  const supplier = await SupplierModel.find({
    _id: req.body.supllier.id,
    companyId,
  });
  const expenceTotalMainCurrency = req.body.expenceTotalMainCurrency;

  await PaymentHistoryModel.deleteMany({
    ref: id,
    companyId,
  });
  await createPaymentHistory(
    "invoice",
    req.body.date || formattedDate,
    expenceTotalMainCurrency,
    req.body.expenceTotal,
    "supplier",
    req.body.supllier.id,
    id,
    companyId,
    req.body.description,
    "",
    "",
    "expence",
    req.body.currency.currencyCode,
  );

  if (req.body.paymentStatus === "paid") {
    const totalRemainder = parseFloat(req.body.totalRemainderMainCurrency);

    if (totalRemainder > 0.3) {
      req.body.paymentStatus = "unpaid";
    }
    expense = await expensesModel.findOneAndUpdate(
      { _id: id, companyId },
      req.body,
      {
        new: true,
      },
    );
    const financialFunds = await FinancialFundsModel.findById({
      _id: req.body.financialFund,
      companyId,
    }).populate("fundCurrency");
    const nextCounterPayment =
      (await paymentModel.countDocuments({
        companyId,
        paymentText: "Withdrawal",
      })) + 1;

    const paymentInFundCurrency = req.body.paymentInFundCurrency;
    financialFunds.fundBalance -= Number(paymentInFundCurrency);

    if (!expense) {
      return next(new ApiError(`No expense for this id ${req.params.id}`, 404));
    }

    const payment = await paymentModel.create({
      supplierId: req.body.supllier.id,
      supplierName: req.body.supllier.name,
      total: req.body.paymentInInvoiceCurrency,
      totalMainCurrency: req.body.paymentInMainCurrency,
      exchangeRate: financialFunds.fundCurrency.exchangeRate,
      financialFundsCurrencyCode: financialFunds.fundCurrency.currencyCode,
      financialFundsName: financialFunds.fundName,
      financialFundsID: req.body.financialFund,
      date: req.body.paymentDate || formattedDate,
      invoiceNumber: expence.counter,
      invoiceID: expense._id,
      counter: Number(req.body.counter) + nextCounterPayment,
      type: "expense",
      description: req.body.expenseClarification,
      invoiceCurrencyCode: req.body.currency.currencyCode,
      paymentInFundCurrency: req.body.paymentInFundCurrency,
      paymentText: "Withdrawal",
      companyId,
      payid: {
        id: expense._id,
        status: req.body.paymentStatus,
        invoiceTotal: req.body.expenceTotal,
        invoiceName: req.body.expenseName,
        invoiceCurrencyCode: req.body.currency.currencyCode,
        status: req.body.paymentStatus,
        paymentInFundCurrency: req.body.paymentInFundCurrency,
        paymentMainCurrency: req.body.paymentInMainCurrency,
        paymentInvoiceCurrency: req.body.paymentInInvoiceCurrency,
      },
    });
    if (financialFunds) {
      await ReportsFinancialFundsModel.create({
        date: req.body.paymentDate || formattedDate,
        amount: paymentInFundCurrency,
        ref: expense._id,
        type: "expense",
        financialFundId: financialFunds._id,
        financialFundRest: financialFunds.fundBalance,
        exchangeRate: req.body.currencyExchangeRate,
        paymentType: "Withdrawal",
        payment: payment._id,
        companyId,
      });
      await financialFunds.save();
    }

    await expensesModel.findByIdAndUpdate(
      expense._id,
      {
        $push: {
          payments: {
            payment: req.body.paymentInFundCurrency,
            paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
            paymentMainCurrency: req.body.paymentInMainCurrency,
            financialFunds: financialFunds.fundName,
            financialFundsCurrencyCode:
              financialFunds.fundCurrency.currencyCode,
            date: req.body.paymentDate || formattedDate,
            paymentID: payment._id,
          },
        },
      },
      { new: true },
    );

    await createPaymentHistory(
      "payment",
      req.body.paymentDate,
      req.body.paymentInMainCurrency,
      req.body.paymentInFundCurrency,
      "supplier",
      req.body.supllier.id,
      id,
      companyId,
      req.body.description,
      payment._id,
      "Deposit",
      "expence",
      financialFunds.fundCurrency.currencyCode,
    );

    if (req.body.supllier.id === expence.supllier.id) {
      supplier.total +=
        expenceTotalMainCurrency - expence.expenceTotalMainCurrency;
    } else {
      expence.supllier.total -= expence.expenceTotalMainCurrency;
      await expence.save();
      supplier.total += expenceTotalMainCurrency;
    }
    supplier.TotalUnpaid =
      Number(supplier.TotalUnpaid) -
      Number(expence.expenceTotalMainCurrency) +
      Number(expenceTotalMainCurrency) -
      Number(req.body.paymentInMainCurrency);
    await supplier.save();
  } else {
    if (
      req.body.totalRemainderMainCurrency === expence.expenceTotalMainCurrency
    ) {
      if (req.body.supllier.id === expence.supllier.id) {
        supplier.TotalUnpaid +=
          expenceTotalMainCurrency - expence.expenceTotalMainCurrency;
        supplier.total +=
          expenceTotalMainCurrency - expence.expenceTotalMainCurrency;
      } else {
        expenceSupplier.total -= expence.expenceTotalMainCurrency;
        expenceSupplier.TotalUnpaid -= expence.expenceTotalMainCurrency;
        await expenceSupplier.save();
        supplier.total += expenceTotalMainCurrency;
        supplier.TotalUnpaid += expenceTotalMainCurrency;
      }
      await supplier.save();
    }
    expense = await expensesModel.findOneAndUpdate(
      { _id: id, companyId },
      req.body,
      {
        new: true,
      },
    );
  }

  const history = createInvoiceHistory(
    companyId,
    id,
    "edit",
    req.user._id,
    new Date().toISOString(),
  );
  res.status(200).json({ status: "true", message: "Expense updated" });
});

exports.patchExpense = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId)
    return res.status(400).json({ message: "companyId is missing" });

  const { id } = req.params;
  if (!id) return res.status(400).json({ message: "id is missing" });

  const expense = await expensesModel.findOne({
    _id: id,
    companyId,
  });
  if (!expense) return res.status(404).json({ message: "expense not found" });

  const { description, tag } = req.body;

  if (req.file) expense.expenseFile = req.file.filename;
  if (description !== undefined) expense.expenseClarification = description;
  if (tag !== undefined) expense.tag = JSON.parse(tag);

  await expense.save();

  await createInvoiceHistory(
    companyId,
    id,
    "edit",
    req.user._id,
    new Date().toISOString(),
  );

  res.status(200).json({
    status: "success",
    message: "Expense patched successfully",
    data: expense,
  });
});

exports.cancelExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const expensesInvoices = await expensesModel.findOne({ _id: id, companyId });
  if (
    expensesInvoices.payments.length <= 0 &&
    expensesInvoices.type !== "expenses cancelled"
  ) {
    try {
      await SupplierModel.findOneAndUpdate(
        {
          _id: expensesInvoices.supllier.id,
          companyId,
        },
        {
          $inc: {
            total: -expensesInvoices.expenceTotalMainCurrency,
            TotalUnpaid: -expensesInvoices.totalRemainderMainCurrency,
          },
        },
      );

      await PaymentHistoryModel.deleteMany({
        ref: id,
      });
      const history = createInvoiceHistory(
        companyId,
        id,
        "cancel",
        req.user._id,
        new Date().toISOString(),
      );
      expensesInvoices.type = "expenses cancelled";
      expensesInvoices.totalRemainderMainCurrency = 0;
      expensesInvoices.totalRemainder = 0;
      expensesInvoices.paymentStatus = "paid";
      await expensesInvoices.save();
      res.status(200).json({ message: "cancel is success" });
    } catch (e) {
      return next(new ApiError(`have a problem ${e}`, 500));
    }
  } else {
    return next(
      new ApiError("Have a Payment pless delete the Payment or Canceled ", 500),
    );
  }
});

exports.getExpenseAndPurchaseForSupplier = asyncHandler(
  async (req, res, next) => {
    const companyId = req.query.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }
    const supplierId = req.params.id;

    const pageSize = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * pageSize;
    const expenseFilter = {
      "supllier.id": supplierId,
      paymentStatus: "unpaid",
      companyId,
    };

    const purchaseFilter = {
      "supllier.id": supplierId,
      paid: "unpaid",
      companyId,
    };

    // Fetch both expenses and purchases
    const [expenses, purchases] = await Promise.all([
      expensesModel.find(expenseFilter),
      PurchaseInvoicesModel.find(purchaseFilter),
    ]);

    // Add a type flag to distinguish in frontend
    const formattedExpenses = expenses.map((item) => ({
      ...item.toObject(),
      sourceType: "expense",
    }));

    const formattedPurchases = purchases.map((item) => ({
      ...item.toObject(),
      sourceType: "purchase",
    }));

    // Merge both arrays and sort by date if needed
    const combinedData = [...formattedExpenses, ...formattedPurchases].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );

    // Paginate the combined result
    const paginatedData = combinedData.slice(skip, skip + pageSize);
    const totalItems = combinedData.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    res.status(200).json({
      results: paginatedData.length,
      totalItems,
      totalPages,
      data: paginatedData,
    });
  },
);

exports.archiveExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const expense = await expensesModel.findOneAndUpdate(
    { _id: id, companyId },
    { archives: req.body.archives },
    { new: true },
  );

  if (!expense) {
    return next(new ApiError(`No expense found with id ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: expense,
  });
});

exports.createNoSupplierExpenses = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    /* -------------------- Counters -------------------- */
    const expenseCounter = await counterModel.findOneAndUpdate(
      { companyId, name: "expenses" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const paymentCounter = await counterModel.findOneAndUpdate(
      { companyId, name: "payments" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    function padZero(value) {
      return value < 10 ? `0${value}` : value;
    }

    const ts = Date.now();
    const date_ob = new Date(ts);
    const futureDateOb = new Date(ts);
    const formattedDate = `${date_ob.getFullYear()}-${padZero(
      date_ob.getMonth(),
    )}-${padZero(date_ob.getDate())} ${padZero(date_ob.getHours())}:${padZero(
      date_ob.getMinutes(),
    )}:${padZero(date_ob.getSeconds())}:${padZero(date_ob.getMilliseconds())}`;
    futureDateOb.setSeconds(futureDateOb.getSeconds() + 1);

    const formattedPayment = `${padZero(futureDateOb.getHours())}:${padZero(
      futureDateOb.getMinutes(),
    )}:${padZero(futureDateOb.getSeconds())}.${padZero(
      futureDateOb.getMilliseconds(),
      3,
    )}`;

    const formattedDateAdd3 = `${padZero(date_ob.getHours())}:${padZero(
      date_ob.getMinutes(),
    )}:${padZero(date_ob.getSeconds())}.${padZero(
      date_ob.getMilliseconds(),
      3,
    )}`;
    const isoDate = `${req.body.date}T${formattedDateAdd3}Z`;
    req.body.date = isoDate;
    const isoPaymentDate = `${req.body.paymentDate}T${formattedPayment}Z`;
    req.body.paymentDate = isoPaymentDate;
    /* -------------------- Dates -------------------- */
    const expenseDate = req.body.date;
    const paymentDate = req.body.paymentDate;

    /* -------------------- Prepare Expense Data -------------------- */
    const expenseData = {
      ...req.body,
      companyId,
      invoiceNumber: Number(req.body.counter) + expenseCounter.seq,
      expenseFile: req.file?.filename,
      currency: JSON.parse(req.body.currency),
      tag: JSON.parse(req.body.tag),
      employeeID: req.user?._id,
      employeeName: req.user?.name,
      counters: req.body.counter,
      counter: Number(req.body.counter) + expenseCounter.seq,
      date: expenseDate,
      paymentDate,
      isCash: true,
      categorts: JSON.parse(req.body.categorts),
    };

    /* -------------------- Financial Fund -------------------- */
    const financialFunds = await FinancialFundsModel.findOne({
      _id: req.body.financialFund,
      companyId,
    })
      .populate("fundCurrency")
      .session(session);

    if (!financialFunds) {
      throw new Error("Financial fund not found");
    }

    /* -------------------- Create Expense -------------------- */
    const [expense] = await expensesModel.create([expenseData], { session });

    /* -------------------- Update Fund Balance -------------------- */
    financialFunds.fundBalance -= Number(expenseData.paymentInFundCurrency);
    await financialFunds.save({ session });

    /* -------------------- Create Payment -------------------- */
    const [payment] = await paymentModel.create(
      [
        {
          source: {
            id: financialFunds?._id,
            name: financialFunds?.fundName,
          },
          destination: {
            id: "",
            name: "",
          },

          sourceType: "expense",
          destinationType: "fund",
          totalInPaymentCurrency: req.body.expenceTotal,
          totalMainCurrency: req.body.paymentInMainCurrency,
          paymentInDestinationCurrency: req.body.paymentInFundCurrency,
          paymentCurrency: {
            id: req.body.currency.id,
            name: req.body.currency.name,
            code: req.body.currency.currencyCode,
            exchangeRate: req.body.currency.exchangeRate,
          },
          destinationExchangeRate: financialFunds.fundCurrency.exchangeRate,
          destinationCurrencyCode: financialFunds.fundCurrency.currencyCode,
          type: "expense",
          paymentType: "Withdrawal",
          description: req.body.paymentDisc,
          date: req.body.paymentDate || formattedDate,
          counter: Number(expenseData.counters) + paymentCounter.seq,
          companyId,
          payid: [
            {
              id: expense._id,
              status: expenseData.paymentStatus,
              invoiceTotal: expenseData.expenceTotal,
              invoiceName: expenseData.expenseName,
              invoiceCurrencyCode: expenseData.currency.currencyCode,
              paymentInFundCurrency: expenseData.paymentInFundCurrency,
              paymentMainCurrency: expenseData.paymentInMainCurrency,
              paymentInvoiceCurrency: expenseData.paymentInInvoiceCurrency,
            },
          ],
        },
      ],
      { session },
    );

    /* -------------------- Financial Fund Report -------------------- */
    await ReportsFinancialFundsModel.create(
      [
        {
          date: paymentDate,
          amount: expenseData.paymentInFundCurrency,
          ref: expense._id,
          type: "expense",
          financialFundId: financialFunds._id,
          financialFundRest: financialFunds.fundBalance,
          exchangeRate: expenseData.currencyExchangeRate,
          paymentType: "Withdrawal",
          payment: payment._id,
          description: expenseData.paymentDisc,
          companyId,
        },
      ],
      { session },
    );

    /* -------------------- Update Expense Payments -------------------- */
    await expensesModel.updateOne(
      { _id: expense._id, companyId },
      {
        $push: {
          payments: {
            payment: expenseData.paymentInFundCurrency,
            paymentInInvoiceCurrency: expenseData.paymentInInvoiceCurrency,
            paymentMainCurrency: expenseData.paymentInMainCurrency,
            financialFunds: financialFunds.fundName,
            financialFundsCurrencyCode:
              financialFunds.fundCurrency.currencyCode,
            date: paymentDate,
            paymentID: payment._id,
          },
        },
      },
      { session },
    );

    /* -------------------- Histories -------------------- */
    await createPaymentHistory(
      "payment",
      paymentDate,
      expenseData.paymentInMainCurrency,
      expenseData.paymentInFundCurrency,
      "",
      "",
      expense._id,
      companyId,
      expenseData.description,
      payment._id,
      "Deposit",
      "expense",
      financialFunds.fundCurrency.currencyCode,
      session,
    );

    await createPaymentHistory(
      "invoice",
      expenseDate,
      expenseData.expenceTotalMainCurrency,
      expenseData.expenceTotal,
      "",
      "",
      expense._id,
      companyId,
      expenseData.description,
      "",
      "",
      "expense",
      expenseData.currency.currencyCode,
      session,
    );

    await createInvoiceHistory(
      companyId,
      expense._id,
      "create",
      req.user._id,
      expenseDate,
    );

    /* -------------------- Commit -------------------- */
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ status: "success", data: expense });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
});
const reverseExpenseJournalEffectsService = async ({
  companyId,
  expenceInvoice,
  session,
  counterFormat,
  cancellationDate,
  reversalJournalLinkCounter,
  mode = "cancel",
}) => {
  if (!expenceInvoice?.journalCounter) {
    throw new ApiError(
      "journal link reference is missing on sales invoice",
      400,
    );
  }

  const modeConfig = {
    cancel: {
      journalType: "Expense Reversal",
      journalNamePrefix: "Expense Invoice Cancellation",
      journalDescPrefix:
        "Journal entry created to reverse the accounting effect of the cancelled Expense invoice",
      originalStatus: "reversed",
    },
    reverse_update: {
      journalType: "Expense Reverse Update",
      journalNamePrefix: "Expense Invoice Update Reversal",
      journalDescPrefix:
        "Journal entry created to reverse the previous accounting effect before reposting the updated Expense invoice",
      originalStatus: "reversed",
    },
  };
  const currentMode = modeConfig[mode];
  if (!currentMode) {
    throw new ApiError(`Invalid journal reversal mode: ${mode}`, 400);
  }
  const originalJournal = await journalEntryModel
    .findOne({
      companyId,
      linkCounter: expenceInvoice.journalCounter,
    })
    .session(session);
  if (!originalJournal) {
    throw new ApiError("original journal not found", 404);
  }

  if (originalJournal.status === "reversed") {
    throw new ApiError("original journal is already reversed", 400);
  }

  const originalLines = originalJournal.journalAccounts || [];

  if (!Array.isArray(originalLines) || originalLines.length === 0) {
    throw new ApiError("original journal accounts are missing", 400);
  }

  const reversedLines = originalLines.map((line, index) => ({
    ...line,
    MainDebit: Number(line?.MainCredit || 0),
    MainCredit: Number(line?.MainDebit || 0),
    accountDebit: Number(line?.accountCredit || 0),
    accountCredit: Number(line?.accountDebit || 0),
    counter: index + 1,
  }));

  const totalDebit = reversedLines.reduce(
    (sum, item) => sum + Number(item?.MainDebit || 0),
    0,
  );

  const totalCredit = reversedLines.reduce(
    (sum, item) => sum + Number(item?.MainCredit || 0),
    0,
  );

  if (Number(totalDebit.toFixed(6)) !== Number(totalCredit.toFixed(6))) {
    throw new ApiError(
      `reversal journal is not balanced. debit=${totalDebit}, credit=${totalCredit}`,
      400,
    );
  }
  const date = cancellationDate.split("T")[0];
  const reversalJournalPayload = {
    journalName: `${currentMode.journalNamePrefix} - ${
      originalJournal?.journalName || expenceInvoice?.expenseName || ""
    }`,
    journalDate: date,
    journalDesc: `${currentMode.journalDescPrefix} ${
      expenceInvoice?.expenseName || ""
    }`,
    journalType: currentMode.journalType,
    linkCounter: String(reversalJournalLinkCounter),
    refCounter: String(expenceInvoice?.counter || ""),
    counter: counterFormat,
    refId: expenceInvoice?._id,
    party: originalJournal?.party || "",
    receiptNumber:
      originalJournal?.receiptNumber || expenceInvoice?.invoiceNumber || "",
    filesArray: [],
    journalDebit: totalDebit,
    journalCredit: totalCredit,
  };

  const createdReversalJournal = await createJournalService({
    companyId,
    journalInfo: reversalJournalPayload,
    journalAccounts: reversedLines,
    session,
  });
  originalJournal.status = currentMode.originalStatus;
  originalJournal.reversedAt = cancellationDate;
  originalJournal.reverseJournalId = createdReversalJournal?._id || null;

  await originalJournal.save({ session });

  return {
    originalJournal,
    createdReversalJournal,
    reversalJournalPayload: {
      ...reversalJournalPayload,
      journalAccounts: reversedLines,
    },
  };
};
exports.cancelNoSupplierExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const companyId = req.query.companyId;
  const session = await mongoose.startSession();
  const padZero = (value) => String(value).padStart(2, "0");
  const padMs = (value) => String(value).padStart(3, "0");
  const now = new Date();
  const cancellationDate = `${now.getFullYear()}-${padZero(
    now.getMonth() + 1,
  )}-${padZero(now.getDate())}T${padZero(now.getHours())}:${padZero(
    now.getMinutes(),
  )}:${padZero(now.getSeconds())}.${padMs(now.getMilliseconds())}Z`;

  session.startTransaction();

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const expense = await expensesModel
    .findOne({ _id: id, companyId })
    .session(session);
  if (!expense) {
    return next(new ApiError(`No expense found with id ${id}`, 404));
  }

  try {
    const findExpensePayment = await paymentModel
      .findOne({
        "payid.id": expense._id,
        companyId,
      })
      .session(session);

    const findFinancialFund = await FinancialFundsModel.findOne({
      _id: findExpensePayment.source.id,
      companyId,
    })
      .populate("fundCurrency")
      .session(session);

    if (!findFinancialFund) {
      throw new Error("Financial fund not found");
    }
    findFinancialFund.fundBalance += Number(
      findExpensePayment.paymentInDestinationCurrency,
    );
    await findFinancialFund.save({ session });

    await ReportsFinancialFundsModel.create(
      [
        {
          date: cancellationDate,
          amount: expense.paymentInFundCurrency,
          ref: expense._id,
          type: "cancel expense",
          financialFundId: findFinancialFund._id,
          financialFundRest: findFinancialFund.fundBalance,
          exchangeRate: expense.currencyExchangeRate,
          paymentType: "Deposit",
          payment: findExpensePayment._id,
          description: expense.paymentDisc,
          companyId,
        },
      ],
      { session },
    );

    expense.payments.pop();
    expense.type = "expenses cancelled";
    expense.paymentStatus = "unpaid";
    await expense.save({ session });

    findExpensePayment.description = `Cancelled payment for expense ${expense.expenseName}`;
    findExpensePayment.payid.pop();
    findExpensePayment.type = "cancelled payment";
    await findExpensePayment.save({ session });

    await reverseExpenseJournalEffectsService({
      companyId,
      expenceInvoice: expense,
      session,
      counterFormat: expense.counter,
      cancellationDate,
      reversalJournalLinkCounter: expense.counter,
      mode: "cancel",
    });

    await session.commitTransaction();
    res.status(200).json({ message: "Expense cancelled successfully" });
  } catch (e) {
    await session.abortTransaction();
    return next(new ApiError(`Error cancelling expense: ${e.message}`, 500));
  } finally {
    session.endSession();
  }
});
