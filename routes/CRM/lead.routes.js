const express = require("express");

const {
  getAllLeads,
  getOneLead,
  createLead,
  updateLead,
  deleteLead,
} = require("../../controllers/CRM/lead.controller");

const router = express.Router();

router.route("/").get(getAllLeads).post(createLead);

router.route("/:id").get(getOneLead).put(updateLead).delete(deleteLead);

module.exports = router;
