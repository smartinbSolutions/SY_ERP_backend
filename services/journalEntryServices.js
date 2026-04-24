const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const journalModel = require("../models/journalEntryModel");
const AccountModel = require("../models/accountingTreeModel");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const reconciliationModel = require("../models/reconciliationModel");
const orderModel = require("../models/orderModel");
const paymentModel = require("../models/paymentModelOld");
const expensesModel = require("../models/expensesModel");
const purchaseinvoicesModel = require("../models/purchaseinvoicesModel");
const returnOrderModel = require("../models/returnOrderModel");
const refundPurchaseInviceModel = require("../models/refundPurchaseInviceModel");
const customarModel = require("../models/customarModel");
const { createPaymentHistory } = require("./paymentHistoryService");
const suppliersModel = require("../models/suppliersModel");
const financialFundsModel = require("../models/Accounting/CurrentAssets/financialFundsModel");
const ReportsFinancialFundsModel = require("../models/Accounting/CurrentAssets/reportsFinancialFunds");
const periodicJournalEntriesModel = require("../models/reports/periodicJournalEntriesModel");

//@desc Get Account Transaction
//@route Get /api/account
exports.getJournals = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = req.query.limit || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  const { startDate, endDate } = req.query;

  let query = { companyId };
  if (startDate && endDate) {
    query.journalDate = {
      $gte: startDate + "T00:00:00.000Z",
      $lte: endDate + "T23:59:59.999Z",
    };
  }

  if (req.query.keyword) {
    query.$or = [
      { journalName: { $regex: req.query.keyword, $options: "i" } },
      { journalRefNum: { $regex: req.query.keyword, $options: "i" } },
      { counter: { $regex: req.query.keyword, $options: "i" } },
      { journalDesc: { $regex: req.query.keyword, $options: "i" } },
    ];
  }
  const totalItems = await journalModel.countDocuments(query);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / pageSize);

  const account = await journalModel
    .find(query)
    .sort({ journalDate: -1 })
    .skip(skip)
    .limit(pageSize);

  res.status(200).json({
    status: "true",
    totalPages: totalPages,
    results: account.length,
    data: account,
  });
});

//@desc Get Account Transaction
//@route Get /api/account:id
exports.getOneJournal = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;

  const account = await journalModel.findOne({ _id: id, companyId });
  if (!account) {
    return next(new ApiError(`not find Transaction in this id: ${id}`, 404));
  }

  res.status(200).json({ data: account });
});

const multerOptions = () => {
  const multerStorage = multer.memoryStorage();

  const multerFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|webp/;
    const extname = allowedTypes.test(
      file.originalname.toLowerCase().split(".").pop()
    );
    const mimeType = allowedTypes.test(file.mimetype);
    if (extname && mimeType) {
      cb(null, true);
    } else {
      cb(new ApiError("Only images and documents are allowed", 400), false);
    }
  };

  return multer({ storage: multerStorage, fileFilter: multerFilter });
};
const uploadMixOfFiles = (arrayOfFields) =>
  multerOptions().fields(arrayOfFields);

exports.uploadFileAndImagejournal = uploadMixOfFiles([
  { name: "filesArray", maxCount: 5 },
]);

exports.processFilesAndImagesjournal = asyncHandler(async (req, res, next) => {
  // ✅ Always initialize
  req.body.filesArray = [];

  // ✅ Only process if files exist
  if (req.files && Array.isArray(req.files.filesArray)) {
    req.files.filesArray.forEach((file) => {
      const fileName = `file-${uuidv4()}-${Date.now()}-${file.originalname}`;
      const filePath = `uploads/journal/${fileName}`;

      require("fs").writeFileSync(filePath, file.buffer);
      req.body.filesArray.push(fileName);
    });
  }

  next();
});

