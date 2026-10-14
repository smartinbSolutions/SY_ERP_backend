const {
  getAllCountries,
  getCountryById,
} = require("../../services/Shared/country.service");

exports.getCountries = async (req, res, next) => {
  try {
    const data = await getAllCountries();
    res.status(200).json({ status: "success", results: data.length, data });
  } catch (err) {
    next(err);
  }
};

exports.getCountry = async (req, res, next) => {
  try {
    const data = await getCountryById(req.params.id);
    if (!data) {
      return res
        .status(404)
        .json({ status: "fail", message: "Country not found" });
    }
    res.status(200).json({ status: "success", data });
  } catch (err) {
    next(err);
  }
};
