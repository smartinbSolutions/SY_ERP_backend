const express = require("express");
const {
  getProduct,
  createProduct,
  getOneProduct,
  updateProduct,
  uploadProductImage,
  resizerImage,
  archiveProduct,
  getProductPos,
  getProductBySuppliers,
  getAllProdcuts,

  bulkUpdate,
  bulkUpdateProductInfo,
  getNullQrProduct,
  generateBarCode,
  importProduct,
} = require("../services/productServices");
const {
  deleteProductValdiator,
} = require("../utils/validators/productValidator");
``;
const multer = require("multer");

const storage = multer.memoryStorage();

const uploads = multer({ storage: storage });

const authService = require("../services/authService");
const {
  getLezyProduct,
  getEcommerceImportProduct,
  updateEcommerceProductDeActive,
  updateEcommerceProducts,
  ecommerceActiveProudct,
  ecommerceDashboardStats,
  setEcommerceProductPublish,
  setEcommerceProductFeatured,
  getEcommerceProductFeatured,
  setEcommerceProductSponsored,
  getEcommerceProductSponsored,
} = require("../services/ecommerce/ecommerceProductService");

const productRout = express.Router();

productRout.post("/add", uploads.single("file"), importProduct);

productRout
  .route("/")
  .get(getProduct)
  .post(
    authService.protect,
    authService.checkCompanyEditable,
    uploadProductImage,
    resizerImage,
    createProduct,
  );

productRout
  .route("/nanqr")
  .get(authService.protect, getNullQrProduct)
  .put(authService.protect, authService.checkCompanyEditable, generateBarCode);

productRout.route("/productLazy").get(getLezyProduct);
productRout
  .route("/importEcommerceProduct")
  .get(authService.protect, getEcommerceImportProduct);

productRout.route("/importEcommerceProduct");
// .post(authService.protect, uploads.single("file"), updateAllForNahed);
productRout.route("/productpos").get(getProductPos);

productRout
  .route("/ecommerceproductdeactive")
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    updateEcommerceProductDeActive,
  );

productRout
  .route("/ecommersproduct")
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    updateEcommerceProducts,
  );

productRout.route("/ecommerce-active-product").get(ecommerceActiveProudct);
productRout.route("/ecommerce-dashboard-stats").get(ecommerceDashboardStats);

productRout
  .route("/publish")
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    setEcommerceProductPublish,
  );

productRout
  .route("/featureProduct")
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    setEcommerceProductFeatured,
  )
  .get(getEcommerceProductFeatured);

productRout
  .route("/sponsorProduct")
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    setEcommerceProductSponsored,
  )
  .get(getEcommerceProductSponsored);
productRout.route("/getallproduct").get(getAllProdcuts);
productRout.route("/bulk-update").put(bulkUpdate);
productRout.route("/bulk-update-product-info").put(bulkUpdateProductInfo);

productRout
  .route("/:id")
  .get(getOneProduct)
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    uploadProductImage,
    resizerImage,
    updateProduct,
  )
  .delete(
    authService.protect,
    authService.checkCompanyEditable,
    archiveProduct,
  );
productRout.route("/suppliers/:id").get(getProductBySuppliers);

module.exports = productRout;
