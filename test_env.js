import http from "http";

const req = http.request(
  {
    hostname: "localhost",
    port: 3000,
    path: "/api/test_env",
    method: "GET"
  },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => console.log("Status:", res.statusCode, "\n", data));
  }
);
req.end();
