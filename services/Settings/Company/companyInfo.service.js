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
