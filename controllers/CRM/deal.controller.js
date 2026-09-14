const asyncHandler = require("express-async-handler");

const dealService = require("../../services/CRM/deal.service");

// GET ALL

exports.getAllDeals = asyncHandler(async (req, res, next) => {
  const result = await dealService.getAllDeals(req);

  res.status(200).json(result);
});

// GET ONE

exports.getOneDeal = asyncHandler(async (req, res, next) => {
  const deal = await dealService.getOneDeal(req);

  res.status(200).json({
    status: "success",
    data: deal,
  });
});

// CREATE

exports.createDeal = asyncHandler(async (req, res, next) => {
  const deal = await dealService.createDeal(req);

  res.status(201).json({
    status: "success",
    data: deal,
  });
});

// UPDATE

exports.updateDeal = asyncHandler(async (req, res, next) => {
  const deal = await dealService.updateDeal(req);

  res.status(200).json({
    status: "success",
    data: deal,
  });
});

// DELETE

exports.deleteDeal = asyncHandler(async (req, res, next) => {
  const message = await dealService.deleteDeal(req);

  res.status(200).json({
    status: "success",
    message,
  });
});
