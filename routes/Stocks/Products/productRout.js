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
  getProductsByType,
} = require("../../../services/Stocks/Products/productServices");
const {
  deleteProductValdiator,
} = require("../../../utils/validators/productValidator");
``;
const multer = require("multer");

const storage = multer.memoryStorage();

const uploads = multer({ storage: storage });

const authService = require("../../../services/authService");
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
} = require("../../../services/ecommerce/ecommerceProductService");

const productRout = express.Router();

productRout.use(
  authService.protect,
  authService.checkPlanFeatures("inventory")
);

productRout.post(
  "/add",
  authService.allowedTo("products.create"),
  authService.checkCompanyEditable,
  uploads.single("file"),
  importProduct
);

productRout
  .route("/")
  .get(authService.allowedTo("products.read"), getProduct)
  .post(
    authService.allowedTo("products.create"),
    authService.checkCompanyEditable,
    uploadProductImage,
    resizerImage,
    createProduct
  );

productRout
  .route("/nanqr")
  .get(authService.allowedTo("products.read"), getNullQrProduct)
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    generateBarCode
  );
productRout
  .route("/prductsByType")
  .get(authService.allowedTo("products.read"), getProductsByType);

productRout.route("/productLazy").get(getLezyProduct);
productRout
  .route("/importEcommerceProduct")
  .get(authService.allowedTo("products.read"), getEcommerceImportProduct);

productRout.route("/importEcommerceProduct");
// .post( uploads.single("file"), updateAllForNahed);
productRout
  .route("/productpos")
  .get(authService.allowedTo("products.read"), getProductPos);

productRout
  .route("/ecommerceproductdeactive")
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    updateEcommerceProductDeActive
  );

productRout
  .route("/ecommersproduct")
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    updateEcommerceProducts
  );

productRout
  .route("/ecommerce-active-product")
  .get(authService.allowedTo("products.read"), ecommerceActiveProudct);
productRout
  .route("/ecommerce-dashboard-stats")
  .get(authService.allowedTo("products.read"), ecommerceDashboardStats);

productRout
  .route("/publish")
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    setEcommerceProductPublish
  );

productRout
  .route("/featureProduct")
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    setEcommerceProductFeatured
  )
  .get(authService.allowedTo("products.read"), getEcommerceProductFeatured);

productRout
  .route("/sponsorProduct")
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    setEcommerceProductSponsored
  )
  .get(authService.allowedTo("products.read"), getEcommerceProductSponsored);
productRout
  .route("/getallproduct")
  .get(authService.allowedTo("products.read"), getAllProdcuts);
productRout
  .route("/bulk-update")
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    bulkUpdate
  );
productRout
  .route("/bulk-update-product-info")
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    bulkUpdateProductInfo
  );

productRout
  .route("/:id")
  .get(authService.allowedTo("products.read"), getOneProduct)
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    uploadProductImage,
    resizerImage,
    updateProduct
  )
  .delete(
    authService.allowedTo("products.archive"),
    authService.checkCompanyEditable,
    archiveProduct
  );
productRout
  .route("/suppliers/:id")
  .get(authService.allowedTo("products.read"), getProductBySuppliers);

module.exports = productRout;
