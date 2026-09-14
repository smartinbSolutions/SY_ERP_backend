const leadModel = require("../../models/CRM/leadModel");
const ApiError = require("../../utils/apiError");

// GET ALL

exports.getAllLeads = async (req) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await leadModel.countDocuments();

  const leads = await leadModel
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: leads.length,
    data: leads,
  };
};

// GET ONE

exports.getOneLead = async (req) => {
  const { id } = req.params;

  const lead = await leadModel.findById(id);

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return lead;
};

// CREATE

exports.createLead = async (req) => {
  const lead = await leadModel.create(req.body);

  return lead;
};

// UPDATE

exports.updateLead = async (req) => {
  const { id } = req.params;

  const lead = await leadModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return lead;
};

// DELETE

exports.deleteLead = async (req) => {
  const { id } = req.params;

  const lead = await leadModel.findByIdAndDelete(id);

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return "Lead deleted successfully";
};