//@desc Create new Account Transaction
//@route post /api/account
exports.createJournal = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  req.body.companyId = companyId;
  const nextJournalNumber =
    (await journalModel.countDocuments({ companyId })) + 1;

  req.body.counter = Number(req.body.counter) + nextJournalNumber;
  req.body.journalRefNum = nextJournalNumber;

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  if (typeof req.body.journalAccounts === "string") {
    req.body.journalAccounts = JSON.parse(req.body.journalAccounts);
  }
  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedDateAdd = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;
  const isoDate = `${req.body.journalDate}T${formattedDateAdd}Z`;

  req.body.journalDate = isoDate;
  req.body.filesArray = req.body.filesArray || [];
  const create = await journalModel.create(req.body);
  const updateOperations = req.body.journalAccounts.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: {
        $inc: {
          debtor: item.MainDebit || 0,
          creditor: item.MainCredit || 0,
        },
      },
    },
  }));
  await AccountModel.bulkWrite(updateOperations);

  for (const item of req.body.journalAccounts) {
    const date = new Date(req.body.journalDate);
    const year = date.getFullYear();
    const monthName = MONTHS[date.getMonth()];

    const monthAmount = (item.MainDebit || 0) - (item.MainCredit || 0);

    const existingPeriodic = await periodicJournalEntriesModel.findOne({
      accountId: item.id,
      year,
      companyId,
    });

    if (existingPeriodic) {
      const existingMonth = existingPeriodic.months.find(
        (x) => x.month === monthName
      );

      if (existingMonth) {
        existingMonth.amount += monthAmount;
      } else {
        existingPeriodic.months.push({ month: monthName, amount: monthAmount });
      }

      existingPeriodic.yearTotal = existingPeriodic.months.reduce(
        (sum, mo) => sum + (mo.amount || 0),
        0
      );

      await existingPeriodic.save();
    } else {
      const newPeriodic = new periodicJournalEntriesModel({
        name: item.name || "",
        year: year,

        months: [
          {
            month: monthName,
            amount: monthAmount || 0,
          },
        ],

        accountId: item.id,
        companyId,
        yearTotal: monthAmount || 0,
        parentId: item.parentId || null,
        parentCode: item.parentCode || null,
        code: item.code || "",
      });

      await newPeriodic.save();
    }
  }

  res.status(200).json({
    status: "success",
    data: create,
  });
});

exports.createJournalService = async ({
  journalInfo,
  journalAccounts,
  companyId,
  session,
}) => {
  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  if (!journalInfo) {
    throw new ApiError("journalInfo is required", 400);
  }

  if (!Array.isArray(journalAccounts) || journalAccounts.length === 0) {
    throw new ApiError("journalAccounts are required", 400);
  }

  const MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  const nextJournalNumber =
    (await journalModel.countDocuments({ companyId }).session(session)) + 1;

  const padZero = (value) => (value < 10 ? `0${value}` : value);

  const ts = Date.now();
  const dateOb = new Date(ts);
  const formattedTime = `${padZero(dateOb.getHours())}:${padZero(
    dateOb.getMinutes()
  )}:${padZero(dateOb.getSeconds())}.${String(
    dateOb.getMilliseconds()
  ).padStart(3, "0")}`;

  const isoJournalDate = `${journalInfo.journalDate}T${formattedTime}Z`;

  const totalJournalDebit = journalAccounts.reduce(
    (sum, account) => sum + Number(account.MainDebit || 0),
    0
  );

  const totalJournalCredit = journalAccounts.reduce(
    (sum, account) => sum + Number(account.MainCredit || 0),
    0
  );

  const payload = {
    ...journalInfo,
    companyId,
    journalDate: isoJournalDate,
    journalAccounts,
    filesArray: journalInfo.filesArray || [],
    counter: Number(journalInfo.counter || 0) + nextJournalNumber,
    journalRefNum: nextJournalNumber,
    journalDebit: totalJournalDebit,
    journalCredit: totalJournalCredit,
  };

  const [createdJournal] = await journalModel.create([payload], { session });

  const updateOperations = journalAccounts.map((item) => ({
    updateOne: {
      filter: { _id: item.id, companyId },
      update: {
        $inc: {
          debtor: Number(item.MainDebit || 0),
          creditor: Number(item.MainCredit || 0),
        },
      },
    },
  }));

  if (updateOperations.length > 0) {
    await AccountModel.bulkWrite(updateOperations, { session });
  }

  for (const item of journalAccounts) {
    const date = new Date(payload.journalDate);
    const year = date.getFullYear();
    const monthName = MONTHS[date.getMonth()];
    const monthAmount =
      Number(item.MainDebit || 0) - Number(item.MainCredit || 0);

    const existingPeriodic = await periodicJournalEntriesModel
      .findOne({
        accountId: item.id,
        year,
        companyId,
      })
      .session(session);

    if (existingPeriodic) {
      const existingMonth = existingPeriodic.months.find(
        (x) => x.month === monthName
      );

      if (existingMonth) {
        existingMonth.amount += monthAmount;
      } else {
        existingPeriodic.months.push({
          month: monthName,
          amount: monthAmount,
        });
      }

      existingPeriodic.yearTotal = existingPeriodic.months.reduce(
        (sum, mo) => sum + Number(mo.amount || 0),
        0
      );

      await existingPeriodic.save({ session });
    } else {
      await periodicJournalEntriesModel.create(
        [
          {
            name: item.name || "",
            year,
            months: [
              {
                month: monthName,
                amount: monthAmount,
              },
            ],
            accountId: item.id,
            companyId,
            yearTotal: monthAmount,
            parentId: item.parentId || null,
            parentCode: item.parentCode || null,
            code: item.code || "",
          },
        ],
        { session }
      );
    }
  }

  return createdJournal;
};

