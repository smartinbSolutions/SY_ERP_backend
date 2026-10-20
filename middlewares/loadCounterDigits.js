// middleware/loadCounterDigits.js

const companySettingModel = require("../models/Settings/CompanyInfo/companySetting.model");

module.exports = async (req, res, next) => {
  try {
    const settings = await companySettingModel
      .findOne({ companyId: req.companyId })
      .select("prefix.counterFormat")
      .lean();
    req.counterDigits = Number(settings?.prefix?.counterFormat) || 4;
    next();
  } catch (err) {
    next(err);
  }
};
