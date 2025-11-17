const paymentModel = require("../../models/paymentModel");
const asyncHandler = require("express-async-handler");

exports.CashFlowReports = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate } = req.query;

  const match = { companyId };

  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const result = await paymentModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        cashIn: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "Deposit"] },
              { $toDouble: "$totalMainCurrency" },
              0,
            ],
          },
        },
        cashOut: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "Withdrawal"] },
              { $toDouble: "$totalMainCurrency" },
              0,
            ],
          },
        },
      },
    },
  ]);

  const data = result[0] || { cashIn: 0, cashOut: 0 };

  res.status(200).json({
    cashIn: data.cashIn,
    cashOut: data.cashOut,
    netCashFlow: data.cashIn - data.cashOut,
  });
});
