import http from "http";
const req = http.request(
  { hostname: "localhost", port: 3000, path: "/api/process-data", method: "POST", headers: {"Content-Type": "application/json"} },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => console.log("Status:", res.statusCode, "\n", data));
  }
);
req.end(JSON.stringify({ token: "invalid_token", spreadsheetId: "123" }));
