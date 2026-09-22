const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const contactService = require("../../services/CRM/contact.service");

// ================= GET ALL =================
exports.getAllContacts = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const result = await contactService.getAllContacts(req);
  res.status(200).json(result);
});

// ================= GET ONE =================
exports.getOneContact = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const contact = await contactService.getOneContact(req);

  res.status(200).json({ status: "success", data: contact });
});

// ================= CREATE =================
exports.createContact = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const contact = await contactService.createContact(req);

  res.status(201).json({ status: "success", data: contact });
});

// ================= UPDATE =================
exports.updateContact = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const contact = await contactService.updateContact(req);

  res.status(200).json({ status: "success", data: contact });
});

// ================= DELETE =================
exports.deleteContact = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const message = await contactService.deleteContact(req);

  res.status(200).json({ status: "success", message });
});

// ================= ASSIGN CONTACT TO COMPANY =================

exports.assignContactToCompany = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const contact = await contactService.assignContactToCompany(req);

  res.status(200).json({
    status: "success",
    message: "Contact assigned to company successfully",
    data: contact,
  });
});

// ================= REMOVE CONTACT FROM COMPANY =================

exports.removeContactFromCompany = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const contact = await contactService.removeContactFromCompany(req);

  res.status(200).json({
    status: "success",
    message: "Contact removed from company successfully",
    data: contact,
  });
});

// ================= SET PRIMARY CONTACT =================

exports.setPrimaryContact = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const contact = await contactService.setPrimaryContact(req);

  res.status(200).json({
    status: "success",
    message: "Primary contact updated successfully",
    data: contact,
  });
});
