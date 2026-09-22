const express = require("express");

const {
  getAllContacts,
  getOneContact,
  createContact,
  updateContact,
  deleteContact,
  assignContactToCompany,
  removeContactFromCompany,
  setPrimaryContact,
} = require("../../controllers/CRM/contact.controller");
const { protect } = require("../../services/authService");

const router = express.Router();

router.use(protect);

router.route("/").get(getAllContacts).post(createContact);
router.patch("/:id/assign-company", assignContactToCompany);
router.patch("/:id/remove-company", removeContactFromCompany);
router.patch("/:id/set-primary", setPrimaryContact);
router
  .route("/:id")
  .get(getOneContact)
  .put(updateContact)
  .delete(deleteContact);

module.exports = router;
