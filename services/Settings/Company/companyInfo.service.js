const bcrypt = require("bcryptjs");
const { default: axios } = require("axios");
const companyInfoModel = require("../../../models/Settings/CompanyInfo/companyInfo.model");
const companySettingModel = require("../../../models/Settings/CompanyInfo/companySetting.model");
const mongoose = require("mongoose");
const linkPanelModel = require("../../../models/linkPanelModel");
const stockModel = require("../../../models/stockModel");
const rolesModel = require("../../../models/Settings/role.model");
const usersModel = require("../../../models/Settings/users.model");
const currencyModel = require("../../../models/Settings/currency.model");
const thirdPartyAuthModel = require("../../../models/ecommerce/thirdPartyAuthModel");
const sendEmail = require("../../../utils/sendEmail");
const generatePassword = require("../../../utils/tools/generatePassword");
const permissionModel = require("../../../models/Settings/permission.model");
const ecommercePaymentMethodModel = require("../../../models/ecommerce/ecommercePaymentMethodModel");
const ApiError = require("../../../utils/apiError");
const companyPlanModel = require("../../../models/Settings/CompanyInfo/companyPlan.model");
const subscriptionModel = require("../../../models/Settings/CompanyInfo/companySubscription.model");
const accountingTreeModel = require("../../../models/accountingTreeModel");
const bigAccountingTree = require("../../../utils/data/bigAccountingTree.json");

const companyInfoFields = [
  "companyName",
  "companyAddress",
  "companyTax",
  "companyEmail",
  "companyTel",
  "turkcellApiKey",
  "companyLogo",
  "rollOver",
  "closedAt",
  "parentId",
  "jobsCompanyId",
  "currentSubscription",
];

const companySettingFields = [
  "prefix",
  "emails",
  "xtwitterUrl",
  "linkedinUrl",
  "instagramUrl",
  "facebookUrl",
];

const pickDefined = (source, fields) =>
  fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
    return result;
  }, {});

const buildSettingUpdate = (body) => {
  const update = {};

  if (body.prefix && typeof body.prefix === "object") {
    Object.entries(body.prefix).forEach(([key, value]) => {
      update[`prefix.${key}`] = value;
    });
  }

  if (body.emails && typeof body.emails === "object") {
    Object.entries(body.emails).forEach(([key, value]) => {
      update[`emails.${key}`] = value;
    });
  }

  ["xtwitterUrl", "linkedinUrl", "instagramUrl", "facebookUrl"].forEach(
    (field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        update[field] = body[field];
      }
    },
  );

  return update;
};

const toPlainObject = (doc) => (doc?.toObject ? doc.toObject() : doc);

const mergeCompanyInfoWithSettings = (companyInfo, companySetting) => ({
  ...toPlainObject(companyInfo),
  ...pickDefined(toPlainObject(companySetting) || {}, companySettingFields),
});

const ensureCompanySetting = async ({ companyId, session }) => {
  const setting = await companySettingModel.findOneAndUpdate(
    { companyId },
    { $setOnInsert: { companyId } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    },
  );

  return setting;
};

const demoFeatureKeys = [
  "accounting",
  "inventory",
  "sales",
  "purchases",
  "hr",
  "crm",
  "manufacturing",
];

const getDemoPricingConfig = () => ({
  featurePrices: {
    accounting: 15,
    inventory: 15,
    sales: 15,
    purchases: 15,
    hr: 15,
    crm: 15,
    manufacturing: 15,
  },
  presetPlans: {
    starter: {
      name: "Starter",
      priceMonthly: 45,
      modules: ["accounting", "inventory", "sales"],
    },
    business: {
      name: "Business",
      priceMonthly: 75,
      modules: ["accounting", "inventory", "sales", "purchases", "hr"],
    },
    complete: {
      name: "Complete",
      priceMonthly: 95,
      modules: demoFeatureKeys,
    },
  },
});

const parseSelectedModules = (value) => {
  if (!value) {
    return [];
  }

  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch (error) {
    return demoFeatureKeys;
  }

  const modules = Array.isArray(parsed) ? parsed : [];
  const selected = modules.filter((module) => demoFeatureKeys.includes(module));

  return selected;
};

