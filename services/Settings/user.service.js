const userCompanySettingsModel = require("../../models/Settings/userCompanySettings.model");
const isEmail = require("../../utils/tools/isEmail");
const sendEmail = require("../../utils/sendEmail");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const safeParse = require("../../utils/tools/safeParse");
const generatePassword = require("../../utils/tools/generatePassword");
const { getDashboardRoles } = require("../roleDashboardServices");
const ApiError = require("../../utils/apiError");
const createToken = require("../../utils/createToken");
const usersModel = require("../../models/Settings/users.model");
const companySubscriptionModel = require("../../models/Settings/CompanyInfo/companySubscription.model");
const companyInfoModel = require("../../models/Settings/CompanyInfo/companyInfo.model");
const rolesModel = require("../../models/Settings/role.model");
const checkUserLimit = async (companyId) => {
  const company = await companyInfoModel.findById(companyId).populate({
    path: "currentSubscription",
    populate: { path: "planId" },
  });

  const plan = company.currentSubscription.planId;

  const usersCount = await usersModel.countDocuments({ companyId });

  if (usersCount >= plan.maxUsers) {
    throw new Error("User limit reached for this plan");
  }
};

exports.getUsers = async ({
  companyId,
  page = 1,
  limit = 10,
  keyword = "",
}) => {
  const pageSize = Math.max(1, Number(limit));
  const currentPage = Math.max(1, Number(page));
  const skip = (currentPage - 1) * pageSize;

  const query = { companies: { $elemMatch: { companyId } } };

  if (keyword) {
    query.$or = [
      { email: { $regex: keyword, $options: "i" } },
      { name: { $regex: keyword, $options: "i" } },
    ];
  }

  const totalItems = await usersModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);

  const users = await usersModel
    .find(query)
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "companies.roleId", select: "name _id" })
    .lean();

  const userIds = users.map((u) => u._id);

  const settings = await userCompanySettingsModel
    .find({
      companyId,
      userId: { $in: userIds },
    })
    .select("userId salesPoint selectedQuickActions stocks status")
    .lean();

  const settingsMap = new Map(settings.map((s) => [String(s.userId), s]));

  const data = users.map((u) => {
    const companyData = (u.company || []).find(
      (c) => c.companyId === companyId,
    );

    return {
      ...u,
      selectedRoles: companyData?.selectedRoles || null,
      settings: settingsMap.get(String(u._id)) || null,
    };
  });

  return { pages: totalPages, results: totalItems, data };
};

