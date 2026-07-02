const WHATSAPP_NUMBER = "5569992824311";
const FALLBACK_IMAGE = "assets/no-image.png";
window.SABOR_DE_MAE_FALLBACK_IMAGE = FALLBACK_IMAGE;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const CATEGORY_SCHEDULES = {
  local: {
    ranges: [{ start: "11:00", end: "14:00" }, { start: "18:00", end: "22:50" }],
    label: "Disponivel das 11:00 as 14:00 e das 18:00 as 22:50",
  },
  bebidas: {
    ranges: [{ start: "11:00", end: "14:00" }, { start: "18:00", end: "22:50" }],
    label: "Disponivel das 11:00 as 14:00 e das 18:00 as 22:50",
  },
  marmitex: { start: "11:00", end: "14:00", label: "Disponível das 11:00 às 14:00" },
  espetinhos: { start: "18:00", end: "22:50", label: "Disponível das 18:00 às 22:50" },
  porcoes: { start: "18:00", end: "22:50", label: "Disponível das 18:00 às 22:50" },
};

const cart = [];
const supabaseClient = createSupabaseClient();
let siteCategories = [];
let siteProducts = [];

const cartItems = document.querySelector("#cartItems");
const cartTotal = document.querySelector("#cartTotal");
const cartCount = document.querySelector("#cartCount");
const floatingCartButton = document.querySelector("#floatingCartButton");
const floatingCartCount = document.querySelector("#floatingCartCount");
const floatingCartLabel = document.querySelector("#floatingCartLabel");
const floatingCartTotal = document.querySelector("#floatingCartTotal");
const cartToast = document.querySelector("#cartToast");
const cartToastTitle = document.querySelector("#cartToastTitle");
const cartToastText = document.querySelector("#cartToastText");
const cartOverlay = document.querySelector("#cartOverlay");
const closeCheckoutButton = document.querySelector("#closeCheckoutButton");
const orderForm = document.querySelector("#orderForm");
const copyOrderButton = document.querySelector("#copyOrderButton");
const submitOrderButton = document.querySelector("#submitOrderButton");
const customerPhoneInput = document.querySelector("#customerPhone");
const paymentMethodInput = document.querySelector("#paymentMethod");
const changeForField = document.querySelector("#changeForField");
const changeForInput = document.querySelector("#changeFor");
const tableField = document.querySelector("#tableField");
const tableSelect = document.querySelector("#tableSelect");
const orderConfirmation = document.querySelector("#orderConfirmation");
const confirmationText = document.querySelector("#confirmationText");
const whatsappFallback = document.querySelector("#whatsappFallback");
const CHAT_TICKET_KEY = "saborDeMaeChatTicketId";
const CHAT_PROFILE_KEY = "saborDeMaeChatProfile";
const LAST_ORDER_KEY = "saborDeMaeLastOrder";
const ORDER_COOLDOWN_MS = 45000;
const DUPLICATE_ORDER_MS = 180000;
const chatToggle = document.querySelector("#chatToggle");
const chatPanel = document.querySelector("#chatPanel");
const chatClose = document.querySelector("#chatClose");
const chatForm = document.querySelector("#chatForm");
const chatIdentityFields = document.querySelector("#chatIdentityFields");
const chatName = document.querySelector("#chatName");
const chatContact = document.querySelector("#chatContact");
const chatMessage = document.querySelector("#chatMessage");
const chatMessages = document.querySelector("#chatMessages");
const chatStatus = document.querySelector("#chatStatus");
const chatSubmitButton = document.querySelector("#chatSubmitButton");
const themeToggle = document.querySelector("#themeToggle");
const themeToggleText = document.querySelector("#themeToggleText");
const themeIcon = document.querySelector(".theme-icon");
let chatRefreshTimer = null;
let availableTables = [];

initTheme();

document.querySelectorAll(".category-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setCategory(tab.dataset.category);
  });
});

document.querySelectorAll('a[href="#pedido"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (cart.length) {
      openCheckout();
    } else {
      document.querySelector("#cardapio").scrollIntoView({ behavior: "smooth", block: "start" });
      showCartToast("Adicione um item primeiro");
    }
  });
});

document.querySelectorAll(".menu-item[data-add-item]").forEach((item) => {
  item.addEventListener("click", () => {
    addToCart(item.dataset.addItem, Number(item.dataset.price), item.dataset.category);
  });
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      addToCart(item.dataset.addItem, Number(item.dataset.price), item.dataset.category);
    }
  });
});

if (window.location.hash && window.location.hash !== "#cardapio" && window.location.hash !== "#inicio") {
  history.replaceState(null, "", window.location.pathname + window.location.search);
  window.scrollTo({ top: 0, left: 0 });
}

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cart.length) {
    alert("Adicione pelo menos um item ao pedido.");
    return;
  }

  const spamWarning = getOrderSpamWarning();
  if (spamWarning) {
    alert(spamWarning);
    return;
  }

  const blockWarning = await getCustomerBlockWarning();
  if (blockWarning) {
    alert(blockWarning);
    return;
  }

  submitOrderButton.disabled = true;
  submitOrderButton.textContent = "Enviando...";
  const orderFingerprint = createOrderFingerprint();

  const savedOrderId = await saveOrderIfConfigured();
  if (!savedOrderId) {
    submitOrderButton.disabled = false;
    submitOrderButton.textContent = "Finalizar pedido";
    alert("Não foi possível registrar o pedido no painel agora. Tente novamente em alguns segundos.");
    return;
  }

  const message = buildOrderMessage();
  rememberSubmittedOrder(orderFingerprint);
  showOrderConfirmation(savedOrderId, message);
  cart.splice(0, cart.length);
  renderCart();
  orderForm.reset();
  updatePaymentFields();
  updateTableField();
  submitOrderButton.disabled = false;
  submitOrderButton.textContent = "Finalizar pedido";
});