const buildDemoFeatures = (selectedModules) =>
  demoFeatureKeys.reduce((features, key) => {
    features[key] = selectedModules.includes(key);
    return features;
  }, {});

const resolveDemoPlan = (body) => {
  const pricingConfig = getDemoPricingConfig();
  const requestedPlan = body.selectedPlan || body.planKey || "starter";

  if (requestedPlan !== "custom" && pricingConfig.presetPlans[requestedPlan]) {
    const plan = pricingConfig.presetPlans[requestedPlan];
    return {
      key: requestedPlan,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      selectedModules: plan.modules,
    };
  }

  const selectedModules = parseSelectedModules(body.selectedModules);
  const customModules =
    selectedModules.length > 0 ? selectedModules : [demoFeatureKeys[0]];
  const priceMonthly = customModules.reduce(
    (total, module) => total + (pricingConfig.featurePrices[module] || 0),
    0,
  );

  return {
    key: "custom",
    name: "Custom",
    priceMonthly,
    selectedModules: customModules,
  };
};

const createDemoSubscription = async ({ body, companyId, session }) => {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 14);
  const planConfig = resolveDemoPlan(body);
  const features = buildDemoFeatures(planConfig.selectedModules);
  const planName =
    planConfig.key === "custom"
      ? `Demo Custom - ${planConfig.selectedModules.join(", ")}`
      : `Demo ${planConfig.name}`;

  const demoPlan = await companyPlanModel.findOneAndUpdate(
    { name: planName },
    {
      $set: {
        name: planName,
        priceMonthly: planConfig.priceMonthly,
        priceYearly: planConfig.priceMonthly * 12,
        features,
        maxUsers: 10,
        maxBranches: 3,
        maxProducts: 1000,
        isActive: true,
        companyId,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    },
  );

  const [subscription] = await subscriptionModel.create(
    [
      {
        companyId,
        planId: demoPlan._id,
        priceAtPurchase: planConfig.priceMonthly,
        billingCycle: "monthly",
        startDate,
        endDate,
        isActive: true,
        isTrial: true,
      },
    ],
    { session },
  );

  await companyInfoModel.findByIdAndUpdate(
    companyId,
    { currentSubscription: subscription._id },
    { session },
  );

  return subscription;
};

exports.creaeteAccountingTreeService = async ({
  session,
  companyId,
  body,
  currency,
}) => {
  let accounts;

  if (body.accountTree === "big") {
    accounts = bigAccountingTree.map((item) => ({
      ...item,
      companyId,
      currency: currency._id,
    }));
  } else if (body.accountTree === "small") {
    //coming Soon

    accounts = bigAccountingTree.map((item) => ({
      ...item,
      currency: currency._id,
      companyId,
    }));
  } else return true;

  await accountingTreeModel.insertMany(accounts, {
    session,
  });

  return true;
};

exports.getCompanyInfo = async ({ req, companyId }) => {
  const companyInfo = await companyInfoModel.findOne({ _id: companyId });
  if (!companyInfo) {
    throw new ApiError("Company not found", 404);
  }

  const companySetting = await ensureCompanySetting({ companyId });
  const currency = await currencyModel.findOne({ is_primary: true, companyId });

  return {
    companyInfo: mergeCompanyInfoWithSettings(companyInfo, companySetting),
    companySetting,
    currency,
  };
};

exports.getCompanySetting = async ({ companyId }) => {
  const companyInfo = await companyInfoModel.findById(companyId).select("_id");
  if (!companyInfo) {
    throw new ApiError("Company not found", 404);
  }

  return ensureCompanySetting({ companyId });
};

