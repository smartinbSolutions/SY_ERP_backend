// shared/modules.js
const MODULES = {
  accounting: {
    scopes: ["sales", "purchase", "expenses", "cash", "general_ledger"],
  },
  inventory: {
    scopes: ["products", "stock"],
  },
  pos: {
    scopes: ["receipts"],
  },
  maintenance: {
    scopes: ["clients", "devices", "cases"],
  },
  hr: {
    scopes: ["staff", "payroll"],
  },
  crm: {
    scopes: [
      "leads",
      "companies",
      "contacts",
      "opportunities",
      "deals",
      "activities",
    ],
  },
  restaurant: {
    scopes: ["menu", "orders"],
  },
  manufacturing: {
    scopes: ["bom", "production"],
  },
};

module.exports = { MODULES, MODULE_KEYS: Object.keys(MODULES) };
