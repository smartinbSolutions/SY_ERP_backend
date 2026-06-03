const axios = require("axios");
const ApiError = require("../utils/apiError");
const User = require("../models/Settings/users.model");

const getCompanyId = (company) => {
  if (!company) return null;
  if (company.companyId?._id) return String(company.companyId._id);
  if (company.companyId) return String(company.companyId);
  if (company._id) return String(company._id);
  return null;
};

const getUserCompaniesByEmail = async (req, res, next) => {
  try {
    const response = await User.findOne({ email: req.body.email }).populate(
      "companies.companyId",
    );

    if (!response) {
      return next(new ApiError("User not found", 404));
    }

    let userSubscriptions = response.companies;

    if (!userSubscriptions || userSubscriptions.length === 0) {
      return next(new ApiError("User has no subscriptions", 401));
    }

    if (response.companies.length > 1) {
      res.status(200).json({ status: "true", companies: response.companies });
    } else {
      req.query = {
        ...req.query,
        companyId: getCompanyId(response.companies[0]),
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
