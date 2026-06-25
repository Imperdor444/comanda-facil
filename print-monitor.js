const fs = require("fs");
const http = require("http");

const SUPABASE_URL = "https://eskoaldublplqjkxghtj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVza29hbGR1YmxwbHFqa3hnaHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc1NDIsImV4cCI6MjA5NTgyMzU0Mn0.p6lMGao-9ay55rndkMC8Z3HLWWu8AAlxQNi5e_E-H0o";
const SUPABASE_EMAIL = process.env.SABOR_DE_MAE_EMAIL;
const SUPABASE_PASSWORD = process.env.SABOR_DE_MAE_PASSWORD;
const PRINT_SERVER_URL = "http://127.0.0.1:8787";
const PRINT_API_KEY = process.env.PRINT_API_KEY || "";
const PRINTER_IP = "192.168.1.223";
const PRINTER_PORT = 9100;
const WIDTH = 32;
const POLL_MS = 8000;
const STATE_FILE = ".print-monitor-state.json";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const printed = loadPrinted();
let bootstrapped = false;
let accessToken = "";

console.log("Monitor de impressao Sabor de Mae iniciado.");
console.log(`Servidor local: ${PRINT_SERVER_URL}`);
console.log(`Impressora: ${PRINTER_IP}:${PRINTER_PORT}`);

if (!SUPABASE_EMAIL || !SUPABASE_PASSWORD) {
  console.log("Configure SABOR_DE_MAE_EMAIL e SABOR_DE_MAE_PASSWORD antes de iniciar.");
  process.exit(1);
}

tick();
setInterval(tick, POLL_MS);

async function tick() {
  try {
    const orders = await fetchNewOrders();

    if (!bootstrapped) {
      orders.forEach((order) => printed.add(order.id));
      savePrinted();
      bootstrapped = true;
      console.log(`Monitor pronto. ${orders.length} pedido(s) novo(s) existente(s) foram ignorados para evitar reimpressao.`);
      return;
    }

    for (const order of orders) {
      if (printed.has(order.id)) continue;
      const ok = await printOrder(order);
      if (ok) {
        printed.add(order.id);
        savePrinted();
        console.log(`Impresso: ${order.customer_name} - ${money.format(Number(order.total))}`);
      } else {
        console.log(`Falhou ao imprimir: ${order.customer_name}`);
      }
    }
  } catch (error) {
    console.log(`Erro no monitor: ${error.message}`);
  }
}

async function fetchNewOrders() {
  const token = await getAccessToken();
  const url = `${SUPABASE_URL}/rest/v1/orders?select=*,order_items(*)&status=eq.novo&order=created_at.asc&limit=20`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase respondeu ${response.status}`);
  }

  return response.json();
}

async function getAccessToken() {
  if (accessToken) return accessToken;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: SUPABASE_EMAIL,
      password: SUPABASE_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`login Supabase falhou ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  return accessToken;
}

async function printOrder(order) {
  const receipt = buildReceipt(order);
  const body = JSON.stringify({
    receipt,
    printerIp: PRINTER_IP,
    printerPort: PRINTER_PORT,
  });

  const headers = { "Content-Type": "application/json" };
  if (PRINT_API_KEY) {
    headers.Authorization = `Bearer ${PRINT_API_KEY}`;
  }

  const response = await fetch(`${PRINT_SERVER_URL}/print`, {
    method: "POST",
    headers,
    body,
  });

  return response.ok;
}

function buildReceipt(order) {
  const line = "-".repeat(WIDTH);
  const items = (order.order_items || []).map((item) =>
    align(`${item.quantity}x ${item.product_name}`, sanitizeForPrinter(money.format(Number(item.subtotal))))
  );

  return sanitizeForPrinter([
    center("SABOR DE MAE"),
    line,
    center("PEDIDO DO SITE"),
    dateTime.format(new Date(order.created_at)),
    line,
    `Cliente: ${order.customer_name}`,
    `Tipo: ${order.delivery_type}`,
    `Endereco: ${order.customer_address || "Combinar"}`,
    `Pagamento: ${order.payment_method}`,
    order.change_for ? `Troco: ${order.change_for}` : "",
    line,
    ...items,
    line,
    align("TOTAL", sanitizeForPrinter(money.format(Number(order.total)))),
    line,
    order.note ? `Obs: ${order.note}` : "Obs: sem observacao",
    line,
    `Codigo: ${order.id.slice(0, 8).toUpperCase()}`,
  ].filter(Boolean).join("\n"));
}

/**
 * Remove non-breaking spaces (U+00A0) and other problematic Unicode characters
 * that corrupt output on ESC/POS thermal printers.
 * Fixes the "A20" bug where "R$\u00a0120,00" becomes "R$ A20,00" on the printer.
 */
function sanitizeForPrinter(text) {
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/\ufeff/g, "")
    .replace(/[\u2000-\u200b]/g, " ");
}

function align(left, right) {
  const cleanLeft = String(left).slice(0, Math.max(1, WIDTH - String(right).length - 1));
  const spaces = Math.max(1, WIDTH - cleanLeft.length - String(right).length);
  return `${cleanLeft}${" ".repeat(spaces)}${right}`;
}

function center(text) {
  const clean = String(text).slice(0, WIDTH);
  const left = Math.floor((WIDTH - clean.length) / 2);
  return `${" ".repeat(Math.max(0, left))}${clean}`;
}

function loadPrinted() {
  try {
    return new Set(JSON.parse(fs.readFileSync(STATE_FILE, "utf8")));
  } catch {
    return new Set();
  }
}

function savePrinted() {
  fs.writeFileSync(STATE_FILE, JSON.stringify([...printed].slice(-500), null, 2));
}
