const express = require("express");

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
} = require("../../services/ecommerce/ecommerceProductService");

const router = express.Router();

/*
 * ========================================
 * PUBLIC ECOMMERCE PRODUCTS
 * ========================================
 */

// Storefront products
router.get("/lazy", getLezyProduct);

/*
 * ========================================
 * PRODUCT IMPORT / MANAGEMENT
 * ========================================
 */

// Get regular products available for Ecommerce import
router.get("/import-products", getEcommerceImportProduct);

// Import regular products to Ecommerce
router.put("/import", updateEcommerceProducts);

// Deactivate Ecommerce product
router.put("/deactivate", updateEcommerceProductDeActive);

// Publish / Unpublish Ecommerce product
router.put("/publish", setEcommerceProductPublish);

/*
 * ========================================
 * ACTIVE ECOMMERCE PRODUCTS
 * ========================================
 */

router.get("/active", ecommerceActiveProduct);

/*
 * ========================================
 * DASHBOARD
 * ========================================
 */

router.get("/dashboard-stats", ecommerceDashboardStats);

/*
 * ========================================
 * FEATURED PRODUCTS
 * ========================================
 */

router.put("/featured", setEcommerceProductFeatured);

router.get("/featured", getEcommerceProductFeatured);

/*
 * ========================================
 * SPONSORED PRODUCTS
 * ========================================
 */

router.put("/sponsored", setEcommerceProductSponsored);

router.get("/sponsored", getEcommerceProductSponsored);

module.exports = router;
