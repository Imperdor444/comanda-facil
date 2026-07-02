const WHATSAPP_NUMBER = "5569992824311";
const FALLBACK_IMAGE = "assets/no-image.png";
window.SABOR_DE_MAE_FALLBACK_IMAGE = FALLBACK_IMAGE;

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
const PRINT_UNLOCK_KEY = "saborDeMaePrintUnlocked";
const PRINT_ACCESS_CODE = "impressao";
const CHAT_REMINDER_INTERVAL = 120000;
const DEFAULT_PRINT_SETTINGS = {
  enabled: false,
  serverUrl: "http://127.0.0.1:8787",
  printerIp: "192.168.1.223",
  printerPort: 9100,
  width: 32,
};

const supabaseClient = createSupabaseClient();
const state = {
  orders: [],
  categories: [],
  products: [],
  tables: [],
  tickets: [],
  historyTickets: [],
  ticketMessages: [],
  activeTicketId: null,
  chatView: "open",
  ticketSearch: "",
  ticketPeriod: "7",
  activeTab: "orders",
  knownOrderIds: new Set(),
  knownTicketIds: new Set(),
  soundEnabled: false,
  ordersChannel: null,
  ticketsChannel: null,
  refreshTimer: null,
  chatReminderTimer: null,
  lastChatReminderAt: 0,
  lastUpdate: null,
  printSettings: loadPrintSettings(),
  printedOrderIds: loadPrintedOrderIds(),
  blockedCustomers: [],
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
const tablesList = document.querySelector("#tablesList");
const ticketsList = document.querySelector("#ticketsList");
const ticketMessages = document.querySelector("#ticketMessages");
const ticketConversationHeader = document.querySelector("#ticketConversationHeader");
const ticketReplyForm = document.querySelector("#ticketReplyForm");
const ticketReplyMessage = document.querySelector("#ticketReplyMessage");
const resolveTicketButton = document.querySelector("#resolveTicketButton");
const reopenTicketButton = document.querySelector("#reopenTicketButton");
const copyTicketButton = document.querySelector("#copyTicketButton");
const refreshChatButton = document.querySelector("#refreshChatButton");
const ticketSearch = document.querySelector("#ticketSearch");
const ticketPeriodFilter = document.querySelector("#ticketPeriodFilter");
const orderStatusFilter = document.querySelector("#orderStatusFilter");
const newChatsMetric = document.querySelector("#newChatsMetric");
const productForm = document.querySelector("#productForm");
const clearProductButton = document.querySelector("#clearProductButton");
const deleteProductButton = document.querySelector("#deleteProductButton");
const productImageInput = document.querySelector("#productImage");
const productImageFile = document.querySelector("#productImageFile");
const imageUploadMessage = document.querySelector("#imageUploadMessage");
const productCategorySelect = document.querySelector("#productCategory");
const addAddonGroupBtn = document.querySelector("#addAddonGroupBtn");
const addonsBuilder = document.querySelector("#addonsBuilder");
const productAddonsInput = document.querySelector("#productAddons");
const categoryForm = document.querySelector("#categoryForm");
const clearCategoryButton = document.querySelector("#clearCategoryButton");
const deleteCategoryButton = document.querySelector("#deleteCategoryButton");
const categoriesList = document.querySelector("#categoriesList");
const tableForm = document.querySelector("#tableForm");
const clearTableButton = document.querySelector("#clearTableButton");
const printSettingsForm = document.querySelector("#printSettingsForm");
const printSettingsBox = document.querySelector("#printSettingsBox");
const unlockPrintButton = document.querySelector("#unlockPrintButton");
const autoPrintEnabled = document.querySelector("#autoPrintEnabled");
const printServerUrl = document.querySelector("#printServerUrl");
const printerIp = document.querySelector("#printerIp");
const printerPort = document.querySelector("#printerPort");
const testPrintButton = document.querySelector("#testPrintButton");
const printStatus = document.querySelector("#printStatus");

initPanel();

async function initPanel() {
  try {
    if (!supabaseClient) {
      showLoginMessage("Supabase ainda não foi configurado.");
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
  } catch (error) {
    showLoginMessage("Não foi possível carregar o painel. Recarregue a página.");
    console.error(error);
  }
}

function bindEvents() {
  loginForm.addEventListener("submit", handleLogin);
  signOutButton.addEventListener("click", handleSignOut);
  refreshButton.addEventListener("click", loadDashboard);
  refreshChatButton.addEventListener("click", refreshChat);
  soundButton.addEventListener("click", enableSound);
  orderStatusFilter.addEventListener("change", renderOrders);
  tableForm?.addEventListener("submit", saveTable);
  clearTableButton?.addEventListener("click", clearTableForm);
  ticketReplyForm.addEventListener("submit", replyToTicket);
  resolveTicketButton.addEventListener("click", resolveActiveTicket);
  reopenTicketButton.addEventListener("click", reopenActiveTicket);
  copyTicketButton.addEventListener("click", copyActiveTicket);
  ticketSearch.addEventListener("input", () => {
    state.ticketSearch = ticketSearch.value.trim().toLowerCase();
    renderTickets();
  });
  ticketPeriodFilter.addEventListener("change", async () => {
    state.ticketPeriod = ticketPeriodFilter.value;
    await refreshChat();
  });

  document.querySelectorAll("[data-chat-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.chatView = button.dataset.chatView;
      state.activeTicketId = null;
      await refreshChat();
    });
  });
  productForm.addEventListener("submit", saveProduct);
  clearProductButton.addEventListener("click", clearProductForm);
  deleteProductButton?.addEventListener("click", deleteProduct);
  categoryForm?.addEventListener("submit", saveCategory);
  clearCategoryButton?.addEventListener("click", clearCategoryForm);
  deleteCategoryButton?.addEventListener("click", deleteCategory);
  addAddonGroupBtn?.addEventListener("click", () => renderAddonGroup());
  productImageFile.addEventListener("change", uploadProductImage);
  printSettingsForm.addEventListener("submit", savePrintSettings);
  unlockPrintButton?.addEventListener("click", unlockPrintSettings);
  testPrintButton.addEventListener("click", testPrintServer);

  const blockForm = document.querySelector("#blockForm");
  if (blockForm) {
    blockForm.addEventListener("submit", saveBlock);
  }

  // Quick replies handler via event delegation
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("quick-reply-btn")) {
      const text = e.target.dataset.text;
      if (ticketReplyMessage && text) {
        ticketReplyMessage.value = text;
        ticketReplyMessage.focus();
      }
    }
  });

  document.querySelectorAll("[data-panel-tab]").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.panelTab));
  });

  renderPrintSettings();
  renderPrintLock();

  const refreshBtn = document.querySelector("#captchaRefresh");
  if (refreshBtn) refreshBtn.addEventListener("click", generateCaptcha);
  generateCaptcha();
}

var captchaExpected = 0;

function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 20) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  captchaExpected = num1 + num2;
  const el1 = document.querySelector("#captchaNum1");
  const el2 = document.querySelector("#captchaNum2");
  if (el1 && el2) {
    el1.textContent = num1;
    el2.textContent = num2;
  }
  const answerEl = document.querySelector("#captchaAnswer");
  if (answerEl) answerEl.value = "";
}

