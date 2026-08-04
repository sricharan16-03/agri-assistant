require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);


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

// Pre-warm the Render ML API on server cold-start — call /predict with dummy
// data so the ML model is fully loaded, not just the web process.
const ML_API_URL = "https://agri-ml-api.onrender.com";
const DUMMY_PREDICT_BODY = JSON.stringify({
  N: 90, P: 42, K: 43, temperature: 20.8, humidity: 82, ph: 6.5, rainfall: 202
});
fetch(`${ML_API_URL}/predict`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: DUMMY_PREDICT_BODY,
}).catch(() => {}); // fire-and-forget


app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API running" });
});

// Warmup endpoint — calls /predict with dummy data so the ML model fully loads
// Vercel hobby plan has a 60s function timeout, Render cold-start is ~30-50s
app.get("/api/warmup", async (req, res) => {
  try {
    await fetch(`${ML_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: DUMMY_PREDICT_BODY,
      signal: AbortSignal.timeout(58000), // just under Vercel's 60s limit
    });
    res.json({ ok: true, message: "ML API is warm" });
  } catch (err) {
    // Even if this times out, the Render server is now actively starting up
    console.log("Warmup result:", err?.name);
    res.json({ ok: true, message: "Warmup ping sent, ML loading" });
  }
});


app.post("/api/recommend", async (req, res) => {
  try {
    const response = await fetch(`${ML_API_URL}/predict`, {
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
