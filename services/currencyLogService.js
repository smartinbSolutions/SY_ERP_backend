const asyncHandler = require("express-async-handler");
const currencyLogModel = require("../models/Settings/currencyLog.model");
const currencyModel = require("../models/Settings/currency.model");

exports.getCurrencyLog = asyncHandler(async (req, res) => {
  const { id, page = 1, limit = 50 } = req.query;
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const skip = (page - 1) * limit;

  const filter = { currencyId: req.params.id, companyId };

  const logs = await currencyLogModel
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await currencyLogModel.countDocuments(filter);

  res.json({
    success: true,
    page: Number(page),
    limit: Number(limit),
    total,
    data: logs,
  });
});
exports.getCurrencyRatesByDate = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const companyId = req.companyId;

  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });
  if (!date) return res.status(400).json({ message: "date is required" });

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // 1️⃣ Logs ON this date
  const logsOnDate = await currencyLogModel
    .find({
      companyId,
      createdAt: { $gte: dayStart, $lt: dayEnd },
    })
    .sort({ currencyId: 1, createdAt: 1 })
    .lean();

  const grouped = {};

  logsOnDate.forEach((log) => {
    if (!grouped[log.currencyId]) {
      grouped[log.currencyId] = {
        currencyId: log.currencyId,
        logs: [],
      };
    }
    grouped[log.currencyId].logs.push(log);
  });

  const currenciesWithLogsOnDate = Object.keys(grouped);

  // 2️⃣ Fallback: last before OR first after
  const fallback = await currencyLogModel.aggregate([
    {
      $match: {
        companyId,
        currencyId: { $nin: currenciesWithLogsOnDate },
      },
    },
    {
      $facet: {
        before: [
          { $match: { createdAt: { $lt: dayStart } } },
          { $sort: { currencyId: 1, createdAt: -1 } },
          {
            $group: {
              _id: "$currencyId",
              log: { $first: "$$ROOT" },
            },
          },
        ],
        after: [
          { $match: { createdAt: { $gte: dayEnd } } },
          { $sort: { currencyId: 1, createdAt: 1 } },
          {
            $group: {
              _id: "$currencyId",
              log: { $first: "$$ROOT" },
            },
          },
        ],
      },
    },
  ]);

  const beforeMap = {};
  const afterMap = {};

  fallback[0]?.before.forEach((b) => {
    beforeMap[b._id] = b.log;
  });

  fallback[0]?.after.forEach((a) => {
    afterMap[a._id] = a.log;
  });

  const allCurrencyIds = new Set([
    ...Object.keys(beforeMap),
    ...Object.keys(afterMap),
  ]);

  for (const currencyId of allCurrencyIds) {
    if (beforeMap[currencyId]) {
      grouped[currencyId] = {
        currencyId,
        logs: [beforeMap[currencyId]],
      };
    } else if (afterMap[currencyId]) {
      grouped[currencyId] = {
        currencyId,
        isAfterDate: true,
        logs: [afterMap[currencyId]],
      };
    }
  }

  // 🔹 OPTION 1: enrich with currency info
  const currencyIds = Object.values(grouped).map((g) => g.currencyId);

  const currencies = await currencyModel
    .find({ _id: { $in: currencyIds } })
    .select("_id currencyName is_primary currencyCode")
    .lean();

  const currencyMap = {};
  currencies.forEach((c) => {
    currencyMap[c._id] = c;
  });

  const finalData = Object.values(grouped).map((item) => ({
    ...item,
    currency: currencyMap[item.currencyId] || null,
  }));

  res.json({
    success: true,
    date,
    data: finalData,
  });
});
