const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const CompanyInfnoModel = require("../models/companyInfoModel");
const currencyModel = require("../models/currencyModel");
const multer = require("multer");
const ApiError = require("../utils/apiError");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const roleDashboardModel = require("../models/roleDashboardModel");
const rolesModel = require("../models/roleModel");
const StockModel = require("../models/stockModel");
const thirdPartyAuthModel = require("../models/ecommerce/thirdPartyAuthModel");
const paymentMethodModel = require("../models/ecommerce/ecommercePaymentMethodModel");
const ecommerceSettingsModel = require("../models/ecommerce/ecommerceSettingsModel");
const employeeModel = require("../models/employeeModel");
const generatePassword = require("../utils/tools/generatePassword");
const multerStorage = multer.memoryStorage();
const bcrypt = require("bcryptjs");
const linkPanelModel = require("../models/linkPanelModel");
const sendEmail = require("../utils/sendEmail");
const { default: axios } = require("axios");
const accountingTreeModel = require("../models/accountingTreeModel");
const financialFundsModel = require("../models/Accounting/CurrentAssets/financialFundsModel");
const reportsFinancialFunds = require("../models/Accounting/CurrentAssets/reportsFinancialFunds");
const customarModel = require("../models/Accounting/Sales/customarModel");
const suppliersModel = require("../models/Accounting/Purchase/suppliersModel");
const { createPaymentHistory } = require("./paymentHistoryService");
const stockModel = require("../models/stockModel");
const paymentHistoryModel = require("../models/paymentHistoryModel");
const journalEntryModel = require("../models/journalEntryModel");
const CategoryModel = require("../models/CategoryModel");
const brandModel = require("../models/brandModel");
const taxModel = require("../models/taxModel");
const tagModel = require("../models/tagModel");
const expensesCategoryModel = require("../models/Accounting/Expenses/expensesCategoryModel");
const UnitsModel = require("../models/UnitsModel");
const salesPointModel = require("../models/salesPointModel");
const { generateCounter } = require("../utils/counterFormat");
const productModel = require("../models/productModel");
const { createProductMovement } = require("../utils/productMovement");
const { createProductBatch } = require("./productBatchServices");
const OpeningInventoryItemModel = require("../models/OpeningInventoryItemModel");
const openingInventoryModel = require("../models/openingInventoryModel");

const multerFilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ApiError("Only images allowed", 400), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

exports.uploadCompanyLogo = upload.single("companyLogo");

exports.resizerLogo = asyncHandler(async (req, res, next) => {
  const filename = `company-${uuidv4()}-${Date.now()}.png`;

  if (req.file) {
    await sharp(req.file.buffer)
      .toFormat("png")
      .png({ quality: 90 })
      .toFile(`uploads/companyinfo/${filename}`);
    req.body.companyLogo = filename;
  }

  next();
});

