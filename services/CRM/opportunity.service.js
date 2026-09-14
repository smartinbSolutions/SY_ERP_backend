const opportunityModel = require("../../models/CRM/opportunityModel");
const ApiError = require("../../utils/apiError");

// GET ALL

exports.getAllOpportunities = async (req) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await opportunityModel.countDocuments();

  const opportunities = await opportunityModel
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: opportunities.length,
    data: opportunities,
  };
};

// GET ONE

exports.getOneOpportunity = async (req) => {
  const { id } = req.params;

  const opportunity = await opportunityModel.findById(id);

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return opportunity;
};

// CREATE

exports.createOpportunity = async (req) => {
  const opportunity = await opportunityModel.create(req.body);

  return opportunity;
};

// UPDATE

exports.updateOpportunity = async (req) => {
  const { id } = req.params;

  const opportunity = await opportunityModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return opportunity;
};

// DELETE

exports.deleteOpportunity = async (req) => {
  const { id } = req.params;

  const opportunity = await opportunityModel.findByIdAndDelete(id);

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return "Opportunity deleted successfully";
};
