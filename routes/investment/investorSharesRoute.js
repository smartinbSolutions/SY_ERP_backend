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
investorSharesRoute.use(authService.protect);

investorSharesRoute
  .route("/")
  .post(createinvestorShares)
  .get(getAllinvestorShares);
investorSharesRoute
  .route("/:id")
  .put(updateInvestorSharesModel)
  .get(getOneInvestorShares)
  .delete(deleteInvestorShares);

investorSharesRoute.route("/shares/:id").put(updateInvestorShares);

module.exports = investorSharesRoute;