exports.createCompanyInfo = async ({ body, session: externalSession }) => {
  const session = externalSession || (await mongoose.startSession());
  const ownsSession = !externalSession;

  if (ownsSession) {
    session.startTransaction();
  }

  try {
    const ownerEmail = body.email || body.companyEmail;
    if (!ownerEmail) {
      throw new ApiError("Company email is required", 400);
    }

    body.email = ownerEmail;
    body.companyEmail = body.companyEmail || ownerEmail;

    const [companyInfo] = await companyInfoModel.create([body], { session });
    const companyId = companyInfo._id;
    const userName = body.name || body.companyName;
    const currentSubscription = await createDemoSubscription({
      body,
      companyId,
      session,
    });
    companyInfo.currentSubscription = currentSubscription._id;
    const companySetting = await companySettingModel.create(
      [
        {
          companyId,
          ...pickDefined(body, companySettingFields),
        },
      ],
      { session },
    );

    const linkAccount = [
      {
        name: "Purcahse",
        previewNameAr: "مشتريات",
        previewNameEn: "Purchase",
        previewNameTr: "Satın alma",
        group: "Purchase",
        companyId,
      },
      {
        name: "Sales",
        previewNameAr: "مبيعات",
        previewNameEn: "Sales",
        previewNameTr: "Satışlar",
        group: "Sales",
        companyId,
      },
      {
        name: "Supplier",
        previewNameAr: "موردون",
        previewNameEn: "Suppliers",
        previewNameTr: "Tedarikçiler",
        group: "Purchase",
        companyId,
      },
      {
        name: "Customers",
        previewNameAr: "عملاء",
        previewNameEn: "Customers",
        previewNameTr: "Müşteriler",
        group: "Sales",
        companyId,
      },
      {
        name: "Stocks",
        previewNameAr: "المستودعات",
        previewNameEn: "Stocks",
        previewNameTr: "Depolar",
        group: "Inventory",
        companyId,
      },
      {
        name: "Purchase withdrawals",
        previewNameAr: "مسموحات المشتريات",
        previewNameEn: "purchase allowances",
        previewNameTr: "Satın Alma İskontoları",
        group: "Purchase",
        companyId,
      },
      {
        name: "Sales withdrawals",
        previewNameAr: "مسموحات المبيعات",
        previewNameEn: "Sales allowances",
        previewNameTr: "Satış İskontoları",
        group: "Sales",
        companyId,
      },
      {
        name: "Purchase returns",
        previewNameAr: "إعادة المشتريات",
        previewNameEn: "Purchase returns",
        previewNameTr: "Satın alma iadeleri",
        group: "Purchase",
        companyId,
      },
      {
        name: "cost of sold services",
        previewNameAr: "كلفة الخدمات المباعة",
        previewNameEn: "Cost of sold services",
        previewNameTr: "Satılan servislerin maliyeti",
        group: "Inventory",
        companyId,
      },
      {
        name: "Earned discount",
        previewNameAr: "الخصومات المكتسبة",
        previewNameEn: "Earned discount",
        previewNameTr: "Kazanılan indirimler",
        group: "Discount",
        companyId,
      },
      {
        name: "Discount granted",
        previewNameAr: "الخصومات الممنوحة",
        previewNameEn: "Discount granted",
        previewNameTr: "Verilen indirimler",
        group: "Discount",
        companyId,
      },
      {
        name: "Salary",
        previewNameAr: "الرواتب",
        previewNameEn: "Salary",
        previewNameTr: "Maaşlar",
        group: "HR",
        companyId,
      },
      {
        name: "Should Pay Salary",
        previewNameAr: "الرواتب المتوجب دفعها",
        previewNameEn: "Should pay salary",
        previewNameTr: "Ödemesi gereken maaşlar",
        group: "HR",
        companyId,
      },
      {
        name: "cost of sold products",
        previewNameAr: "كلفة المنتجات المباعة",
        previewNameEn: "Cost of sold products",
        previewNameTr: "Satılan ürünlerin maliyeti",
        group: "Inventory",
        companyId,
      },
      {
        name: "Sales returns",
        previewNameAr: "إعادة المبيعات",
        previewNameEn: "Refund sales",
        previewNameTr: "Satış iadeleri",
        group: "Sales",
        companyId,
      },

      {
        name: "Walk-In Customer",
        previewNameAr: "زبون نقدي",
        previewNameEn: "Walk-In customer",
        previewNameTr: "Nakdi müşteri",
        group: "Sales",
        companyId,
      },
      {
        name: "Inventory Adjustment",
        previewNameAr: "ضبط المخزون",
        previewNameEn: "Inventory adjustment",
        previewNameTr: "Stok düzenlemesi",
        group: "Inventory",
        companyId,
      },
      {
        name: "Sales Service",
        previewNameAr: "خدمات المبيع",
        previewNameEn: "Sales services",
        previewNameTr: "Satış servisleri",
        group: "Sales",
        companyId,
      },
      {
        name: "Capital",
        previewNameAr: "الرأسمال",
        previewNameEn: "Capital",
        previewNameTr: "Sermaye",
        group: "Investment",
        companyId,
      },
      {
        name: "partnersWithdrawals",
        previewNameEn: "Partners withdrawals",
        previewNameAr: "مسحوبات الشركاء",
        previewNameTr: "Ortakların çekilmeleri",
        group: "Investment",
        companyId,
      },
      {
        name: "profitDistribution",
        __v: 0,
        previewNameEn: "Profit distribution",
        previewNameAr: "توزيع الأرباح",
        previewNameTr: "Kar dağılımı",
        group: "Investment",
        companyId,
      },
      {
        name: "Export Sales",
        DescEn:
          "Recognizes revenue from selling goods/services that will be exported.",
        DescTr:
          "Mal / hizmet satışlarından elde edilen gelir, yurtdışına ihraç edilecek.",
        DescAr: "يعترف بالإيرادات الناتجة عن بيع السلع / الخدمات التي ستُصدّر.",
        sync: false,
        previewNameEn: "Export Sales",
        previewNameAr: "مبيعات التصدير",
        previewNameTr: "İhracat Satışları",
        group: "Sales",
        companyId,
      },
      {
        name: "Foreign Exchange Gain",
        sync: false,
        previewNameEn: "Foreign Exchange Gain",
        previewNameAr: "أرباح فروقات أسعار الصرف",
        previewNameTr: "Kur Farkı Gelirleri",
        group: "Accounting",
        companyId,
      },
      {
        name: "Foreign Exchange Loss",
        sync: false,
        previewNameEn: "Foreign Exchange Loss",
        previewNameAr: "خسائر فروقات أسعار الصرف",
        previewNameTr: "Kur Farkı Giderleri",
        group: "Accounting",
        companyId,
      },
    ];
    await linkPanelModel.create(linkAccount, { session });

    await stockModel.create([{ name: "Main Stock", companyId }], { session });

    const permissions = await permissionModel.find().session(session);
    const [insertMainRole] = await rolesModel.create(
      [
        {
          name: "Super Admin",
          description: "Role Description",
          permissions: permissions.map((p) => p._id),
          superAdmin: true,
          companyId,
        },
      ],
      { session },
    );

    body.companies = {
      companyId,
      roleId: insertMainRole._id,
      companyName: body.companyName,
      authMethods: { passwordEnabled: false, pinEnabled: true },
    };

    const oldEmail = await usersModel
      .findOne({ email: body.email })
      .session(session);
    if (!oldEmail) {
      const userPass = generatePassword();
      const hashedPassword = await bcrypt.hash(userPass, 12);
      body.password = hashedPassword;
      body.name = userName;
      await usersModel.create([body], { session });

      try {
        await axios.post(`${process.env.JOBS_URL}api/auth/createEmployee`, {
          email: body.email,
          name: body.companyName,
          password: userPass,
        });
      } catch (err) {
        console.error("Failed to sync employee:", err.message);
      }

      await sendEmail({
        email: body.email,
        subject: "New Password",
        message: `Hello ${body.companyName}, Your password is ${userPass}`,
      });
    } else {
      await usersModel.findOneAndUpdate(
        { email: body.email },
        {
          $push: {
            companies: {
              companyId,
              roleId: insertMainRole._id,
              companyName: body.companyName,
            },
          },
        },
        { session },
      );
    }

    const currency = await currencyModel.create(
      [
        {
          currencyCode: body.currencyCode,
          currencyName: body.currencyName,
          exchangeRate: 1,
          is_primary: true,
          companyId,
        },
      ],
      { session },
    );

    await thirdPartyAuthModel.create(
      [
        {
          googleAuthClientID: "",
          googleAuthClientSecret: "",
          facebookAuthAppID: "",
          redirectUri: "",
          companyId,
        },
      ],
      { session },
    );

    const paymentMethods = [
      {
        name: "onlinePayment",
        extraCharge: 1,
        minAmount: 1,
        maxAmount: 99999,
        status: false,
        companyId,
      },
      {
        name: "bankTransfer",
        extraCharge: 1,
        minAmount: 1,
        maxAmount: 99999,
        status: false,
        companyId,
      },
      {
        name: "payAtDoor",
        extraCharge: 1,
        minAmount: 1,
        maxAmount: 99999,
        status: false,
        companyId,
      },
    ];
    await ecommercePaymentMethodModel.insertMany(paymentMethods, {
      session,
      ordered: false,
    });

    // const defaultSettings = {
    //   page: [
    //     {
    //       name: "PDPL",
    //       title: "Personal Data Protection Law",
    //       key: "PDPL",
    //       description: "PDPL",
    //       content: "",
    //       companyId,
    //     },
    //     {
    //       name: "Privacy Policy",
    //       title: "Privacy Policy",
    //       key: "PrivPol",
    //       description: "Privacy Policy",
    //       content: "",
    //       companyId,
    //     },
    //     {
    //       name: "Terms & Conditions",
    //       title: "Terms & Conditions",
    //       key: "TermsConds",
    //       description: "Terms & Conditions",
    //       content: "",
    //       companyId,
    //     },
    //   ],
    //   slider: [
    //     { name: "Main", images: ["", "", ""], companyId },
    //     { name: "Offers", images: ["", "", ""], companyId },
    //   ],
    //   contactUs: {
    //     email: "",
    //     phone: "",
    //     facebookUrl: "",
    //     instagramUrl: "",
    //     linkedinUrl: "",
    //     xtwitterUrl: "",
    //     companyId,
    //   },
    // };
    // await ecommerceSettingsModel.updateOne({ companyId }, defaultSettings, {
    //   upsert: true,
    //   session,
    // });

    if (ownsSession) {
      await session.commitTransaction();
      session.endSession();
    }
    console.log(currency);

    return {
      companyInfo: mergeCompanyInfoWithSettings(companyInfo, companySetting[0]),
      companySetting: companySetting[0],
      insertMainRole,
      currentSubscription,
      currency,
    };
  } catch (err) {
    if (ownsSession) {
      await session.abortTransaction();
      session.endSession();
    }
    throw err;
  }
};

