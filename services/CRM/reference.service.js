const leadModel = require("../../models/CRM/leadModel");
const referenceModel = require("../../models/CRM/referenceModel");
const ApiError = require("../../utils/apiError");
const { generateCrmNumber } = require("../../utils/crmhelpers");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const REFERENCE_TYPES = ["person", "company", "partner"];
const SELECT = "name type phone whatsApp email notes number status";

// ======================================================
// LIST
// ======================================================

exports.getAllReferences = async (req) => {
  const companyId = req.companyId;
  const keyword = (req.query.keyword || "").trim();
  const limit = Math.min(Number(req.query.limit) || 50, 1000);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const filter = { companyId, deletedAt: null };

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), "i");
    filter.$or = [
      { name: regex },
      { phone: regex },
      { email: regex },
      { number: regex },
    ];
  }

  return referenceModel
    .find(filter)
    .select(SELECT)
    .sort({ name: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

// ======================================================
// GET ONE
// ======================================================

exports.getOneReference = async (req) => {
  const { id } = req.params;

  const reference = await referenceModel
    .findOne({ _id: id, companyId: req.companyId, deletedAt: null })
    .select(SELECT)
    .lean();

  if (!reference) {
    throw new ApiError(`No reference found with this ID: ${id}`, 404);
  }

  return reference;
};

// ======================================================
// CREATE
// ======================================================

exports.createReference = async (req) => {
  const companyId = req.companyId;
  const body = req.body;

  const name = body.name?.trim();
  if (!name) throw new ApiError("Reference name is required", 400);

  const phone = body.phone?.trim();
  const email = body.email?.trim().toLowerCase();

  // Block duplicates by phone or email.
  const matchers = [];
  if (phone) matchers.push({ phone });
  if (email) matchers.push({ email });

  if (matchers.length) {
    const exists = await referenceModel
      .findOne({ companyId, deletedAt: null, $or: matchers })
      .select("_id")
      .lean();

    if (exists) {
      throw new ApiError(
        "A reference with this phone or email already exists",
        400,
      );
    }
  }

  return referenceModel.create({
    companyId,
    name,
    type: REFERENCE_TYPES.includes(body.type) ? body.type : "person",
    ...(phone ? { phone } : {}),
    ...(body.whatsApp?.trim() ? { whatsApp: body.whatsApp.trim() } : {}),
    ...(email ? { email } : {}),
    ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
    number: await generateCrmNumber(companyId, "reference"),
  });
};

// ======================================================
// UPDATE
// ======================================================

exports.updateReference = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const existing = await referenceModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .select("_id")
    .lean();

  if (!existing) {
    throw new ApiError(`No reference found with this ID: ${id}`, 404);
  }

  const updateData = { ...req.body };

  // Protected fields.
  delete updateData.companyId;
  delete updateData.number;
  delete updateData.deletedAt;

  if ("name" in updateData && !updateData.name?.trim()) {
    throw new ApiError("Reference name is required", 400);
  }

  if (updateData.email)
    updateData.email = updateData.email.trim().toLowerCase();

  // Block duplicates against other references.
  const matchers = [];
  if (updateData.phone?.trim())
    matchers.push({ phone: updateData.phone.trim() });
  if (updateData.email) matchers.push({ email: updateData.email });

  if (matchers.length) {
    const duplicate = await referenceModel
      .findOne({
        companyId,
        deletedAt: null,
        _id: { $ne: id },
        $or: matchers,
      })
      .select("_id")
      .lean();

    if (duplicate) {
      throw new ApiError(
        "A reference with this phone or email already exists",
        400,
      );
    }
  }

  return referenceModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    updateData,
    { new: true, runValidators: true },
  );
};

// ======================================================
// DELETE (soft)
// ======================================================

exports.deleteReference = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const inUse = await leadModel.countDocuments({
    companyId,
    referenceId: id,
    deletedAt: null,
  });

  if (inUse > 0) {
    throw new ApiError(
      `This reference is used by ${inUse} lead(s) and cannot be deleted`,
      400,
    );
  }

  const reference = await referenceModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  );

  if (!reference) {
    throw new ApiError(`No reference found with this ID: ${id}`, 404);
  }

  return "Reference deleted successfully";
};
