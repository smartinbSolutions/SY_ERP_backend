const jwt = require("jsonwebtoken");

const createToken = (payload, sessionId, authSource) => {
  return jwt.sign(
    {
      userId: payload._id,
      email: payload.email,
      sessionId,
      authSource,
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: process.env.JWT_EXPIRE_TIME },
  );
};

module.exports = createToken;
