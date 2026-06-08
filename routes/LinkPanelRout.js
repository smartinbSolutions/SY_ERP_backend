const express = require("express");

const authService = require("../services/authService");
const {
  createLinkPanel,
  getAllLinkPanel,
  updateLinkPanel,
  getLinkPanel,
} = require("../services/LinkPanelServices");

const linkPanelRoute = express.Router();

linkPanelRoute.use(
  authService.checkPlanFeatures("accounting"),
  authService.protect,
);

linkPanelRoute
  .route("/")
  .get(getAllLinkPanel)
  .post(authService.checkCompanyEditable, createLinkPanel);
linkPanelRoute
  .route("/:id")
  .get(getLinkPanel)
  .put(authService.checkCompanyEditable, updateLinkPanel);
module.exports = linkPanelRoute;