async function handleLogin(event) {
  event.preventDefault();
  showLoginMessage("");

  const answerEl = document.querySelector("#captchaAnswer");
  if (answerEl && Number(answerEl.value) !== captchaExpected) {
    showLoginMessage("Verificação de segurança incorreta.");
    generateCaptcha();
    return;
  }

  const email = document.querySelector("#loginEmail").value.trim();
  const password = document.querySelector("#loginPassword").value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showLoginMessage("E-mail ou senha não conferem.");
    generateCaptcha();
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

  try {
    await Promise.all([loadOrders(), loadCategories(), loadProducts(), loadTables(), loadTickets(), loadBlockedCustomers()]);
    rememberKnownOrders();
    rememberKnownTickets();
    state.lastUpdate = new Date();
    renderMetrics();
    renderOrders();
    renderTickets();
    renderCategories();
    renderProducts();
    renderTables();
    renderBlockedCustomers();
    renderLiveStatus();
  } catch (error) {
    ordersList.innerHTML = `<div class="empty-state error-state">Não foi possível carregar o painel agora.</div>`;
    productsList.innerHTML = `<div class="empty-state error-state">Não foi possível carregar os produtos agora.</div>`;
    ticketsList.innerHTML = `<div class="empty-state error-state">Não foi possível carregar os atendimentos agora.</div>`;
    console.error(error);
  }

  refreshButton.disabled = false;
  refreshButton.textContent = "Atualizar";
}

async function loadOrders() {
  let data;
  let error;
  try {
    ({ data, error } = await supabaseClient
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(80));
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    ordersList.innerHTML = `<div class="empty-state error-state">Não foi possível carregar os pedidos.</div>`;
    console.error(error);
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

// --- Categorias ---
async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Erro ao carregar categorias", error);
    state.categories = [];
  } else {
    state.categories = data || [];
  }
}

function renderCategories() {
  if (productCategorySelect) {
    productCategorySelect.innerHTML = state.categories.map(c => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
  }
  
  if (!categoriesList) return;
  categoriesList.innerHTML = state.categories.length ? state.categories.map(categoryCard).join("") : '<div class="empty-state">Nenhuma categoria cadastrada.</div>';
  
  document.querySelectorAll("[data-edit-category]").forEach(btn => {
    btn.onclick = () => editCategory(btn.dataset.editCategory);
  });
  document.querySelectorAll("[data-move-category]").forEach(btn => {
    btn.onclick = () => moveCategory(btn.dataset.moveCategory, Number(btn.dataset.dir));
  });
}

function categoryCard(category) {
  return `
    <article class="product-card">
      <div style="display:flex; justify-content:space-between; align-items:start;">
        <div>
          <h3 style="margin:0 0 4px 0; font-size:1.1rem; color:var(--brand);">${escapeHtml(category.name)}</h3>
          <p class="muted" style="margin:0; font-size:0.85rem;">Slug: ${escapeHtml(category.slug)}</p>
        </div>
        <div style="display:flex; gap:4px; flex-direction:column;">
          <button class="ghost-button" data-move-category="${escapeHtml(category.id)}" data-dir="-1" type="button" style="padding:4px 8px; font-size:0.75rem;">Subir</button>
          <button class="ghost-button" data-move-category="${escapeHtml(category.id)}" data-dir="1" type="button" style="padding:4px 8px; font-size:0.75rem;">Descer</button>
        </div>
      </div>
      <div class="form-actions" style="margin-top:12px;">
        <button class="primary-button" data-edit-category="${escapeHtml(category.id)}" type="button" style="padding:6px 12px; font-size:0.85rem;">Editar</button>
      </div>
    </article>
  `;
}

function clearCategoryForm() {
  categoryForm.reset();
  document.querySelector("#categoryId").value = "";
  document.querySelector("#categoryOrder").value = "";
  if (deleteCategoryButton) deleteCategoryButton.classList.add("hidden");
}

function editCategory(id) {
  const category = state.categories.find(c => c.id === id);
  if (!category) return;
  
  document.querySelector("#categoryId").value = category.id;
  document.querySelector("#categoryName").value = category.name;
  document.querySelector("#categorySlug").value = category.slug;
  document.querySelector("#categoryOrder").value = category.sort_order;
  if (deleteCategoryButton) deleteCategoryButton.classList.remove("hidden");
  
  setActiveTab("categories");
  categoryForm.scrollIntoView({ behavior: "smooth" });
}

async function saveCategory(event) {
  event.preventDefault();
  const id = document.querySelector("#categoryId").value;
  const name = document.querySelector("#categoryName").value.trim();
  const slug = document.querySelector("#categorySlug").value.trim();
  let sort_order = Number(document.querySelector("#categoryOrder").value);
  
  if (!sort_order && !id) {
    sort_order = state.categories.length ? Math.max(...state.categories.map(c => c.sort_order || 0)) + 10 : 10;
  }
  
  const payload = { name, slug, sort_order };
  let req;
  if (id) {
    req = supabaseClient.from("categories").update(payload).eq("id", id);
  } else {
    req = supabaseClient.from("categories").insert([payload]);
  }
  
  const { error } = await req;
  if (error) {
    alert("Erro ao salvar categoria. Talvez o slug já exista.");
    return;
  }
  
  clearCategoryForm();
  await loadCategories();
  renderCategories();
}

async function deleteCategory() {
  const id = document.querySelector("#categoryId").value;
  if (!id) return;
  
  if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
  
  const { error } = await supabaseClient.from("categories").delete().eq("id", id);
  if (error) {
    alert("Erro ao excluir. Talvez existam produtos nela.");
    return;
  }
  
  clearCategoryForm();
  await loadCategories();
  renderCategories();
}

async function moveCategory(id, direction) {
  const index = state.categories.findIndex(c => c.id === id);
  const swapWith = state.categories[index + direction];
  if (!swapWith) return;
  
  const cat = state.categories[index];
  const order1 = cat.sort_order;
  const order2 = swapWith.sort_order;
  
  cat.sort_order = order2;
  swapWith.sort_order = order1;
  state.categories.sort((a,b) => a.sort_order - b.sort_order);
  renderCategories();
  
  await Promise.all([
    supabaseClient.from("categories").update({ sort_order: order2 }).eq("id", cat.id),
    supabaseClient.from("categories").update({ sort_order: order1 }).eq("id", swapWith.id)
  ]);
}

async function loadProducts() {
  let data;
  let error;
  try {
    ({ data, error } = await supabaseClient
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true }));
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    productsList.innerHTML = `<div class="empty-state error-state">Não foi possível carregar os produtos. Tente atualizar a página.</div>`;
    console.error(error);
    return;
  }

  state.products = data || [];
}

async function loadTables() {
  if (!tablesList) return;

  let data;
  let error;
  try {
    ({ data, error } = await supabaseClient
      .from("restaurant_tables")
      .select("*")
      .order("sort_order", { ascending: true }));
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    state.tables = [];
    tablesList.innerHTML = `<div class="empty-state error-state">Mesas ainda nao foram ativadas no Supabase. Rode o arquivo supabase/tables.sql.</div>`;
    return;
  }

  state.tables = data || [];
}

