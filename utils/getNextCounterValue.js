const counterModel = require("../models/Settings/counterModel");

exports.getNextCounterValue = async ({ companyId, name, session }) => {
  const counterDoc = await counterModel.findOneAndUpdate(
    { companyId, name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  return counterDoc.seq;
};
