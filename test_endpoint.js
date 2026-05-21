import http from "http";

const req = http.request(
  {
    hostname: "localhost",
    port: 3000,
    path: "/api/analyze",
    method: "POST",
    headers: { "Content-Type": "application/json" },
  },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => console.log("Status:", res.statusCode, "\n", data.slice(0, 100)));
  }
);
req.end(JSON.stringify({ a: "A".repeat(51 * 1024 * 1024) })); // 51MB