copyOrderButton.addEventListener("click", async () => {
  if (!cart.length) {
    alert("Adicione pelo menos um item ao pedido.");
    return;
  }

  await navigator.clipboard.writeText(buildOrderMessage());
  alert("Pedido copiado.");
});

floatingCartButton.addEventListener("click", openCheckout);
cartOverlay.addEventListener("click", closeCheckout);
closeCheckoutButton.addEventListener("click", closeCheckout);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("checkout-open")) {
    closeCheckout();
  }
});
paymentMethodInput.addEventListener("change", updatePaymentFields);
tableSelect?.addEventListener("change", renderCart);
chatToggle.addEventListener("click", openChat);
chatClose.addEventListener("click", closeChat);
chatForm.addEventListener("submit", sendChatMessage);
themeToggle?.addEventListener("click", toggleTheme);

loadProductsIfConfigured();
loadTablesIfConfigured();
updatePaymentFields();
renderCart();
applyScheduleState();
hydrateChatProfile();
loadExistingChat();
renderChatMode();
initOrderTracking();

function initTheme() {
  let savedTheme = "";
  try {
    savedTheme = localStorage.getItem("saborDeMaeTheme") || "";
  } catch {
    savedTheme = "";
  }

  if (savedTheme === "dark") {
    document.documentElement.dataset.theme = "dark";
  }
  updateThemeButton();
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  if (nextTheme === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }

  try {
    localStorage.setItem("saborDeMaeTheme", nextTheme);
  } catch {
    // O tema ainda muda mesmo quando o navegador bloqueia storage.
  }
  updateThemeButton();
}

function updateThemeButton() {
  const isDark = document.documentElement.dataset.theme === "dark";
  if (themeToggleText) themeToggleText.textContent = isDark ? "Claro" : "Escuro";
  if (themeIcon) themeIcon.textContent = isDark ? "☀" : "☾";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#111816" : "#7a271c");
  themeToggle?.setAttribute("aria-label", isDark ? "Alternar para modo claro" : "Alternar para modo escuro");
}

function addToCart(name, price, category, selectedAddons = []) {
  let finalName = name;
  let finalPrice = price;
  
  if (selectedAddons.length > 0) {
    finalName += " (" + selectedAddons.map(a => a.name).join(", ") + ")";
    finalPrice += selectedAddons.reduce((sum, a) => sum + Number(a.price), 0);
  }

  const existing = cart.find(
    (item) => item.name === finalName && item.category === category
  );

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ name: finalName, price: finalPrice, category, quantity: 1 });
  }

  renderCart();
  showCartToast(finalName);
  updateCartBadge();
  if (isMobileLayout()) {
    floatingCartButton.classList.add("pulse");
    window.setTimeout(() => floatingCartButton.classList.remove("pulse"), 450);
  }
}

function changeQuantity(name, delta) {
  const item = cart.find((entry) => entry.name === name);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    cart.splice(cart.indexOf(item), 1);
  }
  renderCart();
}

function renderCart() {
  cartItems.innerHTML = cart.length
    ? cart.map(cartRow).join("")
    : `<p class="empty-cart">Seu carrinho esta vazio.</p>`;
  cartTotal.textContent = currency.format(totalCart());
  cartCount.textContent = `${totalItems()} ${totalItems() === 1 ? "item" : "itens"}`;
  floatingCartCount.textContent = totalItems();
  floatingCartLabel.textContent = totalItems() === 1 ? "item" : "itens";
  floatingCartTotal.textContent = currency.format(totalCart());
  floatingCartButton.classList.toggle("hidden", !cart.length);
  updateTableField();

  document.querySelectorAll("[data-cart-plus]").forEach((button) => {
    button.onclick = () => changeQuantity(button.dataset.cartPlus, 1);
  });
  document.querySelectorAll("[data-cart-minus]").forEach((button) => {
    button.onclick = () => changeQuantity(button.dataset.cartMinus, -1);
  });
}

function openCheckout() {
  if (!cart.length) {
    showCartToast("Adicione um item primeiro");
    return;
  }

  document.body.classList.add("checkout-open");
  cartOverlay.classList.remove("hidden");
  closeCheckoutButton.classList.remove("hidden");
  document.querySelector("#pedido").classList.add("is-open");
}

function closeCheckout() {
  document.body.classList.remove("checkout-open");
  cartOverlay.classList.add("hidden");
  closeCheckoutButton.classList.add("hidden");
  document.querySelector("#pedido").classList.remove("is-open");
}

function showCartToast(name) {
  const isEmptyWarning = name === "Adicione um item primeiro";
  showSiteToast(
    isEmptyWarning ? "Escolha um item" : "Item adicionado",
    isEmptyWarning ? "Escolha um produto do cardápio para continuar." : `${name} entrou no carrinho.`,
    isEmptyWarning ? "warning" : "success"
  );
}

function showSiteToast(title, message, type = "success") {
  cartToastTitle.textContent = title;
  cartToastText.textContent = message;
  cartToast.classList.toggle("is-warning", type === "warning");
  cartToast.classList.remove("hidden");
  window.clearTimeout(showCartToast.timer);
  showCartToast.timer = window.setTimeout(() => cartToast.classList.add("hidden"), 3200);
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 860px)").matches;
}

