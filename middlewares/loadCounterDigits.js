// middleware/loadCounterDigits.js
const companySettingModel = require("../models/Settings/CompanyInfo/companySetting.model");
const { buildBase } = require("../utils/buildBase");

module.exports = async (req, res, next) => {
  try {
    const settings = await companySettingModel
      .findOne({ companyId: req.companyId })
      .select("prefix.counterFormat prefix.dateFormat")
      .lean();

    const digits = Number(settings?.prefix?.counterFormat) || 4;
    const dateFormat = settings?.prefix?.dateFormat || "YYYYMMDD";

    req.counterDigits = digits;
    req.counterBase = buildBase({ dateFormat, digits });
    next();
  } catch (err) {
    next(err);
  }
};
