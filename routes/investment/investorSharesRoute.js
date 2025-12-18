const express = require("express");
const {
  createinvestorShares,
  deleteInvestorShares,
  getAllinvestorShares,
  getOneInvestorShares,
  updateInvestorSharesModel,
} = require("../../services/investment/investorSharesService");
const authService = require("../../services/authService");
const {
  updateInvestorShares,
} = require("../../services/investment/investorService");

const investorSharesRoute = express.Router();

investorSharesRoute
  .route("/")
  .post(authService.protect, createinvestorShares)
  .get(getAllinvestorShares);
investorSharesRoute
  .route("/:id")
  .put(authService.protect, updateInvestorSharesModel)
  .get(getOneInvestorShares)
  .delete(authService.protect, deleteInvestorShares);

investorSharesRoute.route("/shares/:id").put(updateInvestorShares);

module.exports = investorSharesRoute;
