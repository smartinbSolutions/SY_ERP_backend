const express = require("express");

const {
  uploadMenuCategoryImage,
  resizerMenuCategoryImage,
  getMenuCategory,
  createMenuCategory,
  getMenuCategories,
  deleteMenuCategory,
  updataMenuCategory,
} = require("../../services/resturant_management/menuCategoryServices");
const authService = require("../../services/authService");

const menuCategoryRout = express.Router();

menuCategoryRout.use(
  authService.protect,
  authService.checkPlanFeatures("resturant"),
);

menuCategoryRout
  .route("/")
  .get(
    authService.protect,
    authService.allowedTo("menu_categories.read"),
    getMenuCategories,
  )
  .post(
    authService.protect,
    authService.allowedTo("menu_categories.create"),
    uploadMenuCategoryImage,
    resizerMenuCategoryImage,
    createMenuCategory,
  );
menuCategoryRout
  .route("/:id")
  .get(
    authService.protect,
    authService.allowedTo("menu_categories.read"),
    getMenuCategory,
  )
  .put(
    authService.protect,
    authService.allowedTo("menu_categories.update"),
    uploadMenuCategoryImage,
    resizerMenuCategoryImage,
    updataMenuCategory,
  )
  .delete(
    authService.protect,
    authService.allowedTo("menu_categories.delete"),
    deleteMenuCategory,
  );

module.exports = menuCategoryRout;
