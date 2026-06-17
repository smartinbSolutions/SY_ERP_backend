const userCompanySettingsModel = require("../../models/Settings/user_company_settings.model");
const isEmail = require("../../utils/tools/isEmail");
const sendEmail = require("../../utils/sendEmail");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const safeParse = require("../../utils/tools/safeParse");
const generatePassword = require("../../utils/tools/generatePassword");
const ApiError = require("../../utils/apiError");
const usersModel = require("../../models/Settings/users.model");
const companyInfoModel = require("../../models/Settings/CompanyInfo/companyInfo.model");
const rolesModel = require("../../models/Settings/role.model");

const parseArray = (value) => {
  const parsed = safeParse(value, value);
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [];
};

const parseBoolean = (value) => value === true || value === "true";

const getRoleIdFromBody = (body) => body.roleId || body.selectedRoles;

const toObjectIdList = (value) =>
  parseArray(value)
    .map((item) => {
      if (typeof item === "string") return item;
      return item?._id || item?.id || item?.stockId;
    })
    .filter(Boolean);

const toStockList = (value) =>
  parseArray(value)
    .map((item) => ({
      stockId: typeof item === "string" ? item : item?.stockId || item?.id,
    }))
    .filter((item) => item.stockId);

const mapTag = (tag) => ({
  id: tag?._id || tag?.id,
  _id: tag?._id || tag?.id,
  name: tag?.tagName || tag?.name,
  tagName: tag?.tagName || tag?.name,
});

const mapStock = (stock) => ({
  stockId: stock?.stockId?._id || stock?.stockId,
  id: stock?.stockId?._id || stock?.stockId,
  stockName: stock?.stockId?.name || stock?.stockName,
  name: stock?.stockId?.name || stock?.stockName,
});

const flattenUserForCompany = (user, settings = null) => {
  const userObject = user.toObject ? user.toObject() : user;
  const settingsObject = settings?.toObject ? settings.toObject() : settings;
  const companyData = (userObject.companies || []).find(
    (company) => String(company.companyId) === String(settingsObject?.companyId)
  );
  const selectedRole = companyData?.roleId || null;
  const active = settingsObject?.active ?? companyData?.active ?? true;

  return {
    ...userObject,
    selectedRoles: selectedRole,
    roleId: selectedRole?._id || selectedRole || null,
    settings: settingsObject || null,
    active,
    status: settingsObject?.status || (active ? "active" : "inactive"),
    selectedQuickActions: settingsObject?.selectedQuickActions || [],
    PosUser: Boolean(settingsObject?.salesPoint),
    salesPoint:
      settingsObject?.salesPoint?._id || settingsObject?.salesPoint || "",
    tags: (settingsObject?.tagIds || []).map(mapTag),
    expenseTags: (settingsObject?.expenseTagIds || []).map(mapTag),
    purchaseTags: (settingsObject?.purchaseTagIds || []).map(mapTag),
    salesTags: (settingsObject?.salesTagIds || []).map(mapTag),
    stocks: (settingsObject?.stocks || []).map(mapStock),
  };
};

const hasAny = (body, keys) => keys.some((key) => body[key] !== undefined);

const buildSettingsPayload = (body, { partial = false } = {}) => {
  const isPosUser = parseBoolean(body.PosUser);
  const payload = {};

  if (!partial || body.PosUser !== undefined || body.salesPoint !== undefined) {
    payload.salesPoint = isPosUser && body.salesPoint ? body.salesPoint : null;
  }

  if (!partial || hasAny(body, ["tagIds", "tags", "PosUser"])) {
    payload.tagIds = isPosUser ? [] : toObjectIdList(body.tagIds || body.tags);
  }

  if (!partial || hasAny(body, ["expenseTagIds", "expenseTags", "PosUser"])) {
    payload.expenseTagIds = isPosUser
      ? []
      : toObjectIdList(body.expenseTagIds || body.expenseTags);
  }

  if (!partial || hasAny(body, ["purchaseTagIds", "purchaseTags", "PosUser"])) {
    payload.purchaseTagIds = isPosUser
      ? []
      : toObjectIdList(body.purchaseTagIds || body.purchaseTags);
  }

  if (!partial || hasAny(body, ["salesTagIds", "salesTags", "PosUser"])) {
    payload.salesTagIds = isPosUser
      ? []
      : toObjectIdList(body.salesTagIds || body.salesTags);
  }

  if (!partial || body.selectedQuickActions !== undefined) {
    payload.selectedQuickActions = parseArray(body.selectedQuickActions);
  }

  if (!partial || hasAny(body, ["stocks", "PosUser"])) {
    payload.stocks = isPosUser ? [] : toStockList(body.stocks);
  }

  if (body.active !== undefined) {
    payload.active = parseBoolean(body.active);
  }

  if (body.status !== undefined) {
    payload.status = body.status;
  }

  return payload;
};

