const express = require("express");
const authService = require("../../services/authService");
const {
  createmanufactorProduct,
  getAllmanufactorProducts,
  getOnemanufactorProduct,
  updatemanufactorProduct,
  deletemanufactorProduct,
  uploadmanufactorProductImage,
  resizermanufactorProductImage,
} = require("../../services/resturant_management/manufactorProductService");

const router = express.Router();

router.use(authService.protect, authService.checkPlanFeatures("resturant"));

router
  .route("/")
  .get(authService.allowedTo("menu_items.read"), getAllmanufactorProducts)
  .post(
    authService.allowedTo("menu_items.create"),
    authService.checkCompanyEditable,
    uploadmanufactorProductImage,
    resizermanufactorProductImage,
    createmanufactorProduct,
  );
router
  .route("/:id")
  .get(authService.allowedTo("menu_items.read"), getOnemanufactorProduct)
  .put(
    authService.allowedTo("menu_items.update"),
    authService.checkCompanyEditable,
    uploadmanufactorProductImage,
    resizermanufactorProductImage,
    updatemanufactorProduct,
  )
  .delete(
    authService.allowedTo("menu_items.delete"),
    authService.checkCompanyEditable,
    deletemanufactorProduct,
  );

module.exports = router;
