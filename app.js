const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const state = loadState();
let activeOrderId = null;
let deferredInstallPrompt = null;

const els = {
  installButton: document.querySelector("#installButton"),
  todayTotal: document.querySelector("#todayTotal"),
  openOrders: document.querySelector("#openOrders"),
  orderNameInput: document.querySelector("#orderNameInput"),
  newOrderButton: document.querySelector("#newOrderButton"),
  ordersList: document.querySelector("#ordersList"),
  productForm: document.querySelector("#productForm"),
  productName: document.querySelector("#productName"),
  productPrice: document.querySelector("#productPrice"),
  productCategory: document.querySelector("#productCategory"),
  productsList: document.querySelector("#productsList"),
  reportTotal: document.querySelector("#reportTotal"),
  salesList: document.querySelector("#salesList"),
  settingsForm: document.querySelector("#settingsForm"),
  restaurantName: document.querySelector("#restaurantName"),
  printerWidth: document.querySelector("#printerWidth"),
  printerIp: document.querySelector("#printerIp"),
  printerPort: document.querySelector("#printerPort"),
  printServerUrl: document.querySelector("#printServerUrl"),
  testPrinterButton: document.querySelector("#testPrinterButton"),
  orderDrawer: document.querySelector("#orderDrawer"),
  drawerTitle: document.querySelector("#drawerTitle"),
  drawerItems: document.querySelector("#drawerItems"),
  productPicker: document.querySelector("#productPicker"),
  drawerTotal: document.querySelector("#drawerTotal"),
  closeDrawer: document.querySelector("#closeDrawer"),
  closeOrderButton: document.querySelector("#closeOrderButton"),
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});

els.newOrderButton.addEventListener("click", createOrder);
els.productForm.addEventListener("submit", saveProduct);
els.settingsForm.addEventListener("submit", saveSettings);
els.testPrinterButton.addEventListener("click", testPrinter);
els.closeDrawer.addEventListener("click", closeDrawer);
els.closeOrderButton.addEventListener("click", closeOrder);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installButton.hidden = false;
});

els.installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

seedProducts();
render();

function loadState() {
  const saved = localStorage.getItem("comandaFacilState");
  if (saved) return JSON.parse(saved);

  return {
    products: [],
    orders: [],
    sales: [],
    settings: {
      restaurantName: "Restaurante",
      printerWidth: 32,
      printerIp: "192.168.1.223",
      printerPort: 9100,
      printServerUrl: "http://127.0.0.1:8787",
    },
  };
}

function saveState() {
  localStorage.setItem("comandaFacilState", JSON.stringify(state));
}

function seedProducts() {
  if (state.products.length) return;
  state.products = [
    product("Prato feito", 18, "Comida"),
    product("Marmita pequena", 16, "Comida"),
    product("Marmita grande", 22, "Comida"),
    product("Refrigerante lata", 6, "Bebidas"),
    product("Suco natural", 8, "Bebidas"),
  ];
  saveState();
}

function product(name, price, category = "") {
  return {
    id: createId(),
    name,
    price,
    category,
  };
}

function createId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showView(viewId) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewId);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
}

function createOrder() {
  const name = els.orderNameInput.value.trim() || `Comanda ${state.orders.length + 1}`;
  state.orders.unshift({
    id: createId(),
    name,
    items: [],
    createdAt: new Date().toISOString(),
  });
  els.orderNameInput.value = "";
  saveState();
  render();
}

function saveProduct(event) {
  event.preventDefault();
  const name = els.productName.value.trim();
  const price = Number(els.productPrice.value);
  const category = els.productCategory.value.trim();
  if (!name || Number.isNaN(price)) return;

  state.products.push(product(name, price, category));
  els.productForm.reset();
  saveState();
  render();
}

function saveSettings(event) {
  event.preventDefault();
  state.settings.restaurantName = els.restaurantName.value.trim() || "Restaurante";
  state.settings.printerWidth = Number(els.printerWidth.value) || 32;
  state.settings.printerIp = els.printerIp.value.trim() || "192.168.1.223";
  state.settings.printerPort = Number(els.printerPort.value) || 9100;
  state.settings.printServerUrl = normalizeServerUrl(els.printServerUrl.value);
  saveState();
  render();
  alert("Ajustes salvos.");
}

