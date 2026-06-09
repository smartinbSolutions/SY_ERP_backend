const jwt = require("jsonwebtoken");

const createToken = ({
  userId,
  email,
  roleId,
  channels,
  companyId,
  authSource,
  companyPlan,
}) => {
  return jwt.sign(
    {
      userId: userId,
      email: email,
      roleId,
      channels,
      authSource,
      companyId,
      companyPlan,
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: process.env.JWT_EXPIRE_TIME },
  );
};

module.exports = createToken;
