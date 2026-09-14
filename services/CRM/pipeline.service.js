const pipelineModel = require("../../models/CRM/piplineModel");
const ApiError = require("../../utils/apiError");

// GET ALL

exports.getAllPipelines = async (req) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await pipelineModel.countDocuments();

  const pipelines = await pipelineModel
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: pipelines.length,
    data: pipelines,
  };
};

// GET ONE

exports.getOnePipeline = async (req) => {
  const { id } = req.params;

  const pipeline = await pipelineModel.findById(id);

  if (!pipeline) {
    throw new ApiError(`No pipeline found with this ID: ${id}`, 404);
  }

  return pipeline;
};

// CREATE

exports.createPipeline = async (req) => {
  const pipeline = await pipelineModel.create(req.body);

  return pipeline;
};

// UPDATE

exports.updatePipeline = async (req) => {
  const { id } = req.params;

  const pipeline = await pipelineModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!pipeline) {
    throw new ApiError(`No pipeline found with this ID: ${id}`, 404);
  }

  return pipeline;
};

// DELETE

exports.deletePipeline = async (req) => {
  const { id } = req.params;

  const pipeline = await pipelineModel.findByIdAndDelete(id);

  if (!pipeline) {
    throw new ApiError(`No pipeline found with this ID: ${id}`, 404);
  }

  return "Pipeline deleted successfully";
};