async function loadTickets() {
  let data;
  let historyData;
  let error;
  try {
    ({ data, error } = await supabaseClient
      .from("chat_tickets")
      .select("*")
      .neq("status", "resolvido")
      .order("last_message_at", { ascending: false })
      .limit(80));

    if (!error) {
      let historyQuery = supabaseClient
        .from("chat_tickets")
        .select("*")
        .eq("status", "resolvido")
        .order("last_message_at", { ascending: false })
        .limit(120);

      if (state.ticketPeriod !== "all") {
        const since = new Date();
        since.setDate(since.getDate() - Number(state.ticketPeriod || 7));
        historyQuery = historyQuery.gte("last_message_at", since.toISOString());
      }

      const result = await historyQuery;
      historyData = result.data;
      error = result.error;
    }
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    state.tickets = [];
    state.historyTickets = [];
    ticketsList.innerHTML = `<div class="empty-state error-state">Atendimento ainda não foi ativado no Supabase. Rode o arquivo supabase/chat.sql.</div>`;
    return;
  }

  const previousIds = new Set(state.knownTicketIds);
  state.tickets = data || [];
  state.historyTickets = historyData || [];
  const freshTickets = state.tickets.filter((ticket) => ticket.status === "novo" && !previousIds.has(ticket.id));
  freshTickets.forEach(notifyNewTicket);
}

function renderMetrics() {
  const today = new Date().toISOString().slice(0, 10);
  const newOrders = state.orders.filter((order) => order.status === "novo").length;
  const todayTotal = state.orders
    .filter((order) => order.created_at.slice(0, 10) === today && order.status !== "cancelado")
    .reduce((sum, order) => sum + Number(order.total), 0);
  const activeProducts = state.products.filter((product) => product.active).length;
  const newChats = state.tickets.filter((ticket) => ticket.status === "novo").length;

  document.querySelector("#newOrdersMetric").textContent = newOrders;
  document.querySelector("#salesMetric").textContent = currency.format(todayTotal);
  document.querySelector("#activeProductsMetric").textContent = activeProducts;
  newChatsMetric.textContent = newChats;
}

function renderOrders() {
  const filter = orderStatusFilter.value;
  const orders = filter === "all"
    ? state.orders
    : state.orders.filter((order) => order.status === filter);

  ordersList.innerHTML = orders.length
    ? orders.map(orderCard).join("")
    : `<div class="empty-state">Nenhum pedido encontrado.</div>`;

  document.querySelectorAll("[data-status-btn]").forEach((btn) => {
    btn.addEventListener("click", () => updateOrderStatus(btn.dataset.statusBtn, btn.dataset.setStatus));
  });
  document.querySelectorAll("[data-block-customer]").forEach((button) => {
    button.addEventListener("click", () => blockCustomerFromOrder(button.dataset.blockCustomer));
  });
}

function renderTickets() {
  if (!ticketsList) return;
  document.querySelectorAll("[data-chat-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chatView === state.chatView);
  });
  ticketPeriodFilter.classList.toggle("hidden", state.chatView !== "history");

  const source = state.chatView === "history" ? state.historyTickets : state.tickets;
  const tickets = filterTickets(source);

  if (!tickets.length) {
    ticketsList.innerHTML = `<div class="empty-state">${state.chatView === "history" ? "Nenhum atendimento no histórico." : "Nenhum atendimento aberto."}</div>`;
    renderTicketConversation();
    return;
  }

  ticketsList.innerHTML = tickets.map(ticketCard).join("");
  document.querySelectorAll("[data-open-ticket]").forEach((button) => {
    button.addEventListener("click", () => openTicket(button.dataset.openTicket));
  });
  document.querySelectorAll("[data-assume-ticket]").forEach((button) => {
    button.addEventListener("click", () => assumeTicket(button.dataset.assumeTicket));
  });
}

function filterTickets(tickets) {
  if (!state.ticketSearch) return tickets;
  return tickets.filter((ticket) => [
    ticket.customer_name,
    ticket.customer_contact,
    ticket.last_message,
    ticket.status,
  ].some((value) => String(value || "").toLowerCase().includes(state.ticketSearch)));
}

function ticketCard(ticket) {
  return `
    <article class="ticket-card ${ticket.status === "novo" ? "is-new" : ""} ${ticket.id === state.activeTicketId ? "active" : ""}">
      <div class="order-head">
        <div>
          <p class="eyebrow">${dateTime.format(new Date(ticket.last_message_at || ticket.created_at))}</p>
          <h3>${escapeHtml(ticket.customer_name || "Cliente")}</h3>
        </div>
        <span class="status-pill ${escapeHtml(ticket.status)}">${escapeHtml(ticketStatusLabel(ticket.status))}</span>
      </div>
      <p class="muted">${escapeHtml(ticket.last_message || "Sem mensagem")}</p>
      ${ticket.customer_contact ? `<strong>Contato: ${escapeHtml(ticket.customer_contact)}</strong>` : ""}
      <div class="form-actions">
        ${ticket.status === "resolvido"
          ? `<button class="ghost-button" data-open-ticket="${escapeHtml(ticket.id)}" type="button">Ver conversa</button>`
          : ticket.status === "novo"
          ? `<button class="primary-button compact" data-assume-ticket="${escapeHtml(ticket.id)}" type="button">Assumir</button>`
          : `<button class="ghost-button" data-open-ticket="${escapeHtml(ticket.id)}" type="button">Abrir conversa</button>`}
      </div>
    </article>
  `;
}

async function openTicket(ticketId) {
  state.activeTicketId = ticketId;
  await loadTicketMessages(ticketId);
  renderTickets();
  renderTicketConversation();
  setActiveTab("chat");
}

async function loadTicketMessages(ticketId) {
  const { data, error } = await supabaseClient
    .from("chat_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    state.ticketMessages = [];
    ticketMessages.innerHTML = `<div class="empty-state error-state">Não foi possível carregar as mensagens.</div>`;
    return;
  }

  state.ticketMessages = data || [];
}