async function loadProductsIfConfigured() {
  if (!supabaseClient) return;
  
  try {
    const { data: catData } = await supabaseClient.from("categories").select("*").order("sort_order", { ascending: true });
    siteCategories = catData || [];
  } catch(e) {
    console.warn("Nao carregou categorias", e);
  }

  let data;
  let error;
  try {
    ({ data, error } = await supabaseClient
      .from("products")
      .select("id, name, description, category, price, image_url, tags, addons")
      .eq("active", true)
      .order("sort_order", { ascending: true }));
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    const groupsContainer = document.querySelector("#dynamicMenuGroups");
    if (groupsContainer) groupsContainer.innerHTML = `<div class="empty-menu">Não foi possível carregar o cardápio agora.</div>`;
    console.error(error);
    return;
  }

  if (!data?.length) return;
  siteProducts = data;
  renderMenu(data);
}

async function loadTablesIfConfigured() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from("restaurant_tables")
      .select("id, name, status, active, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    availableTables = data || [];
  } catch (error) {
    availableTables = [];
    console.warn("Mesas ainda nao configuradas no Supabase.", error);
  }

  renderTableOptions();
  updateTableField();
}

function renderTableOptions() {
  if (!tableSelect) return;

  const freeTables = availableTables.filter((table) => table.status === "livre");
  tableSelect.innerHTML = [
    `<option value="">${freeTables.length ? "Selecione uma mesa livre" : "Nenhuma mesa livre cadastrada"}</option>`,
    ...freeTables.map((table) =>
      `<option value="${escapeHtml(table.id)}" data-table-name="${escapeHtml(table.name)}">${escapeHtml(table.name)}</option>`
    ),
  ].join("");
  tableSelect.disabled = !freeTables.length;
}

function renderMenu(products) {
  const tabsContainer = document.querySelector("#dynamicCategoryTabs");
  const groupsContainer = document.querySelector("#dynamicMenuGroups");
  
  if (tabsContainer) {
    tabsContainer.innerHTML = `
      <button class="category-tab active" data-category="all" type="button">Todos</button>
      ${siteCategories.map(cat => `<button class="category-tab" data-category="${escapeHtml(cat.slug)}" type="button">${escapeHtml(cat.name)}</button>`).join("")}
    `;
    
    // Re-bind category tabs
    document.querySelectorAll(".category-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".category-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const category = tab.dataset.category;
        document.querySelectorAll(".menu-group").forEach((group) => {
          if (category === "all") {
            group.style.display = group.hidden ? "none" : "";
          } else {
            group.style.display = group.dataset.menuGroup === category ? "" : "none";
          }
        });
      });
    });
  }

  if (groupsContainer) {
    groupsContainer.innerHTML = siteCategories.map(cat => {
      const scheduleText = categoryScheduleText(cat.slug);
      return `
        <section class="menu-group" data-menu-group="${escapeHtml(cat.slug)}">
          <div class="menu-group-heading">
            <h3>${escapeHtml(cat.name)}</h3>
            ${scheduleText ? `<p data-schedule-label="${escapeHtml(cat.slug)}">${escapeHtml(scheduleText)}</p>` : ""}
          </div>
          <div class="menu-grid"></div>
        </section>
      `;
    }).join("");
  }

  document.querySelectorAll("[data-menu-group]").forEach((group) => {
    const category = group.dataset.menuGroup;
    const categoryProducts = products.filter((product) => product.category === category);
    group.querySelector(".menu-grid").innerHTML = categoryProducts.map(productCard).join("");
    group.hidden = !categoryProducts.length;
    if (group.hidden) group.style.display = "none";
  });
  
  bindMenuItems();
  applyScheduleState();
}

function productCard(product) {
  const available = isCategoryAvailable(product.category);
  const scheduleText = categoryScheduleText(product.category);
  return `
    <article class="menu-item ${available ? "" : "is-closed"}" data-product-id="${escapeHtml(product.id)}" tabindex="0" aria-disabled="${available ? "false" : "true"}">
      <img class="menu-photo" src="${escapeHtml(productImageUrl(product))}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';">
      <div class="item-copy">
        <span class="item-tag">${escapeHtml(categoryLabel(product.category))}</span>
        <h3>${escapeHtml(product.name)}</h3>
        ${product.tags && product.tags.length ? `<div style="display:flex; gap:4px; margin-bottom:4px; flex-wrap:wrap;">${product.tags.map(t => `<span style="background:var(--brand); color:#fff; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:600;">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        <p>${escapeHtml(product.description || "")}</p>
        ${scheduleText ? `<small class="schedule-note">${escapeHtml(scheduleText)}</small>` : ""}
      </div>
      <div class="menu-action">
        <strong>${currency.format(Number(product.price))}</strong>
        <button type="button" ${available ? "" : "disabled"}>${available ? "Adicionar" : "Indisponível"}</button>
      </div>
    </article>
  `;
}

function productImageUrl(product) {
  return product.image_url || product.imageUrl || FALLBACK_IMAGE;
}

function bindMenuItems() {
  document.querySelectorAll(".menu-item[data-product-id]").forEach((item) => {
    const productId = item.dataset.productId;
    const product = siteProducts.find(p => p.id === productId);
    if (!product) return;
    
    item.onclick = () => handleProductClick(product);
    item.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleProductClick(product);
      }
    };
  });
}

function handleProductClick(product) {
  if (!isCategoryAvailable(product.category)) return;
  
  if (product.addons && product.addons.length > 0) {
    openAddonsModal(product);
  } else {
    addToCart(product.name, Number(product.price), product.category);
  }
}

