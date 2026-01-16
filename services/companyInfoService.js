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
const financialFundsModel = require("../models/financialFundsModel");
const reportsFinancialFunds = require("../models/reportsFinancialFunds");
const customarModel = require("../models/customarModel");
const suppliersModel = require("../models/suppliersModel");
const { createPaymentHistory } = require("./paymentHistoryService");
const stockModel = require("../models/stockModel");
const paymentHistoryModel = require("../models/paymentHistoryModel");
const journalEntryModel = require("../models/journalEntryModel");
const CategoryModel = require("../models/CategoryModel");
const brandModel = require("../models/brandModel");
const taxModel = require("../models/taxModel");
const tagModel = require("../models/tagModel");
const expensesCategoryModel = require("../models/expensesCategoryModel");
const UnitsModel = require("../models/UnitsModel");
const salesPointModel = require("../models/salesPointModel");
const { generateCounter } = require("../utils/counterFormat");

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

  const session = await mongoose.startSession();
  session.startTransaction();
  const currentDateTime = new Date();

  const year = currentDateTime.getFullYear() - 1;
  const firstYear = currentDateTime.getFullYear();
  const date = `${firstYear}-01-01T00:00:00.000Z`;
  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${year}-12-31T23:59:59.999Z`;
  try {
    const companyInfo = await CompanyInfnoModel.findOne({
      _id: companyId,
      rollOver: false,
    }).session(session);

    if (!companyInfo) {
      throw new ApiError(
        `There is no company info with this id ${companyId} or rollover already done`,
        404
      );
    }
    const baseName = companyInfo.companyName;
    await CompanyInfnoModel.findByIdAndUpdate(
      companyId,
      {
        companyName: `${baseName}-${year}`,
        rollOver: true,
        closedAt: new Date(),
      },
      { new: true, session }
    );

    if (!companyInfo) {
      throw new ApiError(
        `There is no company info with this id ${companyId}`,
        404
      );
    }

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

    await employeeModel.updateMany(
      {
        "company.companyId": companyId,
      },
      {
        $set: {
          "company.$.companyName": `${baseName}-${year}`,
        },
      },
      { session }
    );
    await employeeModel.updateMany(
      {
        "company.companyId": companyId,
      },
      {
        $push: {
          company: {
            companyId: newCompanyId,
            companyName: baseName,
            selectedRoles: insertMainRole._id,
          },
        },
      },
      { session }
    );

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
        {
          $match: match,
        },
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
      journalMap.set(j._id, {
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

    const newAccounts = await Promise.all(
      accounts.map(async (account) => {
        const isBalanceSheet = account.finalAccount === "Balance Sheet";

        const sums = journalMap.get(account._id) || {
          debtor: 0,
          creditor: 0,
        };

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

    const funds = await financialFundsModel
      .find({ companyId })
      .session(session);

    const openingJournalAccounts = (
      await Promise.all(
        insertedAccounts.map(async (account, index) => {
          if (account.finalAccount !== "Balance Sheet") return null;

          if (!account.originalAccountId) return null;

          const oldSums = journalMap.get(account.originalAccountId.toString());

          if (!oldSums) return null;
          let balance = 0;

          if (account.balanceType === "debit") {
            balance = oldSums.debtor - oldSums.creditor;
          } else if (account.balanceType === "credit") {
            balance = oldSums.creditor - oldSums.debtor;
          }
          console.log("oldSums", oldSums);

          if (balance === 0) return null;

          const currency = await currencyModel
            .findOne({
              companyId: newCompanyId,
              _id: account.currency,
            })
            .session(session);

          const rate = currency?.exchangeRate || 1;

          return {
            counter: Number(counter) + Number(index) + 1,
            id: account._id,
            name: account.name,
            code: account.code,
            MainDebit: account.balanceType === "debit" ? Math.abs(balance) : 0,
            MainCredit:
              account.balanceType === "credit" ? Math.abs(balance) : 0,
            accountDebit:
              account.balanceType === "debit" ? Math.abs(balance) * rate : 0,
            accountCredit:
              account.balanceType === "credit" ? Math.abs(balance) * rate : 0,
            accountCurrency: currency?.currencyCode || "",
            accountExRate: rate,
            description: "Opening Balance",
            isPrimary: rate === 1 ? true : false,
          };
        })
      )
    ).filter(Boolean);

    if (openingJournalAccounts.length > 0) {
      await journalEntryModel.create(
        [
          {
            companyId: newCompanyId,
            journalName: "Opening Balance",
            journalDate: new Date(Date.UTC(year, 0, 1)),
            journalRefNum: counter + 1,
            journalDesc: "Opening Balance",
            journalType: "Opening Balance",
            journalAccounts: openingJournalAccounts,
            counter: counter + 1,
            journalDebit: openingJournalAccounts.reduce(
              (sum, acc) => sum + acc.MainDebit,
              0
            ),
            journalCredit: openingJournalAccounts.reduce(
              (sum, acc) => sum + acc.MainCredit,
              0
            ),
          },
        ],
        { session }
      );
    }

    const newFunds = await Promise.all(
      funds.map(async (fund) => {
        const newFundId = new mongoose.Types.ObjectId();

        const fundReportsData = await reportsFinancialFunds
          .find({
            companyId,
            financialFundId: fund._id,
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          })
          .session(session);

        let fundBalance = 0;

        for (const report of fundReportsData) {
          if (report.paymentType === "Deposit") {
            fundBalance += report.amount;
          } else if (report.paymentType === "Withdrawal") {
            fundBalance -= report.amount;
          }
        }

        return {
          ...fund.toObject(),
          _id: newFundId,
          companyId: newCompanyId,
          openingBalance: fundBalance,
          fundBalance: fundBalance,
        };
      })
    );

    const createFunds = await financialFundsModel.insertMany(newFunds, {
      session,
    });

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

    const customers = await customarModel.find({ companyId }).session(session);

    const newCustomers = await Promise.all(
      customers.map(async (customer) => {
        const newCustomerId = new mongoose.Types.ObjectId();

        const customerHistoryData = await paymentHistoryModel
          .find({
            companyId,
            customerId: customer._id,
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          })
          .session(session);

        let totalInvoices = 0;
        let totalPayments = 0;
        for (const report of customerHistoryData) {
          if (report.type === "invoice") {
            totalInvoices += report.amount;
          } else if (report.type === "payment") {
            totalPayments += report.amount;
          }
        }

        const unpaid = totalInvoices - totalPayments;

        return {
          ...customer.toObject(),
          _id: newCustomerId,
          companyId: newCompanyId,
          total: totalInvoices,
          TotalUnpaid: unpaid,
        };
      })
    );

    const createCustomers = await customarModel.insertMany(newCustomers, {
      session,
    });

    for (const customer of createCustomers) {
      await createPaymentHistory(
        "Opening balance",
        req.body.date,
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

    const suppliers = await suppliersModel
      .find({
        companyId,
      })
      .session(session);

    const newSuppliers = await Promise.all(
      suppliers.map(async (supplier) => {
        const newSupplierId = new mongoose.Types.ObjectId();

        const supplierHistoryData = await paymentHistoryModel
          .find({
            companyId,
            supplierId: supplier._id,
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          })
          .session(session);
        let totalInvoices = 0;
        let totalPayments = 0;
        for (const report of supplierHistoryData) {
          if (report.type === "invoice") {
            totalInvoices += report.amount;
          } else if (report.type === "payment") {
            totalPayments += report.amount;
          }
        }

        const unpaid = totalInvoices - totalPayments;
        return {
          ...supplier.toObject(),
          _id: newSupplierId,
          companyId: newCompanyId,
          total: totalInvoices,
          TotalUnpaid: unpaid,
        };
      })
    );

    const createSuppliers = await suppliersModel.insertMany(newSuppliers, {
      session,
    });

    for (const supplier of createSuppliers) {
      await createPaymentHistory(
        "Opening balance",
        req.body.date,
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

    //---Stocks
    const stocks = await stockModel.find({ companyId }).session(session);

    const newStocks = stocks.map((stock) => ({
      ...stock.toObject(),
      _id: undefined,
      companyId: newCompanyId,
    }));

    await stockModel.insertMany(newStocks, { session });

    //---Categories
    const categories = await CategoryModel.find({ companyId }).session(session);

    const newCategories = categories.map((cat) => ({
      ...cat.toObject(),
      _id: undefined,
      companyId: newCompanyId,
    }));

    await CategoryModel.insertMany(newCategories, { session });

    //---Brands
    const brands = await brandModel.find({ companyId }).session(session);

    const newBrands = brands.map((brand) => ({
      ...brand.toObject(),
      _id: undefined,
      companyId: newCompanyId,
    }));

    await brandModel.insertMany(newBrands, { session });

    //---Taxs
    const taxs = await taxModel.find({ companyId }).session(session);

    const newTaxs = taxs.map((tax) => ({
      ...tax.toObject(),
      _id: undefined,
      companyId: newCompanyId,
    }));

    await taxModel.insertMany(newTaxs, { session });

    //---Tags
    const tags = await tagModel.find({ companyId }).session(session);

    const newTags = tags.map((tag) => ({
      ...tag.toObject(),
      _id: undefined,
      companyId: newCompanyId,
    }));

    await tagModel.insertMany(newTags, { session });

    //---Unit
    const units = await UnitsModel.find({ companyId }).session(session);

    const newunits = units.map((unit) => ({
      ...unit.toObject(),
      _id: undefined,
      companyId: newCompanyId,
    }));

    await UnitsModel.insertMany(newunits, { session });

    //---Expenses Category
    const categorExpenses = await expensesCategoryModel
      .find({ companyId })
      .session(session);

    const newCategorExpense = categorExpenses.map((catEx) => ({
      ...catEx.toObject(),
      _id: undefined,
      companyId: newCompanyId,
    }));

    await expensesCategoryModel.insertMany(newCategorExpense, { session });

    //---Sales Point
    const salesPoints = await salesPointModel
      .find({ companyId })
      .session(session);

    const newSalesPoints = salesPoints.map((salesPoint) => ({
      ...salesPoint.toObject(),
      _id: undefined,
      companyId: newCompanyId,
    }));

    await salesPointModel.insertMany(newSalesPoints, { session });

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
