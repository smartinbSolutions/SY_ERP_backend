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
        group: "Stock",
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
        group: "Stock",

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
        group: "Salary",

        companyId,
      },
      {
        name: "Should Pay Salary",
        previewNameAr: "الرواتب المتوجب دفعها",
        previewNameEn: "Should pay salary",
        previewNameTr: "Ödemesi gereken maaşlar",
        group: "Salary",

        companyId,
      },
      {
        name: "cost of sold products",
        previewNameAr: "كلفة المنتجات المباعة",
        previewNameEn: "Cost of sold products",
        previewNameTr: "Satılan ürünlerin maliyeti",
        group: "Stock",

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
        group: "Stock",

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
        group: "Profit & Loss",
        companyId,
      },
      {
        name: "Foreign Exchange Loss",
        sync: false,
        previewNameEn: "Foreign Exchange Loss",
        previewNameAr: "خسائر فروقات أسعار الصرف",
        previewNameTr: "Kur Farkı Giderleri",
        group: "Profit & Loss",
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

    await currencyModel.create(
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

    return {
      companyInfo: mergeCompanyInfoWithSettings(companyInfo, companySetting[0]),
      companySetting: companySetting[0],
      insertMainRole,
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
