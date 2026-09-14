const companyModel = require("../../models/CRM/companyModel");
const ApiError = require("../../utils/apiError");

// GET ALL

exports.getAllCompanies = async (req) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await companyModel.countDocuments();

  const companies = await companyModel
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: companies.length,
    data: companies,
  };
};

// GET ONE

exports.getOneCompany = async (req) => {
  const { id } = req.params;

  const company = await companyModel.findById(id);

  if (!company) {
    throw new ApiError(`No company found with this ID: ${id}`, 404);
  }

  return company;
};

// CREATE

exports.createCompany = async (req) => {
  const company = await companyModel.create(req.body);

  return company;
};

// UPDATE

exports.updateCompany = async (req) => {
  const { id } = req.params;

  const company = await companyModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!company) {
    throw new ApiError(`No company found with this ID: ${id}`, 404);
  }

  return company;
};

// DELETE

exports.deleteCompany = async (req) => {
  const { id } = req.params;

  const company = await companyModel.findByIdAndDelete(id);

  if (!company) {
    throw new ApiError(`No company found with this ID: ${id}`, 404);
  }

  return "Company deleted successfully";
};
