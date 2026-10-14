// scripts/seedCountries.js
require("dotenv").config({ path: "config.env" });
const mongoose = require("mongoose");

const countries = require("../utils/data/countries.seed.json");
const countryModel = require("../models/Shared/country.model");

(async () => {
  await mongoose.connect(process.env.DB_URI);

  await countryModel.bulkWrite(
    countries.map((c) => ({
      updateOne: {
        filter: { iso2: c.iso2 },
        update: { $set: c },
        upsert: true,
      },
    })),
  );

  console.log("Seeded", countries.length);
  await mongoose.disconnect();
})();
