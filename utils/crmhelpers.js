const companySettingModel = require("../models/Settings/CompanyInfo/companySetting.model");
const counterModel = require("../models/Settings/counterModel");

const CRM_DEFAULTS = {
  lead: { name: "CrmLead", prefix: "C-LD" },
  company: { name: "CrmCompany", prefix: "C-CO" },
  contact: { name: "CrmContact", prefix: "C-CT" },
  opportunity: { name: "CrmOpportunity", prefix: "C-OP" },
  activity: { name: "CrmActivity", prefix: "C-AC" },
  deal: { name: "CrmDeal", prefix: "C-DA" },
};

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
