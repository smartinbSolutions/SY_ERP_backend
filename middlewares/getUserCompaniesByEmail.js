const axios = require("axios");
const ApiError = require("../utils/apiError");
const User = require("../models/Settings/users.model");
const bcrypt = require("bcrypt");

const getCompanyId = (company) => {
  if (!company) return null;
  if (company.companyId?._id) return String(company.companyId._id);
  if (company.companyId) return String(company.companyId);
  if (company._id) return String(company._id);
  return null;
};

const getUserCompaniesByEmail = async (req, res, next) => {
  try {
    const { email, password } = req.body.data;

    const user = await User.findOne({ email })
      .select("+password")
      .populate("companies.companyId");

    if (!user) {
      return next(new ApiError("User not found", 404));
    }

    if (password) {
      const passwordMatch = await bcrypt.compare(password, user.password);

      // if (!passwordMatch) {
      //   return next(new ApiError("Invalid password", 401));
      // }
    }

    const userSubscriptions = user.companies;

    if (!userSubscriptions || userSubscriptions.length === 0) {
      return next(new ApiError("User has no subscriptions", 401));
    }

    if (user.companies.length > 1) {
      return res.status(200).json({
        status: "true",
        companies: user.companies,
      });
    }

    req.query = {
      ...req.query,
      companyId: getCompanyId(user.companies[0]),
    };

    return res.status(200).json({
      status: "true",
      companies: user.companies,
    });
  } catch (error) {
    return res.status(500).json({
      status: "false",
      error: `Internal Server Error ${error}`,
    });
  }
};

module.exports = { getUserCompaniesByEmail };
