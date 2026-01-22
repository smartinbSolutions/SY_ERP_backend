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
} = require("../services/orderServices");

const authService = require("../services/authService");
const {
  EcommerceOrderIntegration,
  EcommerceOrderIntegrationFull,
} = require("../services/integration/salesIntegration");
const { uploadFile } = require("../services/purchaseInvoicesServices");

const OrderRout = express.Router();

OrderRout.route("/return").post(
  authService.protect,
  authService.checkCompanyEditable,
  returnOrder,
);
OrderRout.route("/getReturnOrder").get(authService.protect, getReturnOrder);
OrderRout.route("/getReturnOrder/:id").get(
  authService.protect,
  getOneReturnOrder,
);
OrderRout.route("/customerorder/:id").get(authService.protect, findCustomer);

OrderRout.route("/").get(authService.protect, findAllOrder);

OrderRout.route("/salesDashbord").post(
  authService.protect,
  authService.checkCompanyEditable,
  DashBordSalse,
);
OrderRout.route("/archive/:id").put(
  authService.protect,
  authService.checkCompanyEditable,
  archiveOrder,
);
OrderRout.route("/merge").post(
  authService.protect,
  authService.checkCompanyEditable,
  mergeReceipts,
);
OrderRout.route("/:id")
  .get(findOneOrder)
  .put(authService.protect, authService.checkCompanyEditable, editOrderInvoice)
  .delete(authService.protect, authService.checkCompanyEditable, canceledOrder)
  .patch(
    authService.protect,
    authService.checkCompanyEditable,
    uploadFile,
    patchOrder,
  );

OrderRout.route("/integrate/sales").post(
  authService.protect,
  // EcommerceOrderIntegration
  EcommerceOrderIntegrationFull,
);

module.exports = OrderRout;