function renderTicketConversation() {
  const ticket = findTicket(state.activeTicketId);
  if (!ticket) {
    ticketConversationHeader.innerHTML = `<p class="muted">Selecione um atendimento para responder.</p>`;
    ticketMessages.innerHTML = "";
    ticketReplyForm.classList.add("hidden");
    return;
  }

  ticketConversationHeader.innerHTML = `
    <div>
      <p class="eyebrow">${escapeHtml(ticketStatusLabel(ticket.status))}</p>
      <h3>${escapeHtml(ticket.customer_name || "Cliente")}</h3>
      <p class="muted">${ticket.customer_contact ? `Contato: ${escapeHtml(ticket.customer_contact)}` : "Sem contato informado"}</p>
    </div>
  `;
  ticketMessages.innerHTML = state.ticketMessages.length
    ? state.ticketMessages.map((message) => `
      <article class="ticket-message ${message.sender === "admin" ? "admin" : ""}">
        <strong>${message.sender === "admin" ? "Restaurante" : "Cliente"}</strong>
        <span>${escapeHtml(message.message)}</span>
      </article>
    `).join("")
    : `<div class="empty-state">Nenhuma mensagem neste atendimento.</div>`;
  ticketReplyForm.classList.remove("hidden");
  const isResolved = ticket.status === "resolvido";
  ticketReplyMessage.disabled = isResolved;
  ticketReplyMessage.placeholder = isResolved ? "Atendimento resolvido. Reabra para responder." : "Digite a resposta para o cliente";
  resolveTicketButton.classList.toggle("hidden", isResolved);
  reopenTicketButton.classList.toggle("hidden", !isResolved);
  ticketReplyForm.querySelector('button[type="submit"]').classList.toggle("hidden", isResolved);
  ticketMessages.scrollTop = ticketMessages.scrollHeight;
}

function findTicket(ticketId) {
  return [...state.tickets, ...state.historyTickets].find((entry) => entry.id === ticketId);
}

async function assumeTicket(ticketId) {
  const { error } = await supabaseClient
    .from("chat_tickets")
    .update({ status: "assumido", assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  if (error) {
    alert("Não foi possível assumir o atendimento.");
    return;
  }

  await refreshChat(ticketId);
  await openTicket(ticketId);
}

async function replyToTicket(event) {
  event.preventDefault();
  if (!state.activeTicketId) return;
  const message = ticketReplyMessage.value.trim();
  if (!message) return;

  const { error: messageError } = await supabaseClient.from("chat_messages").insert({
    ticket_id: state.activeTicketId,
    sender: "admin",
    message,
  });

  if (messageError) {
    alert("Não foi possível enviar a resposta.");
    return;
  }

  await supabaseClient
    .from("chat_tickets")
    .update({
      status: "respondido",
      last_message: message,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.activeTicketId);

  ticketReplyMessage.value = "";
  await refreshChat(state.activeTicketId);
}

async function resolveActiveTicket() {
  if (!state.activeTicketId) return;
  const { error } = await supabaseClient
    .from("chat_tickets")
    .update({ status: "resolvido", updated_at: new Date().toISOString() })
    .eq("id", state.activeTicketId);

  if (error) {
    alert("Não foi possível resolver o atendimento.");
    return;
  }

  state.activeTicketId = null;
  await refreshChat();
}

async function reopenActiveTicket() {
  if (!state.activeTicketId) return;
  const { error } = await supabaseClient
    .from("chat_tickets")
    .update({ status: "assumido", assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", state.activeTicketId);

  if (error) {
    alert("Não foi possível reabrir o atendimento.");
    return;
  }

  state.chatView = "open";
  await refreshChat(state.activeTicketId);
}

async function copyActiveTicket() {
  const ticket = findTicket(state.activeTicketId);
  if (!ticket) return;

  const lines = [
    `Atendimento: ${ticket.customer_name || "Cliente"}`,
    ticket.customer_contact ? `Contato: ${ticket.customer_contact}` : "Contato: não informado",
    `Status: ${ticketStatusLabel(ticket.status)}`,
    "",
    ...state.ticketMessages.map((message) =>
      `${message.sender === "admin" ? "Restaurante" : "Cliente"}: ${message.message}`
    ),
  ];

  await navigator.clipboard.writeText(lines.join("\n"));
  alert("Conversa copiada.");
}

async function refreshChat(ticketId = state.activeTicketId) {
  await loadTickets();
  if (ticketId) {
    state.activeTicketId = ticketId;
    await loadTicketMessages(ticketId);
  }
  renderMetrics();
  renderTickets();
  renderTicketConversation();
  renderLiveStatus();
}

function orderCard(order) {
  const items = (order.order_items || [])
    .map((item, idx) => `
      <label class="order-prep-item" style="display:flex; align-items:center; gap:8px; font-size:0.95rem; margin-bottom:6px; cursor:pointer;">
        <input type="checkbox" style="width:16px; height:16px; cursor:pointer;" onclick="this.checked ? this.parentElement.style.textDecoration='line-through' : this.parentElement.style.textDecoration='none'">
        <span><strong>${item.quantity}x ${escapeHtml(item.product_name)}</strong> ${currency.format(Number(item.subtotal))}</span>
      </label>
    `).join("");
  const message = encodeURIComponent(orderWhatsAppMessage(order));
  const cleanCustomerPhone = order.customer_phone ? order.customer_phone.replace(/\D/g, "") : "";
  const customerWhatsAppLink = cleanCustomerPhone ? `https://wa.me/${cleanCustomerPhone.startsWith("55") ? cleanCustomerPhone : "55" + cleanCustomerPhone}` : "#";

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
        <div><span>Pagamento</span><strong>${escapeHtml(paymentLabel(order.payment_method))}</strong></div>
        ${order.customer_phone ? `<div><span>Telefone</span><strong>${escapeHtml(order.customer_phone)}</strong></div>` : ""}
        ${order.table_name ? `<div><span>Mesa</span><strong>${escapeHtml(order.table_name)}</strong></div>` : ""}
        <div><span>Endereço</span><strong>${escapeHtml(order.customer_address || "Combinar")}</strong></div>
      </div>

      <div class="item-list">
        <span>Itens (Marque para riscar)</span>
        <div style="margin-top:8px;">${items || "Sem itens salvos"}</div>
        <span style="margin-top:12px; display:block;">Observação</span>
        <p>${escapeHtml(order.note || "Sem observação")}</p>
      </div>

      <div class="order-actions" style="display:flex; flex-wrap:wrap; gap:10px;">
        ${order.status === "novo" ? `<button class="primary-button" data-status-btn="${escapeHtml(order.id)}" data-set-status="preparando" type="button" style="background:var(--green); border-color:var(--green); padding:0 12px; height:36px; font-size:12px;">Aceitar pedido</button>` : ""}
        ${order.status === "preparando" ? `<button class="primary-button" data-status-btn="${escapeHtml(order.id)}" data-set-status="finalizado" type="button" style="background:var(--amber); border-color:var(--amber); padding:0 12px; height:36px; font-size:12px;">Pedido finalizado</button>` : ""}
        ${order.status !== "cancelado" && order.status !== "finalizado" ? `<button class="ghost-button" data-status-btn="${escapeHtml(order.id)}" data-set-status="cancelado" type="button" style="color:var(--red); border-color:var(--red); padding:0 12px; height:36px; font-size:12px;">Cancelar pedido</button>` : ""}
        ${order.customer_phone ? `<button class="ghost-button" data-block-customer="${escapeHtml(order.id)}" type="button" style="padding:0 12px; height:36px; font-size:12px;">Bloquear telefone</button>` : ""}
        ${cleanCustomerPhone ? `<a class="primary-button" href="${customerWhatsAppLink}" target="_blank" rel="noreferrer" style="background:#25d366; border-color:#25d366; padding:0 12px; height:36px; font-size:12px;">Falar c/ Cliente</a>` : ""}
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

  if (supabaseClient.channel && !state.ticketsChannel) {
    state.ticketsChannel = supabaseClient
      .channel("chat-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_tickets" }, async () => {
        await refreshChat();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
        if (payload.new?.ticket_id === state.activeTicketId) {
          await loadTicketMessages(state.activeTicketId);
          renderTicketConversation();
        }
      })
      .subscribe();
  }

  state.refreshTimer = window.setInterval(async () => {
    await loadOrders();
    await loadTickets();
    renderMetrics();
    renderOrders();
    renderTickets();
    renderLiveStatus();
  }, 4000);

  state.chatReminderTimer = window.setInterval(remindOpenTickets, 30000);
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

  if (state.ticketsChannel) {
    supabaseClient.removeChannel(state.ticketsChannel);
    state.ticketsChannel = null;
  }

  if (state.chatReminderTimer) {
    window.clearInterval(state.chatReminderTimer);
    state.chatReminderTimer = null;
  }
}

function rememberKnownOrders() {
  state.knownOrderIds = new Set(state.orders.map((order) => order.id));
}

function rememberKnownTickets() {
  state.knownTicketIds = new Set(state.tickets.map((ticket) => ticket.id));
}

function notifyNewOrder(order) {
  playAlertSound();
  if (state.activeTab !== "orders") {
    setActiveTab("orders");
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Novo pedido - Sabor de Mãe", {
      body: `${order.customer_name} - ${currency.format(Number(order.total))}`,
    });
  }
}

function notifyNewTicket(ticket) {
  playAlertSound();
  if (state.activeTab !== "chat") {
    setActiveTab("chat");
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Novo atendimento - Sabor de Mãe", {
      body: `${ticket.customer_name || "Cliente"}: ${ticket.last_message || "Nova mensagem"}`,
    });
  }
}

