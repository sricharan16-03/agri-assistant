require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fetch = require("node-fetch");

const Contact = require("../models/Contact");
const Query = require("../models/Query");
const Crop = require("../models/Crop");

const app = express();


app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());


let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  isConnected = true;
  console.log("✅ MongoDB connected (Vercel)");
}

connectDB().catch(err =>
  console.error("❌ MongoDB connection error:", err)
);


app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API running" });
});


app.post("/api/recommend", async (req, res) => {
  try {
    const response = await fetch("https://agri-ml-api.onrender.com/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const result = await response.json();

    await new Query({ ...req.body, recommended: [result.crop] }).save();

    res.json({ recommended: [result.crop] });
  } catch (error) {
    console.error("Prediction API call failed:", error);
    res.status(500).json({ msg: "Prediction failed" });
  }
});


app.get("/api/crops", async (req, res) => {
  try {
    const crops = await Crop.find();

    if (crops.length === 0) {
      return res.json([
        { name: "Wheat", soil: "Loamy", climate: "Cool", yield: "4 tons/hectare" },
        { name: "Rice", soil: "Clayey", climate: "Hot & Humid", yield: "5 tons/hectare" },
      ]);
    }

    res.json(crops);
  } catch {
    res.status(500).json({ msg: "Failed to load crops" });
  }
});


app.get("/api/techniques", (req, res) => {
  res.json([
    { name: "Drip Irrigation", desc: "Efficient water use for crops." },
    { name: "Organic Farming", desc: "Eco-friendly farming techniques." },
    { name: "Precision Agriculture", desc: "Uses GPS & sensors to monitor crops." },
    { name: "Hydroponics", desc: "Soilless farming using nutrient solution." },
    { name: "Vertical Farming", desc: "Indoor stacked crop cultivation." },
  ]);
});


app.get("/api/schemes", (req, res) => {
  res.json([
    {
      name: "PM-Kisan Samman Nidhi",
      benefit: "₹6000/year income support",
      desc: "Income support to farmer families",
      link: "https://pmkisan.gov.in/"
    },
    {
      name: "Pradhan Mantri Fasal Bima Yojana",
      benefit: "Crop insurance cover",
      desc: "Protection from crop loss",
      link: "https://pmfby.gov.in/"
    },
    {
      name: "Soil Health Card Scheme",
      benefit: "Free soil testing & nutrient report",
      desc: "Improves soil productivity",
      link: "https://soilhealth.dac.gov.in/"
    },
  ]);
});


app.get("/api/diseases", (req, res) => {
  res.json([
    { crop: "Wheat", disease: "Rust", solution: "Resistant varieties + fungicide" },
    { crop: "Rice", disease: "Blast", solution: "Spacing + proper fungicide" },
    { crop: "Potato", disease: "Late Blight", solution: "Preventive fungicide + drainage" },
  ]);
});


app.post("/api/npk-advisor", (req, res) => {
  const { N, P, K } = req.body;
  const advice = [];

  if (N < 50) advice.push("Add Urea (Nitrogen fertilizer)");
  if (P < 40) advice.push("Use DAP (Phosphorus fertilizer)");
  if (K < 40) advice.push("Apply MOP (Potassium fertilizer)");

  res.json({ advice });
});


app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;
  await new Contact({ name, email, message }).save();
  res.json({ success: true, msg: "Message saved!" });
});


module.exports = app;