function openAddonsModal(product) {
  let modal = document.querySelector("#addonsModal");
  if (!modal) {
    modal = document.createElement("dialog");
    modal.id = "addonsModal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }
  
  const groupsHtml = product.addons.map((group, gIdx) => `
    <div class="addon-group" style="margin-bottom: 16px;">
      <h4 style="margin: 0 0 8px 0; font-size: 1rem;">${escapeHtml(group.name)} ${group.required ? '<span style="color:var(--brand); font-size:0.8rem;">(Obrigatório)</span>' : ''}</h4>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${group.options.map((opt, oIdx) => `
          <label style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid var(--line); border-radius:8px; cursor:pointer;">
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="${group.required ? 'radio' : 'checkbox'}" name="addon_g${gIdx}" value='${escapeHtml(JSON.stringify(opt))}' ${group.required ? 'required' : ''}>
              <span>${escapeHtml(opt.name)}</span>
            </div>
            ${opt.price > 0 ? `<strong style="color:var(--brand);">+ ${currency.format(Number(opt.price))}</strong>` : ''}
          </label>
        `).join("")}
      </div>
    </div>
  `).join("");
  
  modal.innerHTML = `
    <div class="modal-content" style="background:var(--surface-1); padding:20px; border-radius:12px; max-width:400px; width:90%; margin:auto; position:relative; border:1px solid var(--line);">
      <button type="button" onclick="document.querySelector('#addonsModal').close()" style="position:absolute; top:12px; right:12px; background:none; border:none; color:var(--ink); font-size:1.5rem; cursor:pointer;">&times;</button>
      <h3 style="margin-top:0;">${escapeHtml(product.name)}</h3>
      <p class="muted" style="font-size:0.9rem;">Escolha os complementos:</p>
      <form id="addonsForm" style="margin-top:16px;">
        ${groupsHtml}
        <button type="submit" class="primary-button" style="width:100%; margin-top:16px;">Adicionar ao Carrinho</button>
      </form>
    </div>
  `;
  
  modal.showModal();
  
  document.querySelector("#addonsForm").onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedAddons = [];
    for (let [key, value] of formData.entries()) {
      try { selectedAddons.push(JSON.parse(value)); } catch(err) {}
    }
    
    addToCart(product.name, Number(product.price), product.category, selectedAddons);
    modal.close();
  };
}

async function saveOrderIfConfigured() {
  const backendOrderId = await saveOrderWithBackend();
  if (backendOrderId) return backendOrderId;

  if (!hasSupabaseCredentials()) return createId();

  const order = getOrderPayload();
  const orderId = createId();
  const orderWithId = { id: orderId, ...order };
  try {
  if (!supabaseClient) {
    return (await saveOrderWithRest(orderWithId)) ? orderId : null;
  }

  const { error } = await supabaseClient
    .from("orders")
    .insert(orderWithId);

  if (error) {
    if (isMissingTableColumnsError(error)) {
      return saveOrderWithoutTableFields(orderId, order);
    }
    return null;
  }

  const items = cart.map((item) => ({
    order_id: orderId,
    product_name: item.name,
    unit_price: item.price,
    quantity: item.quantity,
    subtotal: item.price * item.quantity,
  }));

  const { error: itemsError } = await supabaseClient.from("order_items").insert(items);
  return itemsError ? null : orderId;
  } catch {
    return null;
  }
}

