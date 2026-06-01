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
  .get(authService.protect, authService.allowedTo("users.read"), getUsers)
  .post(
    authService.protect,
    authService.allowedTo("users.create"),
    authService.checkCompanyEditable,
    uploadUserImage,
    resizerUserImage,
    createUser,
  );
userRoute
  .route("/resendpassword/:email")
  .put(
    authService.protect,
    authService.allowedTo("users.reset_password"),
    authService.checkCompanyEditable,
    reSendPassword,
  );
userRoute
  .route("/create-employee")
  .post(
    authService.protect,
    authService.allowedTo("employee.create"),
    authService.checkCompanyEditable,
    createUser,
  );

userRoute
  .route("/:id")
  .delete(
    authService.protect,
    authService.allowedTo("users.delete"),
    authService.checkCompanyEditable,
    deleteUser,
  )
  .get(authService.protect, authService.allowedTo("users.read"), getUser)
  .put(
    authService.protect,
    authService.allowedTo("users.update"),
    authService.checkCompanyEditable,
    uploadUserImage,
    resizerUserImage,
    updateUser,
  );
userRoute
  .route("/updateName/:id")
  .put(
    authService.protect,
    authService.allowedTo("users.update"),
    authService.checkCompanyEditable,
    updateUser,
  );
userRoute
  .route("/updatePassword/:id")
  .put(
    authService.protect,
    authService.allowedTo("users.reset_password"),
    authService.checkCompanyEditable,
    updateUserPassword,
  );

module.exports = userRoute;
