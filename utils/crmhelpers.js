const contactModel = require("../models/CRM/contactModel");
const companySettingModel = require("../models/Settings/CompanyInfo/companySetting.model");
const counterModel = require("../models/Settings/counterModel");
const ApiError = require("./apiError");

const CRM_DEFAULTS = {
  lead: { name: "CrmLead", prefix: "C-LD" },
  company: { name: "CrmCompany", prefix: "C-CO" },
  contact: { name: "CrmContact", prefix: "C-CT" },
  opportunity: { name: "CrmOpportunity", prefix: "C-OP" },
  activity: { name: "CrmActivity", prefix: "C-AC" },
  deal: { name: "CrmDeal", prefix: "C-DA" },
};

// ----------------------------------------------------
// Auto number: prefix (from company settings) + counter
// ----------------------------------------------------
exports.generateCrmNumber = async (companyId, key, session) => {
  const { name, prefix: defaultPrefix } = CRM_DEFAULTS[key];

  const settings = await companySettingModel
    .findOne({ companyId })
    .select("prefix")
    .session(session || null)
    .lean();

  const prefix = settings?.prefix?.[key] || defaultPrefix;
  const digits = settings?.prefix?.counterFormat || 4;

  const counter = await counterModel.findOneAndUpdate(
    { companyId, name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  return `${prefix}-${String(counter.seq).padStart(digits, "0")}`;
};

// ----------------------------------------------------
// Decides isPrimary for a new contact and clears the
// old primary of the company if the new one replaces it
// ----------------------------------------------------
exports.resolveIsPrimary = async (
  companyId,
  crmCompanyId,
  requested,
  session,
) => {
  if (!crmCompanyId) {
    if (requested) {
      throw new ApiError("A primary contact must belong to a company", 400);
    }
    return false;
  }

  const currentPrimary = await contactModel
    .findOne({ companyId, crmCompanyId, isPrimary: true, deletedAt: null })
    .select("_id")
    .session(session || null)
    .lean();

  // first contact of the company becomes primary automatically
  if (!currentPrimary) return true;

  if (requested) {
    await contactModel.updateOne(
      { _id: currentPrimary._id },
      { $set: { isPrimary: false } },
      { session },
    );
    return true;
  }

  return false;
};
