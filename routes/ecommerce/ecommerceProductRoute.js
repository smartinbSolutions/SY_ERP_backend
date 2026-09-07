const express = require("express");

const authService = require("../../services/authService");

const {
  getLezyProduct,
  updateEcommerceProducts,
  updateEcommerceProductDeActive,
  setEcommerceProductPublish,
  getEcommerceImportProduct,
  ecommerceActiveProduct,
  ecommerceDashboardStats,
  setEcommerceProductFeatured,
  getEcommerceProductFeatured,
  setEcommerceProductSponsored,
  getEcommerceProductSponsored,
  updateEcommerceProduct,
  getOneEcommerceProduct,
  uploadEcommercProductImage,
  resizerEcommercProductImage,
} = require("../../services/ecommerce/ecommerceProductService");

const router = express.Router();

/*
 * ========================================
 * PUBLIC ECOMMERCE PRODUCTS
 * ========================================
 */

// Storefront products
router.get("/lazy",authService.protect, getLezyProduct);

/*
 * ========================================
 * PRODUCT IMPORT / MANAGEMENT
 * ========================================
 */

// Get regular products available for Ecommerce import
router.get("/import-products",authService.protect, getEcommerceImportProduct);

// Import regular products to Ecommerce
router.put("/import", authService.protect, updateEcommerceProducts);

// Deactivate Ecommerce product
router.put("/deactivate", authService.protect, updateEcommerceProductDeActive);

// Publish / Unpublish Ecommerce product
router.put("/publish", authService.protect, setEcommerceProductPublish);

/*
 * ========================================
 * ACTIVE ECOMMERCE PRODUCTS
 * ========================================
 */

router.get("/active", authService.protect, ecommerceActiveProduct);

/*
 * ========================================
 * DASHBOARD
 * ========================================
 */

router.get("/dashboard-stats", authService.protect, ecommerceDashboardStats);

/*
 * ========================================
 * FEATURED PRODUCTS
 * ========================================
 */

router.put("/featured", authService.protect, setEcommerceProductFeatured);

router.get("/featured", authService.protect, getEcommerceProductFeatured);

/*
 * ========================================
 * SPONSORED PRODUCTS
 * ========================================
 */

router.put("/sponsored", authService.protect, setEcommerceProductSponsored);

router.get("/sponsored", authService.protect, getEcommerceProductSponsored);

router.get(
  "/:id",
  authService.protect,
  getOneEcommerceProduct,
);

router.put(
  "/:id",
  authService.protect,
  uploadEcommercProductImage,
  resizerEcommercProductImage,
  updateEcommerceProduct,
);


module.exports = router;