async function saveOrderWithBackend() {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return null;

  try {
    const response = await fetch(`${backendUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...getOrderPayload(),
        items: cart.map((item) => ({
          product_name: item.name,
          unit_price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity,
        })),
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (result?.error) alert(result.error);
      return null;
    }

    return result.id || null;
  } catch (error) {
    console.warn("Backend local indisponivel, usando fallback do Supabase.", error);
    return null;
  }
}

async function saveOrderWithoutTableFields(orderId, order) {
  const { table_id, table_name, customer_phone, ...fallbackOrder } = order;
  const { error } = await supabaseClient
    .from("orders")
    .insert({ id: orderId, ...fallbackOrder });

  if (error) return null;

  const items = cart.map((item) => ({
    order_id: orderId,
    product_name: item.name,
    unit_price: item.price,
    quantity: item.quantity,
    subtotal: item.price * item.quantity,
  }));

  const { error: itemsError } = await supabaseClient.from("order_items").insert(items);
  return itemsError ? null : orderId;
}

function isMissingTableColumnsError(error) {
  return /table_id|table_name|customer_phone|schema cache|column/i.test(`${error?.message || ""} ${error?.details || ""}`);
}

async function saveOrderWithRest(orderWithId) {
  const config = getSupabaseConfig();
  const headers = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  const orderResponse = await fetch(`${config.url}/rest/v1/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(orderWithId),
  });

  if (!orderResponse.ok) {
    if (orderResponse.status === 400) {
      const { table_id, table_name, customer_phone, ...fallbackOrder } = orderWithId;
      const fallbackResponse = await fetch(`${config.url}/rest/v1/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(fallbackOrder),
      });
      if (!fallbackResponse.ok) return false;
    } else {
      return false;
    }
  }

  const items = cart.map((item) => ({
    order_id: orderWithId.id,
    product_name: item.name,
    unit_price: item.price,
    quantity: item.quantity,
    subtotal: item.price * item.quantity,
  }));

  const itemsResponse = await fetch(`${config.url}/rest/v1/order_items`, {
    method: "POST",
    headers,
    body: JSON.stringify(items),
  });

  return itemsResponse.ok;
}

function showOrderConfirmation(orderId, message) {
  const shortId = orderId.slice(0, 8).toUpperCase();
  confirmationText.textContent = `Código do pedido: ${shortId}. O restaurante já pode acompanhar pelo painel.`;
  whatsappFallback.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  orderConfirmation.classList.remove("hidden");
  orderConfirmation.scrollIntoView({ behavior: "smooth", block: "center" });

  try {
    saveRecentOrder(orderId, document.querySelector("#customerName").value.trim() || "Nao informado", totalCart());
    startOrderTracking(orderId);
    document.querySelector("#rastreamento").classList.remove("hidden");
  } catch (e) {
    console.error("Erro no autostart do rastreamento:", e);
  }
}

async function openChat() {
  chatPanel.classList.remove("hidden");
  renderChatMode();
  chatMessage.focus();
  await loadExistingChat();
  startChatRefresh();
}

function closeChat() {
  chatPanel.classList.add("hidden");
  stopChatRefresh();
}

async function loadExistingChat() {
  const ticketId = localStorage.getItem(CHAT_TICKET_KEY);
  if (!ticketId || !supabaseClient) {
    renderChatMode();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("chat_messages")
      .select("sender,message,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) return;
    renderChatMessages(data || []);
    renderChatMode();
  } catch {
    // The chat table may not exist yet. The form will show a clear message when the user sends.
  }
}

async function sendChatMessage(event) {
  event.preventDefault();
  const profile = getChatProfile();
  const ticketIdBeforeSend = localStorage.getItem(CHAT_TICKET_KEY);
  const name = ticketIdBeforeSend ? profile.name : chatName.value.trim();
  const contact = ticketIdBeforeSend ? profile.contact : chatContact.value.trim();
  const message = chatMessage.value.trim();
  if (!message) return;
  if (!ticketIdBeforeSend && !name) {
    chatName.focus();
    chatStatus.textContent = "Informe seu nome para abrir o atendimento.";
    return;
  }

  if (!supabaseClient) {
    chatStatus.textContent = "Atendimento online ainda não foi configurado. Use o WhatsApp por enquanto.";
    return;
  }

  chatSubmitButton.disabled = true;
  chatSubmitButton.textContent = "Enviando...";
  chatStatus.textContent = "";

  try {
    let ticketId = localStorage.getItem(CHAT_TICKET_KEY);
    if (!ticketId) {
      saveChatProfile({ name, contact });
      const { data: ticket, error: ticketError } = await supabaseClient
        .from("chat_tickets")
        .insert({
          customer_name: name,
          customer_contact: contact,
          last_message: message,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (ticketError) throw ticketError;
      ticketId = ticket.id;
      localStorage.setItem(CHAT_TICKET_KEY, ticketId);
      renderChatMode();
    }

    const { error: messageError } = await supabaseClient.from("chat_messages").insert({
      ticket_id: ticketId,
      sender: "cliente",
      message,
    });

    if (messageError) throw messageError;

    await supabaseClient
      .from("chat_tickets")
      .update({
        customer_name: name,
        customer_contact: contact,
        status: "novo",
        last_message: message,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    chatMessage.value = "";
    chatStatus.textContent = "Mensagem enviada. O restaurante recebeu seu atendimento.";
    await loadExistingChat();
    startChatRefresh();
  } catch (error) {
    chatStatus.textContent = "Não foi possível abrir o atendimento online agora. Use o WhatsApp se for urgente.";
    console.error(error);
  }

  chatSubmitButton.disabled = false;
  chatSubmitButton.textContent = "Enviar mensagem";
}

function renderChatMessages(messages) {
  chatMessages.innerHTML = messages.length
    ? messages.map((message) => `
      <article class="chat-bubble ${message.sender === "admin" ? "admin" : ""}">
        <strong>${message.sender === "admin" ? "Restaurante" : "Voce"}</strong>
        <span>${escapeHtml(message.message)}</span>
      </article>
    `).join("")
    : `<p class="chat-empty">Envie uma mensagem para abrir um atendimento no restaurante.</p>`;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderChatMode() {
  const hasTicket = Boolean(localStorage.getItem(CHAT_TICKET_KEY));
  chatIdentityFields.classList.toggle("hidden", hasTicket);
  chatName.required = !hasTicket;
  chatSubmitButton.textContent = hasTicket ? "Enviar nova mensagem" : "Abrir atendimento";

  if (hasTicket) {
    const profile = getChatProfile();
    chatStatus.textContent = profile.name
      ? `Atendimento aberto como ${profile.name}.`
      : "Atendimento aberto. Continue a conversa por aqui.";
  }
}

function hydrateChatProfile() {
  const profile = getChatProfile();
  if (profile.name) chatName.value = profile.name;
  if (profile.contact) chatContact.value = profile.contact;
}

function getChatProfile() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_PROFILE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveChatProfile(profile) {
  localStorage.setItem(CHAT_PROFILE_KEY, JSON.stringify({
    name: profile.name || "Cliente",
    contact: profile.contact || "",
  }));
}

let chatMessagesChannel = null;

function startChatRefresh() {
  if (!localStorage.getItem(CHAT_TICKET_KEY)) return;

  if (supabaseClient) {
    const ticketId = localStorage.getItem(CHAT_TICKET_KEY);
    if (chatMessagesChannel) {
      supabaseClient.removeChannel(chatMessagesChannel);
    }

    chatMessagesChannel = supabaseClient
      .channel(`chat-messages-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `ticket_id=eq.${ticketId}`
        },
        () => {
          loadExistingChat();
        }
      )
      .subscribe();
  }

  if (!chatRefreshTimer) {
    chatRefreshTimer = window.setInterval(loadExistingChat, 8000);
  }
}

