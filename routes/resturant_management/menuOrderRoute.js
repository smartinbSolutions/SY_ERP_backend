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
  .get(getAllmenuOrders)
  .post(authService.protect, createmenuOrder);
menuOrderRouter
  .route("/move-order")
  .post(authService.protect, moveOrderToInProgress);
menuOrderRouter
  .route("/:id")
  .get(getOnemenuOrder)
  .put(authService.protect, updatemenuOrder)
  .delete(authService.protect, deletemenuOrder);

module.exports = menuOrderRouter;
