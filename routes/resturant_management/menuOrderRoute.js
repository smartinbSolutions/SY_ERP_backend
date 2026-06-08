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
    authService.protect,
    authService.checkPlanFeatures("resturant"),
    createmenuOrder,
  );
menuOrderRouter
  .route("/move-order")
  .post(
    authService.protect,
    authService.checkPlanFeatures("resturant"),
    moveOrderToInProgress,
  );
menuOrderRouter
  .route("/:id")
  .get(authService.checkPlanFeatures("resturant"), getOnemenuOrder)
  .put(
    authService.protect,
    authService.checkPlanFeatures("resturant"),
    updatemenuOrder,
  )
  .delete(
    authService.protect,
    authService.checkPlanFeatures("resturant"),
    deletemenuOrder,
  );

module.exports = menuOrderRouter;
