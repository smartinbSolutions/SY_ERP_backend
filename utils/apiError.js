class ApiError extends Error {
  constructor(message, statsCode, code) {
    super(message);
    this.statsCode = statsCode;
    this.status = `${statsCode}`.startsWith(4) ? "fail" : "error";
    this.isOperational = true;
    // Optional machine-readable code (e.g. "CONTACT_EMAIL_EXISTS")
    if (code) this.code = code;
  }
}
module.exports = ApiError;
