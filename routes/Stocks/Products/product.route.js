const express = require("express");
const multer = require("multer");
const authService = require("../../../services/authService");
const {
  importProduct,
  getProducts,
  createProduct,
  uploadProductImage,
  resizerImage,
  generateBarCode,
  getNullQrProduct,
  getProductPos,
  getAllProductsForExports,
  bulkUpdateProductPrice,
  bulkUpdateProductInfo,
  archiveProduct,
  updateProduct,
  getOneProduct,
} = require("../../../controllers/Stocks/Products/product.controller");
const storage = multer.memoryStorage();

const productRout = express.Router();
const uploads = multer({ storage: storage });

productRout.use(
  authService.protect,
  authService.checkPlanFeatures("inventory"),
);

productRout.post(
  "/import",
  authService.allowedTo("products.create"),
  authService.checkCompanyEditable,
  uploads.single("file"),
  importProduct,
);

productRout
  .route("/")
  .get(authService.allowedTo("products.read"), getProducts)
  .post(
    authService.allowedTo("products.create"),
    authService.checkCompanyEditable,
    uploadProductImage,
    resizerImage,
    createProduct,
  );

productRout
  .route("/nanqr")
  .get(authService.allowedTo("products.read"), getNullQrProduct)
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    generateBarCode,
  );

productRout
  .route("/productpos")
  .get(
    // authService.allowedTo("products.read"),
     getProductPos);

productRout
  .route("/getallproduct")
  .get(authService.allowedTo("products.read"), getAllProductsForExports);

productRout
  .route("/bulk-update")
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    bulkUpdateProductPrice,
  );
productRout
  .route("/bulk-update-product-info")
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    bulkUpdateProductInfo,
  );
productRout
  .route("/:id")
  .get(authService.allowedTo("products.read"), getOneProduct)
  .put(
    authService.allowedTo("products.update"),
    authService.checkCompanyEditable,
    uploadProductImage,
    resizerImage,
    updateProduct,
  )
  .delete(
    authService.allowedTo("products.archive"),
    authService.checkCompanyEditable,
    archiveProduct,
  );

module.exports = productRout;