function stopChatRefresh() {
  if (chatRefreshTimer) {
    window.clearInterval(chatRefreshTimer);
    chatRefreshTimer = null;
  }
  if (chatMessagesChannel && supabaseClient) {
    supabaseClient.removeChannel(chatMessagesChannel);
    chatMessagesChannel = null;
  }
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(char) / 4)))).toString(16)
  );
}

function getOrderSpamWarning() {
  const lastOrder = readLastOrder();
  if (!lastOrder) return "";

  const elapsed = Date.now() - Number(lastOrder.createdAt || 0);
  if (elapsed > 0 && elapsed < ORDER_COOLDOWN_MS) {
    const seconds = Math.ceil((ORDER_COOLDOWN_MS - elapsed) / 1000);
    return `Aguarde ${seconds} segundos para enviar outro pedido.`;
  }

  if (elapsed > 0 && elapsed < DUPLICATE_ORDER_MS && lastOrder.fingerprint === createOrderFingerprint()) {
    return "Esse pedido parece igual ao anterior. Aguarde alguns minutos ou altere alguma informação antes de enviar novamente.";
  }

  return "";
}

async function getCustomerBlockWarning() {
  const normalizedPhone = normalizePhone(customerPhoneInput?.value || "");
  if (!normalizedPhone) return "";

  const backendWarning = await getCustomerBlockWarningFromBackend(normalizedPhone);
  if (backendWarning) return backendWarning;

  if (!hasSupabaseCredentials()) return "";

  try {
    const query = supabaseClient
      ? supabaseClient.from("blocked_customers").select("reason").eq("normalized_phone", normalizedPhone).eq("active", true).maybeSingle()
      : null;

    let data;
    let error;
    if (query) {
      ({ data, error } = await query);
    } else {
      const config = getSupabaseConfig();
      const response = await fetch(`${config.url}/rest/v1/blocked_customers?select=reason&normalized_phone=eq.${encodeURIComponent(normalizedPhone)}&active=eq.true&limit=1`, {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      });
      if (!response.ok) return "";
      const rows = await response.json();
      data = rows[0];
    }

    if (error || !data) return "";
    return `Este telefone esta bloqueado para pedidos pelo site. Motivo: ${data.reason || "bloqueio do restaurante"}.`;
  } catch {
    return "";
  }
}