function remindOpenTickets() {
  const hasUnassumed = state.tickets.some((ticket) => ticket.status === "novo");
  if (!hasUnassumed) return;

  const now = Date.now();
  if (now - state.lastChatReminderAt < CHAT_REMINDER_INTERVAL) return;
  state.lastChatReminderAt = now;
  playAlertSound();

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Atendimento aguardando", {
      body: "Existe atendimento novo sem assumir no painel.",
    });
  }
}

async function maybePrintOrder(order) {
  if (!state.printSettings.enabled || order.status !== "novo" || state.printedOrderIds.has(order.id)) return;

  const printed = await printOrder(order);
  if (printed) {
    state.printedOrderIds.add(order.id);
    savePrintedOrderIds();
    setPrintStatus(`Pedido de ${order.customer_name} enviado para impressão.`);
  } else {
    setPrintStatus("Não consegui imprimir. Confira se o servidor local está ligado.");
  }
}

async function testPrintServer() {
  const printed = await sendReceiptToPrinter([
    "=".repeat(state.printSettings.width),
    center("SABOR DE MAE", state.printSettings.width),
    center("TESTE DE IMPRESSAO", state.printSettings.width),
    "=".repeat(state.printSettings.width),
    new Date().toLocaleString("pt-BR"),
    "-".repeat(state.printSettings.width),
    center("SERVIDOR LOCAL OK", state.printSettings.width),
  ].join("\n"));

  setPrintStatus(printed ? "Teste enviado para impressora." : "Servidor local nao respondeu.");
}
async function printOrder(order) {
  return sendReceiptToPrinter(buildPrintReceipt(order));
}

async function sendReceiptToPrinter(receipt) {
  try {
    const response = await fetch(`${normalizeServerUrl(state.printSettings.serverUrl)}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  const doubleLine = "=".repeat(width);
  const items = (order.order_items || []).flatMap((item) => receiptItemLines(item, width));
  const orderCode = order.id.slice(0, 8).toUpperCase();
  const note = normalizeReceiptText(order.note || "sem observacao");

  return [
    doubleLine,
    center("SABOR DE MAE", width),
    center("RUA RIO NEGRO, 1890", width),
    doubleLine,
    center("PEDIDO DO SITE", width),
    center(`#${orderCode}`, width),
    dateTime.format(new Date(order.created_at)),
    line,
    "DADOS DO CLIENTE",
    line,
    ...wrapReceiptLine(`Cliente: ${order.customer_name}`, width),
    order.customer_phone ? `Telefone: ${normalizeReceiptText(order.customer_phone)}` : "",
    `Tipo: ${normalizeReceiptText(order.delivery_type)}`,
    ...wrapReceiptLine(`Endereco: ${order.customer_address || "Combinar"}`, width),
    order.table_name ? `Mesa: ${normalizeReceiptText(order.table_name)}` : "",
    `Pagamento: ${receiptPaymentLabel(order.payment_method)}`,
    order.change_for ? `Troco para: ${normalizeReceiptText(order.change_for)}` : "",
    line,
    "ITENS",
    line,
    ...items,
    line,
    align("TOTAL", currency.format(Number(order.total)), width),
    line,
    "OBSERVACAO",
    line,
    ...wrapReceiptLine(note, width),
    doubleLine,
    center("CONFERIR ANTES DE ENVIAR", width),
    doubleLine,
  ].filter(Boolean).join("\n");
}

function receiptItemLines(item, width) {
  const qty = Number(item.quantity);
  const name = normalizeReceiptText(item.product_name);
  const subtotal = currency.format(Number(item.subtotal));
  const available = Math.max(1, width - subtotal.length - 1);

  if (`${qty}x ${name}`.length <= available) {
    return [align(`${qty}x ${name}`, subtotal, width)];
  }

  const firstNamePart = name.slice(0, Math.max(1, available - 3));
  return [
    align(`${qty}x ${firstNamePart}`, subtotal, width),
    ...wrapReceiptLine(`   ${name.slice(firstNamePart.length)}`, width),
  ];
}
function savePrintSettings(event) {
  event.preventDefault();
  state.printSettings = {
    ...state.printSettings,
    enabled: autoPrintEnabled.checked,
    serverUrl: normalizeServerUrl(printServerUrl.value),
    printerIp: printerIp.value.trim() || DEFAULT_PRINT_SETTINGS.printerIp,
    printerPort: Number(printerPort.value) || DEFAULT_PRINT_SETTINGS.printerPort,
  };
  localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(state.printSettings));
  renderPrintSettings();
  setPrintStatus("Ajustes de impressão salvos.");
}

function renderPrintSettings() {
  autoPrintEnabled.checked = state.printSettings.enabled;
  printServerUrl.value = state.printSettings.serverUrl;
  printerIp.value = state.printSettings.printerIp;
  printerPort.value = state.printSettings.printerPort;
}

function renderPrintLock() {
  const unlocked = sessionStorage.getItem(PRINT_UNLOCK_KEY) === "true";
  printSettingsBox?.classList.toggle("is-locked", !unlocked);
  if (unlockPrintButton) {
    unlockPrintButton.textContent = unlocked ? "Ajustes liberados" : "Abrir ajustes de impressao";
    unlockPrintButton.disabled = unlocked;
  }
}