//@desc Create company info
//@route POST /api/companyinfo
exports.createCompanyInfo = asyncHandler(async (req, res, next) => {
  //1-craet a company
  const companyInfo = await CompanyInfnoModel.create(req.body);

  const dashboardRoles = await roleDashboardModel.find();
  const linkAccount = [
    {
      name: "Purcahse",
      previewNameAr: "مشتريات",
      previewNameEn: "Purchase",
      previewNameTr: "Satın alma",
      companyId: companyInfo._id,
    },
    {
      name: "Sales",
      previewNameAr: "مبيعات",
      previewNameEn: "Sales",
      previewNameTr: "Satışlar",
      companyId: companyInfo._id,
    },
    {
      name: "Supplier",
      previewNameAr: "موردون",
      previewNameEn: "Suppliers",
      previewNameTr: "Tedarikçiler",
      companyId: companyInfo._id,
    },
    {
      name: "Customers",
      previewNameEn: "Customers",
      previewNameAr: "عملاء",
      previewNameTr: "Müşteriler",
      companyId: companyInfo._id,
    },
    {
      name: "Stocks",
      previewNameAr: "المستودعات",
      previewNameEn: "Stocks",
      previewNameTr: "Depolar",
      companyId: companyInfo._id,
    },
    {
      name: "Purchase withdrawals",
      previewNameAr: "مسموحات المشتريات",
      previewNameEn: " purchase allowances ",
      previewNameTr: "Satın Alma İskontoları",
      companyId: companyInfo._id,
    },
    {
      name: "Sales withdrawals",
      previewNameAr: "مسموحات المبيعات",
      previewNameEn: " Sales allowances ",
      previewNameTr: "Satış İskontoları",
      companyId: companyInfo._id,
    },
    {
      name: "Sales returns",
      previewNameAr: "إعادة المبيعات",
      previewNameEn: "Refund sales",
      previewNameTr: "Satış iadeleri",
      companyId: companyInfo._id,
    },
    {
      name: "Purchase returns",
      previewNameAr: "إعادة المشتريات",
      previewNameEn: "Purchase returns",
      previewNameTr: "Satın alma iadeleri",
      companyId: companyInfo._id,
    },
    {
      name: "cost of sold services",
      previewNameAr: "كلفة الخدمات المباعة",
      previewNameEn: "Cost of sold services",
      previewNameTr: "Satılan servislerin maliyeti",
      companyId: companyInfo._id,
    },
    {
      name: "Cash",
      previewNameAr: "النقد",
      previewNameEn: "Cash",
      previewNameTr: "Nakit",
      companyId: companyInfo._id,
    },
    {
      name: "Earned discount",
      previewNameAr: "الخصومات المكتسبة",
      previewNameEn: "Earned discount",
      previewNameTr: "Kazanılan indirimler",
      companyId: companyInfo._id,
    },
    {
      name: "Discount granted",
      previewNameAr: "الخصومات الممنوحة",
      previewNameEn: "Discount granted",
      previewNameTr: "Verilen indirimler",
      companyId: companyInfo._id,
    },
    {
      name: "Salary",
      previewNameAr: "الرواتب",
      previewNameEn: "Salary",
      previewNameTr: "Maaşlar",
      companyId: companyInfo._id,
    },
    {
      name: "Should Pay Salary",
      previewNameAr: "الرواتب المتوجب دفعها",
      previewNameEn: "Should pay salary",
      previewNameTr: "Ödemesi gereken maaşlar",
      companyId: companyInfo._id,
    },
    {
      name: "cost of sold products",
      previewNameAr: "كلفة المنتجات المباعة",
      previewNameEn: "Cost of sold products",
      previewNameTr: "Satılan ürünlerin maliyeti",
      companyId: companyInfo._id,
    },
    {
      name: "Refund Sales",
      previewNameAr: "إعادة المبيعات",
      previewNameEn: "Refund sales",
      previewNameTr: "Satşlar iadesi",
      companyId: companyInfo._id,
    },
    {
      name: "Walk-In Customer",
      previewNameAr: "زبون نقدي",
      previewNameEn: "Walk-In customer",
      previewNameTr: "Nakdi müşteri",
      companyId: companyInfo._id,
    },
    {
      name: "Inventory Adjustment",
      previewNameAr: "ضبط المخزون",
      previewNameEn: "Inventory adjustment",
      previewNameTr: "Stok düzenlemesi",
      companyId: companyInfo._id,
    },
    {
      name: "Sales Service",
      previewNameAr: "خدمات المبيع",
      previewNameEn: "Sales services",
      previewNameTr: "Satış servisleri",
      companyId: companyInfo._id,
    },
    {
      name: "Capital",
      previewNameAr: "الرأسمال",
      previewNameEn: "Capital",
      previewNameTr: "Sermaye",
      companyId: companyInfo._id,
    },
  ];
  await linkPanelModel.create(linkAccount);
  await StockModel.create({ name: "main Stcok", companyId: companyInfo._id });

  //4-insert the main role
  // Extract IDs from the inserted documents
  const dashboardRoleIds = dashboardRoles.map((role) => role._id);
  const insertMainRole = await rolesModel.create({
    name: "Super Admin",
    description: "Role Description",
    rolesDashboard: dashboardRoleIds,
    superAdmin: true,
    companyId: companyInfo._id,
  });

  req.body.name = req.body.companyName;
  req.body.company = {
    companyId: companyInfo._id,
    selectedRoles: insertMainRole._id,
    companyName: req.body.companyName,
  };
  const oldEmail = await employeeModel.findOne({ email: req.body.email });
  if (!oldEmail) {
    const employeePass = generatePassword();
    const hashedPassword = await bcrypt.hash(employeePass, 12);
    req.body.password = hashedPassword;
    const employee = await employeeModel.create(req.body);
    //Added for the jobs
    const payload = {
      email: req.body.email,
      name: req.body.companyName,
      password: employeePass,
    };
    try {
      await axios.post(
        `${process.env.JOBS_URL}api/auth/createEmployee`,
        payload
      );
    } catch (err) {
      console.error("Failed to sync employee:", err.message);
    }

    await sendEmail({
      email: req.body.email,
      subject: "New Password",
      message: `Hello ${employee.name}, Your password is ${employeePass}`,
    });
  } else {
    await employeeModel.findOneAndUpdate(
      { email: req.body.email },
      {
        $push: {
          company: {
            companyId: companyInfo._id,
            selectedRoles: insertMainRole._id,
            companyName: req.body.companyName,
          },
        },
      }
    );
  }

  //5-insert the main currency
  await currencyModel.create({
    currencyCode: req.body.currencyCode,
    currencyName: req.body.currencyName,
    exchangeRate: "1",
    is_primary: "true",
    companyId: companyInfo._id,
  });

  //6- Insert the 3rd party auth
  await thirdPartyAuthModel.create({
    googleAuthClientID: "",
    googleAuthClientSecret: "",
    facebookAuthAppID: "",
    redirectUri: "",
    companyId: companyInfo._id,
  });

  //7- Insert the e-commerce payment methods
  const paymentMethods = [
    {
      name: "onlinePayment",
      description: "",
      extraCharge: 1,
      minAmount: 1,
      maxAmount: 99999,
      status: false,
      companyId: companyInfo._id,
    },
    {
      name: "bankTransfer",
      description: "",
      extraCharge: 1,
      minAmount: 1,
      maxAmount: 99999,
      status: false,
      companyId: companyInfo._id,
    },
    {
      name: "payAtDoor",
      description: "",
      extraCharge: 1,
      minAmount: 1,
      maxAmount: 99999,
      status: false,
      companyId: companyInfo._id,
    },
  ];
  await paymentMethodModel
    .insertMany(paymentMethods, { ordered: false })
    .catch((err) => {
      console.log("the paymet is alread inserted", err.message);
    });
  //8- Insert default settings
  const defaultSettings = {
    page: [
      {
        name: "PDPL",
        title: "Personal Data Protection Law",
        key: "PDPL",
        description: "PDPL",
        content: "",
        companyId: companyInfo._id,
      },
      {
        name: "Privacy Policy",
        title: "Privacy Policy",
        key: "PrivPol",
        description: "Privacy Policy",
        content: "",
        companyId: companyInfo._id,
      },
      {
        name: "Terms & Conditions",
        title: "Terms & Conditions",
        key: "TermsConds",
        description: "Terms & Conditions",
        content: "",
        companyId: companyInfo._id,
      },
    ],
    slider: [
      {
        name: "Main",
        images: ["", "", ""],
        companyId: companyInfo._id,
      },
      {
        name: "Offers",
        images: ["", "", ""],
        companyId: companyInfo._id,
      },
    ],
    contactUs: {
      email: "",
      phone: "",
      facebookUrl: "",
      instagramUrl: "",
      linkedinUrl: "",
      xtwitterUrl: "",
      companyId: companyInfo._id,
    },
  };
  await ecommerceSettingsModel.updateOne({}, defaultSettings, {
    upsert: true,
  });
  //Finally, make res
  res.status(201).json({
    status: "true",
    message: "Company info inserted",
    data: {
      company: companyInfo,
      mainRoleId: insertMainRole._id,
    },
  });
});