async function getCustomerBlockWarningFromBackend(normalizedPhone) {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return "";

  try {
    const response = await fetch(`${backendUrl}/api/check-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone }),
    });
    if (!response.ok) return "";
    const data = await response.json();
    if (!data.blocked) return "";
    return `Este telefone esta bloqueado para pedidos pelo site. Motivo: ${data.reason || "bloqueio do restaurante"}.`;
  } catch {
    return "";
  }
}

function getBackendUrl() {
  return String(window.SABOR_DE_MAE_BACKEND_URL || "").replace(/\/+$/, "");
}

function readLastOrder() {
  try {
    return JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || "null");
  } catch {
    return null;
  }
}

function rememberSubmittedOrder(fingerprint) {
  try {
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({
      fingerprint,
      createdAt: Date.now(),
    }));
  } catch {
    // Se o navegador bloquear storage, o pedido salvo continua válido.
  }
}

function createOrderFingerprint() {
  const payload = getOrderPayload();
  const items = cart
    .map((item) => `${item.name}:${item.quantity}:${Number(item.price)}`)
    .sort()
    .join("|");

  return normalizeFingerprint([
    payload.customer_name,
    payload.delivery_type,
    payload.customer_address,
    payload.payment_method,
    payload.change_for,
    payload.note,
    payload.total,
    items,
  ].join("|"));
}

function getOrderPayload() {
  const paymentMethod = paymentMethodInput.value;
  const selectedTable = selectedTableData();
  const hasLocal = hasLocalItems();
  return {
    customer_name: document.querySelector("#customerName").value.trim() || "Nao informado",
    customer_phone: customerPhoneInput?.value.trim() || "",
    delivery_type: hasLocal ? "Retirada" : document.querySelector("#deliveryType").value,
    customer_address: document.querySelector("#customerAddress").value.trim() || "Combinar",
    payment_method: paymentMethod,
    change_for: paymentMethod === "Dinheiro" ? changeForInput.value.trim() : "",
    note: document.querySelector("#customerNote").value.trim(),
    total: totalCart(),
    table_id: selectedTable.id || null,
    table_name: selectedTable.name || "",
  };
}

function cartRow(item) {
  return `
    <article class="cart-row">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.quantity} x ${currency.format(item.price)}</span>
      </div>
      <div class="quantity-actions">
        <button type="button" data-cart-minus="${escapeHtml(item.name)}">-</button>
        <button type="button" data-cart-plus="${escapeHtml(item.name)}">+</button>
      </div>
    </article>
  `;
}

function buildOrderMessage() {
  const name = document.querySelector("#customerName").value.trim() || "Nao informado";
  const phone = customerPhoneInput?.value.trim() || "Nao informado";
  const selectedTable = selectedTableData();
  const deliveryType = hasLocalItems() ? "Retirada" : document.querySelector("#deliveryType").value;
  const address = document.querySelector("#customerAddress").value.trim() || "Combinar";
  const paymentMethod = paymentMethodInput.value;
  const changeFor = changeForInput.value.trim();
  const note = document.querySelector("#customerNote").value.trim() || "Sem observacao";
  const items = cart
    .map((item) => `${item.quantity}x ${item.name} - ${currency.format(item.price * item.quantity)}`)
    .join("\n");
  const message = [
    "Ola, quero fazer um pedido no Sabor de Mae.",
    "",
    `Nome: ${name}`,
    `Telefone: ${phone}`,
    `Tipo: ${deliveryType}`,
    `Endereco: ${address}`,
    selectedTable.name ? `Mesa: ${selectedTable.name}` : "",
    `Pagamento: ${paymentLabel(paymentMethod)}`,
    "",
    "Pedido:",
    items,
    "",
    `Total: ${currency.format(totalCart())}`,
    "",
    `Observacao: ${note}`,
  ].filter(Boolean);

  if (paymentMethod === "Dinheiro") {
    message.splice(selectedTable.name ? 7 : 6, 0, `Troco para: ${changeFor || "Nao informado"}`);
  }

  return message.join("\n");
}

function updatePaymentFields() {
  const needsChange = paymentMethodInput.value === "Dinheiro";
  changeForField.classList.toggle("hidden", !needsChange);
  changeForInput.disabled = !needsChange;
  changeForInput.required = needsChange;

  if (!needsChange) {
    changeForInput.value = "";
  }
}

function updateTableField() {
  if (!tableField || !tableSelect) return;

  const shouldShow = hasLocalItems();
  tableField.classList.toggle("hidden", !shouldShow);
  tableSelect.required = shouldShow && !tableSelect.disabled;
}

function hasLocalItems() {
  return cart.some((item) => item.category === "local");
}

function selectedTableData() {
  if (!tableSelect || !tableSelect.value) return { id: "", name: "" };
  const selectedOption = tableSelect.options[tableSelect.selectedIndex];
  return {
    id: tableSelect.value,
    name: selectedOption?.dataset.tableName || selectedOption?.textContent || "",
  };
}

function totalCart() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function totalItems() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function setCategory(category) {
  document.querySelectorAll(".category-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.category === category);
  });
  filterMenuBySearch();
}

function applyScheduleState() {
  document.querySelectorAll("[data-schedule-label]").forEach((label) => {
    const category = label.dataset.scheduleLabel;
    const text = categoryScheduleText(category);
    if (text) label.textContent = text;
  });

  document.querySelectorAll(".menu-item[data-category]").forEach((item) => {
    const available = isCategoryAvailable(item.dataset.category);
    const button = item.querySelector(".menu-action button");
    item.classList.toggle("is-closed", !available);
    item.setAttribute("aria-disabled", available ? "false" : "true");
    if (button) {
      button.disabled = !available;
      button.textContent = available ? "Adicionar" : "Fora do horário";
    }
  });
}

function categoryScheduleText(category) {
  const schedule = CATEGORY_SCHEDULES[category];
  if (!schedule) return "";
  return `${schedule.label} - ${isCategoryAvailable(category) ? "aberto agora" : "fechado agora"}.`;
}

function isCategoryAvailable(category) {
  const schedule = CATEGORY_SCHEDULES[category];
  if (!schedule) return true;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (schedule.ranges) {
    return schedule.ranges.some((range) =>
      currentMinutes >= timeToMinutes(range.start) && currentMinutes <= timeToMinutes(range.end)
    );
  }
  return currentMinutes >= timeToMinutes(schedule.start) && currentMinutes <= timeToMinutes(schedule.end);
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function categoryLabel(categorySlug) {
  if (!siteCategories || siteCategories.length === 0) return categorySlug;
  const cat = siteCategories.find(c => c.slug === categorySlug);
  return cat ? cat.name : categorySlug;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paymentLabel(value) {
  return value === "Cartao" ? "Cartão" : value;
}

function normalizeFingerprint(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

// --- Rastreamento de Pedido e Busca em Tempo Real ---
let orderTrackingChannel = null;

function initOrderTracking() {
  const searchInput = document.querySelector("#trackingCodeInput");
  const searchBtn = document.querySelector("#searchTrackingButton");
  const clearBtn = document.querySelector("#clearTrackingButton");
  const navLink = document.querySelector("#trackOrderNavLink");
  const menuSearch = document.querySelector("#menuSearchInput");

  if (menuSearch) {
    menuSearch.addEventListener("input", filterMenuBySearch);
  }

  if (navLink) {
    navLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#rastreamento").classList.remove("hidden");
      document.querySelector("#rastreamento").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => {
      const code = searchInput.value.trim();
      if (code) {
        startOrderTracking(code);
      } else {
        showTrackingMessage("Por favor, digite o código do pedido.");
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", stopOrderTracking);
  }

  renderRecentOrders();

  if (window.location.hash === "#rastreamento") {
    document.querySelector("#rastreamento").classList.remove("hidden");
    document.querySelector("#rastreamento").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function filterMenuBySearch() {
  const query = (document.querySelector("#menuSearchInput")?.value || "").trim().toLowerCase();
  const activeTab = document.querySelector(".category-tab.active");
  const activeCategory = activeTab ? activeTab.dataset.category : "all";

  document.querySelectorAll(".menu-item").forEach((item) => {
    const name = (item.dataset.addItem || "").toLowerCase();
    const desc = (item.querySelector("p")?.textContent || "").toLowerCase();
    const category = item.dataset.category;

    const matchesSearch = name.includes(query) || desc.includes(query);
    const matchesCategory = activeCategory === "all" || category === activeCategory;

    if (matchesSearch && matchesCategory) {
      item.classList.remove("hidden-item");
      item.style.display = "";
    } else {
      item.classList.add("hidden-item");
      item.style.display = "none";
    }
  });

  document.querySelectorAll("[data-menu-group]").forEach((group) => {
    const visibleItems = group.querySelectorAll(".menu-item:not(.hidden-item)");
    group.hidden = visibleItems.length === 0;
  });
}

function showTrackingMessage(msg) {
  const el = document.querySelector("#trackingMessage");
  if (el) el.textContent = msg;
}

async function startOrderTracking(orderIdInput) {
  let orderId = orderIdInput.trim();

  if (orderId.length === 8 && supabaseClient) {
    showTrackingMessage("Buscando pedido...");
    try {
      const { data, error } = await supabaseClient
        .from("orders")
        .select("id")
        .ilike("id", `${orderId}%`)
        .limit(1);

      if (!error && data && data.length) {
        orderId = data[0].id;
      } else {
        showTrackingMessage("Pedido não encontrado. Verifique o código.");
        return;
      }
    } catch (e) {
      console.warn("Erro ao buscar código curto", e);
    }
  }

  if (!supabaseClient) {
    showTrackingMessage("Conexão com banco indisponível.");
    return;
  }

  showTrackingMessage("Carregando status...");
  try {
    const { data: order, error } = await supabaseClient
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      showTrackingMessage("Pedido não encontrado.");
      return;
    }

    showTrackingMessage("");
    renderTrackingState(order);
    saveRecentOrder(order.id, order.customer_name, order.total);

    document.querySelector("#trackingSearchBox").classList.add("hidden");
    document.querySelector("#trackingInfoBox").classList.remove("hidden");

    if (orderTrackingChannel) {
      supabaseClient.removeChannel(orderTrackingChannel);
    }

    orderTrackingChannel = supabaseClient
      .channel(`tracking-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        () => {
          startOrderTracking(order.id);
        }
      )
      .subscribe();

  } catch (err) {
    showTrackingMessage("Erro ao carregar status do pedido.");
    console.error(err);
  }
}

