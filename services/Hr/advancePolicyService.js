const AdvancePolicy = require("../../models/Hr/advancePolicyModel");
const AdvanceType = require("../../models/Hr/advanceTypesModel");
const ApiError = require("../../utils/apiError");
const mongoose = require("mongoose");

// ================= GET ALL =================
exports.getAllPolicies = async ({ companyId, page, limit, keyword }) => {
  const skip = (page - 1) * limit;

  const query = { companyId };

  if (keyword) {
    query.$or = [{ policyName: { $regex: keyword, $options: "i" } }];
  }

  const total = await AdvancePolicy.countDocuments(query);

  const policies = await AdvancePolicy.find(query)
    .skip(skip)
    .limit(limit)
    .populate({
      path: "approvalFlow",
      select: "name steps createdBy",
    })
    .sort({ createdAt: -1 });

  return {
    policies,
    total,
  };
};

// ================= GET ONE =================
exports.getPolicyById = async (companyId, id) => {
  const policy = await AdvancePolicy.findOne({ _id: id, companyId }).populate({
    path: "approvalFlow",
    select: "name",
  });

  if (!policy) {
    throw new ApiError(`No policy found with ID: ${id}`, 404);
  }

  return policy;
};

// ================= CREATE =================
exports.createPolicy = async ({
  companyId,
  policyName,
  code,
  types,
  approvalFlow,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const exists = await AdvancePolicy.findOne({
      companyId,
      policyName,
    }).session(session);

    if (exists) {
      throw new ApiError("Policy name already exists", 400);
    }

    const policy = await AdvancePolicy.create(
      [
        {
          policyName,
          code,
          companyId,
          approvalFlow,
        },
      ],
      { session },
    );

    let createdTypes = [];

    if (types?.length) {
      const docs = types.map((type) => ({
        policyId: policy[0]._id,
        companyId,
        typeKey: type.typeKey,
        maxPercentageOfSalary: type.maxPercentageOfSalary,
        approvalFlow: type.approvalFlow,
        requiresAttachment: type.requiresAttachment ?? false,
        allowInstallments: type.allowInstallments ?? false,
        maxMonthsInstallments: type.maxMonthsInstallments ?? null,
        maxInstallmentPercentage: type.maxInstallmentPercentage ?? 1,
        minMonthsAfterJoin: type.minMonthsAfterJoin ?? 3,
      }));

      createdTypes = await AdvanceType.insertMany(docs, { session });
    }

    await session.commitTransaction();
    session.endSession();

    return {
      policy: policy[0],
      types: createdTypes,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

// ================= UPDATE =================
exports.updatePolicy = async (companyId, id, body) => {
  if (body.policyName) {
    const exists = await AdvancePolicy.findOne({
      companyId,
      policyName: body.policyName,
      _id: { $ne: id },
    });

    if (exists) {
      throw new ApiError("Policy name already exists", 400);
    }
  }

  const updateData = {};

  if (body.policyName !== undefined) updateData.policyName = body.policyName;

  if (body.code !== undefined) updateData.code = body.code;

  const policy = await AdvancePolicy.findOneAndUpdate(
    { _id: id, companyId },
    updateData,
    { new: true, runValidators: true },
  );

  if (!policy) {
    throw new ApiError(`No policy found with ID: ${id}`, 404);
  }

  return policy;
};

// ================= DELETE =================
exports.deletePolicy = async (companyId, id) => {
  const policy = await AdvancePolicy.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!policy) {
    throw new ApiError(`No policy found with ID: ${id}`, 404);
  }

  await AdvanceType.deleteMany({ policyId: id });

  return true;
};