//Get company info
//@role: who has role can Get company info
exports.getCompanyInfo = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const companyInfos = await CompanyInfnoModel.findOne({ _id: companyId });
  const currency = await currencyModel.findOne({ is_primary: true, companyId });

  res.status(200).json({ status: "true", data: companyInfos, currency });
});

exports.updataCompanyInfo = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyInfo = await CompanyInfnoModel.findByIdAndUpdate(
      { _id: id },
      {
        companyName: req.body.companyName,
        companyAddress: req.body.companyAddress,
        companyTax: req.body.companyTax,
        companyTel: req.body.companyTel,
        companyLogo: req.body.companyLogo,
        turkcellApiKey: req.body.turkcellApiKey,
        pinCode: req.body.pinCode,
        color: req.body.color,
        havePin: req.body.havePin,
        facebookUrl: req.body.facebookUrl,
        instagramUrl: req.body.instagramUrl,
        xtwitterUrl: req.body.xtwitterUrl,
        linkedinUrl: req.body.linkedinUrl,
        emails: req.body.emails,
        prefix: req.body.prefix,
        transactionReferenceFormat: req.body.transactionReferenceFormat,
        transactionReferenceExtra: req.body.transactionReferenceExtra,
      },
      {
        new: true,
      }
    );
    if (!companyInfo) {
      return next(new ApiError(`There is no company with this id ${id}`, 404));
    } else {
      res.status(200).json({
        status: "true",
        message: "Company info updated",
        data: companyInfo,
      });
    }
  } catch (error) {
    console.log(error);
  }
});

