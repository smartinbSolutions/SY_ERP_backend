const asyncHandler = require("express-async-handler");

const contactService = require("../../services/CRM/contact.service");

// GET ALL

exports.getAllContacts = asyncHandler(async (req, res, next) => {
  const result = await contactService.getAllContacts(req);

  res.status(200).json(result);
});

// GET ONE

exports.getOneContact = asyncHandler(async (req, res, next) => {
  const contact = await contactService.getOneContact(req);

  res.status(200).json({
    status: "success",
    data: contact,
  });
});

// CREATE

exports.createContact = asyncHandler(async (req, res, next) => {
  const contact = await contactService.createContact(req);

  res.status(201).json({
    status: "success",
    data: contact,
  });
});

// UPDATE

exports.updateContact = asyncHandler(async (req, res, next) => {
  const contact = await contactService.updateContact(req);

  res.status(200).json({
    status: "success",
    data: contact,
  });
});

// DELETE

exports.deleteContact = asyncHandler(async (req, res, next) => {
  const message = await contactService.deleteContact(req);

  res.status(200).json({
    status: "success",
    message,
  });
});
