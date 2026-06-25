const WHATSAPP_NUMBER = "5569992824311";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const PRINT_SETTINGS_KEY = "saborDeMaePrintSettings";
const PRINTED_ORDERS_KEY = "saborDeMaePrintedOrders";
const DEFAULT_PRINT_SETTINGS = {
  enabled: false,
  serverUrl: "http://127.0.0.1:8787",
  printerIp: "192.168.1.223",
  printerPort: 9100,
  width: 32,
  apiKey: "",
};

const VALID_ORDER_STATUSES = ["novo", "aceito", "preparando", "finalizado", "cancelado"];
const MAX_INPUT_LENGTH = 500;

const supabaseClient = createSupabaseClient();
const state = {
  orders: [],
  products: [],
  activeTab: "orders",
  knownOrderIds: new Set(),
  soundEnabled: false,
  ordersChannel: null,
  refreshTimer: null,
  lastUpdate: null,
  printSettings: loadPrintSettings(),
  printedOrderIds: loadPrintedOrderIds(),
};

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const signOutButton = document.querySelector("#signOutButton");
const refreshButton = document.querySelector("#refreshButton");
const soundButton = document.querySelector("#soundButton");
const lastUpdateText = document.querySelector("#lastUpdateText");
const ordersList = document.querySelector("#ordersList");
const productsList = document.querySelector("#productsList");
const orderStatusFilter = document.querySelector("#orderStatusFilter");
const productForm = document.querySelector("#productForm");
const clearProductButton = document.querySelector("#clearProductButton");
const productImageInput = document.querySelector("#productImage");
const productImageFile = document.querySelector("#productImageFile");
const imageUploadMessage = document.querySelector("#imageUploadMessage");
const printSettingsForm = document.querySelector("#printSettingsForm");
const autoPrintEnabled = document.querySelector("#autoPrintEnabled");
const printServerUrl = document.querySelector("#printServerUrl");
const printerIp = document.querySelector("#printerIp");
const printerPort = document.querySelector("#printerPort");
const testPrintButton = document.querySelector("#testPrintButton");
const printStatus = document.querySelector("#printStatus");

initPanel();

async function initPanel() {
  if (!supabaseClient) {
    showLoginMessage("Supabase ainda nao foi configurado.");
    return;
  }

  bindEvents();

  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    showDashboard();
    await loadDashboard();
  } else {
    showLogin();
  }
}

function bindEvents() {
  loginForm.addEventListener("submit", handleLogin);
  signOutButton.addEventListener("click", handleSignOut);
  refreshButton.addEventListener("click", loadDashboard);
  soundButton.addEventListener("click", enableSound);
  orderStatusFilter.addEventListener("change", renderOrders);
  productForm.addEventListener("submit", saveProduct);
  clearProductButton.addEventListener("click", clearProductForm);
  productImageFile.addEventListener("change", uploadProductImage);
  printSettingsForm.addEventListener("submit", savePrintSettings);
  testPrintButton.addEventListener("click", testPrintServer);

  document.querySelectorAll("[data-panel-tab]").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.panelTab));
  });

  renderPrintSettings();
}

async function handleLogin(event) {
  event.preventDefault();
  showLoginMessage("");

  const email = document.querySelector("#loginEmail").value.trim();
  const password = document.querySelector("#loginPassword").value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showLoginMessage("E-mail ou senha nao conferem.");
    return;
  }

  showDashboard();
  await loadDashboard();
}

async function handleSignOut() {
  stopOrderMonitor();
  await supabaseClient.auth.signOut();
  showLogin();
}

function showLogin() {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  signOutButton.classList.add("hidden");
  soundButton.classList.add("hidden");
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  signOutButton.classList.remove("hidden");
  soundButton.classList.remove("hidden");
  startOrderMonitor();
}

function showLoginMessage(message) {
  loginMessage.textContent = message;
}

async function loadDashboard() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Atualizando...";

  await Promise.all([loadOrders(), loadProducts()]);
  rememberKnownOrders();
  state.lastUpdate = new Date();
  renderMetrics();
  renderOrders();
  renderProducts();
  renderLiveStatus();

  refreshButton.disabled = false;
  refreshButton.textContent = "Atualizar";
}

async function loadOrders() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    ordersList.innerHTML = `<div class="empty-state">Nao foi possivel carregar os pedidos.</div>`;
    return;
  }

  const previousIds = new Set(state.knownOrderIds);
  state.orders = data || [];
  state.lastUpdate = new Date();
  const freshOrders = state.orders.filter((order) => order.status === "novo" && !previousIds.has(order.id));
  rememberKnownOrders();

  if (previousIds.size && freshOrders.length) {
    notifyNewOrder(freshOrders[0]);
    freshOrders.forEach((order) => maybePrintOrder(order));
  }
}

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    productsList.innerHTML = `<div class="empty-state">Nao foi possivel carregar os produtos.</div>`;
    return;
  }

  state.products = data || [];
}