exports.updateCompanySetting = async ({ session, companyId, body }) => {
  const companyInfo = await companyInfoModel.findById(companyId).select("_id");
  if (!companyInfo) {
    throw new ApiError("Company not found", 404);
  }

  const settingUpdate = buildSettingUpdate(body);
  if (Object.keys(settingUpdate).length === 0) {
    return ensureCompanySetting({ companyId, session });
  }

  const companySetting = await companySettingModel.findOneAndUpdate(
    { companyId },
    {
      $set: settingUpdate,
      $setOnInsert: { companyId },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    },
  );

  return companySetting;
};

exports.updateCompanyInfo = async ({ session, companyId, body }) => {
  try {
    const infoUpdate = pickDefined(body, companyInfoFields);
    const settingUpdate = buildSettingUpdate(body);

    const companyInfo =
      Object.keys(infoUpdate).length > 0
        ? await companyInfoModel.findByIdAndUpdate(
            companyId,
            { $set: infoUpdate },
            { new: true, session },
          )
        : await companyInfoModel.findById(companyId).session(session);

    if (!companyInfo) {
      throw new ApiError("Company not found", 404);
    }

    let companySetting = await ensureCompanySetting({ companyId, session });
    if (Object.keys(settingUpdate).length > 0) {
      companySetting = await companySettingModel.findOneAndUpdate(
        { companyId },
        {
          $set: settingUpdate,
          $setOnInsert: { companyId },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
          session,
        },
      );
    }

    return {
      companyInfo: mergeCompanyInfoWithSettings(companyInfo, companySetting),
      companySetting,
    };
  } catch (error) {
    throw error;
  }
};

