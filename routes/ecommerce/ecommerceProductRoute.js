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
const { resolveCompanyFromSlug } = require("../../middlewares/resolveCompany");

const router = express.Router();

/*
 * ========================================
 * PUBLIC ECOMMERCE PRODUCTS (بدون token)
 * ========================================
 */

// Storefront products
// GET /api/ecommerce/products?companySlug=smartinb-com
router.get("/lazy", resolveCompanyFromSlug, getLezyProduct);

// GET /api/ecommerce/store/:companySlug/products
router.get(
  "/store/:companySlug/products",
  resolveCompanyFromSlug,
  getLezyProduct,
);

// GET /api/ecommerce/products/:id?companySlug=smartinb-com
router.get("/product/:id", resolveCompanyFromSlug, getOneEcommerceProduct);

// GET /api/ecommerce/store/:companySlug/products/:id
router.get(
  "/store/:companySlug/products/:id",
  resolveCompanyFromSlug,
  getOneEcommerceProduct,
);

// Get regular products available for Ecommerce import
router.get("/import-products", authService.protect, getEcommerceImportProduct);

// Import regular products to Ecommerce
router.put("/import", authService.protect, updateEcommerceProducts);

// Deactivate Ecommerce product
router.put("/deactivate", authService.protect, updateEcommerceProductDeActive);

// Publish / Unpublish Ecommerce product
router.put("/publish", authService.protect, setEcommerceProductPublish);

router.get("/active", authService.protect, ecommerceActiveProduct);

router.get("/dashboard-stats", authService.protect, ecommerceDashboardStats);

router.put("/featured", authService.protect, setEcommerceProductFeatured);

router.get("/featured", authService.protect, getEcommerceProductFeatured);

router.put("/sponsored", authService.protect, setEcommerceProductSponsored);

router.get("/sponsored", authService.protect, getEcommerceProductSponsored);

router.put(
  "/:id",
  authService.protect,
  uploadEcommercProductImage,
  resizerEcommercProductImage,
  updateEcommerceProduct,
);

module.exports = router;
