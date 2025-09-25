const express = require("express");

const {
  createmenuOrder,
  deletemenuOrder,
  getAllmenuOrders,
  getOnemenuOrder,
  updatemenuOrder,
} = require("../../services/resturant_management/menuOrderService");
const authService = require("../../services/authService");

const menuCategoryRout = express.Router();

menuCategoryRout
  .route("/")
  .get(getAllmenuOrders)
  .post(authService.protect, createmenuOrder);
menuCategoryRout
  .route("/:id")
  .get(getOnemenuOrder)
  .put(authService.protect, updatemenuOrder)
  .delete(authService.protect, deletemenuOrder);

module.exports = menuCategoryRout;
