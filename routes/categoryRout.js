const express = require("express");
const {
  getCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
  resizerCategoryImage,
  getLastChildrenCategories,
  importCategory,
} = require("../services/CategoryServices");
const {
  createCategoryVlaidator,
  updateCategoryValidator,
  getCategoryValidator,
  deleteCategoryValidator,
} = require("../utils/validators/categoryValidator");

const authService = require("../services/authService");
const categoryRout = express.Router();

const multer = require("multer");
const upload = multer();

categoryRout.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);

categoryRout
  .route("/last-children")
  .get(authService.allowedTo("category.read"), getLastChildrenCategories);

categoryRout
  .route("/")
  .get(authService.allowedTo("category.read"), getCategories)
  .post(
    authService.allowedTo("category.create"),
    authService.checkCompanyEditable,
    uploadCategoryImage,
    resizerCategoryImage,
    createCategoryVlaidator,
    createCategory,
  );
categoryRout
  .route("/import")
  .post(
    authService.allowedTo("category.create"),
    authService.checkCompanyEditable,
    upload.single("file"),
    importCategory,
  );
categoryRout
  .route("/:id")
  .get(
    authService.allowedTo("category.read"),
    getCategoryValidator,
    getCategory,
  )
  .put(
    authService.allowedTo("category.update"),
    authService.checkCompanyEditable,
    uploadCategoryImage,
    resizerCategoryImage,
    updateCategoryValidator,
    updateCategory,
  )
  .delete(
    authService.allowedTo("category.delete"),
    authService.checkCompanyEditable,
    deleteCategoryValidator,
    deleteCategory,
  );
module.exports = categoryRout;