function renderMetrics() {
  const today = new Date().toISOString().slice(0, 10);
  const newOrders = state.orders.filter((order) => order.status === "novo").length;
  const todayTotal = state.orders
    .filter((order) => order.created_at.slice(0, 10) === today && order.status !== "cancelado")
    .reduce((sum, order) => sum + Number(order.total), 0);
  const activeProducts = state.products.filter((product) => product.active).length;

  document.querySelector("#newOrdersMetric").textContent = newOrders;
  document.querySelector("#salesMetric").textContent = currency.format(todayTotal);
  document.querySelector("#activeProductsMetric").textContent = activeProducts;
}

function renderOrders() {
  const filter = orderStatusFilter.value;
  const orders = filter === "all"
    ? state.orders
    : state.orders.filter((order) => order.status === filter);

  ordersList.innerHTML = orders.length
    ? orders.map(orderCard).join("")
    : `<div class="empty-state">Nenhum pedido encontrado.</div>`;

  document.querySelectorAll("[data-order-status]").forEach((select) => {
    select.addEventListener("change", () => updateOrderStatus(select.dataset.orderStatus, select.value));
  });
}

function orderCard(order) {
  const items = (order.order_items || [])
    .map((item) => `<strong>${item.quantity}x ${escapeHtml(item.product_name)}</strong> ${currency.format(Number(item.subtotal))}`)
    .join("<br>");
  const message = encodeURIComponent(orderWhatsAppMessage(order));

  return `
    <article class="order-card ${order.status === "novo" ? "is-new" : ""}">
      <div class="order-head">
        <div>
          <h3>${escapeHtml(order.customer_name)}</h3>
          <p class="muted">${dateTime.format(new Date(order.created_at))}</p>
        </div>
        <span class="status-pill ${escapeHtml(order.status)}">${escapeHtml(statusLabel(order.status))}</span>
      </div>

      <div class="details-grid">
        <div><span>Total</span><strong>${currency.format(Number(order.total))}</strong></div>
        <div><span>Tipo</span><strong>${escapeHtml(order.delivery_type)}</strong></div>
        <div><span>Pagamento</span><strong>${escapeHtml(order.payment_method)}</strong></div>
        <div><span>Endereco</span><strong>${escapeHtml(order.customer_address || "Combinar")}</strong></div>
      </div>

      <div class="item-list">
        <span>Itens</span>
        <p>${items || "Sem itens salvos"}</p>
        <span>Observacao</span>
        <p>${escapeHtml(order.note || "Sem observacao")}</p>
      </div>

      <div class="order-actions">
        <select data-order-status="${escapeHtml(order.id)}" aria-label="Status do pedido">
          ${statusOptions(order.status)}
        </select>
        <a class="whatsapp-link" href="https://wa.me/${WHATSAPP_NUMBER}?text=${message}" target="_blank" rel="noreferrer">Abrir no WhatsApp</a>
      </div>
    </article>
  `;
}

function startOrderMonitor() {
  if (state.refreshTimer) return;

  if (supabaseClient.channel && !state.ordersChannel) {
    state.ordersChannel = supabaseClient
      .channel("orders-monitor")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async () => {
        await loadOrders();
        renderMetrics();
        renderOrders();
        renderLiveStatus();
      })
      .subscribe();
  }

  state.refreshTimer = window.setInterval(async () => {
    await loadOrders();
    renderMetrics();
    renderOrders();
    renderLiveStatus();
  }, 15000);
}

function stopOrderMonitor() {
  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }

  if (state.ordersChannel) {
    supabaseClient.removeChannel(state.ordersChannel);
    state.ordersChannel = null;
  }
}

function rememberKnownOrders() {
  state.knownOrderIds = new Set(state.orders.map((order) => order.id));
}

function notifyNewOrder(order) {
  playAlertSound();
  if (state.activeTab !== "orders") {
    setActiveTab("orders");
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Novo pedido - Sabor de Mae", {
      body: `${order.customer_name} - ${currency.format(Number(order.total))}`,
    });
  }
}

