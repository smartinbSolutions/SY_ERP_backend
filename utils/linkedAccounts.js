const customarModel = require("../models/Accounting/Sales/customarModel");
const suppliersModel = require("../models/Accounting/Purchase/suppliersModel");
const financialFundsModel = require("../models/Accounting/CurrentAssets/financialFundsModel");
const expensesCategoryModel = require("../models/Accounting/Expenses/expensesCategoryModel"); // adjust path
const taxModel = require("../models/Settings/Definition/tax.model"); // adjust path

// Add a line here whenever a new model links to an account
const LINK_SOURCES = [
  { model: customarModel, fields: ["linkAccount"] },
  { model: suppliersModel, fields: ["linkAccount"] },
  { model: financialFundsModel, fields: ["linkAccount"] },
  { model: expensesCategoryModel, fields: ["linkAccount"] },
  { model: taxModel, fields: ["salesAccountTax", "purchaseAccountTax"] },
];

// Used by the endpoint: every linked account id
const getAllLinkedAccountIds = async (companyId) => {
  const lists = await Promise.all(
    LINK_SOURCES.flatMap(({ model, fields }) =>
      fields.map((field) =>
        model.distinct(field, { companyId, [field]: { $ne: null } }),
      ),
    ),
  );
  return [...new Set(lists.flat().map(String))];
};

// Used by the guard: is this one account linked anywhere?
const isAccountLinked = async ({ accountId, companyId, session }) => {
  const checks = await Promise.all(
    LINK_SOURCES.map(({ model, fields }) =>
      model
        .exists({
          companyId,
          $or: fields.map((field) => ({ [field]: accountId })),
        })
        .session(session),
    ),
  );
  return checks.some(Boolean);
};

module.exports = { getAllLinkedAccountIds, isAccountLinked };
