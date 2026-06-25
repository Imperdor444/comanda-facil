const http = require("http");
const net = require("net");
const os = require("os");

const HOST = "0.0.0.0";
const PORT = 8787;
const DEFAULT_PRINTER_IP = "192.168.1.223";
const DEFAULT_PRINTER_PORT = 9100;
const MAX_RECEIPT_BYTES = 8192;
const API_KEY = process.env.PRINT_API_KEY || "";

const ALLOWED_ORIGINS = [
  "https://imperdor444.github.io",
  "http://127.0.0.1",
  "http://localhost",
];

const server = http.createServer(async (request, response) => {
  setCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method !== "POST" || request.url !== "/print") {
    sendJson(response, 404, { ok: false, error: "Not found" });
    return;
  }

  if (API_KEY && !checkApiKey(request)) {
    sendJson(response, 401, { ok: false, error: "Unauthorized" });
    return;
  }

  try {
    const body = await readJson(request);
    const receipt = sanitizeForPrinter(String(body.receipt || "").trimEnd());
    const printerIp = String(body.printerIp || DEFAULT_PRINTER_IP).trim();
    const printerPort = Number(body.printerPort) || DEFAULT_PRINTER_PORT;

    if (!receipt) {
      sendJson(response, 400, { ok: false, error: "Receipt is empty" });
      return;
    }

    if (!isPrivateIp(printerIp)) {
      sendJson(response, 400, { ok: false, error: "Printer IP must be a private network address" });
      return;
    }

    if (!isValidPort(printerPort)) {
      sendJson(response, 400, { ok: false, error: "Printer port must be between 1 and 65535" });
      return;
    }

    await sendToPrinter(printerIp, printerPort, receipt);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Servidor de impressao em http://127.0.0.1:${PORT}`);
    if (API_KEY) {
      console.log("Autenticacao por API key ativada.");
    } else {
      console.log("AVISO: Sem API key configurada. Defina PRINT_API_KEY para proteger o servidor.");
    }
    getNetworkUrls().forEach((url) => console.log(`Celular na mesma rede: ${url}`));
  });
}

/**
 * Remove non-breaking spaces (U+00A0) and other problematic Unicode characters
 * that corrupt output on ESC/POS thermal printers.
 *
 * This fixes the "A20" bug where Intl.NumberFormat produces "R$\u00a0120,00"
 * and the non-breaking space gets misinterpreted by the printer, corrupting
 * the first digit of the number.
 */
function sanitizeForPrinter(text) {
  return String(text)
    .replace(/\u00a0/g, " ")       // non-breaking space → normal space
    .replace(/\u202f/g, " ")       // narrow no-break space → normal space
    .replace(/\ufeff/g, "")        // BOM → remove
    .replace(/[\u2000-\u200b]/g, " "); // various Unicode spaces → normal space
}

function setCorsHeaders(request, response) {
  const origin = String(request.headers.origin || "");
  const allowed = ALLOWED_ORIGINS.some((allowed) =>
    origin === allowed || origin.startsWith(allowed + ":")
  );

  if (allowed) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // Allow requests with no origin (same-origin, curl, etc.)
    response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Vary", "Origin");
}

function checkApiKey(request) {
  const auth = String(request.headers.authorization || "");
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7).trim() === API_KEY;
  }
  return false;
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > MAX_RECEIPT_BYTES) {
        reject(new Error("Request too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function sendToPrinter(ip, port, receipt) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port, timeout: 5000 }, () => {
      // ESC @ — initialize printer
      socket.write(Buffer.from([0x1b, 0x40]));
      // Send receipt text as latin1 (after sanitization, all chars are ASCII-safe)
      socket.write(Buffer.from(receipt + "\n\n\n", "latin1"));
      // GS V A 16 — partial cut with feed
      socket.write(Buffer.from([0x1d, 0x56, 0x41, 0x10]));
      socket.end();
    });

    socket.on("close", resolve);
    socket.on("timeout", () => {
      socket.destroy(new Error("Printer connection timeout"));
    });
    socket.on("error", reject);
  });
}

/**
 * Validate that the IP address is a private/local network address.
 * Blocks public IPs to prevent SSRF attacks.
 */
function isPrivateIp(ip) {
  if (!ip || typeof ip !== "string") return false;

  // Basic format validation
  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;

  // Allow only private ranges
  const [a, b] = nums;
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16
  if (a === 127) return true;                          // 127.0.0.0/8 (loopback)

  return false;
}

function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function getNetworkUrls() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${PORT}`);
}

// Export for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = { sanitizeForPrinter, isPrivateIp, isValidPort, checkApiKey };
}