const validateRole = async ({ roleId, companyId, session }) => {
  if (!roleId) {
    throw new ApiError("roleId is required", 400);
  }
  if (!mongoose.Types.ObjectId.isValid(roleId)) {
    throw new ApiError("Invalid roleId", 400);
  }

  const role = await rolesModel
    .findOne({ _id: roleId, companyId })
    .session(session);
  if (!role) {
    throw new ApiError("Role not found", 404);
  }

  return role;
};

exports.checkUserLimit = async (companyId) => {
  const company = await companyInfoModel.findById(companyId).populate({
    path: "currentSubscription",
    populate: { path: "planId" },
  });

  if (!company?.currentSubscription?.planId) {
    throw new ApiError("Company subscription plan not found", 404);
  }
  const plan = company.currentSubscription.planId;

  const usersCount = await usersModel.countDocuments({
    companies: { $elemMatch: { companyId } },
  });

  if (usersCount >= plan.maxUsers) {
    throw new ApiError("User limit reached for this plan", 400);
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
    .select("userId salesPoint selectedQuickActions stocks status active")
    .lean();

  const settingsMap = new Map(settings.map((s) => [String(s.userId), s]));

  const data = users.map((u) =>
    flattenUserForCompany(u, {
      ...(settingsMap.get(String(u._id)) || {}),
      companyId,
    })
  );

  return { pages: totalPages, results: totalItems, data };
};

exports.createUser = async ({ companyId, body }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const email = body.email;
    if (!isEmail(email)) throw new Error("There is an error in email format");
    const roleId = getRoleIdFromBody(body);

    const findUser = await usersModel.findOne({ email }).session(session);
    const company = await companyInfoModel.findById(companyId).session(session);
    if (!company) throw new Error("Company not found");
    await validateRole({ roleId, companyId, session });

    let userDoc;
    let userPass;
    const settingsPayload = buildSettingsPayload(body, { partial: true });

    if (!findUser) {
      userPass = generatePassword();
      const password = await bcrypt.hash(userPass, 12);

      const created = await usersModel.create(
        [
          {
            name: body.name,
            email,
            phone: body.phone,
            image: body.image,
            AdditionalInfo: body.AdditionalInfo,
            password,
            companies: [
              {
                companyId,
                roleId,
                companyName: company.companyName,
              },
            ],
          },
        ],
        { session }
      );
      userDoc = created[0];

      await userCompanySettingsModel.create(
        [
          {
            companyId,
            userId: userDoc._id,
            ...settingsPayload,
            status: "active",
          },
        ],
        { session }
      );
    } else {
      const existingCompany = findUser.companies?.some(
        (companyEntry) => String(companyEntry.companyId) === String(companyId)
      );

      if (existingCompany) {
        throw new ApiError("User already exists in this company", 400);
      }

      userDoc = await usersModel.findByIdAndUpdate(
        findUser._id,
        {
          $push: {
            companies: {
              companyId,
              roleId,
              companyName: company.companyName,
            },
          },
        },
        { new: true, session }
      );

      await userCompanySettingsModel.updateOne(
        { companyId, userId: userDoc._id },
        {
          $setOnInsert: {
            companyId,
            userId: userDoc._id,
            ...settingsPayload,
            status: "active",
          },
        },
        { upsert: true, session }
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
      "companies.companyId": String(companyId),
    })
    .populate({ path: "companies.roleId", select: "name _id channels" })
    .select("-password -createdAt -updatedAt")
    .lean();

  if (!user) {
    throw new ApiError(`No user by this id ${id}`, 404);
  }

  const companyData = (user.companies || []).find(
    (c) => String(c.companyId) === String(companyId)
  );

  if (!companyData?.roleId) {
    throw new ApiError("User has no selected role in this company", 400);
  }

  const settings = await userCompanySettingsModel
    .findOne({ companyId: String(companyId), userId: user._id })
    .select(
      "salesPoint selectedQuickActions stocks status active tagIds expenseTagIds purchaseTagIds salesTagIds"
    )
    .populate("tagIds expenseTagIds purchaseTagIds salesTagIds")
    .populate("stocks.stockId", "name _id")
    .lean();

  return {
    data: flattenUserForCompany(user, { ...(settings || {}), companyId }),
  };
};

exports.updateUser = async ({ companyId, body, id }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const roleId = getRoleIdFromBody(body);
    if (roleId) {
      await validateRole({ roleId, companyId, session });
    }

    if (body.email && !isEmail(body.email)) {
      throw new Error("There is an error in email format");
    }

    const userSet = {};
    if (body.name !== undefined) userSet.name = body.name;
    if (body.phone !== undefined) userSet.phone = body.phone;
    if (body.image !== undefined) userSet.image = body.image;
    if (body.AdditionalInfo !== undefined) {
      userSet.AdditionalInfo = body.AdditionalInfo;
    }
    if (body.email !== undefined) userSet.email = body.email;
    if (roleId) userSet["companies.$.roleId"] = roleId;

    const user = await usersModel
      .findOneAndUpdate(
        { _id: id, "companies.companyId": String(companyId) },
        { $set: userSet },
        { new: true, session }
      )
      .populate({ path: "companies.roleId", select: "name _id channels" });
    if (!user) throw new Error("User not found");

    const settingsPayload = buildSettingsPayload(body, { partial: true });
    Object.keys(settingsPayload).forEach((key) => {
      if (settingsPayload[key] === undefined) delete settingsPayload[key];
    });

    const updatedSettings = await userCompanySettingsModel.findOneAndUpdate(
      { companyId, userId: user._id },
      {
        $set: {
          companyId,
          userId: user._id,
          ...settingsPayload,
        },
      },
      { upsert: true, new: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    return { data: flattenUserForCompany(user, updatedSettings) };
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
    { new: true }
  );

  if (!settings) {
    throw new ApiError("User settings not found", 404);
  }

  return settings;
};

exports.updateUserPassword = async ({ companyId, id, body }) => {
  const user = await usersModel.findOneAndUpdate(
    { _id: id, "companies.companyId": String(companyId) },
    {
      password: await bcrypt.hash(body.newPassword, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    }
  );

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  return { data: user };
};

exports.reSendPassword = async ({ body, email }) => {
  try {
    const userPass = body.password || generatePassword();
    const hashedPassword = await bcrypt.hash(userPass, 12);

    const user = await usersModel.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    if (!body.password) {
      await sendEmail({
        email: user.email,
        subject: "🔐 Password Reset - SmartERP",
        message: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                
                <tr>
                  <td style="background:#1a73e8;padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">SmartERP</h1>
                    <p style="margin:6px 0 0;color:#c8dffe;font-size:13px;">Password Reset</p>
                  </td>
                </tr>
      
                <tr>
                  <td style="padding:36px 40px;">
                    <p style="margin:0 0 8px;font-size:15px;color:#333;">Dear <strong>${
                      user.name
                    }</strong>,</p>
                    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
                      Your password has been reset. Use the new password below to log in to your account.
                    </p>
      
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                      <tr>
                        <td style="background:#f0f4ff;border:1px dashed #1a73e8;border-radius:6px;padding:20px;text-align:center;">
                          <p style="margin:0 0 6px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">New Password</p>
                          <p style="margin:0;font-size:26px;font-weight:700;color:#1a73e8;letter-spacing:3px;">${userPass}</p>
                        </td>
                      </tr>
                    </table>
      
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                      <tr>
                        <td style="background:#fde8e8;border-left:4px solid #e53935;border-radius:4px;padding:14px 16px;">
                          <p style="margin:0;font-size:13px;color:#a00;">
                            🔒 If you did not request this reset, contact your administrator immediately.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
      
                <tr>
                  <td style="background:#f9f9f9;padding:20px 40px;border-top:1px solid #eee;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#aaa;">
                      This is an automated message — please do not reply.<br/>
                      © ${new Date().getFullYear()} SmartERP · noreply@smartinb.com
                    </p>
                  </td>
                </tr>
      
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
        `,
      });
    }

    return {
      message: "User Update Password",
      data: user,
    };
  } catch (error) {
    throw error;
  }
};
