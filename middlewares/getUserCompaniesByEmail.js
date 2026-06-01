const axios = require("axios");
const ApiError = require("../utils/apiError");
const User = require("../models/Settings/users.model");

const getUserCompaniesByEmail = async (req, res, next) => {
  try {
    const response = await User.findOne({ email: req.body.email }).populate(
      "companies.companyId",
    );

    let userSubscriptions = response.companies;

    if (!userSubscriptions || userSubscriptions.length === 0) {
      return next(new ApiError("User has no subscriptions", 401));
    }

    if (response.companies.length > 1) {
      res.status(200).json({ status: "true", companies: response.companies });
    } else {
      req.query = {
        ...req.query,
        companyId: response.companies[0]._id,
      };

      res.status(200).json({ status: "true", companies: response.companies });
    }
  } catch (error) {
    res
      .status(500)
      .json({ status: "false", error: `Internal Server Error ${error}` });
  }
};

module.exports = { getUserCompaniesByEmail };
