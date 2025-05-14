import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";


dotenv.config();

const app = express();
app.use(cors()); // Enable CORS
app.use(express.json()); // Allow JSON requests

const PORT = process.env.PORT || 5000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_TABLE_NAME = process.env.SUPABASE_TABLE_NAME;
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN;
const S3_BUCKET_URL =
  process.env.S3_BUCKET_URL ||
  "https://fusion-networks-qa-dev.s3.eu-west-2.amazonaws.com";
// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});
// S3 Proxy Endpoint
app.get("/api/proxy/merged-results", async (req, res) => {
  try {
    const response = await fetch(`${S3_BUCKET_URL}/merged-results.json`);
    if (!response.ok) {
      throw new Error(`S3 request failed with status ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("S3 Proxy Error:", error);
    res.status(500).json({
      error: "Failed to fetch data from S3",
      details: error.message,
    });
  }
});

app.get("/api/getcredentials", (req, res) => {
  const authToken = req.headers["x-api-key"];

  if (authToken !== process.env.CREDS_API_KEY) {
    return res.status(403).json({ error: "Unauthorized access" });
  }

  const username = process.env.EMAIL;
  const password = process.env.PASSWORD;

  if (!username || !password) {
    return res
      .status(500)
      .json({ error: "Credentials not set in environment variables" });
  }

  return res.status(200).json({ username, password });
});

app.post("/api/verifycredentials", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    return res
      .status(200)
      .json({ message: "Credentials are valid", isAuthenticated: true });
  }

  // Default case: credentials are invalid
  return res
    .status(401)
    .json({ error: "Invalid username or password", isAuthenticated: false });
});
// API Route to Fetch All Data from Supabase
app.get("/api/data", async (req, res) => {
  try {
    let allData = [];
    let pageSize = 1000;
    let offset = 0;
    let moreData = true;

    while (moreData) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE_NAME}?offset=${offset}&limit=${pageSize}`,
        {
          headers: {
            apikey: SUPABASE_TOKEN,
          },
        }
      );

      if (!response.ok)
        throw new Error(`HTTP Error! Status: ${response.status}`);

      const data = await response.json();
      allData.push(...data);

      // If less than pageSize, we've reached the end
      if (data.length < pageSize) {
        moreData = false;
      } else {
        offset += pageSize;
      }
    }

    res.json(allData);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});


// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
