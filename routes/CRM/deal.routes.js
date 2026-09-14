const express = require("express");

const {
  getAllDeals,
  getOneDeal,
  createDeal,
  updateDeal,
  deleteDeal,
} = require("../../controllers/CRM/deal.controller");

const router = express.Router();

router.route("/").get(getAllDeals).post(createDeal);

router.route("/:id").get(getOneDeal).put(updateDeal).delete(deleteDeal);

module.exports = router;