async function testPrinter() {
  const receipt = buildReceipt({
    name: "Teste",
    closedAt: new Date().toISOString(),
    total: 1,
    items: [
      {
        name: "Teste de impressao",
        price: 1,
        quantity: 1,
      },
    ],
  });
  const printed = await printViaServer(receipt);
  alert(printed ? "Teste enviado para a impressora." : "Servidor nao encontrado. Confira a URL nos ajustes.");
}

function openOrder(id) {
  activeOrderId = id;
  els.orderDrawer.hidden = false;
  renderDrawer();
}

function closeDrawer() {
  activeOrderId = null;
  els.orderDrawer.hidden = true;
}

function addItem(productId) {
  const order = getActiveOrder();
  const itemProduct = state.products.find((item) => item.id === productId);
  if (!order || !itemProduct) return;

  const existing = order.items.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    order.items.push({
      productId,
      name: itemProduct.name,
      price: itemProduct.price,
      quantity: 1,
    });
  }
  saveState();
  render();
  renderDrawer();
}

function changeQuantity(productId, delta) {
  const order = getActiveOrder();
  if (!order) return;
  const item = order.items.find((entry) => entry.productId === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    order.items = order.items.filter((entry) => entry.productId !== productId);
  }
  saveState();
  render();
  renderDrawer();
}

function closeOrder() {
  const order = getActiveOrder();
  if (!order || !order.items.length) {
    alert("Adicione pelo menos um item antes de fechar.");
    return;
  }

  const sale = {
    ...order,
    closedAt: new Date().toISOString(),
    total: totalOrder(order),
  };
  state.sales.unshift(sale);
  state.orders = state.orders.filter((entry) => entry.id !== order.id);
  saveState();
  printReceipt(sale);
  closeDrawer();
  render();
}

function deleteProduct(id) {
  state.products = state.products.filter((item) => item.id !== id);
  saveState();
  render();
}

function getActiveOrder() {
  return state.orders.find((order) => order.id === activeOrderId);
}

function totalOrder(order) {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function isToday(isoDate) {
  return new Date(isoDate).toLocaleDateString("pt-BR") === new Date().toLocaleDateString("pt-BR");
}

function render() {
  const todaySales = state.sales.filter((sale) => isToday(sale.closedAt));
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0);

  els.todayTotal.textContent = money.format(todayTotal);
  els.reportTotal.textContent = money.format(todayTotal);
  els.openOrders.textContent = state.orders.length;
  els.restaurantName.value = state.settings.restaurantName;
  els.printerWidth.value = state.settings.printerWidth;
  els.printerIp.value = state.settings.printerIp || "192.168.1.223";
  els.printerPort.value = state.settings.printerPort || 9100;
  els.printServerUrl.value = state.settings.printServerUrl || "http://127.0.0.1:8787";

  els.ordersList.innerHTML = state.orders.length
    ? state.orders.map(orderRow).join("")
    : emptyText("Nenhuma comanda aberta.");

  els.productsList.innerHTML = state.products.length
    ? state.products.map(productRow).join("")
    : emptyText("Cadastre o primeiro produto.");

  els.salesList.innerHTML = todaySales.length
    ? todaySales.map(saleRow).join("")
    : emptyText("Nenhuma venda fechada hoje.");

  bindDynamicButtons();
}

function renderDrawer() {
  const order = getActiveOrder();
  if (!order) return;
  els.drawerTitle.textContent = order.name;
  els.drawerTotal.textContent = money.format(totalOrder(order));
  els.drawerItems.innerHTML = order.items.length
    ? order.items.map(orderItemRow).join("")
    : emptyText("A comanda ainda está vazia.");
  els.productPicker.innerHTML = state.products.map(pickerButton).join("");
  bindDynamicButtons();
}

