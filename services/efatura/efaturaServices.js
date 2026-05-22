const asyncHandler = require("express-async-handler");
const { default: axios } = require("axios");
const { createInvoiceHistory } = require("../invoiceHistoryService");
const orderModel = require("../../models/Accounting/Sales/orderModel");

const url = "https://efaturaservice.turkcellesirket.com/v1/";
const urlV2 = "https://efaturaservice.turkcellesirket.com/v2/";
// const url = "https://efaturaservicetest.isim360.com/v1/";
// const urlV2 = "https://efaturaservicetest.isim360.com/v2/";

// Create E-Fatura
exports.createEFatura = asyncHandler(async (req, res, next) => {
  const { apiKey } = req?.body;
  console.log(`apiKey: ${apiKey}`);

  const orderNumber = req.body?.orderInfoModel?.orderNumber;
  const { type } = req.params;

  if (!orderNumber) {
    console.log("Missing orderNumber in request body.");
    return res.status(400).json({ status: "error", message: "orderNumber" });
  }

  if (!apiKey) {
    console.log("Missing apiKey in request body.");
    return res.status(400).json({ status: "error", message: "apiKey" });
  }

  if (!type) {
    console.log("Missing type in request params.");
    return res.status(400).json({ status: "error", message: "type" });
  }

  try {
    const response = await axios.post(
      `${type === "efatura" ? url : urlV2}${
        type === "efatura" ? "outboxinvoice" : "earchive"
      }/create`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      }
    );
    const companyId = req.query.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const timeIsoString = new Date().toISOString();

    await orderModel.findByIdAndUpdate(
      orderNumber,
      {
        efaturaGenerated: true,
        ettn: response?.data?.id,
        efaturaStatus: "0",
      },
      { new: true }
    );

    createInvoiceHistory(
      companyId,
      orderNumber,
      "edit",
      req.user?._id,
      req.body?.orderInfoModel?.orderDate || timeIsoString
    );

    return res.status(201).json({
      status: "success",
      message: "SUCCESS",
      data: response?.data,
    });
  } catch (error) {
    console.error("E-Fatura Error Response:", error?.response?.data || error);
    return res.status(500).json({
      status: "error",
      message: "E-Fatura request failed",
      details: error?.response?.data,
    });
  }
});

// Get E-Fatura status
exports.getEFaturaStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const apiKey = req.headers["x-api-key"];
  console.log(`apiKey: ${apiKey}`);
  console.log(`id: ${id}`);

  if (!id) {
    console.log("Missing id in request params.");
    return res.status(400).json({ status: "error", message: "id" });
  }

  if (!apiKey) {
    console.log("Missing apiKey in request params.");
    return res.status(401).json({ status: "error", message: "apiKey" });
  }

  try {
    const response = await axios.get(`${urlV2}/outboxinvoice/${id}/status`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    return res.status(201).json({
      status: true,
      message: "SUCCESS",
      data: response?.data,
    });
  } catch (error) {
    console.error("E-Fatura Error Response:", error?.response?.data || error);
    return res.status(500).json({
      status: "error",
      message: "E-Fatura status request failed",
      details: error,
    });
  }
});

// Update E-Fatura status
exports.updateEfaturaStatus = asyncHandler(async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const body = req.body;

  console.log(`apiKey: ${apiKey}`);
  console.log(`body: ${body}`);

  if (!apiKey) {
    return res
      .status(401)
      .json({ status: "error", message: "apiKey is required" });
  }

  try {
    const response = await axios.put(
      `${url}outboxinvoice/updatestatuslist`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      }
    );

    return res.status(200).json({
      status: true,
      message: "SUCCESS",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "E-Fatura Update Status Error:",
      error?.response?.data || error
    );
    return res.status(500).json({
      status: "error",
      message: "Failed to update E-Fatura status",
      details: error?.response?.data || error.message,
    });
  }
});

// Get All Incoming E-Fatura
exports.getAllIncomingEFatura = asyncHandler(async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const queryParams = { ...req.query };

  if (!apiKey) {
    return res
      .status(401)
      .json({ status: "error", message: "apiKey is required" });
  }

  try {
    const response = await axios.get(`${url}inboxinvoice/list`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      params: queryParams,
    });

    return res.status(200).json({
      status: true,
      message: "SUCCESS",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "E-Fatura Get Incoming Error:",
      error?.response?.data || error
    );
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch incoming E-Fatura",
      details: error?.response?.data || error.message,
    });
  }
});

// Get Custom E-Fatura (HTML/UBL)
exports.getEFaturaCustom = asyncHandler(async (req, res) => {
  const { id, type } = req.params;
  const apiKey = req.headers["x-api-key"];

  if (!id) {
    return res.status(400).json({ status: "error", message: "id is required" });
  }

  if (!type) {
    return res
      .status(400)
      .json({ status: "error", message: "type is required" });
  }

  if (!apiKey) {
    return res
      .status(401)
      .json({ status: "error", message: "apiKey is required" });
  }

  try {
    const response = await axios.get(`${urlV2}inboxinvoice/${id}/${type}`, {
      headers: {
        "x-api-key": apiKey,
      },
      responseType: "text", // HTML or XML
    });

    return res.status(200).send(response.data);
  } catch (error) {
    console.error("E-Fatura Custom Error:", error?.response?.data || error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch E-Fatura custom data",
      details: error?.response?.data || error.message,
    });
  }
});

// Reply to Commercial E-Fatura
exports.replyCommercialEfatura = asyncHandler(async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const body = req.body;

  if (!apiKey) {
    return res
      .status(401)
      .json({ status: "error", message: "apiKey is required" });
  }

  try {
    const response = await axios.post(`${url}invoiceresponse`, body, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    return res.status(200).json({
      status: true,
      message: "SUCCESS",
      data: response.data,
    });
  } catch (error) {
    console.error("E-Fatura Reply Error:", error?.response?.data || error);
    return res.status(500).json({
      status: "error",
      message: "Failed to reply to commercial E-Fatura",
      details: error?.response?.data || error.message,
    });
  }
});
