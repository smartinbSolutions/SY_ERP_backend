const express = require("express");
const {
  findAllOrder,
  findOneOrder,
  returnOrder,
  getReturnOrder,
  getOneReturnOrder,
  DashBordSalse,
  editOrderInvoice,
  canceledOrder,
  findCustomer,
  mergeReceipts,
  archiveOrder,
  patchOrder,
  calculateProfit,
} = require("../services/orderServices");

const authService = require("../services/authService");
const {
  EcommerceOrderIntegration,
  EcommerceOrderIntegrationFull,
} = require("../services/integration/salesIntegration");
const { uploadFile } = require("../services/purchaseInvoicesServices");
const {
  createSalesInvoice,
  postSalesInvoiceDraft,
  deleteSalesInvoiceDraft,
  updateSalesDraftInvoice,
  cancelSalesInvoice,
  updatePostedSalesInvoice,
} = require("../controllers/Accounting/Sales/SalesInvoice.controller");

const OrderRout = express.Router();
OrderRout.use(authService.protect);

OrderRout.route("/return").post(authService.checkCompanyEditable, returnOrder);
OrderRout.route("/getReturnOrder").get(getReturnOrder);
OrderRout.route("/calculate-profit").post(calculateProfit);
OrderRout.route("/getReturnOrder/:id").get(getOneReturnOrder);
OrderRout.route("/customerorder/:id").get(findCustomer);

OrderRout.route("/").get(findAllOrder);

OrderRout.route("/salesDashbord").post(
  authService.checkCompanyEditable,
  createSalesInvoice,
);
OrderRout.route("/archive/:id").put(
  authService.checkCompanyEditable,
  archiveOrder,
);
OrderRout.route("/merge").post(authService.checkCompanyEditable, mergeReceipts);
OrderRout.route("/:id")
  .get(findOneOrder)
  .put(authService.checkCompanyEditable, updatePostedSalesInvoice)
  .delete(authService.checkCompanyEditable, canceledOrder)
  .patch(authService.checkCompanyEditable, uploadFile, patchOrder);

OrderRout.route("/post/:id").put(
  authService.checkCompanyEditable,
  postSalesInvoiceDraft,
);
OrderRout.route("/draft/:id")
  .put(authService.checkCompanyEditable, updateSalesDraftInvoice)
  .delete(authService.checkCompanyEditable, deleteSalesInvoiceDraft);

OrderRout.route("/cancel/:id").put(
  authService.checkCompanyEditable,
  cancelSalesInvoice,
);
OrderRout.route("/integrate/sales").post(
  // EcommerceOrderIntegration
  EcommerceOrderIntegrationFull,
);

module.exports = OrderRout;
