const express = require("express");
const {
  getEmployees,
  createEmployee,
  deleteEmployee,
  getEmployee,
  updateEmployee,
  createEmployeeInPos,
  updateEmployeePassword,
  uploadEmployeeImage,
  resizerEmployeeImage,
  reSendPassword,
} = require("../services/employeeServices");
const {
  createEmployeeValidator,
  updateEmployeeValidator,
  updateNameValidator,
  getEmployeeVlaidator,
  deleteEmployeeVlaidator,
  updatePasswordValidator,
} = require("../utils/validators/employeeValidator");
const authService = require("../services/authService");

const employeeRoute = express.Router();

employeeRoute.use(authService.protect);

employeeRoute
  .route("/")
  .get(authService.allowedTo("employee.read"), getEmployees)
  .post(
    authService.allowedTo("employee.create"),
    authService.checkCompanyEditable,
    uploadEmployeeImage,
    resizerEmployeeImage,
    createEmployee,
  );
employeeRoute
  .route("/resendpassword/:email")
  .put(
    authService.allowedTo("users.reset_password"),
    authService.checkCompanyEditable,
    reSendPassword,
  );
employeeRoute
  .route("/create-employee")
  .post(
    authService.allowedTo("employee.create"),
    authService.checkCompanyEditable,
    createEmployee,
  );

employeeRoute
  .route("/:id")
  .delete(
    authService.allowedTo("employee.delete"),
    authService.checkCompanyEditable,
    deleteEmployeeVlaidator,
    deleteEmployee,
  )
  .get(
    authService.allowedTo("employee.read"),
    getEmployeeVlaidator,
    getEmployee,
  )
  .put(
    authService.allowedTo("employee.update"),
    authService.checkCompanyEditable,
    uploadEmployeeImage,
    resizerEmployeeImage,
    updateEmployee,
  );
employeeRoute
  .route("/updateName/:id")
  .put(
    authService.allowedTo("employee.update"),
    authService.checkCompanyEditable,
    /*updateNameValidator, */ updateEmployee,
  );
employeeRoute
  .route("/updatePassword/:id")
  .put(
    authService.allowedTo("users.reset_password"),
    authService.checkCompanyEditable,
    updatePasswordValidator,
    updateEmployeePassword,
  );

module.exports = employeeRoute;
