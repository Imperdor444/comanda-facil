const WHATSAPP_NUMBER = "5569992824311";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const cart = [];
const supabaseClient = createSupabaseClient();

const MAX_NAME_LENGTH = 100;
const MAX_ADDRESS_LENGTH = 300;
const MAX_NOTE_LENGTH = 500;
const VALID_DELIVERY_TYPES = ["Entrega", "Retirada"];
const VALID_PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartao"];

const cartItems = document.querySelector("#cartItems");
const cartTotal = document.querySelector("#cartTotal");
const cartCount = document.querySelector("#cartCount");
const orderForm = document.querySelector("#orderForm");
const copyOrderButton = document.querySelector("#copyOrderButton");
const submitOrderButton = document.querySelector("#submitOrderButton");
const paymentMethodInput = document.querySelector("#paymentMethod");
const changeForField = document.querySelector("#changeForField");
const changeForInput = document.querySelector("#changeFor");
const orderConfirmation = document.querySelector("#orderConfirmation");
const confirmationText = document.querySelector("#confirmationText");
const whatsappFallback = document.querySelector("#whatsappFallback");

document.querySelectorAll(".category-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setCategory(tab.dataset.category);
  });
});

document.querySelectorAll(".menu-item[data-add-item]").forEach((item) => {
  item.addEventListener("click", () => {
    addToCart(item.dataset.addItem, Number(item.dataset.price));
  });
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      addToCart(item.dataset.addItem, Number(item.dataset.price));
    }
  });
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cart.length) {
    alert("Adicione pelo menos um item ao pedido.");
    return;
  }

  const customerName = document.querySelector("#customerName").value.trim();
  if (!customerName || customerName.length > MAX_NAME_LENGTH) {
    alert("Informe seu nome (maximo 100 caracteres).");
    return;
  }

  const address = document.querySelector("#customerAddress").value.trim();
  if (address.length > MAX_ADDRESS_LENGTH) {
    alert("Endereco muito longo (maximo 300 caracteres).");
    return;
  }

  const note = document.querySelector("#customerNote").value.trim();
  if (note.length > MAX_NOTE_LENGTH) {
    alert("Observacao muito longa (maximo 500 caracteres).");
    return;
  }

  const deliveryType = document.querySelector("#deliveryType").value;
  if (!VALID_DELIVERY_TYPES.includes(deliveryType)) {
    alert("Tipo de recebimento invalido.");
    return;
  }

  const paymentMethod = paymentMethodInput.value;
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    alert("Forma de pagamento invalida.");
    return;
  }

  submitOrderButton.disabled = true;
  submitOrderButton.textContent = "Enviando...";

  const savedOrderId = await saveOrderIfConfigured();
  if (!savedOrderId) {
    submitOrderButton.disabled = false;
    submitOrderButton.textContent = "Finalizar pedido";
    alert("Nao foi possivel registrar o pedido no painel agora. Tente novamente em alguns segundos.");
    return;
  }

  const message = buildOrderMessage();
  showOrderConfirmation(savedOrderId, message);
  cart.splice(0, cart.length);
  renderCart();
  orderForm.reset();
  updatePaymentFields();
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

paymentMethodInput.addEventListener("change", updatePaymentFields);

loadProductsIfConfigured();
updatePaymentFields();
renderCart();

function addToCart(name, price) {
  const existing = cart.find((item) => item.name === name);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ name, price, quantity: 1 });
  }
  renderCart();
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

  document.querySelectorAll("[data-cart-plus]").forEach((button) => {
    button.onclick = () => changeQuantity(button.dataset.cartPlus, 1);
  });
  document.querySelectorAll("[data-cart-minus]").forEach((button) => {
    button.onclick = () => changeQuantity(button.dataset.cartMinus, -1);
  });
}

async function loadProductsIfConfigured() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("products")
    .select("name, description, category, price, image_url")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) return;
  renderMenu(data);
}

function renderMenu(products) {
  document.querySelectorAll("[data-menu-group]").forEach((group) => {
    const category = group.dataset.menuGroup;
    const categoryProducts = products.filter((product) => product.category === category);
    group.querySelector(".menu-grid").innerHTML = categoryProducts.map(productCard).join("");
    group.hidden = !categoryProducts.length;
  });
  bindMenuItems();
}

function productCard(product) {
  return `
    <article class="menu-item" data-category="${escapeHtml(product.category)}" data-add-item="${escapeHtml(product.name)}" data-price="${Number(product.price)}" tabindex="0">
      <img class="menu-photo" src="${escapeHtml(product.image_url || "assets/marmitex-menu.png")}" alt="${escapeHtml(product.name)}">
      <div class="item-copy">
        <span class="item-tag">${escapeHtml(categoryLabel(product.category))}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description)}</p>
      </div>
      <div class="menu-action">
        <strong>${currency.format(Number(product.price))}</strong>
        <button type="button">Adicionar</button>
      </div>
    </article>
  `;
}

function bindMenuItems() {
  document.querySelectorAll(".menu-item[data-add-item]").forEach((item) => {
    item.onclick = () => addToCart(item.dataset.addItem, Number(item.dataset.price));
    item.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        addToCart(item.dataset.addItem, Number(item.dataset.price));
      }
    };
  });
}

async function saveOrderIfConfigured() {
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
  } catch {
    return null;
  }
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

  if (!orderResponse.ok) return false;

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
  confirmationText.textContent = `Codigo do pedido: ${shortId}. O restaurante ja pode acompanhar pelo painel.`;
  whatsappFallback.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  orderConfirmation.classList.remove("hidden");
  orderConfirmation.scrollIntoView({ behavior: "smooth", block: "center" });
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(char) / 4)))).toString(16)
  );
}

function getOrderPayload() {
  const paymentMethod = paymentMethodInput.value;
  const total = totalCart();
  return {
    customer_name: document.querySelector("#customerName").value.trim().slice(0, MAX_NAME_LENGTH) || "Nao informado",
    delivery_type: VALID_DELIVERY_TYPES.includes(document.querySelector("#deliveryType").value)
      ? document.querySelector("#deliveryType").value
      : "Retirada",
    customer_address: document.querySelector("#customerAddress").value.trim().slice(0, MAX_ADDRESS_LENGTH) || "Combinar",
    payment_method: VALID_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : "Pix",
    change_for: paymentMethod === "Dinheiro" ? changeForInput.value.trim().slice(0, 50) : "",
    note: document.querySelector("#customerNote").value.trim().slice(0, MAX_NOTE_LENGTH),
    total: Math.max(0, total),
    status: "novo",
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
  const deliveryType = document.querySelector("#deliveryType").value;
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
    `Tipo: ${deliveryType}`,
    `Endereco: ${address}`,
    `Pagamento: ${paymentMethod}`,
    "",
    "Pedido:",
    items,
    "",
    `Total: ${currency.format(totalCart())}`,
    "",
    `Observacao: ${note}`,
  ];

  if (paymentMethod === "Dinheiro") {
    message.splice(6, 0, `Troco para: ${changeFor || "Nao informado"}`);
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
  document.querySelectorAll("[data-menu-group]").forEach((group) => {
    const hasProducts = Boolean(group.querySelector(".menu-item"));
    group.hidden = !hasProducts || (category !== "all" && group.dataset.menuGroup !== category);
  });
}

function categoryLabel(category) {
  return {
    marmitex: "Marmitex",
    local: "Consumo local",
    bebidas: "Bebida",
    espetinhos: "Espetinho",
    porcoes: "Porcao",
    sobremesas: "Sobremesa",
  }[category] || "Cardapio";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