exports.createUser = async ({ companyId, body }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const email = body.email;
    if (!isEmail(email)) throw new Error("There is an error in email format");

    const findUser = await usersModel.findOne({ email }).session(session);
    const company = await companyInfoModel.findById(companyId).session(session);
    if (!company) throw new Error("Company not found");

    body.stocks = safeParse(body.stocks || []);

    body.company = [
      {
        companyId,
        selectedRoles: body.selectedRoles,
        companyName: company.companyName,
      },
    ];

    let userDoc;
    let userPass;

    if (!findUser) {
      userPass = generatePassword();
      body.password = await bcrypt.hash(userPass, 12);

      const created = await usersModel.create([body], { session });
      userDoc = created[0];

      await userCompanySettingsModel.create(
        [
          {
            companyId,
            userId: userDoc._id,
            salesPoint: body.salesPoint || null,
            tagIds: safeParse(body.tagIds || []),
            expenseTagIds: safeParse(body.expenseTagIds || []),
            purchaseTagIds: safeParse(body.purchaseTagIds || []),
            salesTagIds: safeParse(body.salesTagIds || []),
            selectedQuickActions: body.selectedQuickActions || [],
            stocks: (body.stocks || []).map((s) => ({
              stockId: s.stockId || s,
            })),
            status: "active",
          },
        ],
        { session },
      );
    } else {
      userDoc = await usersModel.findByIdAndUpdate(
        findUser._id,
        {
          $addToSet: {
            company: {
              companyId,
              selectedRoles: body.selectedRoles,
              companyName: company.companyName,
            },
          },
        },
        { new: true, session },
      );

      await userCompanySettingsModel.updateOne(
        { companyId, userId: userDoc._id },
        {
          $setOnInsert: {
            companyId,
            userId: userDoc._id,
            status: "active",
            selectedQuickActions: [],
            tagIds: [],
            expenseTagIds: [],
            purchaseTagIds: [],
            salesTagIds: [],
            stocks: [],
          },
        },
        { upsert: true, session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    if (userPass) {
      await sendEmail({
        email: body.email,
        subject: "Your Account Password Details",
        message: `
Dear ${body.name},

A temporary password has been generated for your account.

Temporary Password:
${userPass}

Please change your password immediately after logging in.

This is an automated message (noreply@smartinb.com).
        `,
      });
    }

    return userDoc;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

exports.getUser = async ({ companyId, id }) => {
  const user = await usersModel
    .findOne({
      _id: id,
      "company.companyId": String(companyId),
    })
    .select("-password -createdAt -updatedAt")
    .lean();

  if (!user) {
    throw new ApiError(`No user by this id ${id}`, 404);
  }

  const companyData = (user.company || []).find(
    (c) => String(c.companyId) === String(companyId),
  );

  if (!companyData?.selectedRoles) {
    throw new ApiError("User has no selected role in this company", 400);
  }

  const roles = await rolesModel
    .findOne({ _id: companyData.selectedRoles, companyId: String(companyId) })
    .lean();

  if (!roles) {
    throw new ApiError("Role not found", 404);
  }

  const settings = await userCompanySettingsModel
    .findOne({ companyId: String(companyId), userId: user._id })
    .select(
      "salesPoint selectedQuickActions stocks status active tagIds expenseTagIds purchaseTagIds salesTagIds",
    )
    .lean();

  return {
    data: {
      ...user,
      selectedRoles: roles,
      settings: settings || null,
    },
  };
};

exports.updateUser = async ({ companyId, body, id }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await usersModel
      .findByIdAndUpdate(id, { body }, { new: true })
      .session(session);
    if (!user) throw new Error("User not found");

    if (body.email && !isEmail(body.email)) {
      throw new Error("There is an error in email format");
    }

    const tagIds = safeParse(body.tagIds, []);
    const expenseTagIds = safeParse(body.expenseTagIds, []);
    const purchaseTagIds = safeParse(body.purchaseTagIds, []);
    const salesTagIds = safeParse(body.salesTagIds, []);
    const selectedQuickActions = safeParse(body.selectedQuickActions, []);
    const stocksParsed = safeParse(body.stocks, []);

    let updatedUserDoc = await userCompanySettingsModel.updateOne(
      { companyId, userId: user._id },
      {
        $set: {
          ...body,
          tagIds,
          expenseTagIds,
          purchaseTagIds,
          salesTagIds,
          selectedQuickActions,
          stocks: (stocksParsed || []).map((s) => ({
            stockId: s?.stockId || s,
          })),
        },
      },
      { upsert: true, session },
    );

    await session.commitTransaction();
    session.endSession();

    return { data: { user, updatedUserDoc } };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

exports.deleteUser = async ({ id, companyId }) => {
  const settings = await userCompanySettingsModel.findOneAndUpdate(
    { userId: id, companyId },
    [{ $set: { active: { $not: "$active" } } }],
    { new: true },
  );

  if (!settings) {
    throw new ApiError("User settings not found", 404);
  }

  return settings;
};

exports.updateUserPassword = async ({ companyId, id, body }) => {
  const user = await usersModel.findOneAndUpdate(
    { _id: id, companyId },
    {
      password: await bcrypt.hash(body.newPassword, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    },
  );

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Generate Token
  const token = createToken(user, null, "erp", req.companyId);

  return { data: user, token };
};

exports.reSendPassword = async ({ body }) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const email = body.email;

  try {
    //Generate Password
    const userPass = generatePassword();
    const hashedPassword = await bcrypt.hash(userPass, 12);

    const user = await usersModel.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true },
    );

    await sendEmail({
      email: user.email,
      subject: "Your Account Temporary Password",
      message: `
Dear ${user.name},

A temporary password has been generated for your account.

Temporary Password:
${userPass}

For security reasons, please log in and change your password immediately.

This is an automated message (noreply@smartinb.com). Please do not reply.

Best regards,
System Administration
      `,
    });
    return {
      message: "User Update Password",
      data: user,
    };
  } catch (error) {
    throw error;
  }
};
