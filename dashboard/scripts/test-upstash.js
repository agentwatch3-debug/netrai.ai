const net = require("net");
const tls = require("tls");

const redisHost = "classic-opossum-136741.upstash.io";
const redisPort = 6379;
const redisPassword = "gQAAAAAAAhYlAAIgcDExMDU1OTM5NTYwZTc0YmIxYTI3NmY0ZWIwNzg0NTNlMA";

console.log("================================================================================");
console.log(" 🚀 Testing Upstash Cloud Redis Connection...");
console.log("================================================================================\n");

const socket = tls.connect(redisPort, redisHost, { rejectUnauthorized: false }, () => {
  console.log("✅ TLS Socket connected to Upstash Redis!");

  // Send AUTH and PING commands
  socket.write(`AUTH ${redisPassword}\r\n`);
  socket.write("SET agentwatch:status ready\r\n");
  socket.write("GET agentwatch:status\r\n");
  socket.write("PING\r\n");
});

socket.on("data", (data) => {
  const response = data.toString();
  console.log("Received from Upstash Redis:\n" + response.trim());
  if (response.includes("PONG") || response.includes("ready") || response.includes("OK")) {
    console.log("\n🎉 Upstash Cloud Redis is 100% HEALTHY & READY!");
    socket.end();
  }
});

socket.on("error", (err) => {
  console.error("❌ Redis Error:", err);
  process.exit(1);
});
