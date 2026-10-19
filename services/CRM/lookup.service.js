const companyModel = require("../../models/CRM/companyModel");
const { LOOKUP_TYPES } = require("../../models/CRM/Lookup");
const lookupModel = require("../../models/CRM/Lookup");

const ApiError = require("../../utils/apiError");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SELECT = "type name nameAr nameTr isActive";

const assertType = (type) => {
  if (!LOOKUP_TYPES.includes(type)) {
    throw new ApiError(
      `Invalid type. Allowed: ${LOOKUP_TYPES.join(", ")}`,
      400,
    );
  }
};

// Which company fields point to each lookup type.
const USAGE_FIELD = {
  industry: "industryIds",
  classification: "classificationId",
};

// ======================================================
// LIST
// ======================================================

exports.getAllLookups = async (req) => {
  const companyId = req.companyId;
  const { type, keyword, includeInactive } = req.query;

  assertType(type);

  const filter = { companyId, type, deletedAt: null };

  // Selects show active values only. Settings pages can ask for all.
  if (includeInactive !== "true") filter.isActive = true;

  if (keyword?.trim()) {
    const regex = new RegExp(escapeRegex(keyword.trim()), "i");
    filter.$or = [{ name: regex }, { nameAr: regex }, { nameTr: regex }];
  }

  return lookupModel.find(filter).select(SELECT).sort({ name: 1 }).lean();
};

// ======================================================
// GET ONE
// ======================================================

exports.getOneLookup = async (req) => {
  const { id } = req.params;

  const lookup = await lookupModel
    .findOne({ _id: id, companyId: req.companyId, deletedAt: null })
    .select(SELECT)
    .lean();

  if (!lookup) {
    throw new ApiError(`No lookup found with this ID: ${id}`, 404);
  }

  return lookup;
};

// ======================================================
// CREATE
// ======================================================

exports.createLookup = async (req) => {
  const companyId = req.companyId;
  const { type } = req.body;

  assertType(type);

  const name = req.body.name?.trim();
  if (!name) throw new ApiError("Name is required", 400);

  const exists = await lookupModel
    .findOne({
      companyId,
      type,
      deletedAt: null,
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    })
    .select("_id")
    .lean();

  if (exists) {
    throw new ApiError("This value already exists", 400);
  }

  try {
    return await lookupModel.create({
      companyId,
      type,
      name,
      ...(req.body.nameAr?.trim() ? { nameAr: req.body.nameAr.trim() } : {}),
      ...(req.body.nameTr?.trim() ? { nameTr: req.body.nameTr.trim() } : {}),
    });
  } catch (err) {
    // Two requests created the same name at the same time.
    if (err?.code === 11000) {
      throw new ApiError("This value already exists", 400);
    }
    throw err;
  }
};

// ======================================================
// UPDATE
// ======================================================

exports.updateLookup = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const existing = await lookupModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .select("_id type")
    .lean();

  if (!existing) {
    throw new ApiError(`No lookup found with this ID: ${id}`, 404);
  }

  // Only these fields can change. The type is fixed after creation.
  const updateData = {};

  if ("name" in req.body) {
    const name = req.body.name?.trim();
    if (!name) throw new ApiError("Name is required", 400);

    const duplicate = await lookupModel
      .findOne({
        companyId,
        type: existing.type,
        deletedAt: null,
        _id: { $ne: id },
        name: new RegExp(`^${escapeRegex(name)}$`, "i"),
      })
      .select("_id")
      .lean();

    if (duplicate) throw new ApiError("This value already exists", 400);

    updateData.name = name;
  }

  if ("nameAr" in req.body) updateData.nameAr = req.body.nameAr?.trim() || "";
  if ("nameTr" in req.body) updateData.nameTr = req.body.nameTr?.trim() || "";
  if ("isActive" in req.body) updateData.isActive = Boolean(req.body.isActive);

  try {
    return await lookupModel.findOneAndUpdate(
      { _id: id, companyId, deletedAt: null },
      updateData,
      { new: true, runValidators: true },
    );
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError("This value already exists", 400);
    }
    throw err;
  }
};

// ======================================================
// DELETE (soft)
// ======================================================

exports.deleteLookup = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lookup = await lookupModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .select("_id type")
    .lean();

  if (!lookup) {
    throw new ApiError(`No lookup found with this ID: ${id}`, 404);
  }

  // Block deletion while a company uses this value.
  // strictQuery is off so this safely returns 0 until the Company
  // schema has these fields (otherwise Mongoose would drop the filter).
  const inUse = await companyModel
    .countDocuments({
      companyId,
      deletedAt: null,
      [USAGE_FIELD[lookup.type]]: id,
    })
    .setOptions({ strictQuery: false });

  if (inUse > 0) {
    throw new ApiError(
      `This value is used by ${inUse} compan${inUse === 1 ? "y" : "ies"}. Deactivate it instead.`,
      400,
    );
  }

  await lookupModel.updateOne(
    { _id: id, companyId },
    { deletedAt: new Date() },
  );

  return "Lookup deleted successfully";
};
