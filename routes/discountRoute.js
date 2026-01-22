const express = require("express");
const {
  createDiscount,
  getDiscounts,
  getOneDiscount,
  updateDiscount,
  deleteDiscount,
} = require("../services/discountService");
const authService = require("../services/authService");

const discountRoute = express.Router();

//prmisstions
discountRoute.use(authService.protect);

discountRoute
  .route("/")
  .post(authService.checkCompanyEditable, createDiscount)
  .get(getDiscounts);

discountRoute
  .route("/:id")
  .get(getOneDiscount)
  .put(authService.checkCompanyEditable, updateDiscount)
  .delete(authService.checkCompanyEditable, deleteDiscount);

module.exports = discountRoute;
