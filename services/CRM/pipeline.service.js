const pipelineModel = require("../../models/CRM/piplineModel");
const ApiError = require("../../utils/apiError");
const Opportunity = require("../../models/CRM/opportunityModel");

// ============ GET ALL ============
exports.getAllPipelines = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, isActive, isDefault } = req.query;

  const query = { companyId, deletedAt: null };

  if (keyword) {
    query.name = { $regex: keyword, $options: "i" };
  }
  if (isActive !== undefined) query.isActive = isActive === "true";
  if (isDefault !== undefined) query.isDefault = isDefault === "true";

  const [total, pipelines] = await Promise.all([
    pipelineModel.countDocuments(query),
    pipelineModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ isDefault: -1, createdAt: -1 })
      .populate("ownerId", "name email"),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: pipelines.length,
    total,
    data: pipelines,
  };
};

// ============ GET ONE ============
exports.getOnePipeline = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const pipeline = await pipelineModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .populate("ownerId", "name email");

  if (!pipeline) {
    throw new ApiError(`No pipeline found with this ID: ${id}`, 404);
  }

  return pipeline;
};

// ============ CREATE ============
exports.createPipeline = async (req) => {
  const companyId = req.companyId;

  const exists = await pipelineModel.findOne({
    companyId,
    name: req.body.name,
    deletedAt: null,
  });
  if (exists) {
    throw new ApiError("A pipeline with this name already exists", 400);
  }

  if (req.body.isDefault) {
    await pipelineModel.updateMany(
      { companyId, isDefault: true, deletedAt: null },
      { isDefault: false },
    );
  }

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
  };

  const pipeline = await pipelineModel.create(payload);

  return pipeline;
};

// ============ UPDATE ============
exports.updatePipeline = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (req.body.name) {
    const exists = await pipelineModel.findOne({
      companyId,
      name: req.body.name,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (exists) {
      throw new ApiError("A pipeline with this name already exists", 400);
    }
  }

  // If the updated pipeline is set to default, unset the default flag from other pipelines
  if (req.body.isDefault === true) {
    await pipelineModel.updateMany(
      { companyId, isDefault: true, _id: { $ne: id }, deletedAt: null },
      { isDefault: false },
    );
  }

  const updateData = { ...req.body };
  delete updateData.companyId;
  delete updateData.deletedAt;

  const pipeline = await pipelineModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    updateData,
    { new: true, runValidators: true },
  );

  if (!pipeline) {
    throw new ApiError(`No pipeline found with this ID: ${id}`, 404);
  }

  return pipeline;
};

// ============ DELETE (Soft) ============
exports.deletePipeline = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const pipeline = await pipelineModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!pipeline) {
    throw new ApiError(`No pipeline found with this ID: ${id}`, 404);
  }

  if (pipeline.isDefault) {
    throw new ApiError(
      "Cannot delete the default pipeline. Set another as default first.",
      400,
    );
  }

  const oppCount = await Opportunity.countDocuments({
    pipelineId: id,
    companyId,
    deletedAt: null,
  });
  if (oppCount > 0) {
    throw new ApiError(
      `Cannot delete pipeline. It has ${oppCount} opportunities linked to it.`,
      400,
    );
  }

  pipeline.deletedAt = new Date();
  await pipeline.save();

  return "Pipeline deleted successfully";
};
