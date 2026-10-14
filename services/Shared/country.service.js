const countryModel = require("../../models/Shared/country.model");

let cache = null;
let cachedAt = 0;
const TTL = 60 * 60 * 1000; // 1 hour

exports.getAllCountries = async () => {
  if (cache && Date.now() - cachedAt < TTL) return cache;

  cache = await countryModel
    .find({ isActive: true })
    .select("name nameAr nameTr iso2 iso3 phoneCode currency")
    .sort({ name: 1 })
    .lean();
  cachedAt = Date.now();
  return cache;
};

exports.getCountryById = (id) => countryModel.findById(id).lean();
