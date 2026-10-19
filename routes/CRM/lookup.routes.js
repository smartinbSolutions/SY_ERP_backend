const express = require("express");

const {
  getAllLookups,
  getOneLookup,
  createLookup,
  updateLookup,
  deleteLookup,
} = require("../../controllers/CRM/lookup.controller");

const { protect } = require("../../services/authService");

const router = express.Router();

router.use(protect);

router.route("/").get(getAllLookups).post(createLookup);

router.route("/:id").get(getOneLookup).put(updateLookup).delete(deleteLookup);

module.exports = router;