exports.rolloverService = async ({ companyId, session, body }) => {
  const {
    endDate: endDates,
    startDate: startDates,
    manualJournal,
    priceMethod,
    profitloseAccounts,
    type,
  } = body;

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

    const now = new Date();

    const companySubscription = await subscriptionModel
      .findOne({
        companyId,
        endDate: now,
      })
      .session(session)
      .populate("planId");

    if (!companyInfo) {
      throw new ApiError(
        `There is no company info with this id ${companyId} or rollover already done`,
        409,
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
      { new: true, session },
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
          models: companyInfo.models,
          parentId: companyInfo.parentId,
          rollOver: false,
        },
      ],
      { session },
    );
    const companySetting = await companySettingModel.create(
      [
        {
          companyId,
          prefix: companyInfo.prefix,
          emails: companyInfo.emails,
          xtwitterUrl: companyInfo.xtwitterUrl,
          linkedinUrl: companyInfo.linkedinUrl,
          instagramUrl: companyInfo.instagramUrl,
          facebookUrl: companyInfo.facebookUrl,
        },
      ],
      { session },
    );
    const companyPlan = await companyPlanModel.create(
      [
        {
          companyId,
          name: companySubscription.planId.name,
          priceMonthly: companySubscription.planId.priceMonthly,
          priceYearly: companySubscription.planId.priceMonthly * 12,
          features: companySubscription.planId.features,
          maxUsers: companySubscription.planId.maxUsers,
          maxBranches: companySubscription.planId.maxBranches,
          maxProducts: companySubscription.planId.maxProducts,
          isActive: companySubscription.planId.isActive,
        },
      ],
      { session },
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

    body.companies = {
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
      { "companies.companyId": companyId },
      {
        $set: {
          "companies.$[c].companyName": `${baseName}-${year}`,
        },
      },
      {
        arrayFilters: [{ "c.companyId": companyId }],
        session,
      },
    );

    const employees = await usersModel
      .find({ "companies.companyId": companyId })
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
              companies: {
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
      }),
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
          link.accountData?.toString() || link.accountId?.toString(),
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
      }),
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
      }),
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
      }),
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

      if (
        chackDateBalanceDebtor.toFixed(4) !==
        chackDateBalanceCreditor.toFixed(4)
      ) {
        throw new ApiError(
          `Opening balance journal not balanced (Debit: ${chackDateBalanceDebtor}, Credit: ${chackDateBalanceCreditor}), `,
          405,
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
                0,
              ),
              journalCredit: openingJournalAccounts.reduce(
                (sum, acc) => sum + acc.MainCredit,
                0,
              ),
            },
          ],
          { session },
        );
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
        { session },
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
        "Opening balance",
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
        "Opening balance",
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

    // await BeginningInvoice({
    //   companyId,
    //   newCompanyId,
    //   session,
    //   newStocks,
    //   date,
    //   counter,
    //   units,
    //   newunits: insertedUnits,
    //   priceMethod,
    //   manualJournal,
    //   categoryMap,
    //   unitMap,
    //   taxMap,
    //   currencyMap,
    //   brandMap,
    // });

    return {
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
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

exports.BeginningInvoiceService = async ({
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

  // await openingInventoryRollover({
  //   products,
  //   newCompanyId,
  //   session,
  //   newStocks,
  //   date,
  //   counter,
  //   priceMethod,
  //   manualJournal,
  // });
};

exports.openingInventoryRolloverService = async ({
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
    { session },
  );

  const items = [];
  const productStockMap = new Map();
  let totalQuantity = 0;
  let totalValue = 0;

  for (const stock of stocks) {
    for (const oldProduct of products) {
      const newProduct = newProducts.find(
        (p) => p.originalProductId?.toString() === oldProduct._id.toString(),
      );
      if (!newProduct) continue;

      const stockEntry = oldProduct.stocks?.find(
        (s) => s.stockName === stock.name,
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
      { session },
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
    { session },
  );

  return openingInventory;
};
