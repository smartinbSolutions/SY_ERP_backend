const asyncHandler = require("express-async-handler");
const {
  processPaymentService,
} = require("../../../services/Accounting/CurrentAssets/Payments/Payment.service");

exports.createPayment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const result = await processPaymentService({
    req,
    companyId,
    next,
  });

  return res.status(201).json(result);
});