async function maybePrintOrder(order) {
  if (!state.printSettings.enabled || order.status !== "novo" || state.printedOrderIds.has(order.id)) return;

  const printed = await printOrder(order);
  if (printed) {
    state.printedOrderIds.add(order.id);
    savePrintedOrderIds();
    setPrintStatus(`Pedido de ${order.customer_name} enviado para impressao.`);
  } else {
    setPrintStatus("Nao consegui imprimir. Confira se o servidor local esta ligado.");
  }
}

async function testPrintServer() {
  const printed = await sendReceiptToPrinter([
    center("Sabor de Mae", state.printSettings.width),
    "-".repeat(state.printSettings.width),
    "Teste de impressao",
    new Date().toLocaleString("pt-BR"),
    "-".repeat(state.printSettings.width),
    center("Servidor local OK", state.printSettings.width),
  ].join("\n"));

  setPrintStatus(printed ? "Teste enviado para impressora." : "Servidor local nao respondeu.");
}

async function printOrder(order) {
  return sendReceiptToPrinter(buildPrintReceipt(order));
}

async function sendReceiptToPrinter(receipt) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (state.printSettings.apiKey) {
      headers.Authorization = `Bearer ${state.printSettings.apiKey}`;
    }

    const response = await fetch(`${normalizeServerUrl(state.printSettings.serverUrl)}/print`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        receipt,
        printerIp: state.printSettings.printerIp,
        printerPort: Number(state.printSettings.printerPort),
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function buildPrintReceipt(order) {
  const width = state.printSettings.width;
  const line = "-".repeat(width);
  const items = (order.order_items || []).map((item) =>
    align(`${item.quantity}x ${item.product_name}`, sanitizeForPrinter(currency.format(Number(item.subtotal))), width)
  );

  return sanitizeForPrinter([
    center("Sabor de Mae", width),
    line,
    "PEDIDO DO SITE",
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
    align("TOTAL", sanitizeForPrinter(currency.format(Number(order.total))), width),
    line,
    order.note ? `Obs: ${order.note}` : "Obs: sem observacao",
    line,
    center("Obrigado pela preferencia", width),
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

function savePrintSettings(event) {
  event.preventDefault();
  const ipValue = printerIp.value.trim() || DEFAULT_PRINT_SETTINGS.printerIp;
  const portValue = Number(printerPort.value) || DEFAULT_PRINT_SETTINGS.printerPort;

  if (portValue < 1 || portValue > 65535) {
    setPrintStatus("Porta invalida. Use um valor entre 1 e 65535.");
    return;
  }

  state.printSettings = {
    ...state.printSettings,
    enabled: autoPrintEnabled.checked,
    serverUrl: normalizeServerUrl(printServerUrl.value),
    printerIp: ipValue,
    printerPort: portValue,
    apiKey: (document.querySelector("#printApiKey")?.value || "").trim(),
  };
  localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(state.printSettings));
  renderPrintSettings();
  setPrintStatus("Ajustes de impressao salvos.");
}

function renderPrintSettings() {
  autoPrintEnabled.checked = state.printSettings.enabled;
  printServerUrl.value = state.printSettings.serverUrl;
  printerIp.value = state.printSettings.printerIp;
  printerPort.value = state.printSettings.printerPort;
  const apiKeyInput = document.querySelector("#printApiKey");
  if (apiKeyInput) apiKeyInput.value = state.printSettings.apiKey || "";
}

function loadPrintSettings() {
  try {
    return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(localStorage.getItem(PRINT_SETTINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS };
  }
}

function loadPrintedOrderIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PRINTED_ORDERS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function savePrintedOrderIds() {
  localStorage.setItem(PRINTED_ORDERS_KEY, JSON.stringify([...state.printedOrderIds].slice(-300)));
}

function setPrintStatus(message) {
  printStatus.textContent = message;
}

function normalizeServerUrl(url) {
  return String(url || DEFAULT_PRINT_SETTINGS.serverUrl).trim().replace(/\/+$/, "");
}

function align(left, right, width) {
  const cleanLeft = String(left).slice(0, Math.max(1, width - String(right).length - 1));
  const spaces = Math.max(1, width - cleanLeft.length - String(right).length);
  return `${cleanLeft}${" ".repeat(spaces)}${right}`;
}

function center(text, width) {
  const clean = String(text).slice(0, width);
  const left = Math.floor((width - clean.length) / 2);
  return `${" ".repeat(Math.max(0, left))}${clean}`;
}

async function enableSound() {
  state.soundEnabled = true;
  soundButton.textContent = "Som ativo";
  soundButton.classList.add("sound-on");

  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }

  playAlertSound();
}

function playAlertSound() {
  if (!state.soundEnabled) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);

  [0, 0.18].forEach((delay) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime + delay);
    oscillator.connect(gain);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + 0.14);
  });

  window.setTimeout(() => context.close(), 800);
}

