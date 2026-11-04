import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: new URL("./.env", import.meta.url) });

console.log("Node.js:", process.version);
console.log("MONGODB_URI loaded:", Boolean(process.env.MONGODB_URI));

if (!process.env.MONGODB_URI) {
  console.error("Missing MONGODB_URI in server/.env");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });

  console.log("SUCCESS: Connected to MongoDB Atlas.");
  console.log("Database:", mongoose.connection.name);
} catch (error) {
  console.error("CONNECTION FAILED:", error.name);
  console.error("Message:", error.message);
} finally {
  await mongoose.disconnect().catch(() => {});
}