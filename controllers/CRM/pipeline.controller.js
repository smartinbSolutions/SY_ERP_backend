const asyncHandler = require("express-async-handler");

const pipelineService = require("../../services/CRM/pipeline.service");

// GET ALL

exports.getAllPipelines = asyncHandler(async (req, res, next) => {
  const result = await pipelineService.getAllPipelines(req);

  res.status(200).json(result);
});

// GET ONE

exports.getOnePipeline = asyncHandler(async (req, res, next) => {
  const pipeline = await pipelineService.getOnePipeline(req);

  res.status(200).json({
    status: "success",
    data: pipeline,
  });
});

// CREATE

exports.createPipeline = asyncHandler(async (req, res, next) => {
  const pipeline = await pipelineService.createPipeline(req);

  res.status(201).json({
    status: "success",
    data: pipeline,
  });
});

// UPDATE

exports.updatePipeline = asyncHandler(async (req, res, next) => {
  const pipeline = await pipelineService.updatePipeline(req);

  res.status(200).json({
    status: "success",
    data: pipeline,
  });
});

// DELETE

exports.deletePipeline = asyncHandler(async (req, res, next) => {
  const message = await pipelineService.deletePipeline(req);

  res.status(200).json({
    status: "success",
    message,
  });
});