exports.createJournalOpenBalance = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  req.body.companyId = companyId;
  const nextCounterPayment =
    (await journalModel.countDocuments({ companyId })) + 1;
  const accountingTreePayment =
    (await journalModel.countDocuments({ companyId })) + 1;

  req.body.journalAccounts = JSON.parse(req.body.journalAccounts);
  req.body.counter = Number(req.body.counter) + nextCounterPayment;
  req.body.journalRefNum = accountingTreePayment;
  req.body.journalType = "Opening Balance";

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedDateAdd = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;
  const isoDate = `${req.body.journalDate}T${formattedDateAdd}Z`;

  req.body.journalDate = isoDate;

  const create = await journalModel.create(req.body);
  for (const item of req.body.journalAccounts) {
    const total = item.MainDebit - item.MainCredit;

    if (item.party === "Customer") {
      const cutomerData = await customarModel.findOneAndUpdate(
        {
          _id: item.partyId,
          companyId,
        },
        { $inc: { total: total, TotalUnpaid: total } },
        { new: true }
      );
      await createPaymentHistory(
        "Opening balance",
        req.body.journalDate,
        cutomerData.TotalUnpaid,
        cutomerData.TotalUnpaid,
        "customer",
        cutomerData._id,
        "",
        companyId,
        "",
        "",
        req.body.MainCredit > 0 ? "Withdrawal" : "Deposit",
        "Opening balance"
      );
    } else if (item.party === "Supplier") {
      const supplierData = await suppliersModel.findOneAndUpdate(
        { _id: item.partyId, companyId },
        { $inc: { total: total, TotalUnpaid: total } },
        { new: true }
      );
      await createPaymentHistory(
        "Opening balance",
        req.body.journalDate,
        supplierData.TotalUnpaid,
        supplierData.TotalUnpaid,
        "supplier",
        supplierData._id,
        "",
        companyId,
        "",
        "",
        req.body.MainCredit > 0 ? "Withdrawal" : "Deposit",
        "Opening balance"
      );
    } else if (item.party === "Funds") {
      const fundsData = await financialFundsModel.findOneAndUpdate(
        { _id: item.partyId, companyId },
        { $inc: { fundBalance: total } },
        { new: true }
      );
      await ReportsFinancialFundsModel.create({
        date: req.body.journalDate,
        amount: total,
        type: "Opening Balance",
        financialFundId: fundsData._id,
        financialFundRest: total,
        paymentType: req.body.MainCredit > 0 ? "Withdrawal" : "Deposit",
        companyId,
      });
    }
  }

  const updateOperations = req.body.journalAccounts.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: {
        $inc: {
          debtor: item.MainDebit || 0,
          creditor: item.MainCredit || 0,
        },
      },
    },
  }));
  await AccountModel.bulkWrite(updateOperations);

  for (const item of req.body.journalAccounts) {
    const date = new Date(req.body.journalDate);
    const year = date.getFullYear();
    const monthName = MONTHS[date.getMonth()];

    const monthAmount = (item.MainDebit || 0) - (item.MainCredit || 0);

    const existingPeriodic = await periodicJournalEntriesModel.findOne({
      accountId: item.id,
      year,
      companyId,
    });
    console.log(MONTHS[date.getMonth()]);

    if (existingPeriodic) {
      const existingMonth = existingPeriodic.months.find(
        (x) => x.month === monthName
      );

      if (existingMonth) {
        existingMonth.amount += monthAmount;
      } else {
        existingPeriodic.months.push({ month: monthName, amount: monthAmount });
      }

      existingPeriodic.yearTotal = existingPeriodic.months.reduce(
        (sum, mo) => sum + (mo.amount || 0),
        0
      );

      await existingPeriodic.save();
    } else {
      const newPeriodic = new periodicJournalEntriesModel({
        name: item.name || "",
        year: year,

        months: [
          {
            month: monthName,
            amount: monthAmount || 0,
          },
        ],

        accountId: item.id,
        companyId,
        yearTotal: monthAmount || 0,
        parentId: item.parentId || null,
        parentCode: item.parentCode || null,
        code: item.code || "",
      });

      await newPeriodic.save();
    }
  }

  res.status(200).json({
    status: "success",
    data: create,
  });
});

