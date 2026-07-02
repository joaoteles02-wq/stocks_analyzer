import "dotenv/config";

console.log("GEMINI_API_KEY in env:", process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 8)}...${process.env.GEMINI_API_KEY.slice(-5)}` : "not set");
console.log("GOOGLE_API_KEY in env:", process.env.GOOGLE_API_KEY ? `${process.env.GOOGLE_API_KEY.slice(0, 8)}...${process.env.GOOGLE_API_KEY.slice(-5)}` : "not set");
