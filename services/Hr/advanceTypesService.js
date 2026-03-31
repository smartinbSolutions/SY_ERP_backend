const AdvanceType = require("../../models/Hr/advanceTypesModel");
const { default: mongoose } = require("mongoose");

exports.createAdvanceType = async (data) => {
  return await AdvanceType.create(data);
};

exports.findOneType = async (filter) => {
  return await AdvanceType.findOne(filter);
};

exports.countTypes = async (query) => {
  return await AdvanceType.countDocuments(query);
};

exports.findTypes = async (query, skip, limit) => {
  return await AdvanceType.find(query)
    .skip(skip)
    .limit(limit)
    .populate({ path: "approvalFlow", select: "name steps createdBy" })
    .sort({ createdAt: -1 });
};

exports.findByIdAndCompany = async (id, companyId) => {
  return await AdvanceType.findOne({ _id: id, companyId });
};

exports.updateByIdAndCompany = async (id, companyId, updates) => {
  return await AdvanceType.findOneAndUpdate({ _id: id, companyId }, updates, {
    new: true,
    runValidators: true,
  });
};

exports.deleteByIdAndCompany = async (id, companyId) => {
  return await AdvanceType.findOneAndDelete({ _id: id, companyId });
};
