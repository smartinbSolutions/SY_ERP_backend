const express = require("express");

const {
  getAllLeads,
  getOneLead,
  createLead,
  updateLead,
  deleteLead,
} = require("../../controllers/CRM/lead.controller");

const { protect } = require("../../services/authService");
const router = express.Router();

router.use(protect);

router.route("/").get(getAllLeads).post(createLead);

router.route("/:id").get(getOneLead).put(updateLead).delete(deleteLead);

module.exports = router;