function renderLiveStatus() {
  if (!state.lastUpdate) {
    lastUpdateText.textContent = "Atualizando agora";
    return;
  }

  lastUpdateText.textContent = `Ultima atualizacao ${state.lastUpdate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function statusOptions(current) {
  return ["novo", "aceito", "preparando", "finalizado", "cancelado"]
    .map((status) => `<option value="${status}" ${status === current ? "selected" : ""}>${statusLabel(status)}</option>`)
    .join("");
}

async function updateOrderStatus(orderId, status) {
  if (!VALID_ORDER_STATUSES.includes(status)) {
    alert("Status invalido.");
    return;
  }

  if (!orderId || typeof orderId !== "string" || orderId.length > 40) {
    alert("ID de pedido invalido.");
    return;
  }

  const { error } = await supabaseClient
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    alert("Nao foi possivel atualizar o pedido.");
    return;
  }

  const order = state.orders.find((entry) => entry.id === orderId);
  if (order) order.status = status;
  renderMetrics();
  renderOrders();
}

function renderProducts() {
  productsList.innerHTML = state.products.length
    ? groupedProducts()
    : `<div class="empty-state">Nenhum produto cadastrado.</div>`;

  document.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => fillProductForm(button.dataset.editProduct));
  });
  document.querySelectorAll("[data-move-product]").forEach((button) => {
    button.addEventListener("click", () => moveProduct(button.dataset.moveProduct, Number(button.dataset.moveDirection)));
  });
}

function groupedProducts() {
  return ["marmitex", "local", "bebidas"]
    .map((category) => {
      const products = state.products.filter((product) => product.category === category);
      if (!products.length) return "";
      return `
        <section class="product-group">
          <div class="product-group-title">
            <h3>${escapeHtml(categoryLabel(category))}</h3>
            <span>${products.length} ${products.length === 1 ? "produto" : "produtos"}</span>
          </div>
          <div class="products-list-inner">
            ${products.map((product, index) => productCard(product, products, index)).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function productCard(product, categoryProducts, index) {
  return `
    <article class="product-card">
      <img src="${escapeHtml(product.image_url || "assets/marmitex-menu.png")}" alt="${escapeHtml(product.name)}">
      <div class="product-meta">
        <div class="product-head">
          <h3>${escapeHtml(product.name)}</h3>
          <span class="status-pill ${product.active ? "aceito" : "cancelado"}">${product.active ? "Ativo" : "Pausado"}</span>
        </div>
        <p class="muted">${escapeHtml(product.description || "Sem descricao")}</p>
        <strong>${currency.format(Number(product.price))} - ${escapeHtml(categoryLabel(product.category))}</strong>
      </div>
      <div class="product-actions">
        <button class="ghost-button icon-button" data-move-product="${escapeHtml(product.id)}" data-move-direction="-1" ${index === 0 ? "disabled" : ""} type="button" title="Subir produto">↑</button>
        <button class="ghost-button icon-button" data-move-product="${escapeHtml(product.id)}" data-move-direction="1" ${index === categoryProducts.length - 1 ? "disabled" : ""} type="button" title="Descer produto">↓</button>
        <button class="ghost-button" data-edit-product="${escapeHtml(product.id)}" type="button">Editar</button>
      </div>
    </article>
  `;
}

function fillProductForm(productId) {
  const product = state.products.find((entry) => entry.id === productId);
  if (!product) return;

  document.querySelector("#productId").value = product.id;
  document.querySelector("#productName").value = product.name;
  document.querySelector("#productCategory").value = product.category;
  document.querySelector("#productPrice").value = product.price;
  document.querySelector("#productOrder").value = product.sort_order || 0;
  document.querySelector("#productDescription").value = product.description || "";
  productImageInput.value = product.image_url || "";
  document.querySelector("#productActive").checked = Boolean(product.active);
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveProduct(event) {
  event.preventDefault();

  const productId = document.querySelector("#productId").value;
  const category = document.querySelector("#productCategory").value;
  const name = document.querySelector("#productName").value.trim();
  const price = Number(document.querySelector("#productPrice").value);
  const description = document.querySelector("#productDescription").value.trim();
  const imageUrl = productImageInput.value.trim() || null;

  if (!name || name.length > MAX_INPUT_LENGTH) {
    alert("Nome do produto invalido ou muito longo.");
    return;
  }

  if (Number.isNaN(price) || price < 0 || price > 99999) {
    alert("Preco invalido.");
    return;
  }

  if (!["marmitex", "local", "bebidas"].includes(category)) {
    alert("Categoria invalida.");
    return;
  }

  if (description.length > 1000) {
    alert("Descricao muito longa.");
    return;
  }

  if (imageUrl && imageUrl.length > 2000) {
    alert("URL da imagem muito longa.");
    return;
  }

  const payload = {
    name,
    category,
    price,
    sort_order: Number(document.querySelector("#productOrder").value || nextSortOrder(category)),
    description,
    image_url: imageUrl,
    active: document.querySelector("#productActive").checked,
  };

  const request = productId
    ? supabaseClient.from("products").update(payload).eq("id", productId)
    : supabaseClient.from("products").insert(payload);
  const { error } = await request;

  if (error) {
    alert("Nao foi possivel salvar o produto.");
    return;
  }

  clearProductForm();
  await loadProducts();
  renderProducts();
  renderMetrics();
}

async function moveProduct(productId, direction) {
  const product = state.products.find((entry) => entry.id === productId);
  if (!product) return;

  const categoryProducts = state.products
    .filter((entry) => entry.category === product.category)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const index = categoryProducts.findIndex((entry) => entry.id === productId);
  const swapWith = categoryProducts[index + direction];
  if (!swapWith) return;

  const productOrder = Number(product.sort_order);
  const swapOrder = Number(swapWith.sort_order);
  product.sort_order = swapOrder;
  swapWith.sort_order = productOrder;
  state.products.sort(productSort);
  renderProducts();

  const updates = [
    supabaseClient.from("products").update({ sort_order: swapOrder }).eq("id", product.id),
    supabaseClient.from("products").update({ sort_order: productOrder }).eq("id", swapWith.id),
  ];
  const results = await Promise.all(updates);
  if (results.some((result) => result.error)) {
    alert("Nao foi possivel mudar a ordem.");
    await loadProducts();
    renderProducts();
  }
}

function nextSortOrder(category) {
  const max = state.products
    .filter((product) => product.category === category)
    .reduce((highest, product) => Math.max(highest, Number(product.sort_order) || 0), 0);
  return max + 10;
}

function productSort(a, b) {
  return a.category.localeCompare(b.category) || Number(a.sort_order) - Number(b.sort_order);
}

function clearProductForm() {
  productForm.reset();
  document.querySelector("#productId").value = "";
  document.querySelector("#productActive").checked = true;
  setImageUploadMessage("Use uma foto quadrada ou horizontal, com boa luz.");
}

async function uploadProductImage() {
  const file = productImageFile.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setImageUploadMessage("Escolha um arquivo de imagem.");
    productImageFile.value = "";
    return;
  }

  setImageUploadMessage("Enviando foto...");

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = slugify(document.querySelector("#productName").value || file.name.replace(/\.[^.]+$/, ""));
  const filePath = `${safeName || "produto"}-${Date.now()}.${extension}`;

  const { error } = await supabaseClient.storage
    .from("produtos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (error) {
    setImageUploadMessage("Nao foi possivel enviar. Confira o bucket produtos no Supabase.");
    productImageFile.value = "";
    return;
  }

  const { data } = supabaseClient.storage.from("produtos").getPublicUrl(filePath);
  productImageInput.value = data.publicUrl;
  setImageUploadMessage("Foto enviada. Agora e so salvar o produto.");
}

function setImageUploadMessage(message) {
  imageUploadMessage.textContent = message;
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll("[data-panel-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.panelTab === tabName);
  });
  document.querySelector("#ordersPanel").classList.toggle("hidden", tabName !== "orders");
  document.querySelector("#productsPanel").classList.toggle("hidden", tabName !== "products");
}

function orderWhatsAppMessage(order) {
  const items = (order.order_items || [])
    .map((item) => `${item.quantity}x ${item.product_name} - ${currency.format(Number(item.subtotal))}`)
    .join("\n");

  return [
    `Pedido de ${order.customer_name}`,
    `Tipo: ${order.delivery_type}`,
    `Endereco: ${order.customer_address || "Combinar"}`,
    `Pagamento: ${order.payment_method}`,
    `Troco: ${order.change_for || "Nao precisa"}`,
    "",
    items,
    "",
    `Total: ${currency.format(Number(order.total))}`,
    `Observacao: ${order.note || "Sem observacao"}`,
  ].join("\n");
}

function statusLabel(status) {
  return {
    novo: "Novo",
    aceito: "Aceito",
    preparando: "Preparando",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  }[status] || status;
}

function categoryLabel(category) {
  return {
    marmitex: "Marmitex",
    local: "Consumo local",
    bebidas: "Bebidas",
  }[category] || "Produto";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