// exports.getOneAccountAndJournal = asyncHandler(async (req, res, next) => {
//   try {
//     const {
//       companyId,
//       limit,
//       page,
//       keyword,
//       filters: filtersRaw,
//       gotoLastMatched,
//     } = req.query;
//     const { id } = req.params;

//     if (!companyId) {
//       return res.status(400).json({ message: "companyId is required" });
//     }

//     const filters = filtersRaw ? JSON.parse(filtersRaw) : {};
//     const pageSize = parseInt(limit, 10) || 10;
//     let currentPage = parseInt(page, 10) || 1;

//     const account = await AccountModel.findOne({ _id: id, companyId })
//       .populate("currency")
//       .lean();

//     if (!account) {
//       return res.status(404).json({ message: "Account not found" });
//     }

//     const query = { companyId, "journalAccounts.id": id };

//     if (filters.partyId) query.party = filters.partyId;
//     if (filters.journalType) query.journalType = filters.journalType;
//     if (filters.auditing) query.auditing = filters.auditing;

//     if (filters.startDate || filters.endDate) {
//       query.journalDate = {};
//       if (filters.startDate) {
//         query.journalDate.$gte = `${filters.startDate}T00:00:00.000Z`;
//       }
//       if (filters.endDate) {
//         query.journalDate.$lte = `${filters.endDate}T23:59:59.999Z`;
//       }
//     }

//     if (keyword) {
//       query.$or = [
//         { journalName: { $regex: keyword, $options: "i" } },
//         { journalRefNum: { $regex: keyword, $options: "i" } },
//         { counter: { $regex: keyword, $options: "i" } },
//         { refCounter: { $regex: keyword, $options: "i" } },
//       ];
//     }

//     const totalItems = await journalModel.countDocuments(query);
//     const totalPages = Math.ceil(totalItems / pageSize);

//     const allJournals = await journalModel.find(query).lean();

//     const reconciliations = await reconciliationModel
//       .find({ companyId })
//       .sort({ createdAt: -1 })
//       .select("journalLineCounter journalEntryId desc matchedBy matchedAt")
//       .lean();

//     const reconciliationMap = {};
//     reconciliations.forEach((rec) => {
//       reconciliationMap[rec.journalLineCounter] = rec;
//     });

