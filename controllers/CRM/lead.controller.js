const asyncHandler = require("express-async-handler");
const leadService = require("../../services/CRM/lead.service");

// GET ALL

exports.getAllLeads = asyncHandler(async (req, res, next) => {
  const result = await leadService.getAllLeads(req);

  res.status(200).json(result);
});

// GET ONE

exports.getOneLead = asyncHandler(async (req, res, next) => {
  const lead = await leadService.getOneLead(req);

  res.status(200).json({
    status: "success",
    data: lead,
  });
});

// CREATE

exports.createLead = asyncHandler(async (req, res, next) => {
  const lead = await leadService.createLead(req);

  res.status(201).json({
    status: "success",
    data: lead,
  });
});

// UPDATE

exports.updateLead = asyncHandler(async (req, res, next) => {
  const lead = await leadService.updateLead(req);

  res.status(200).json({
    status: "success",
    data: lead,
  });
});

// DELETE

exports.deleteLead = asyncHandler(async (req, res, next) => {
  const message = await leadService.deleteLead(req);

  res.status(200).json({
    status: "success",
    message,
  });
});