function bindDynamicButtons() {
  document.querySelectorAll("[data-open-order]").forEach((button) => {
    button.onclick = () => openOrder(button.dataset.openOrder);
  });
  document.querySelectorAll("[data-add-item]").forEach((button) => {
    button.onclick = () => addItem(button.dataset.addItem);
  });
  document.querySelectorAll("[data-plus]").forEach((button) => {
    button.onclick = () => changeQuantity(button.dataset.plus, 1);
  });
  document.querySelectorAll("[data-minus]").forEach((button) => {
    button.onclick = () => changeQuantity(button.dataset.minus, -1);
  });
  document.querySelectorAll("[data-delete-product]").forEach((button) => {
    button.onclick = () => deleteProduct(button.dataset.deleteProduct);
  });
  document.querySelectorAll("[data-print-sale]").forEach((button) => {
    button.onclick = () => {
      const sale = state.sales.find((entry) => entry.id === button.dataset.printSale);
      if (sale) printReceipt(sale);
    };
  });
}

function orderRow(order) {
  return `
    <article class="row">
      <div>
        <h3>${escapeHtml(order.name)}</h3>
        <p class="meta">${order.items.length} itens - ${money.format(totalOrder(order))}</p>
      </div>
      <button class="small-button" data-open-order="${order.id}">Abrir</button>
    </article>
  `;
}

function productRow(item) {
  return `
    <article class="row">
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="meta">${escapeHtml(item.category || "Sem categoria")} - ${money.format(item.price)}</p>
      </div>
      <button class="danger-button small-button" data-delete-product="${item.id}">Excluir</button>
    </article>
  `;
}

function saleRow(sale) {
  const time = new Date(sale.closedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `
    <article class="row">
      <div>
        <h3>${escapeHtml(sale.name)}</h3>
        <p class="meta">${time} - ${money.format(sale.total)}</p>
      </div>
      <button class="ghost-button small-button" data-print-sale="${sale.id}">Imprimir</button>
    </article>
  `;
}

function orderItemRow(item) {
  return `
    <article class="row">
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="meta">${item.quantity} x ${money.format(item.price)}</p>
      </div>
      <div class="row-actions">
        <button class="ghost-button small-button" data-minus="${item.productId}">-</button>
        <button class="small-button" data-plus="${item.productId}">+</button>
      </div>
    </article>
  `;
}

function pickerButton(item) {
  return `
    <button data-add-item="${item.id}">
      ${escapeHtml(item.name)}<br>
      <span class="meta">${money.format(item.price)}</span>
    </button>
  `;
}

function emptyText(text) {
  return `<p class="hint">${text}</p>`;
}

async function printReceipt(sale) {
  const receipt = buildReceipt(sale);
  const printedByServer = await printViaServer(receipt);
  if (printedByServer) return;

  printInBrowser(receipt);
}

function buildReceipt(sale) {
  const width = state.settings.printerWidth || 32;
  const line = "-".repeat(width);
  return [
    center(state.settings.restaurantName, width),
    line,
    `Comanda: ${sale.name}`,
    new Date(sale.closedAt).toLocaleString("pt-BR"),
    line,
    ...sale.items.map((item) => receiptItem(item, width)),
    line,
    align("TOTAL", money.format(sale.total), width),
    line,
    center("Obrigado pela preferência", width),
  ].join("\n");
}

async function printViaServer(receipt) {
  try {
    const response = await fetch(`${normalizeServerUrl(state.settings.printServerUrl)}/print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receipt,
        printerIp: state.settings.printerIp || "192.168.1.223",
        printerPort: Number(state.settings.printerPort) || 9100,
      }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

function normalizeServerUrl(url) {
  const value = String(url || "").trim() || "http://127.0.0.1:8787";
  return value.replace(/\/+$/, "");
}

function printInBrowser(receipt) {
  const printArea = document.createElement("section");
  printArea.className = "print-area";
  printArea.textContent = receipt;
  document.body.appendChild(printArea);
  window.print();
  setTimeout(() => printArea.remove(), 1200);
}

function receiptItem(item, width) {
  const left = `${item.quantity}x ${item.name}`;
  const right = money.format(item.price * item.quantity);
  return align(left, right, width);
}

function align(left, right, width) {
  const cleanLeft = left.slice(0, Math.max(1, width - right.length - 1));
  const spaces = Math.max(1, width - cleanLeft.length - right.length);
  return `${cleanLeft}${" ".repeat(spaces)}${right}`;
}

function center(text, width) {
  const trimmed = text.slice(0, width);
  const spaces = Math.max(0, Math.floor((width - trimmed.length) / 2));
  return `${" ".repeat(spaces)}${trimmed}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
