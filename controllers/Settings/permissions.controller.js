const asyncHandler = require("express-async-handler");
const permissionService = require("../../services/Settings/permissions.service");
const companyPlanModel = require("../../models/Settings/CompanyInfo/companyPlan.model");

exports.getPermissions = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  const plan = await companyPlanModel.findOne({ companyId });
  const features = plan?.features || {};

  const grouped = await permissionService.getGroupedPermissions(features);

  res.status(200).json({
    status: true,
    data: grouped,
  });
});
