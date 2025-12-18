const jwt = require("jsonwebtoken");

const createToken = (payload, sessionId) => {
  return jwt.sign(
    { userId: payload._id, email: payload.email, sessionId },
    process.env.JWT_SECRET_KEY,
    { expiresIn: process.env.JWT_EXPIRE_TIME }
  );
};

module.exports = createToken;
