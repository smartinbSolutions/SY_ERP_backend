const ProductMovementSchema = require("../models/productMovementModel");
const ApiError = require("./apiError");

const createProductMovement = async ({
  productId,
  reference,
  newQuantity,
  quantity,
  movementType,
  source,
  companyId,
  desc,
  enterPrice,
  enterPriceMainCurrency,
  outPrice,
  outPriceMainCurrrency,
  stockId,
  sellingPrice,
  buyingPrice,
  exchangeRate,
  movementDate,
  session,
}) => {
  try {
    console.log(source);

    const movementPayload = {
      productId,
      reference,
      quantity,
      newQuantity,
      movementType,
      source,
      desc,
      companyId,
      enterPrice,
      enterPriceMainCurrency,
      outPrice,
      outPriceMainCurrrency,
      exchangeRate,
      referenceModel:
        source === "Sales Invoice"
          ? "Sales"
          : source === "Sales Invoice Cancellation"
            ? "Sales"
            : source === "Sales Invoice Reverse Update"
              ? "Sales"
              : source === "Purchase Invoice"
                ? "PurchaseInvoices"
                : source === "Stock reconciliation"
                  ? "Reconciliation-v1"
                  : source === "Stock Transfer"
                    ? "StockTransfer"
                    : source === "POS Receipt"
                      ? "posReceipts"
                      : source === "POS Receipt Cancellation"
                        ? "posReceipts"
                        : source === "Resturant Order"
                          ? "MenuOrder"
                          : source === "Refund POS Receipt"
                            ? "RefundPosSales"
                            : source === "Manufacturing"
                              ? "productionLog"
                              : source === "Refund Purchase Invoice"
                                ? "refundpurchaseinvoices"
                                : source === "Refund Sales Invoice"
                                  ? "refundSales"
                                  : source === "Purchase Invoice Cancellation"
                                    ? "PurchaseInvoices"
                                    : source ===
                                        "Purchase Invoice Reverse Update"
                                      ? "PurchaseInvoices"
                                      : null,
      stockId,
      sellingPrice,
      buyingPrice,
      movementDate: movementDate ? new Date(movementDate) : new Date(),
    };

    const [savedMovement] = session
      ? await ProductMovementSchema.create([movementPayload], { session })
      : await ProductMovementSchema.create([movementPayload]);

    return savedMovement;
  } catch (error) {
    console.error("Error saving product movement:", error);
    throw new ApiError(
      `Error creating product movement: ${error.message}`,
      500,
    );
  }
};

module.exports = { createProductMovement };