//     if (gotoLastMatched === "true" && reconciliations.length > 0) {
//       const lastRec = reconciliations[0];
//       const beforeDash = lastRec.journalLineCounter.split("-")[0];
//       const lastJournal = await journalModel
//         .findOne({ counter: beforeDash, companyId })
//         .lean();

//       const journalsSorted = allJournals.sort(
//         (a, b) => new Date(b.journalDate) - new Date(a.journalDate)
//       );

//       const index = journalsSorted.findIndex(
//         (j) => j._id.toString() === lastJournal._id.toString()
//       );

//       if (index >= 0) {
//         currentPage = Math.floor(index / pageSize) + 1;
//       } else {
//         currentPage = 1; // fallback
//       }
//     }

//     const skip = (currentPage - 1) * pageSize;
//     let runningBalanceMaine = 0,
//       totalDebtor = 0,
//       totalCreditor = 0,
//       runningBalance = 0;

//     const filteredJournals = allJournals
//       .sort((a, b) => new Date(a.journalDate) - new Date(b.journalDate))
//       .map((journal) => {
//         const filteredAccounts = journal.journalAccounts
//           .filter((acc) => {
//             let match = acc.id === id && acc.posted !== false;
//             if (filters.currency) {
//               match =
//                 match && acc.accountCurrency?.toString() === filters.currency;
//             }
//             return match;
//           })
//           .map((accEntry) => {
//             if (filters.currency) query.accountCurrency = filters.currency;

//             runningBalanceMaine +=
//               account.balanceType === "credit"
//                 ? accEntry.MainCredit - accEntry.MainDebit
//                 : accEntry.MainDebit - accEntry.MainCredit;
//             totalDebtor += accEntry.MainDebit;
//             totalCreditor += accEntry.MainCredit;
//             const debitValue = accEntry.isPrimary
//               ? accEntry.MainDebit
//               : accEntry.accountDebit;
//             const creditValue = accEntry.isPrimary
//               ? accEntry.MainCredit
//               : accEntry.accountCredit;

//             runningBalance +=
//               account.balanceType === "credit"
//                 ? creditValue - debitValue
//                 : debitValue - creditValue;

//             const reconciliationInfo =
//               reconciliationMap[`${journal.counter}-${accEntry.counter}`] ||
//               null;

//             return {
//               ...accEntry,
//               runningBalanceMaine,
//               runningBalance,
//               reconciliation: reconciliationInfo,
//             };
//           });

//         return {
//           ...journal,
//           journalAccounts: filteredAccounts,
//           runningBalanceMaine,
//           runningBalance,
//           totalDebtor,
//           totalCreditor,
//         };
//       });

//     const paginatedJournals = filteredJournals
//       .sort((a, b) => new Date(b.journalDate) - new Date(a.journalDate))
//       .slice(skip, skip + pageSize);

