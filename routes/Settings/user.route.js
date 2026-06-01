const express = require("express");

const authService = require("../../services/authService");
const {
  getUsers,
  createUser,
  updateUser,
  uploadUserImage,
  resizerUserImage,
  reSendPassword,
  deleteUser,
  getUser,
  updateUserPassword,
} = require("../../controllers/Settings/user.controller");

const userRoute = express.Router();

userRoute
  .route("/")
  .get(getUsers)
  .post(uploadUserImage, resizerUserImage, createUser);
userRoute
  .route("/resendpassword/:email")
  .put(authService.protect, authService.checkCompanyEditable, reSendPassword);
userRoute.route("/create-employee").post(createUser);

userRoute
  .route("/:id")
  .delete(authService.protect, authService.checkCompanyEditable, deleteUser)
  .get(authService.protect, authService.checkCompanyEditable, getUser)
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    uploadUserImage,
    resizerUserImage,
    updateUser,
  );
userRoute
  .route("/updateName/:id")
  .put(authService.protect, authService.checkCompanyEditable, updateUser);
userRoute
  .route("/updatePassword/:id")
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    updateUserPassword,
  );

module.exports = userRoute;