function unlockPrintSettings() {
  sessionStorage.setItem(PRINT_UNLOCK_KEY, "true");
  renderPrintLock();
  setPrintStatus("Ajustes de impressao liberados nesta sessao.");
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
  let finalUrl = String(url || DEFAULT_PRINT_SETTINGS.serverUrl).trim().replace(/\/+$/, "");
  if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
    finalUrl = "http://" + finalUrl;
  }
  return finalUrl;
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

function wrapReceiptLine(value, width) {
  const words = normalizeReceiptText(value).split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      if (line) lines.push(line);
      line = word.slice(0, width);
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function receiptPaymentLabel(value) {
  return value === "Cartao" ? "Cartao" : normalizeReceiptText(value);
}

function normalizeReceiptText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
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

  lastUpdateText.textContent = `Última atualização ${state.lastUpdate.toLocaleTimeString("pt-BR", {
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
  const { error } = await supabaseClient
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    alert("Não foi possível atualizar o pedido.");
    return;
  }

  const order = state.orders.find((entry) => entry.id === orderId);
  if (order) {
    order.status = status;
    
    // Se aceitar pedido (preparando), imprime automaticamente na impressora
    if (status === "preparando" && !state.printedOrderIds.has(orderId)) {
      setPrintStatus(`Enviando pedido de ${order.customer_name} para a impressora...`);
      printOrder(order).then(printed => {
        if(printed) {
          state.printedOrderIds.add(order.id);
          savePrintedOrderIds();
          setPrintStatus(`Pedido de ${order.customer_name} impresso com sucesso!`);
        } else {
          setPrintStatus("Não consegui imprimir. Verifique o servidor local da impressora.");
        }
      });
    }
  }
  
  renderMetrics();
  renderOrders();
}

async function blockCustomerFromOrder(orderId) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order?.customer_phone) return;

  const reason = prompt("Motivo do bloqueio:", "Uso indevido do site");
  if (reason === null) return;

  const payload = {
    customer_name: order.customer_name || "",
    phone: order.customer_phone,
    normalized_phone: normalizePhone(order.customer_phone),
    reason: reason.trim() || "Bloqueado pelo restaurante",
    active: true,
  };

  const { error } = await supabaseClient
    .from("blocked_customers")
    .upsert(payload, { onConflict: "normalized_phone" });

  if (error) {
    alert("Nao foi possivel bloquear. Confira se supabase/customers.sql foi rodado.");
    return;
  }

  alert("Telefone bloqueado para novos pedidos pelo site.");
}

function renderTables() {
  if (!tablesList) return;

  tablesList.innerHTML = state.tables.length
    ? `<div class="tables-list-inner">${state.tables.map(tableCard).join("")}</div>`
    : `<div class="empty-state">Nenhuma mesa cadastrada.</div>`;

  document.querySelectorAll("[data-edit-table]").forEach((button) => {
    button.addEventListener("click", () => fillTableForm(button.dataset.editTable));
  });
  document.querySelectorAll("[data-table-status]").forEach((select) => {
    select.addEventListener("change", () => updateTableStatus(select.dataset.tableStatus, select.value));
  });
}

function tableCard(table) {
  return `
    <article class="table-card">
      <div class="table-card-main">
        <div class="table-head">
          <h3>${escapeHtml(table.name)}</h3>
          <span class="status-pill ${tableStatusClass(table)}">${escapeHtml(tableStatusLabel(table.status))}</span>
        </div>
        <div class="table-meta">
          <span>${table.active ? "Aparece no site" : "Oculta no site"}</span>
          <strong>Ordem ${Number(table.sort_order) || 0}</strong>
        </div>
      </div>
      <div class="table-actions">
        <select data-table-status="${escapeHtml(table.id)}" aria-label="Status da mesa">
          ${tableStatusOptions(table.status)}
        </select>
        <button class="ghost-button" data-edit-table="${escapeHtml(table.id)}" type="button">Editar</button>
      </div>
    </article>
  `;
}

function tableStatusOptions(current) {
  return ["livre", "ocupada", "pausada"]
    .map((status) => `<option value="${status}" ${status === current ? "selected" : ""}>${tableStatusLabel(status)}</option>`)
    .join("");
}

function tableStatusLabel(status) {
  return {
    livre: "Livre",
    ocupada: "Ocupada",
    pausada: "Pausada",
  }[status] || status;
}

function tableStatusClass(table) {
  if (!table.active || table.status === "pausada") return "cancelado";
  if (table.status === "ocupada") return "preparando";
  return "aceito";
}

function fillTableForm(tableId) {
  const table = state.tables.find((entry) => entry.id === tableId);
  if (!table) return;

  document.querySelector("#tableId").value = table.id;
  document.querySelector("#tableName").value = table.name;
  document.querySelector("#tableStatus").value = table.status;
  document.querySelector("#tableOrder").value = table.sort_order || 0;
  document.querySelector("#tableActive").checked = Boolean(table.active);
  tableForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveTable(event) {
  event.preventDefault();

  const tableId = document.querySelector("#tableId").value;
  const payload = {
    name: document.querySelector("#tableName").value.trim(),
    status: document.querySelector("#tableStatus").value,
    sort_order: Number(document.querySelector("#tableOrder").value || nextTableSortOrder()),
    active: document.querySelector("#tableActive").checked,
  };

  const request = tableId
    ? supabaseClient.from("restaurant_tables").update(payload).eq("id", tableId)
    : supabaseClient.from("restaurant_tables").insert(payload);
  const { error } = await request;

  if (error) {
    alert("Nao foi possivel salvar a mesa. Confira se supabase/tables.sql foi rodado.");
    return;
  }

  clearTableForm();
  await loadTables();
  renderTables();
}

async function updateTableStatus(tableId, status) {
  const { error } = await supabaseClient
    .from("restaurant_tables")
    .update({ status })
    .eq("id", tableId);

  if (error) {
    alert("Nao foi possivel atualizar a mesa.");
    await loadTables();
    renderTables();
    return;
  }

  const table = state.tables.find((entry) => entry.id === tableId);
  if (table) table.status = status;
  renderTables();
}

function clearTableForm() {
  if (!tableForm) return;
  tableForm.reset();
  document.querySelector("#tableId").value = "";
  document.querySelector("#tableOrder").value = "";
  document.querySelector("#tableActive").checked = true;
}

function nextTableSortOrder() {
  const max = state.tables.reduce((highest, table) => Math.max(highest, Number(table.sort_order) || 0), 0);
  return max + 10;
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
  document.querySelectorAll("[data-delete-product]").forEach((button) => {
    button.addEventListener("click", () => deleteProduct(button.dataset.deleteProduct));
  });
}

function groupedProducts() {
  const categories = state.categories.length ? state.categories.map(c => c.slug) : ["marmitex", "espetinhos", "porcoes", "local", "bebidas", "sobremesas"];
  return categories
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
      <img src="${escapeHtml(productImageUrl(product))}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';">
      <div class="product-meta">
        <div class="product-head">
          <h3>${escapeHtml(product.name)}</h3>
          <span class="status-pill ${product.active ? "aceito" : "cancelado"}">${product.active ? "Ativo" : "Pausado"}</span>
        </div>
        ${product.tags && product.tags.length ? `<div style="display:flex; gap:4px; margin-bottom:4px; flex-wrap:wrap;">${product.tags.map(t => `<span style="background:var(--brand); color:#fff; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:600;">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        <p class="muted">${escapeHtml(product.description || "Sem descrição")}</p>
        <strong>${currency.format(Number(product.price))} - ${escapeHtml(categoryLabel(product.category))}</strong>
      </div>
      <div class="product-actions" style="display:flex; gap:8px;">
        <div style="display:flex; gap:4px;">
          <button class="ghost-button icon-button" data-move-product="${escapeHtml(product.id)}" data-move-direction="-1" ${index === 0 ? "disabled" : ""} type="button" title="Subir produto">↑</button>
          <button class="ghost-button icon-button" data-move-product="${escapeHtml(product.id)}" data-move-direction="1" ${index === categoryProducts.length - 1 ? "disabled" : ""} type="button" title="Descer produto">↓</button>
        </div>
        <button class="ghost-button" data-edit-product="${escapeHtml(product.id)}" type="button" style="padding:6px 12px; font-size:0.85rem;">Editar</button>
        <button class="ghost-button" data-delete-product="${escapeHtml(product.id)}" type="button" style="color:var(--red); border-color:var(--red); padding:6px 12px; font-size:0.85rem;">Excluir</button>
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
  productImageInput.value = product.image_url || product.imageUrl || "";
  document.querySelector("#productActive").checked = Boolean(product.active);
  
  document.querySelectorAll('input[name="productTags"]').forEach(cb => {
    cb.checked = product.tags && product.tags.includes(cb.value);
  });
  productAddonsInput.value = JSON.stringify(product.addons || []);
  renderAddonsBuilder();
  if (deleteProductButton) deleteProductButton.classList.remove("hidden");
  
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveProduct(event) {
  event.preventDefault();

  const productId = document.querySelector("#productId").value;
  const category = document.querySelector("#productCategory").value;
  const tags = Array.from(document.querySelectorAll('input[name="productTags"]:checked')).map(cb => cb.value);
  let addons = [];
  try { addons = JSON.parse(productAddonsInput.value || "[]"); } catch (e) {}

  const payload = {
    name: document.querySelector("#productName").value.trim(),
    category,
    price: Number(document.querySelector("#productPrice").value),
    sort_order: Number(document.querySelector("#productOrder").value || nextSortOrder(category)),
    description: document.querySelector("#productDescription").value.trim(),
    image_url: productImageInput.value.trim() || null,
    active: document.querySelector("#productActive").checked,
    tags,
    addons
  };

  const request = productId
    ? supabaseClient.from("products").update(payload).eq("id", productId)
    : supabaseClient.from("products").insert(payload);
  const { error } = await request;

  if (error) {
    alert("Não foi possível salvar o produto.");
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
    alert("Não foi possível mudar a ordem.");
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
  document.querySelector("#productOrder").value = "";
  document.querySelectorAll('input[name="productTags"]').forEach(cb => cb.checked = false);
  productAddonsInput.value = "[]";
  renderAddonsBuilder();
  if (deleteProductButton) deleteProductButton.classList.add("hidden");
  document.querySelector("#productActive").checked = true;
  setImageUploadMessage("Use uma foto quadrada ou horizontal, com boa luz.");
}

async function deleteProduct(eventOrId) {
  if (eventOrId && eventOrId.preventDefault) eventOrId.preventDefault();
  
  const id = typeof eventOrId === 'string' ? eventOrId : document.querySelector("#productId").value;
  if (!id) {
    alert("Erro: Nenhum produto selecionado para excluir.");
    return;
  }
  
  // Criar modal customizado
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0,0,0,0.8)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "99999";
  overlay.style.backdropFilter = "blur(4px)";

  const modal = document.createElement("div");
  modal.style.backgroundColor = "var(--surface-1)";
  modal.style.padding = "32px";
  modal.style.borderRadius = "var(--radius)";
  modal.style.textAlign = "center";
  modal.style.maxWidth = "400px";
  modal.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)";
  
  modal.innerHTML = `
    <h3 style="margin-top:0; color:var(--ink); font-size:1.4rem;">Excluir Produto?</h3>
    <p style="color:var(--muted); margin-bottom:24px; line-height:1.5;">Você tem certeza que irá excluir esse produto? Esta ação não pode ser desfeita.</p>
    <div style="display:flex; gap:12px; justify-content:center;">
      <button id="cancelDeleteBtn" class="ghost-button" type="button" style="padding:10px 24px;">Cancelar</button>
      <button id="confirmDeleteBtn" class="primary-button" type="button" style="background:var(--red); padding:10px 24px;">Confirmar</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
    document.body.removeChild(overlay);
  });

  document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
    const btn = document.getElementById("confirmDeleteBtn");
    btn.disabled = true;
    btn.textContent = "Excluindo...";
    
    const { error } = await supabaseClient.from("products").delete().eq("id", id);
    document.body.removeChild(overlay);
    
    if (error) {
      alert("Erro ao excluir o produto. Verifique sua conexão: " + error.message);
      return;
    }
    
    // Recarregar a página para o usuário ver que foi excluído
    window.location.reload();
  });
}