//     return res.status(200).json({
//       pages: totalPages,
//       results: totalItems,
//       currentPage,
//       runningBalanceMaine,
//       runningBalance,
//       totalDebtor,
//       totalCreditor,
//       data: account,
//       journals: paginatedJournals,
//     });
//   } catch (error) {
//     next(error);
//   }
// });
exports.getOneAccountAndJournal = asyncHandler(async (req, res, next) => {
  try {
    const {
      companyId,
      limit,
      page,
      keyword,
      filters: filtersRaw,
      gotoLastMatched,
    } = req.query;

    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const filters = filtersRaw ? JSON.parse(filtersRaw) : {};
    const pageSize = parseInt(limit, 10) || 10;
    let currentPage = parseInt(page, 10) || 1;

    const account = await AccountModel.findOne({ _id: id, companyId })
      .populate("currency")
      .lean();

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const query = {
      companyId,
      "journalAccounts.id": id,
    };

    if (filters.partyId) query.party = filters.partyId;
    if (filters.journalType) query.journalType = filters.journalType;
    if (filters.auditing) query.auditing = filters.auditing;

    if (filters.startDate || filters.endDate) {
      query.journalDate = {};

      if (filters.startDate) {
        query.journalDate.$gte = `${filters.startDate}T00:00:00.000Z`;
      }

      if (filters.endDate) {
        query.journalDate.$lte = `${filters.endDate}T23:59:59.999Z`;
      }
    }

    if (keyword) {
      query.$or = [
        { journalName: { $regex: keyword, $options: "i" } },
        { journalRefNum: { $regex: keyword, $options: "i" } },
        { counter: { $regex: keyword, $options: "i" } },
        { refCounter: { $regex: keyword, $options: "i" } },
      ];
    }

    const totalItems = await journalModel.countDocuments(query);
    const totalPages = Math.ceil(totalItems / pageSize);

    const allJournals = await journalModel.find(query).lean();

    const reconciliations = await reconciliationModel
      .find({ companyId })
      .sort({ createdAt: -1 })
      .select("journalLineCounter journalEntryId desc matchedBy matchedAt")
      .lean();

    const reconciliationMap = {};
    reconciliations.forEach((rec) => {
      reconciliationMap[rec.journalLineCounter] = rec;
    });

    if (gotoLastMatched === "true" && reconciliations.length > 0) {
      const lastRec = reconciliations[0];
      const beforeDash = lastRec.journalLineCounter?.split("-")[0];

      if (beforeDash) {
        const lastJournal = await journalModel
          .findOne({ counter: beforeDash, companyId })
          .lean();

        if (lastJournal) {
          const journalsSorted = [...allJournals].sort(
            (a, b) => new Date(b.journalDate) - new Date(a.journalDate)
          );

          const index = journalsSorted.findIndex(
            (j) => j._id.toString() === lastJournal._id.toString()
          );

          currentPage = index >= 0 ? Math.floor(index / pageSize) + 1 : 1;
        } else {
          currentPage = 1;
        }
      } else {
        currentPage = 1;
      }
    }

    const skip = (currentPage - 1) * pageSize;

    let runningBalanceMaine = 0;
    let runningBalance = 0;
    let totalDebtor = 0;
    let totalCreditor = 0;

    const filteredJournals = allJournals
      .sort((a, b) => new Date(a.journalDate) - new Date(b.journalDate))
      .map((journal) => {
        const filteredAccounts = (journal.journalAccounts || [])
          .filter((acc) => {
            let match =
              acc.id?.toString() === id.toString() && acc.posted !== false;

            if (filters.currency) {
              match =
                match && acc.accountCurrency?.toString() === filters.currency;
            }

            return match;
          })
          .map((accEntry) => {
            const mainDebit = Number(accEntry.MainDebit || 0);
            const mainCredit = Number(accEntry.MainCredit || 0);
            const accountDebit = Number(accEntry.accountDebit || 0);
            const accountCredit = Number(accEntry.accountCredit || 0);

            runningBalanceMaine +=
              account.balanceType === "credit"
                ? mainCredit - mainDebit
                : mainDebit - mainCredit;

            totalDebtor += mainDebit;
            totalCreditor += mainCredit;

            // IMPORTANT:
            // runningBalance should always be in account currency,
            // so do not switch to main currency based on isPrimary.
            runningBalance +=
              account.balanceType === "credit"
                ? accountCredit - accountDebit
                : accountDebit - accountCredit;

            const reconciliationInfo =
              reconciliationMap[`${journal.counter}-${accEntry.counter}`] ||
              null;

            return {
              ...accEntry,
              runningBalanceMaine,
              runningBalance,
              reconciliation: reconciliationInfo,
            };
          });

        return {
          ...journal,
          journalAccounts: filteredAccounts,
          runningBalanceMaine,
          runningBalance,
          totalDebtor,
          totalCreditor,
        };
      })
      .filter((journal) => journal.journalAccounts.length > 0);

    const paginatedJournals = filteredJournals
      .sort((a, b) => new Date(b.journalDate) - new Date(a.journalDate))
      .slice(skip, skip + pageSize);

    return res.status(200).json({
      pages: totalPages,
      results: totalItems,
      currentPage,
      runningBalanceMaine,
      runningBalance,
      totalDebtor,
      totalCreditor,
      data: account,
      journals: paginatedJournals,
    });
  } catch (error) {
    next(error);
  }
});
exports.updateJournal = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;
  const journal = await journalModel.findOne({ _id: id, companyId });
  req.body.journalAccounts = JSON.parse(req.body.journalAccounts);
  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedDateAdd = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;
  const isoDate = `${req.body.journalDate}T${formattedDateAdd}Z`;

  req.body.journalDate = isoDate;

  const updateJournal = await journalModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
    }
  );
  const updateOperations = journal.journalAccounts.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: {
        $inc: {
          debtor: -item.MainDebit || 0,
          creditor: -item.MainCredit || 0,
        },
      },
    },
  }));

  await AccountModel.bulkWrite(updateOperations);
  const updateOperations2 = req.body.journalAccounts.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: {
        $inc: {
          debtor: item.MainDebit || 0,
          creditor: item.MainCredit || 0,
        },
      },
    },
  }));
  await AccountModel.bulkWrite(updateOperations2);

  res.status(200).json({
    status: "success",
    message: "Journal Updated",
    data: updateJournal,
  });
});

