const dealModel = require("../../models/CRM/dealModel");
const ApiError = require("../../utils/apiError");
const Opportunity = require("../../models/CRM/opportunityModel");
const Company = require("../../models/CRM/companyModel");
const Contact = require("../../models/CRM/contactModel");

const validateOpportunity = async (opportunityId, companyId) => {
  const opportunity = await Opportunity.findOne({
    _id: opportunityId,
    companyId,
    deletedAt: null,
  });

  if (!opportunity) {
    throw new ApiError("Opportunity not found in your company", 404);
  }

  if (opportunity.status !== "won") {
    throw new ApiError(
      "A Deal can only be created from a won Opportunity",
      400,
    );
  }

  if (opportunity.dealId) {
    throw new ApiError("A Deal already exists for this Opportunity", 400);
  }

  return opportunity;
};

const validateCRMCompany = async (crmCompanyId, companyId) => {
  if (!crmCompanyId) {
    return null;
  }

  const crmCompany = await Company.findOne({
    _id: crmCompanyId,
    companyId,
    deletedAt: null,
  });

  if (!crmCompany) {
    throw new ApiError("CRM Company not found in your company", 404);
  }

  return crmCompany;
};

const validateContacts = async (
  contactIds = [],
  companyId,
  crmCompanyId = null,
) => {
  if (!contactIds.length) {
    return [];
  }

  const contacts = await Contact.find({
    _id: { $in: contactIds },
    companyId,
    deletedAt: null,
  });

  if (contacts.length !== contactIds.length) {
    throw new ApiError(
      "One or more contacts were not found in your company",
      404,
    );
  }

  if (crmCompanyId) {
    const hasConflict = contacts.some(
      (contact) =>
        contact.crmCompanyId &&
        contact.crmCompanyId.toString() !== crmCompanyId.toString(),
    );

    if (hasConflict) {
      throw new ApiError(
        "One or more contacts belong to a different CRM Company",
        400,
      );
    }
  }

  return contacts;
};

const calculateProductTotal = (product) => {
  const quantity = Number(product.quantity || 0);
  const unitPrice = Number(product.unitPrice || 0);
  const discount = Number(product.discount || 0);

  const subtotal = quantity * unitPrice;
  const discountAmount = subtotal * (discount / 100);

  return Math.max(0, subtotal - discountAmount);
};

const calculateProducts = (products = []) => {
  return products.map((product) => ({
    ...product,
    total: calculateProductTotal(product),
  }));
};

const handleStatusChange = (updateData) => {
  if (!updateData.status) {
    return;
  }

  if (updateData.status === "completed") {
    const now = new Date();

    updateData.actualDeliveryDate = now;
    updateData.closedAt = now;

    return;
  }

  updateData.actualDeliveryDate = null;
  updateData.closedAt = null;
};

exports.getAllDeals = async (req) => {
  const companyId = req.companyId;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, crmCompanyId, ownerId, opportunityId, from, to } =
    req.query;

  const query = {
    companyId,
    deletedAt: null,
  };

  if (keyword) {
    query.$or = [
      {
        title: {
          $regex: keyword,
          $options: "i",
        },
      },
      {
        description: {
          $regex: keyword,
          $options: "i",
        },
      },
    ];
  }

  if (status) {
    query.status = status;
  }

  if (crmCompanyId) {
    query.crmCompanyId = crmCompanyId;
  }

  if (ownerId) {
    query.ownerId = ownerId;
  }

  if (opportunityId) {
    query.opportunityId = opportunityId;
  }

  if (from || to) {
    query.closedAt = {};

    if (from) {
      query.closedAt.$gte = new Date(from);
    }

    if (to) {
      query.closedAt.$lte = new Date(to);
    }
  }

  const [total, deals] = await Promise.all([
    dealModel.countDocuments(query),

    dealModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email")
      .populate("crmCompanyId", "name industry")
      .populate("opportunityId", "title value status")
      .populate("contactIds", "firstName lastName email"),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: deals.length,
    total,
    data: deals,
  };
};

exports.getOneDeal = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const deal = await dealModel
    .findOne({
      _id: id,
      companyId,
      deletedAt: null,
    })
    .populate("ownerId", "name email")
    .populate("crmCompanyId", "name industry website")
    .populate("opportunityId", "title value status currentStageKey")
    .populate("contactIds", "firstName lastName email phone");

  if (!deal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  return deal;
};

exports.createDeal = async (req) => {
  const companyId = req.companyId;

  const { opportunityId, crmCompanyId, contactIds = [] } = req.body;

  // 1. Validate Opportunity
  const opportunity = await validateOpportunity(opportunityId, companyId);

  // 2. Validate CRM Company
  await validateCRMCompany(crmCompanyId, companyId);

  // 3. Validate Contacts
  await validateContacts(contactIds, companyId, crmCompanyId);

  // 4. Calculate product totals
  const products = calculateProducts(req.body.products || []);

  const payload = {
    ...req.body,
    companyId,
    products,
    closedAt: null,
    ownerId: req.user._id,
    actualDeliveryDate: null,
    deletedAt: null,
  };

  // A newly created Deal must start as pending.
  payload.status = "pending";

  // 5. Create Deal
  const deal = await dealModel.create(payload);

  // 6. Link Deal to Opportunity
  opportunity.dealId = deal._id;
  await opportunity.save();

  return deal;
};

exports.updateDeal = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const deal = await dealModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!deal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  const updateData = {
    ...req.body,
  };

  // These fields cannot be changed through update.
  delete updateData.companyId;
  delete updateData.deletedAt;
  delete updateData.opportunityId;

  // 1. Validate CRM Company if provided
  if (Object.prototype.hasOwnProperty.call(updateData, "crmCompanyId")) {
    await validateCRMCompany(updateData.crmCompanyId, companyId);
  }

  // 2. Validate Contacts if provided
  if (Object.prototype.hasOwnProperty.call(updateData, "contactIds")) {
    await validateContacts(
      updateData.contactIds || [],
      companyId,
      Object.prototype.hasOwnProperty.call(updateData, "crmCompanyId")
        ? updateData.crmCompanyId
        : deal.crmCompanyId,
    );
  }

  // 3. Recalculate products if provided
  if (Object.prototype.hasOwnProperty.call(updateData, "products")) {
    updateData.products = calculateProducts(updateData.products || []);
  }

  // 4. Handle status
  handleStatusChange(updateData);

  // 5. Protect system-managed fields
  delete updateData.companyId;
  delete updateData.deletedAt;

  const updatedDeal = await dealModel.findOneAndUpdate(
    {
      _id: id,
      companyId,
      deletedAt: null,
    },
    updateData,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedDeal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  return updatedDeal;
};

exports.deleteDeal = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const deal = await dealModel.findOneAndUpdate(
    {
      _id: id,
      companyId,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
    },
    {
      new: true,
    },
  );

  if (!deal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  return "Deal deleted successfully";
};