function renderAddonGroup() {
  let addons = [];
  try { addons = JSON.parse(productAddonsInput.value || "[]"); } catch (e) {}
  addons.push({ name: "Novo Grupo", required: false, options: [] });
  productAddonsInput.value = JSON.stringify(addons);
  renderAddonsBuilder();
}

function renderAddonsBuilder() {
  if (!addonsBuilder) return;
  let addons = [];
  try { addons = JSON.parse(productAddonsInput.value || "[]"); } catch (e) {}
  
  if (addons.length === 0) {
    addonsBuilder.innerHTML = '<span class="muted" style="font-size:0.85rem;">Nenhum complemento adicionado.</span>';
    return;
  }
  
  addonsBuilder.innerHTML = addons.map((group, gIdx) => `
    <div style="border:1px solid var(--line); padding:10px; border-radius:8px; background:rgba(0,0,0,0.2);">
      <div style="display:flex; gap:10px; margin-bottom:8px;">
        <input type="text" value="${escapeHtml(group.name)}" onchange="updateAddonGroup(${gIdx}, 'name', this.value)" placeholder="Nome do grupo" style="flex:1;">
        <label style="display:flex; align-items:center; gap:4px; font-weight:normal; font-size:0.85rem;">
          <input type="checkbox" ${group.required ? "checked" : ""} onchange="updateAddonGroup(${gIdx}, 'required', this.checked)"> Obrigatório
        </label>
        <button type="button" class="ghost-button icon-button" onclick="removeAddonGroup(${gIdx})" style="color:var(--red);">X</button>
      </div>
      <div style="display:grid; gap:4px; margin-left:12px;">
        ${group.options.map((opt, oIdx) => `
          <div style="display:flex; gap:4px;">
            <input type="text" value="${escapeHtml(opt.name)}" onchange="updateAddonOption(${gIdx}, ${oIdx}, 'name', this.value)" placeholder="Opção (ex: Ao ponto)" style="flex:2; font-size:0.85rem; padding:4px;">
            <input type="number" step="0.01" value="${opt.price}" onchange="updateAddonOption(${gIdx}, ${oIdx}, 'price', this.value)" placeholder="0,00" style="flex:1; font-size:0.85rem; padding:4px;">
            <button type="button" class="ghost-button icon-button" onclick="removeAddonOption(${gIdx}, ${oIdx})" style="font-size:0.85rem; color:var(--red);">X</button>
          </div>
        `).join("")}
        <button type="button" class="ghost-button" onclick="addAddonOption(${gIdx})" style="font-size:0.75rem; padding:4px; width:fit-content; margin-top:4px;">+ Nova opção</button>
      </div>
    </div>
  `).join("");
}