function stopOrderTracking() {
  if (orderTrackingChannel && supabaseClient) {
    supabaseClient.removeChannel(orderTrackingChannel);
    orderTrackingChannel = null;
  }
  document.querySelector("#trackingSearchBox").classList.remove("hidden");
  document.querySelector("#trackingInfoBox").classList.add("hidden");
  document.querySelector("#trackingCodeInput").value = "";
  showTrackingMessage("");
  renderRecentOrders();
}

function renderTrackingState(order) {
  document.querySelector("#trackCustomerName").textContent = `Cliente: ${escapeHtml(order.customer_name)}`;

  const dateStr = order.created_at ? dateTime.format(new Date(order.created_at)) : "";
  document.querySelector("#trackOrderTime").textContent = `Realizado em: ${dateStr}`;

  const badge = document.querySelector("#trackStatusBadge");
  badge.textContent = order.status.toUpperCase();
  badge.className = `status-badge ${order.status}`;

  const steps = ["novo", "aceito", "preparando", "finalizado"];
  const currentStepIndex = steps.indexOf(order.status);

  document.querySelectorAll(".tracking-stepper .step").forEach((el, index) => {
    el.className = "step";
    if (order.status === "cancelado") {
      el.classList.add("cancelled");
      el.querySelector(".step-icon").textContent = "✕";
    } else {
      if (index === currentStepIndex) {
        el.classList.add("active");
        el.querySelector(".step-icon").textContent = index + 1;
      } else if (index < currentStepIndex) {
        el.classList.add("completed");
        el.querySelector(".step-icon").textContent = "✓";
      } else {
        el.querySelector(".step-icon").textContent = index + 1;
      }
    }
  });

  if (order.status === "cancelado") {
    badge.textContent = "CANCELADO";
    showTrackingMessage("Este pedido foi cancelado pelo restaurante.");
  } else {
    showTrackingMessage("");
  }

  const itemsHtml = (order.order_items || []).map(item => `
    <div class="track-item-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.95rem;">
      <span>${item.quantity}x ${escapeHtml(item.product_name)}</span>
      <span>${currency.format(Number(item.subtotal))}</span>
    </div>
  `).join("");

  document.querySelector("#trackOrderItemsSummary").innerHTML = `
    <h4 style="margin: 16px 0 8px 0; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">Itens do Pedido:</h4>
    ${itemsHtml || "<p class='muted'>Nenhum item carregado.</p>"}
  `;

  document.querySelector("#trackOrderTotal").textContent = currency.format(Number(order.total));
}

function saveRecentOrder(orderId, name, total) {
  try {
    const recent = JSON.parse(localStorage.getItem("saborDeMaeRecentOrders") || "[]");
    const filtered = recent.filter(o => o.id !== orderId);
    filtered.unshift({ id: orderId, name, total, date: new Date().toISOString() });
    localStorage.setItem("saborDeMaeRecentOrders", JSON.stringify(filtered.slice(0, 5)));
  } catch (e) {
    console.error(e);
  }
}

function renderRecentOrders() {
  const box = document.querySelector("#recentOrdersBox");
  const list = document.querySelector("#recentOrdersList");
  if (!box || !list) return;

  try {
    const recent = JSON.parse(localStorage.getItem("saborDeMaeRecentOrders") || "[]");
    if (recent.length === 0) {
      box.classList.add("hidden");
      return;
    }

    box.classList.remove("hidden");
    list.innerHTML = recent.map(order => `
      <button class="recent-order-btn" type="button" style="margin-right:8px; margin-bottom:8px; padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-card); cursor:pointer;" onclick="startOrderTracking('${order.id}')">
        <span>Pedido ${order.id.slice(0, 8).toUpperCase()}</span>
        <small style="display:block; color:var(--text-muted);">${currency.format(Number(order.total))}</small>
      </button>
    `).join("");
  } catch (e) {
    box.classList.add("hidden");
  }
}

window.startOrderTracking = startOrderTracking;
