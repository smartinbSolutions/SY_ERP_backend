const contactModel = require("../../models/CRM/contactModel");
const ApiError = require("../../utils/apiError");

// GET ALL

exports.getAllContacts = async (req) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await contactModel.countDocuments();

  const contacts = await contactModel
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: contacts.length,
    data: contacts,
  };
};

// GET ONE

exports.getOneContact = async (req) => {
  const { id } = req.params;

  const contact = await contactModel.findById(id);

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  return contact;
};

// CREATE

exports.createContact = async (req) => {
  const contact = await contactModel.create(req.body);

  return contact;
};

// UPDATE

exports.updateContact = async (req) => {
  const { id } = req.params;

  const contact = await contactModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  return contact;
};

// DELETE

exports.deleteContact = async (req) => {
  const { id } = req.params;

  const contact = await contactModel.findByIdAndDelete(id);

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  return "Contact deleted successfully";
};
