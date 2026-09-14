const asyncHandler = require("express-async-handler");

const companyService = require("../../services/CRM/company.service");

// GET ALL

exports.getAllCompanies = asyncHandler(async (req, res, next) => {
  const result = await companyService.getAllCompanies(req);

  res.status(200).json(result);
});

// GET ONE

exports.getOneCompany = asyncHandler(async (req, res, next) => {
  const company = await companyService.getOneCompany(req);

  res.status(200).json({
    status: "success",
    data: company,
  });
});

// CREATE

exports.createCompany = asyncHandler(async (req, res, next) => {
  const company = await companyService.createCompany(req);

  res.status(201).json({
    status: "success",
    data: company,
  });
});

// UPDATE

exports.updateCompany = asyncHandler(async (req, res, next) => {
  const company = await companyService.updateCompany(req);

  res.status(200).json({
    status: "success",
    data: company,
  });
});

// DELETE

exports.deleteCompany = asyncHandler(async (req, res, next) => {
  const message = await companyService.deleteCompany(req);

  res.status(200).json({
    status: "success",
    message,
  });
});
