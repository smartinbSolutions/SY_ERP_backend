const express = require("express");

const {
  getAllContacts,
  getOneContact,
  createContact,
  updateContact,
  deleteContact,
} = require("../../controllers/CRM/contact.controller");
const { protect } = require("../../services/authService");

const router = express.Router();

router.use(protect);

router.route("/").get(getAllContacts).post(createContact);

router
  .route("/:id")
  .get(getOneContact)
  .put(updateContact)
  .delete(deleteContact);

module.exports = router;
