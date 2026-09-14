const dealModel = require("../../models/CRM/dealModel");
const ApiError = require("../../utils/apiError");

// GET ALL

exports.getAllDeals = async (req) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await dealModel.countDocuments();

  const deals = await dealModel
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: deals.length,
    data: deals,
  };
};

// GET ONE

exports.getOneDeal = async (req) => {
  const { id } = req.params;

  const deal = await dealModel.findById(id);

  if (!deal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  return deal;
};

// CREATE

exports.createDeal = async (req) => {
  const deal = await dealModel.create(req.body);

  return deal;
};

// UPDATE

exports.updateDeal = async (req) => {
  const { id } = req.params;

  const deal = await dealModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!deal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  return deal;
};

// DELETE

exports.deleteDeal = async (req) => {
  const { id } = req.params;

  const deal = await dealModel.findByIdAndDelete(id);

  if (!deal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  return "Deal deleted successfully";
};