window.updateAddonGroup = (gIdx, field, val) => {
  let addons = JSON.parse(productAddonsInput.value || "[]");
  addons[gIdx][field] = val;
  productAddonsInput.value = JSON.stringify(addons);
  renderAddonsBuilder();
};
window.removeAddonGroup = (gIdx) => {
  let addons = JSON.parse(productAddonsInput.value || "[]");
  addons.splice(gIdx, 1);
  productAddonsInput.value = JSON.stringify(addons);
  renderAddonsBuilder();
};
window.addAddonOption = (gIdx) => {
  let addons = JSON.parse(productAddonsInput.value || "[]");
  addons[gIdx].options.push({ name: "", price: 0 });
  productAddonsInput.value = JSON.stringify(addons);
  renderAddonsBuilder();
};
window.updateAddonOption = (gIdx, oIdx, field, val) => {
  let addons = JSON.parse(productAddonsInput.value || "[]");
  addons[gIdx].options[oIdx][field] = field === 'price' ? Number(val) : val;
  productAddonsInput.value = JSON.stringify(addons);
  renderAddonsBuilder();
};
window.removeAddonOption = (gIdx, oIdx) => {
  let addons = JSON.parse(productAddonsInput.value || "[]");
  addons[gIdx].options.splice(oIdx, 1);
  productAddonsInput.value = JSON.stringify(addons);
  renderAddonsBuilder();
};

function productImageUrl(product) {
  return product.image_url || product.imageUrl || FALLBACK_IMAGE;
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
    setImageUploadMessage("Não foi possível enviar. Confira o bucket produtos no Supabase.");
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
  document.querySelector("#chatPanelAdmin").classList.toggle("hidden", tabName !== "chat");
  document.querySelector("#tablesPanel").classList.toggle("hidden", tabName !== "tables");
  document.querySelector("#productsPanel").classList.toggle("hidden", tabName !== "products");
  const blocksPanel = document.querySelector("#blocksPanel");
  if (blocksPanel) {
    blocksPanel.classList.toggle("hidden", tabName !== "blocks");
  }
}

function orderWhatsAppMessage(order) {
  const items = (order.order_items || [])
    .map((item) => `${item.quantity}x ${item.product_name} - ${currency.format(Number(item.subtotal))}`)
    .join("\n");

  return [
    `Pedido de ${order.customer_name}`,
    order.customer_phone ? `Telefone: ${order.customer_phone}` : "",
    `Tipo: ${order.delivery_type}`,
    `Endereco: ${order.customer_address || "Combinar"}`,
    order.table_name ? `Mesa: ${order.table_name}` : "",
    `Pagamento: ${paymentLabel(order.payment_method)}`,
    `Troco: ${order.change_for || "Nao precisa"}`,
    "",
    items,
    "",
    `Total: ${currency.format(Number(order.total))}`,
    `Observacao: ${order.note || "Sem observacao"}`,
  ].filter(Boolean).join("\n");
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

function ticketStatusLabel(status) {
  return {
    novo: "Novo",
    assumido: "Assumido",
    respondido: "Respondido",
    resolvido: "Resolvido",
  }[status] || status;
}

function categoryLabel(categorySlug) {
  if (!state.categories || state.categories.length === 0) {
    return categorySlug;
  }
  const cat = state.categories.find(c => c.slug === categorySlug);
  return cat ? cat.name : categorySlug;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paymentLabel(value) {
  return value === "Cartao" ? "Cartão" : value;
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

// --- Gestão de Clientes Bloqueados ---
async function loadBlockedCustomers() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from("blocked_customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) {
      state.blockedCustomers = data || [];
    }
  } catch (e) {
    console.error("Erro ao carregar bloqueios", e);
  }
}

function renderBlockedCustomers() {
  const list = document.querySelector("#blocksList");
  if (!list) return;

  list.innerHTML = state.blockedCustomers.length
    ? `<div class="blocked-list-inner" style="display:grid; gap:12px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">${state.blockedCustomers.map(blockedCard).join("")}</div>`
    : `<div class="empty-state">Nenhum cliente bloqueado.</div>`;

  document.querySelectorAll("[data-unblock-customer]").forEach((btn) => {
    btn.onclick = () => unblockCustomer(btn.dataset.unblockCustomer);
  });
}

function blockedCard(item) {
  return `
    <article class="product-card" style="display:flex; justify-content:space-between; align-items:center; padding:16px; border:1px solid var(--line); border-radius:8px; background:var(--panel);">
      <div style="flex:1; margin-right:12px;">
        <h3 style="margin:0 0 4px 0; font-size:1.05rem;">${escapeHtml(item.customer_name || "Cliente Sem Nome")}</h3>
        <p class="muted" style="margin:0 0 4px 0; font-size:0.85rem;">Telefone: <strong>${escapeHtml(item.phone)}</strong></p>
        <span style="font-size:0.8rem; color:var(--brand-dark); font-weight:700;">Motivo: ${escapeHtml(item.reason || "Não informado")}</span>
      </div>
      <button class="ghost-button" data-unblock-customer="${escapeHtml(item.id)}" type="button" style="color:var(--green); border-color:var(--green); font-size:0.8rem; padding:6px 10px;">Desbloquear</button>
    </article>
  `;
}

async function unblockCustomer(id) {
  if (!confirm("Deseja desbloquear este cliente?")) return;

  const { error } = await supabaseClient
    .from("blocked_customers")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Não foi possível desbloquear o cliente.");
    return;
  }

  await loadBlockedCustomers();
  renderBlockedCustomers();
}

async function saveBlock(event) {
  event.preventDefault();
  const phone = document.querySelector("#blockPhone").value.trim();
  const reason = document.querySelector("#blockReason").value.trim();
  if (!phone || !reason) return;

  const payload = {
    customer_name: "Bloqueio Manual",
    phone,
    normalized_phone: phone.replace(/\D/g, ""),
    reason,
    active: true,
  };

  const { error } = await supabaseClient
    .from("blocked_customers")
    .upsert(payload, { onConflict: "normalized_phone" });

  if (error) {
    alert("Não foi possível salvar o bloqueio.");
    return;
  }

  document.querySelector("#blockForm").reset();
  await loadBlockedCustomers();
  renderBlockedCustomers();
}
