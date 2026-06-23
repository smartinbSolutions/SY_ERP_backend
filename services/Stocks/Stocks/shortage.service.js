const shortageModel = require("../../../models/Stocks/Stock/shortage.Model");

exports.createShortageService = async ({ session, body, companyId }) => {
  const exists = await shortageModel
    .findOne({
      companyId,
      productId: body.productId,
      warehouseId: body.warehouseId,
      status: {
        $in: ["pending", "approved", "ordered"],
      },
      isDeleted: false,
    })
    .session(session);

  if (exists) {
    throw new Error("Shortage already exists for this product");
  }
  const shortage = await shortageModel.create([body], {
    session,
  });

  return shortage[0];
};

exports.updateShortageService = async ({
  session,
  id,
  body,
  companyId,
  user,
}) => {
  const shortage = await shortageModel.findOneAndUpdate(
    {
      _id: id,
      companyId,
      isDeleted: false,
    },
    {
      ...body,
      updatedBy: user,
    },
    {
      new: true,
      session,
    },
  );

  if (!shortage) {
    throw new Error("Shortage not found");
  }

  return shortage;
};