exports.getOneJournalByLink = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { linkNum } = req.params;

  const journal = await journalModel.findOne({
    linkCounter: linkNum,
    companyId,
  });

  if (!journal) {
    return next(new ApiError(`no journal by linkNum ${linkNum}`, 404));
  }
  res.status(200).json({
    status: "success",
    message: "Journal Updated",
    data: journal,
  });
});

exports.updateJournalForInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  req.body.journalAccounts = JSON.parse(req.body.journalAccounts);
  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }
  const { linkNum } = req.params;
  const journal = await journalModel.findOne({
    linkCounter: linkNum,
    companyId,
  });
  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedDateAdd = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;
  const isoDate = `${req.body.journalDate}T${formattedDateAdd}Z`;

  req.body.journalDate = isoDate;

  const updateJournal = await journalModel.findOneAndUpdate(
    { linkCounter: linkNum, companyId },
    req.body,
    { new: true }
  );
  if (!updateJournal) {
    return next(new ApiError(`No Journal By this id`, 404));
  }
  const updateOperations = journal.journalAccounts
    .filter((item) => item.id)
    .map((item) => ({
      updateOne: {
        filter: { _id: item.id, companyId },
        update: {
          $inc: {
            debtor: -item.MainDebit || 0,
            creditor: -item.MainCredit || 0,
          },
        },
      },
    }));

  await AccountModel.bulkWrite(updateOperations);
  const updateOperations2 = req.body.journalAccounts.map((item) => ({
    updateOne: {
      filter: { _id: item.id, companyId },
      update: {
        $inc: {
          debtor: item.MainDebit || 0,
          creditor: item.MainCredit || 0,
        },
      },
    },
  }));
  await AccountModel.bulkWrite(updateOperations2);
  res.status(200).json({
    status: "success",
    message: "Journal Updated",
    data: updateJournal,
  });
});

exports.auditingJornal = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;
  const { auditing } = req.body;

  const journal = await journalModel.findOneAndUpdate(
    { _id: id, companyId },
    { auditing: auditing },
    { new: true }
  );
  if (journal.journalType === "Sales") {
    await orderModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true }
    );
  } else if (
    journal.journalType === "Payment In" ||
    journal.journalType === "Payment Out"
  ) {
    await paymentModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true }
    );
  } else if (journal.journalType === "Expense") {
    await expensesModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true }
    );
  } else if (journal.journalType === "Purchase") {
    await purchaseinvoicesModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true }
    );
  } else if (journal.journalType === "SalesRefund") {
    await returnOrderModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true }
    );
  } else if (journal.journalType === "PurchaseRefund") {
    await refundPurchaseInviceModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true }
    );
  }
  res.status(200).json({
    status: "success",
    message: "Journal audited",
    data: journal,
  });
});
