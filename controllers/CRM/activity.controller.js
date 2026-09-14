const asyncHandler = require("express-async-handler");

const activityService = require("../../services/CRM/activity.service");

// GET ALL

exports.getAllActivities = asyncHandler(async (req, res, next) => {
  const result = await activityService.getAllActivities(req);

  res.status(200).json(result);
});

// GET ONE

exports.getOneActivity = asyncHandler(async (req, res, next) => {
  const activity = await activityService.getOneActivity(req);

  res.status(200).json({
    status: "success",
    data: activity,
  });
});

// CREATE

exports.createActivity = asyncHandler(async (req, res, next) => {
  const activity = await activityService.createActivity(req);

  res.status(201).json({
    status: "success",
    data: activity,
  });
});

// UPDATE

exports.updateActivity = asyncHandler(async (req, res, next) => {
  const activity = await activityService.updateActivity(req);

  res.status(200).json({
    status: "success",
    data: activity,
  });
});

// DELETE

exports.deleteActivity = asyncHandler(async (req, res, next) => {
  const message = await activityService.deleteActivity(req);

  res.status(200).json({
    status: "success",
    message,
  });
});
