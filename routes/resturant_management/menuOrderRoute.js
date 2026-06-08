const express = require("express");

const {
  createmenuOrder,
  deletemenuOrder,
  getAllmenuOrders,
  getOnemenuOrder,
  updatemenuOrder,
  moveOrderToInProgress,
} = require("../../services/resturant_management/menuOrderService");
const authService = require("../../services/authService");

const menuOrderRouter = express.Router();

menuOrderRouter
  .route("/")
  .get(authService.checkPlanFeatures("resturant"), getAllmenuOrders)
  .post(
    authService.checkPlanFeatures("resturant"),
    authService.protect,
    createmenuOrder,
  );
menuOrderRouter
  .route("/move-order")
  .post(
    authService.checkPlanFeatures("resturant"),
    authService.protect,
    moveOrderToInProgress,
  );
menuOrderRouter
  .route("/:id")
  .get(authService.checkPlanFeatures("resturant"), getOnemenuOrder)
  .put(
    authService.checkPlanFeatures("resturant"),
    authService.protect,
    updatemenuOrder,
  )
  .delete(
    authService.checkPlanFeatures("resturant"),
    authService.protect,
    deletemenuOrder,
  );

module.exports = menuOrderRouter;