exports.rollover = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  const {
    endDate: endDates,
    startDate: startDates,
    manualJournal,
    priceMethod,
    profitloseAccounts,
    type,
  } = req.body;
  const debugRollback = false;
  if (!endDates || !startDates) {
    throw new ApiError(
      "Journal date and price method are required to continue rollover",
      400
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  const currentDateTime = new Date();
  const year = currentDateTime.getFullYear() - 1;

  const date = `${endDates}T00:00:00.000Z`;
  const startDate = `${startDates}T00:00:00.000Z`;
  const endDate = `${endDates}T23:59:59.999Z`;

  try {
    const companyInfo = await CompanyInfnoModel.findOne({
      _id: companyId,
      rollOver: false,
    }).session(session);

    if (!companyInfo) {
      throw new ApiError(
        `There is no company info with this id ${companyId} or rollover already done`,
        409
      );
    }
    const baseName = companyInfo.companyName;
    await CompanyInfnoModel.findByIdAndUpdate(
      companyId,
      {
        companyName: `${baseName}-${year}`,
        rollOver: true,
        closedAt: endDate,
      },
      { new: true, session }
    );
    const newCompanyInfo = await CompanyInfnoModel.create(
      [
        {
          companyName: baseName,
          companyAddress: companyInfo.companyAddress,
          companyTax: companyInfo.companyTax,
          companyEmail: companyInfo.companyEmail,
          companyTel: companyInfo.companyTel,
          companyLogo: companyInfo.companyLogo,
          pinCode: companyInfo.pinCode,
          havePin: companyInfo.havePin,
          facebookUrl: companyInfo.facebookUrl,
          instagramUrl: companyInfo.instagramUrl,
          linkedinUrl: companyInfo.linkedinUrl,
          xtwitterUrl: companyInfo.xtwitterUrl,
          emails: companyInfo.emails,
          prefix: companyInfo.prefix,
          turkcellApiKey: companyInfo.turkcellApiKey,
          transactionReferenceExtra: companyInfo.transactionReferenceExtra,
          transactionReferenceFormat: companyInfo.transactionReferenceFormat,
          jobsCompanyId: companyInfo.jobsCompanyId,
          models: companyInfo.models,
          parentId: companyInfo.parentId,
          rollOver: false,
        },
      ],
      { session }
    );
    const { dateFormat, counterFormat } = companyInfo.prefix;

    const counter = generateCounter({
      dateFormat,
      counterFormat,
      date: new Date(),
    });
    const newCompanyId = newCompanyInfo[0]._id;

    const dashboardRoles = await roleDashboardModel.find();
    const dashboardRoleIds = dashboardRoles.map((role) => role._id);
    const insertMainRole = await rolesModel.create({
      name: "Super Admin",
      description: "Role Description",
      rolesDashboard: dashboardRoleIds,
      superAdmin: true,
      companyId: newCompanyId,
    });

    req.body.company = {
      companyId: companyInfo._id,
      selectedRoles: insertMainRole._id,
      companyName: baseName,
    };

    // --- Stocks
    const stocks = await stockModel.find({ companyId }).session(session);

    const newStocks = stocks.map((stock) => {
      const obj = stock.toObject();
      const oldId = obj._id;
      delete obj._id;
      delete obj.id;

      return {
        ...obj,
        companyId: newCompanyId,
        oldId: oldId,
      };
    });

    const insertStock = await stockModel.insertMany(newStocks, { session });

    const stockMap = new Map();
    insertStock.forEach((s) => {
      stockMap.set(s.oldId.toString(), s._id);
    });

    await employeeModel.updateMany(
      { "company.companyId": companyId },
      {
        $set: {
          "company.$[c].companyName": `${baseName}-${year}`,
        },
      },
      {
        arrayFilters: [{ "c.companyId": companyId }],
        session,
      }
    );

    const employees = await employeeModel
      .find({ "company.companyId": companyId })
      .session(session);

    const bulkOps = employees.map((emp) => {
      const newEmployeeStocks = (emp.stocks || [])
        .map((st) => {
          const newStockId = stockMap.get(st.stockId?.toString());
          if (!newStockId) return null;

          return {
            stockId: newStockId,
            stockName: st.stockName,
          };
        })
        .filter(Boolean);

      return {
        updateOne: {
          filter: { _id: emp._id },
          update: {
            $set: {
              stocks: newEmployeeStocks,
            },
            $push: {
              company: {
                companyId: newCompanyId,
                companyName: baseName,
                selectedRoles: insertMainRole._id,
              },
            },
          },
        },
      };
    });

    if (bulkOps.length) {
      await employeeModel.bulkWrite(bulkOps, { session });
    }

    const currencies = await currencyModel.find({ companyId }).session(session);

    const newCurrencies = currencies.map((cur) => ({
      ...cur.toObject(),
      _id: undefined,
      companyId: newCompanyId,
      oldCurrency: cur._id,
    }));

    const accounts = await accountingTreeModel
      .find({ companyId })
      .session(session);

    const match = {
      companyId: companyId,
      journalDate: { $gte: startDate, $lte: endDate },
    };

    const journalSums = await journalEntryModel
      .aggregate([
        { $match: match },
        { $unwind: "$journalAccounts" },
        {
          $group: {
            _id: "$journalAccounts.id",
            totalDebit: { $sum: "$journalAccounts.MainDebit" },
            totalCredit: { $sum: "$journalAccounts.MainCredit" },
            totalAccountDebit: { $sum: "$journalAccounts.accountDebit" },
            totalAccountCredit: { $sum: "$journalAccounts.accountCredit" },
          },
        },
      ])
      .session(session);

    const journalMap = new Map();
    journalSums.forEach((j) => {
      journalMap.set(j._id?.toString(), {
        debtor: j.totalDebit,
        creditor: j.totalCredit,
      });
    });

    const insertCurrencies = await currencyModel.insertMany(newCurrencies, {
      session,
    });

    const currencyMap = new Map();
    newCurrencies.forEach((cur, index) => {
      currencyMap.set(cur.oldCurrency.toString(), insertCurrencies[index]._id);
    });

    let chackDateBalanceDebtor = 0;
    let chackDateBalanceCreditor = 0;

    const newAccounts = await Promise.all(
      accounts.map(async (account) => {
        const isBalanceSheet = account.finalAccount === "Balance Sheet";

        const sums = journalMap.get(account._id.toString()) || {
          debtor: 0,
          creditor: 0,
        };

        const debtor = Number(sums.debtor) || 0;
        const creditor = Number(sums.creditor) || 0;

        chackDateBalanceDebtor += debtor;
        chackDateBalanceCreditor += creditor;

        return {
          ...account.toObject(),
          _id: undefined,
          companyId: newCompanyId,
          originalAccountId: account._id,
          debtor: isBalanceSheet ? sums.debtor : 0,
          creditor: isBalanceSheet ? sums.creditor : 0,
          currency: currencyMap.get(account.currency?.toString()) || null,
        };
      })
    );

    const insertedAccounts = await accountingTreeModel.insertMany(newAccounts, {
      session,
    });

    const accountIdMap = new Map();
    insertedAccounts.forEach((acc) => {
      accountIdMap.set(acc.originalAccountId.toString(), acc._id);
    });

    const linkedPanel = await linkPanelModel.find({ companyId }).lean();

    const newLinkedPanel = linkedPanel
      .map((link) => {
        const newAccountId = accountIdMap.get(
          link.accountData?.toString() || link.accountId?.toString()
        );

        return {
          ...link,
          _id: undefined,
          companyId: newCompanyId,
          accountData: newAccountId,
        };
      })
      .filter(Boolean);

    await linkPanelModel.insertMany(newLinkedPanel, {
      session,
    });

    // ------------------------------------------------------------------
    // Suppliers (create first)
    // ------------------------------------------------------------------
    const suppliers = await suppliersModel.find({ companyId }).session(session);

    const newSuppliers = await Promise.all(
      suppliers.map(async (supplier) => {
        const newSupplierId = new mongoose.Types.ObjectId();

        const supplierHistoryData = await paymentHistoryModel
          .find({
            companyId,
            supplierId: supplier._id,
            date: { $gte: startDate, $lte: endDate },
          })
          .session(session);

        let totalInvoices = 0;
        let totalPayments = 0;

        for (const report of supplierHistoryData) {
          if (report.type === "invoice") totalInvoices += report.amount;
          else if (report.type === "payment") totalPayments += report.amount;
        }

        const unpaid = totalInvoices - totalPayments;

        return {
          ...supplier.toObject(),
          _id: newSupplierId,
          companyId: newCompanyId,
          total: totalInvoices,
          TotalUnpaid: unpaid,
          linkAccount:
            accountIdMap.get(supplier.linkAccount?.toString()) || null,
        };
      })
    );

    const createSuppliers = await suppliersModel.insertMany(newSuppliers, {
      session,
    });

    // ------------------------------------------------------------------
    // Funds (create)
    // ------------------------------------------------------------------
    const funds = await financialFundsModel
      .find({ companyId })
      .session(session);

    const newFunds = await Promise.all(
      funds.map(async (fund) => {
        const newFundId = new mongoose.Types.ObjectId();

        const fundReportsData = await reportsFinancialFunds
          .find({
            companyId,
            financialFundId: fund._id,
            date: { $gte: startDate, $lte: endDate },
          })
          .session(session);

        let fundBalance = 0;

        for (const report of fundReportsData) {
          if (report.paymentType === "Deposit") fundBalance += report.amount;
          else if (report.paymentType === "Withdrawal")
            fundBalance -= report.amount;
        }

        return {
          ...fund.toObject(),
          _id: newFundId,
          companyId: newCompanyId,
          openingBalance: fundBalance,
          fundBalance: fundBalance,
          linkAccount: accountIdMap.get(fund.linkAccount?.toString()) || null,
        };
      })
    );

    const createFunds = await financialFundsModel.insertMany(newFunds, {
      session,
    });

    // ------------------------------------------------------------------
    // Customers (create)
    // ------------------------------------------------------------------
    const customers = await customarModel.find({ companyId }).session(session);

    const newCustomers = await Promise.all(
      customers.map(async (customer) => {
        const newCustomerId = new mongoose.Types.ObjectId();

        const customerHistoryData = await paymentHistoryModel
          .find({
            companyId,
            customerId: customer._id,
            date: { $gte: startDate, $lte: endDate },
          })
          .session(session);

        let totalInvoices = 0;
        let totalPayments = 0;

        for (const report of customerHistoryData) {
          if (report.type === "invoice") totalInvoices += report.amount;
          else if (report.type === "payment") totalPayments += report.amount;
        }

        const unpaid = totalInvoices - totalPayments;

        return {
          ...customer.toObject(),
          _id: newCustomerId,
          companyId: newCompanyId,
          total: totalInvoices,
          TotalUnpaid: unpaid,
          linkAccount:
            accountIdMap.get(customer.linkAccount?.toString()) || null,
        };
      })
    );

    const createCustomers = await customarModel.insertMany(newCustomers, {
      session,
    });

    // Customers: amount sign stays as-is (AR usually Debit)
    const customersByAccount = new Map(); // accId => [{ kind, refId, name, amountSigned }]
    for (const c of createCustomers) {
      const accId = c.linkAccount?.toString();
      if (!accId) continue;

      const amt = Number(c.TotalUnpaid) || 0;
      if (Math.abs(amt) <= 0.009) continue;

      if (!customersByAccount.has(accId)) customersByAccount.set(accId, []);
      customersByAccount.get(accId).push({
        kind: "customer",
        refId: c._id,
        name: c.name || c.customerName || "",
        amountSigned: amt,
      });
    }

    const suppliersByAccount = new Map();
    for (const s of createSuppliers) {
      const accId = s.linkAccount?.toString();
      if (!accId) continue;

      const raw = Number(s.TotalUnpaid) || 0;
      if (Math.abs(raw) <= 0.009) continue;

      const amtSigned = -raw;

      if (!suppliersByAccount.has(accId)) suppliersByAccount.set(accId, []);
      suppliersByAccount.get(accId).push({
        kind: "supplier",
        refId: s._id,
        name: s.name || s.supplierName || "",
        amountSigned: amtSigned,
      });
    }

    const fundsByAccount = new Map();
    for (const f of createFunds) {
      const accId = f.linkAccount?.toString();
      if (!accId) continue;

      const amt = Number(f.fundBalance) || 0;
      if (Math.abs(amt) <= 0.009) continue;

      if (!fundsByAccount.has(accId)) fundsByAccount.set(accId, []);
      fundsByAccount.get(accId).push({
        kind: "fund",
        refId: f._id,
        name: f.name || f.fundName || "",
        amountSigned: amt,
      });
    }

    // ------------------------------------------------------------------
    // Opening Journal
    // ------------------------------------------------------------------
    console.log("manualJournal", manualJournal);
    if (!manualJournal) {
      const openingJournalAccounts = [];

      for (let index = 0; index < insertedAccounts.length; index++) {
        const account = insertedAccounts[index];

        if (account.finalAccount !== "Balance Sheet") continue;
        if (!account.originalAccountId) continue;

        const oldSums = journalMap.get(account.originalAccountId.toString());
        if (!oldSums) continue;

        const balance =
          (Number(oldSums.debtor) || 0) - (Number(oldSums.creditor) || 0);

        if (Math.abs(balance) <= 0.009) continue;

        const currency = await currencyModel
          .findOne({ companyId: newCompanyId, _id: account.currency })
          .session(session);

        const rate = currency?.exchangeRate || 1;

        const accKey = account._id.toString();

        const partyLines = [
          ...(customersByAccount.get(accKey) || []),
          ...(suppliersByAccount.get(accKey) || []),
          ...(fundsByAccount.get(accKey) || []),
        ];

        if (partyLines.length) {
          let sumLines = 0;

          for (const item of partyLines) {
            sumLines += item.amountSigned;

            const amt = Math.abs(item.amountSigned);

            const row = {
              counter: openingJournalAccounts.length + 1,
              id: account._id,
              name: account.name,
              code: account.code,

              MainDebit: item.amountSigned > 0 ? amt : 0,
              MainCredit: item.amountSigned < 0 ? amt : 0,

              accountDebit: item.amountSigned > 0 ? amt * rate : 0,
              accountCredit: item.amountSigned < 0 ? amt * rate : 0,

              accountCurrency: currency?.currencyCode || "",
              accountExRate: rate,
              Desc: `Opening Balance - ${item.name}`,
              isPrimary: rate === 1,

              party: item.refId,
              partyName: item.name,
            };

            if (item.kind === "customer") {
              row.customerId = item.refId;
            } else if (item.kind === "supplier") {
              row.supplierId = item.refId;
            } else if (item.kind === "fund") {
              row.financialFundId = item.refId;
            }

            openingJournalAccounts.push(row);
          }

          const unallocated = balance - sumLines;

          if (Math.abs(unallocated) > 0.009) {
            const ua = Math.abs(unallocated);
            openingJournalAccounts.push({
              counter: openingJournalAccounts.length + 1,
              id: account._id,
              name: account.name,
              code: account.code,

              MainDebit: unallocated > 0 ? ua : 0,
              MainCredit: unallocated < 0 ? ua : 0,

              accountDebit: unallocated > 0 ? ua * rate : 0,
              accountCredit: unallocated < 0 ? ua * rate : 0,

              accountCurrency: currency?.currencyCode || "",
              accountExRate: rate,
              Desc: "Opening Balance - UNALLOCATED",
              isPrimary: rate === 1,
            });
          }

          continue;
        }

        const amt = Math.abs(balance);

        openingJournalAccounts.push({
          counter: openingJournalAccounts.length + 1,
          id: account._id,
          name: account.name,
          code: account.code,

          MainDebit: balance > 0 ? amt : 0,
          MainCredit: balance < 0 ? amt : 0,

          accountDebit: balance > 0 ? amt * rate : 0,
          accountCredit: balance < 0 ? amt * rate : 0,

          accountCurrency: currency?.currencyCode || "",
          accountExRate: rate,
          Desc: "Opening Balance",
          isPrimary: rate === 1,
        });
      }

      openingJournalAccounts.sort((a, b) => a.code.localeCompare(b.code));

      // if (
      //   chackDateBalanceDebtor.toFixed(4) !==
      //   chackDateBalanceCreditor.toFixed(4)
      // ) {
      //   throw new ApiError(
      //     `Opening balance journal not balanced (Debit: ${chackDateBalanceDebtor}, Credit: ${chackDateBalanceCreditor}), `,
      //     405,
      //   );
      // }

      const diff = Math.abs(chackDateBalanceDebtor - chackDateBalanceCreditor);

      if (diff > 0.001) {
        throw new ApiError(
          `Opening balance journal not balanced (Debit: ${chackDateBalanceDebtor}, Credit: ${chackDateBalanceCreditor}, Diff: ${diff})`,
          405
        );
      }

      for (const acc of profitloseAccounts) {
        openingJournalAccounts.push({
          counter: openingJournalAccounts.length + 1,
          id: acc.id,
          name: acc.name,
          code: acc.code,

          MainDebit: type === "credit" ? Math.abs(acc.Balance || 0) : 0,
          MainCredit: type === "debit" ? Math.abs(acc.Balance || 0) : 0,

          accountDebit:
            type === "credit"
              ? Math.abs(acc.Balance || 0) * (acc.exchRate || 1)
              : 0,
          accountCredit:
            type === "debit"
              ? Math.abs(acc.Balance || 0) * (acc.exchRate || 1)
              : 0,

          accountCurrency: acc.currency || "",
          accountExRate: acc.exchRate || 1,

          description: "PROFIT & LOSS CLOSING ENTRY",
          isPrimary: (acc.exchRate || 1) === 1,
        });
      }
      console.log(
        "openingJournalAccountsbefore",
        openingJournalAccounts.length
      );
      if (openingJournalAccounts.length > 0) {
        console.log(
          "openingJournalAccountsAfter",
          openingJournalAccounts.length
        );
        const createdOpeningJournal = await journalEntryModel.create(
          [
            {
              companyId: newCompanyId,
              journalName: "Opening Balance",
              journalDate: new Date(Date.UTC(year, 0, 1)),
              journalRefNum: String(Number(counter) + 1),
              journalDesc: "Opening Balance",
              journalType: "Opening Balance",
              journalAccounts: openingJournalAccounts,
              counter: String(Number(counter) + 1),
              journalDebit: openingJournalAccounts.reduce(
                (sum, acc) => sum + Number(acc.MainDebit || 0),
                0
              ),
              journalCredit: openingJournalAccounts.reduce(
                (sum, acc) => sum + Number(acc.MainCredit || 0),
                0
              ),
            },
          ],
          { session }
        );

        console.log("createdOpeningJournal", createdOpeningJournal);

        const checkOpeningJournal = await journalEntryModel
          .find({
            companyId: newCompanyId,
            journalType: "Opening Balance",
          })
          .session(session);

        console.log("checkOpeningJournal", checkOpeningJournal);
      }
    }

    // ------------------------------------------------------------------
    // Create opening reports / history (كما عندك)
    // ------------------------------------------------------------------
    for (const fund of createFunds) {
      await reportsFinancialFunds.create(
        [
          {
            date: date,
            amount: fund.fundBalance,
            type: "Opening Balance",
            financialFundId: fund._id,
            financialFundRest: fund.fundBalance,
            paymentType: fund.fundBalance > 0 ? "Deposit" : "Withdrawal",
            companyId: newCompanyId,
          },
        ],
        { session }
      );
    }

    for (const customer of createCustomers) {
      await createPaymentHistory(
        "Opening balance",
        date,
        customer.TotalUnpaid,
        customer.TotalUnpaid,
        "customer",
        customer._id,
        "",
        newCompanyId,
        "",
        "",
        customer.TotalUnpaid > 0 ? "Deposit" : "Withdrawal",
        "Opening balance"
      );
    }

    for (const supplier of createSuppliers) {
      await createPaymentHistory(
        "Opening balance",
        date,
        supplier.TotalUnpaid,
        supplier.TotalUnpaid,
        "supplier",
        supplier._id,
        "",
        newCompanyId,
        "",
        "",
        supplier.TotalUnpaid > 0 ? "Deposit" : "Withdrawal",
        "Opening balance"
      );
    }

    // --- Categories
    const categories = await CategoryModel.find({ companyId }).session(session);

    const newCategories = categories.map((c) => ({
      ...c.toObject(),
      _id: undefined,
      companyId: newCompanyId,
      oldId: c._id,
    }));

    const insertedCategories = await CategoryModel.insertMany(newCategories, {
      session,
    });

    const categoryMap = new Map();
    insertedCategories.forEach((cat) => {
      categoryMap.set(cat.oldId, cat._id);
    });

    // --- Brands
    const brands = await brandModel.find({ companyId }).session(session);

    const newBrands = brands.map((b) => ({
      ...b.toObject(),
      _id: undefined,
      companyId: newCompanyId,
      oldId: b._id,
    }));

    const insertedBrands = await brandModel.insertMany(newBrands, { session });

    const brandMap = new Map();
    insertedBrands.forEach((b) => {
      brandMap.set(b.oldId, b._id);
    });

    // --- Taxes
    const taxes = await taxModel.find({ companyId }).session(session);

    const newTaxes = taxes.map((t) => ({
      ...t.toObject(),
      _id: undefined,
      companyId: newCompanyId,
      oldId: t._id,
      salesAccountTax: accountIdMap.get(t.salesAccountTax?.toString()) || null,
      purchaseAccountTax:
        accountIdMap.get(t.purchaseAccountTax?.toString()) || null,
    }));

    const insertedTaxes = await taxModel.insertMany(newTaxes, { session });

    const taxMap = new Map();
    insertedTaxes.forEach((t) => {
      taxMap.set(t.oldId.toString(), t._id);
    });

    // --- Tags
    const tags = await tagModel.find({ companyId }).session(session);

    const newTags = tags.map((tag) => ({
      ...tag.toObject(),
      _id: undefined,
      companyId: newCompanyId,
    }));

    await tagModel.insertMany(newTags, { session });

    // --- Unit
    const units = await UnitsModel.find({ companyId }).session(session);

    const newUnits = units.map((u) => ({
      ...u.toObject(),
      _id: undefined,
      companyId: newCompanyId,
      oldId: u._id,
    }));

    const insertedUnits = await UnitsModel.insertMany(newUnits, { session });

    const unitMap = new Map();
    insertedUnits.forEach((u) => {
      unitMap.set(u.oldId.toString(), u._id);
    });

    // --- Expenses Category
    const categorExpenses = await expensesCategoryModel
      .find({ companyId })
      .session(session);

    const newCategorExpense = categorExpenses.map((catEx) => ({
      ...catEx.toObject(),
      _id: undefined,
      companyId: newCompanyId,
      linkAccount: accountIdMap.get(catEx.linkAccount?.toString()) || null,
    }));

    await expensesCategoryModel.insertMany(newCategorExpense, { session });

    // --- Sales Point
    const salesPoints = await salesPointModel
      .find({ companyId })
      .session(session);

    const bulkpoint = salesPoints.map((point) => {
      const stockArr = Array.isArray(point?.stock) ? point.stock : [];

      const newSalesPoints = stockArr
        .map((st) => {
          const key = (st?.id ?? st?._id)?.toString();
          if (!key) return null;

          const newStockId = stockMap.get(key);
          if (!newStockId) return null;

          return {
            id: newStockId,
            name: st?.name,
          };
        })
        .filter(Boolean);

      return {
        updateOne: {
          filter: { _id: point._id },
          update: { $set: { stock: newSalesPoints } },
        },
      };
    });

    const ops = bulkpoint.filter((op) => op?.updateOne);

    if (ops.length) {
      await salesPointModel.bulkWrite(ops, { session });
    }
    console.log("BEFORE BeginningInvoice");
    await BeginningInvoice({
      companyId,
      newCompanyId,
      session,
      newStocks,
      date,
      counter,
      units,
      newunits: insertedUnits,
      priceMethod,
      manualJournal,
      categoryMap,
      unitMap,
      taxMap,
      currencyMap,
      brandMap,
    });

    console.log("AFTER BeginningInvoice");

    const journalsAfterBeginningInvoice = await journalEntryModel
      .find({ companyId: newCompanyId })
      .session(session);

    console.log("journalsAfterBeginningInvoice", journalsAfterBeginningInvoice);

    if (debugRollback === true || debugRollback === "true") {
      throw new ApiError(
        "Debug rollback: transaction aborted intentionally",
        499
      );
    }

    console.log("journalsAfterBeginningInvoice", journalsAfterBeginningInvoice);

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      status: true,
      message: "Rollover completed successfully",
      data: newCompanyInfo[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
});

const BeginningInvoice = async ({
  companyId,
  newCompanyId,
  session,
  newStocks,
  date,
  counter,
  units,
  newunits,
  priceMethod,
  manualJournal,
  categoryMap,
  unitMap,
  taxMap,
  currencyMap,
  brandMap,
}) => {
  const products = await productModel.find({ companyId }).lean();
  const oldUnitIdToName = new Map();
  units.forEach((u) => {
    oldUnitIdToName.set(u._id.toString(), u.name);
  });

  const newUnitNameToId = new Map();
  newunits.forEach((u) => {
    newUnitNameToId.set(u.name, u._id);
  });

  const newProducts = products.map((product) => {
    const obj = { ...product };
    const oldId = obj._id;

    delete obj._id;
    delete obj.id;

    const newUnitsPrices = (obj.unitsPrices || []).map((up) => ({
      ...up,
      unitId: unitMap.get(up.unitId?.toString()) || null,
    }));

    return {
      ...obj,
      companyId: newCompanyId,
      originalProductId: oldId,
      stocks: [],
      unitsPrices: newUnitsPrices,
      costBuyingPrice: obj.costBuyingPrice || obj.buyingprice || 0,
      category: categoryMap.get(obj.category?.toString()) || null,
      unit: unitMap.get(obj.unit?.toString()) || null,
      tax: taxMap.get(obj.tax?.toString()) || null,
      currency: currencyMap.get(obj.currency?.toString()) || null,
      brand: brandMap.get(obj.brand?.toString()) || null,
    };
  });

  const insertedProduct = await productModel.insertMany(newProducts, {
    session,
  });

  await openingInventoryRollover({
    products,
    newCompanyId,
    session,
    newStocks,
    date,
    counter,
    priceMethod,
    manualJournal,
  });
};

const openingInventoryRollover = async ({
  products,
  newCompanyId,
  session,
  date,
  counter,
  priceMethod,
  manualJournal,
}) => {
  const mainCurrency = await currencyModel
    .findOne({ companyId: newCompanyId, is_primary: "true" })
    .session(session)
    .lean();

  if (!mainCurrency) {
    throw new ApiError("Main currency not found", 400);
  }

  const stocks = await stockModel
    .find({ companyId: newCompanyId })
    .session(session)
    .lean();

  const newProducts = await productModel
    .find({ companyId: newCompanyId })
    .session(session)
    .lean();

  const [openingInventory] = await openingInventoryModel.create(
    [
      {
        companyId: newCompanyId,
        openingNumber: counter,
        date,
        description: "Opening Inventory Balance",
        currency: {
          id: mainCurrency._id,
          currencyCode: mainCurrency.currencyCode,
          currencyName: mainCurrency.currencyName,
          exchangeRate: mainCurrency.exchangeRate,
        },
      },
    ],
    { session }
  );

  const items = [];
  const productStockMap = new Map();
  let totalQuantity = 0;
  let totalValue = 0;

  for (const stock of stocks) {
    for (const oldProduct of products) {
      const newProduct = newProducts.find(
        (p) => p.originalProductId?.toString() === oldProduct._id.toString()
      );
      if (!newProduct) continue;

      const stockEntry = oldProduct.stocks?.find(
        (s) => s.stockName === stock.name
      );

      const quantity = stockEntry?.productQuantity || 0;
      if (quantity <= 0) continue;

      let buyingPrice = 0;
      if (priceMethod === "costBuyingPrice") {
        buyingPrice = newProduct.costBuyingPrice || 0;
      } else if (priceMethod === "price") {
        buyingPrice = newProduct.price || 0;
      } else {
        buyingPrice = newProduct.buyingprice || 0;
      }

      const total = quantity * buyingPrice;

      totalQuantity += quantity;
      totalValue += total;

      if (!productStockMap.has(newProduct._id.toString())) {
        productStockMap.set(newProduct._id.toString(), []);
      }

      productStockMap.get(newProduct._id.toString()).push({
        stockId: stock._id,
        stockName: stock.name,
        productQuantity: quantity,
      });

      items.push({
        openingInventoryId: openingInventory._id,
        companyId: newCompanyId,

        productId: newProduct._id,
        name: newProduct.name,
        sku: newProduct.sku,
        barcode: newProduct.barcode,

        unit: newProduct.unit,

        stock: {
          id: stock._id,
          name: stock.name,
        },

        quantity,
        buyingPrice,
        total,
        note: "Opening Balance",
      });
    }
  }

  if (!items.length) {
    throw new ApiError("No opening inventory items found", 400);
  }

  await OpeningInventoryItemModel.insertMany(items, { session });

  for (const item of items) {
    await createProductMovement({
      productId: item.productId,
      reference: openingInventory._id,
      newQuantity: item.quantity,
      quantity: item.quantity,
      movementType: "in",
      source: "Opening Inventory",
      companyId: newCompanyId,
      stockId: item.stock.id,
      buyingPrice: item.buyingPrice,
      enterPrice: item.buyingPrice,
      exchangeRate: 1,
    });

    await createProductBatch({
      productId: item.productId,
      companyId: newCompanyId,
      stockId: item.stock.id,
      quantity: item.quantity,
      buyingprice: item.buyingPrice,
      costBuyingPrice: item.buyingPrice,
      sourceId: openingInventory._id,
      referenceType: "opening",
    });
  }

  for (const [productId, stocksData] of productStockMap.entries()) {
    await productModel.updateOne(
      { _id: productId },
      { $set: { stocks: stocksData } },
      { session }
    );
  }

  await openingInventoryModel.updateOne(
    { _id: openingInventory._id },
    {
      $set: {
        totalQuantity,
        totalValue,
        totalValueMainCurrency: totalValue * mainCurrency.exchangeRate,
      },
    },
    { session }
  );

  // if (!manualJournal) {
  //   const purchaseLink = await linkPanelModel
  //     .findOne({ name: "Purcahse", companyId: newCompanyId })
  //     .session(session)
  //     .lean();

  //   const stockLink = await linkPanelModel
  //     .findOne({ name: "Stocks", companyId: newCompanyId })
  //     .session(session)
  //     .lean();

  //   const purchaseAccount = await accountingTreeModel
  //     .findById(purchaseLink.accountData)
  //     .session(session)
  //     .populate({
  //       path: "currency",
  //       options: { session },
  //     })
  //     .lean();

  //   const stockAccount = await accountingTreeModel
  //     .findById(stockLink.accountData)
  //     .session(session)
  //     .populate({
  //       path: "currency",
  //       options: { session },
  //     })
  //     .lean();

  //   const journalAccounts = [
  //     {
  //       counter: 1,
  //       id: stockAccount._id,
  //       name: stockAccount.name,
  //       code: stockAccount.code,
  //       MainDebit: totalValue,
  //       MainCredit: 0,
  //       accountDebit: totalValue * stockAccount.currency.exchangeRate,
  //       accountCredit: 0,
  //       accountCurrency: stockAccount.currency.currencyCode,
  //       accountExRate: stockAccount.currency.exchangeRate,
  //       description: "Opening Balance",
  //     },
  //     {
  //       counter: 2,
  //       id: purchaseAccount._id,
  //       name: purchaseAccount.name,
  //       code: purchaseAccount.code,
  //       MainDebit: 0,
  //       MainCredit: totalValue,
  //       accountDebit: 0,
  //       accountCredit: totalValue * purchaseAccount.currency.exchangeRate,
  //       accountCurrency: purchaseAccount.currency.currencyCode,
  //       accountExRate: purchaseAccount.currency.exchangeRate,
  //       description: "Opening Balance",
  //     },
  //   ];

  //   await journalEntryModel.create(
  //     [
  //       {
  //         companyId: newCompanyId,
  //         journalName: "Opening Balance",
  //         journalDate: date,
  //         journalRefNum: counter,
  //         journalType: "Opening Balance",
  //         journalAccounts,
  //         journalDebit: totalValue,
  //         journalCredit: totalValue,
  //       },
  //     ],
  //     { session },
  //   );
  // }

  return openingInventory;
};
