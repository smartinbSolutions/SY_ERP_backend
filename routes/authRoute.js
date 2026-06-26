const express = require("express");
const multer = require("multer");

const upload = multer();
const {
  login,
  signup,
  forgotPassword,
  verifyPasswordResetCode,
  resetPassword,
  EcommerceLogin,
  googleLogin,
  facebookLogin,
  switchCompany,
  protect,
} = require("../services/authService");
const {
  getUserCompaniesByEmail,
} = require("../middlewares/getUserCompaniesByEmail");

const router = express.Router();

router.post("/check", getUserCompaniesByEmail);
router.post("/login", upload.none(), login);
router.post("/switch", upload.none(), switchCompany);
router.post("/forgot-passwords", upload.none(), forgotPassword);
router.post("/verify-reset-code", verifyPasswordResetCode);
router.put("/reset-password", upload.none(), resetPassword);

router.post("/ecommerce-login", EcommerceLogin);
router.post("/google-signin", googleLogin);
router.post("/facebook-signin", facebookLogin);
router.post("/signup", signup);
// router.post("/forgot-passwords", forgotPassword);
// router.post("/verify-reset-code", verifyPasswordResetCode);
// router.put("/reset-password", upload.none(), resetPassword);

module.exports = router;
