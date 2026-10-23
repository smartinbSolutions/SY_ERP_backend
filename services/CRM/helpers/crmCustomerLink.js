const companyModel = require("../../../models/CRM/companyModel");
const contactModel = require("../../../models/CRM/contactModel");
const ApiError = require("../../../utils/apiError");

// A customer can be linked to only one CRM record: one company or one standalone contact.
exports.assertCustomerFree = async (
  companyId,
  customerId,
  { excludeCompanyId, excludeContactId } = {},
) => {
  const [company, contact] = await Promise.all([
    companyModel.exists({
      companyId,
      customerId,
      deletedAt: null,
      ...(excludeCompanyId && { _id: { $ne: excludeCompanyId } }),
    }),
    contactModel.exists({
      companyId,
      customerId,
      deletedAt: null,
      ...(excludeContactId && { _id: { $ne: excludeContactId } }),
    }),
  ]);

  if (company || contact) {
    throw new ApiError(
      "This customer is already linked to another company or contact",
      400,
    );
  }
};
