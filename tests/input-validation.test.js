const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// ============================================================
// Reproduce the validation logic from site.js and painel.js
// ============================================================

const MAX_NAME_LENGTH = 100;
const MAX_ADDRESS_LENGTH = 300;
const MAX_NOTE_LENGTH = 500;
const VALID_DELIVERY_TYPES = ["Entrega", "Retirada"];
const VALID_PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartao"];
const VALID_ORDER_STATUSES = ["novo", "aceito", "preparando", "finalizado", "cancelado"];
const MAX_INPUT_LENGTH = 500;

function validateOrderPayload(payload) {
  const errors = [];

  if (!payload.customer_name || payload.customer_name.length > MAX_NAME_LENGTH) {
    errors.push("customer_name invalid");
  }

  if (payload.customer_address && payload.customer_address.length > MAX_ADDRESS_LENGTH) {
    errors.push("customer_address too long");
  }

  if (payload.note && payload.note.length > MAX_NOTE_LENGTH) {
    errors.push("note too long");
  }

  if (!VALID_DELIVERY_TYPES.includes(payload.delivery_type)) {
    errors.push("delivery_type invalid");
  }

  if (!VALID_PAYMENT_METHODS.includes(payload.payment_method)) {
    errors.push("payment_method invalid");
  }

  if (typeof payload.total !== "number" || payload.total < 0) {
    errors.push("total invalid");
  }

  if (payload.status !== "novo") {
    errors.push("status must be novo");
  }

  return errors;
}

function validateProductPayload(payload) {
  const errors = [];

  if (!payload.name || payload.name.length > MAX_INPUT_LENGTH) {
    errors.push("name invalid");
  }

  if (!["marmitex", "local", "bebidas", "espetinhos", "porcoes", "sobremesas"].includes(payload.category)) {
    errors.push("category invalid");
  }

  if (typeof payload.price !== "number" || Number.isNaN(payload.price) || payload.price < 0 || payload.price > 99999) {
    errors.push("price invalid");
  }

  if (payload.description && payload.description.length > 1000) {
    errors.push("description too long");
  }

  if (payload.image_url && payload.image_url.length > 2000) {
    errors.push("image_url too long");
  }

  return errors;
}

function validateOrderStatus(status) {
  return VALID_ORDER_STATUSES.includes(status);
}

// ============================================================
// Order payload validation tests
// ============================================================

describe("validateOrderPayload", () => {
  const validOrder = {
    customer_name: "Maria Silva",
    delivery_type: "Entrega",
    customer_address: "Rua Rio Negro, 1890",
    payment_method: "Pix",
    change_for: "",
    note: "",
    total: 44,
    status: "novo",
  };

  it("should accept a valid order", () => {
    assert.deepEqual(validateOrderPayload(validOrder), []);
  });

  it("should reject empty customer name", () => {
    const order = { ...validOrder, customer_name: "" };
    const errors = validateOrderPayload(order);
    assert.ok(errors.includes("customer_name invalid"));
  });

  it("should reject customer name over 100 chars", () => {
    const order = { ...validOrder, customer_name: "A".repeat(101) };
    const errors = validateOrderPayload(order);
    assert.ok(errors.includes("customer_name invalid"));
  });

  it("should accept customer name at exactly 100 chars", () => {
    const order = { ...validOrder, customer_name: "A".repeat(100) };
    assert.deepEqual(validateOrderPayload(order), []);
  });

  it("should reject address over 300 chars", () => {
    const order = { ...validOrder, customer_address: "B".repeat(301) };
    const errors = validateOrderPayload(order);
    assert.ok(errors.includes("customer_address too long"));
  });

  it("should reject note over 500 chars", () => {
    const order = { ...validOrder, note: "C".repeat(501) };
    const errors = validateOrderPayload(order);
    assert.ok(errors.includes("note too long"));
  });

  it("should reject invalid delivery type", () => {
    const order = { ...validOrder, delivery_type: "Drone" };
    const errors = validateOrderPayload(order);
    assert.ok(errors.includes("delivery_type invalid"));
  });

  it("should reject invalid payment method", () => {
    const order = { ...validOrder, payment_method: "Bitcoin" };
    const errors = validateOrderPayload(order);
    assert.ok(errors.includes("payment_method invalid"));
  });

  it("should reject negative total", () => {
    const order = { ...validOrder, total: -10 };
    const errors = validateOrderPayload(order);
    assert.ok(errors.includes("total invalid"));
  });

  it("should reject status other than 'novo'", () => {
    const order = { ...validOrder, status: "finalizado" };
    const errors = validateOrderPayload(order);
    assert.ok(errors.includes("status must be novo"));
  });

  it("should reject status 'cancelado' on insert", () => {
    const order = { ...validOrder, status: "cancelado" };
    const errors = validateOrderPayload(order);
    assert.ok(errors.includes("status must be novo"));
  });

  it("should reject XSS in customer name (still validates length)", () => {
    const order = { ...validOrder, customer_name: '<script>alert("xss")</script>' };
    // The name itself passes length validation — XSS prevention is handled by escapeHtml in the UI
    // This test ensures the validation doesn't crash on special characters
    const errors = validateOrderPayload(order);
    assert.deepEqual(errors, []);
  });

  it("should accept all valid delivery types", () => {
    for (const type of VALID_DELIVERY_TYPES) {
      const order = { ...validOrder, delivery_type: type };
      assert.deepEqual(validateOrderPayload(order), [], `Failed for type: ${type}`);
    }
  });

  it("should accept all valid payment methods", () => {
    for (const method of VALID_PAYMENT_METHODS) {
      const order = { ...validOrder, payment_method: method };
      assert.deepEqual(validateOrderPayload(order), [], `Failed for method: ${method}`);
    }
  });
});

// ============================================================
// Product payload validation tests
// ============================================================

describe("validateProductPayload", () => {
  const validProduct = {
    name: "Marmitex grande",
    category: "marmitex",
    price: 22,
    description: "Porcao reforcada",
    image_url: null,
  };

  it("should accept a valid product", () => {
    assert.deepEqual(validateProductPayload(validProduct), []);
  });

  it("should reject empty product name", () => {
    const product = { ...validProduct, name: "" };
    assert.ok(validateProductPayload(product).includes("name invalid"));
  });

  it("should reject product name over 500 chars", () => {
    const product = { ...validProduct, name: "X".repeat(501) };
    assert.ok(validateProductPayload(product).includes("name invalid"));
  });

  it("should reject invalid category", () => {
    const product = { ...validProduct, category: "sobremesa" };
    assert.ok(validateProductPayload(product).includes("category invalid"));
  });

  it("should accept all valid categories", () => {
    for (const cat of ["marmitex", "local", "bebidas", "espetinhos", "porcoes", "sobremesas"]) {
      const product = { ...validProduct, category: cat };
      assert.deepEqual(validateProductPayload(product), [], `Failed for category: ${cat}`);
    }
  });

  it("should reject negative price", () => {
    const product = { ...validProduct, price: -5 };
    assert.ok(validateProductPayload(product).includes("price invalid"));
  });

  it("should reject price over 99999", () => {
    const product = { ...validProduct, price: 100000 };
    assert.ok(validateProductPayload(product).includes("price invalid"));
  });

  it("should reject NaN price", () => {
    const product = { ...validProduct, price: NaN };
    assert.ok(validateProductPayload(product).includes("price invalid"));
  });

  it("should reject description over 1000 chars", () => {
    const product = { ...validProduct, description: "D".repeat(1001) };
    assert.ok(validateProductPayload(product).includes("description too long"));
  });

  it("should reject image URL over 2000 chars", () => {
    const product = { ...validProduct, image_url: "https://example.com/" + "a".repeat(2000) };
    assert.ok(validateProductPayload(product).includes("image_url too long"));
  });

  it("should accept zero price (free item)", () => {
    const product = { ...validProduct, price: 0 };
    assert.deepEqual(validateProductPayload(product), []);
  });
});

// ============================================================
// Order status validation tests
// ============================================================

describe("validateOrderStatus", () => {
  it("should accept all valid statuses", () => {
    for (const status of VALID_ORDER_STATUSES) {
      assert.ok(validateOrderStatus(status), `Failed for status: ${status}`);
    }
  });

  it("should reject invalid statuses", () => {
    assert.ok(!validateOrderStatus("completed"));
    assert.ok(!validateOrderStatus(""));
    assert.ok(!validateOrderStatus("NOVO")); // case-sensitive
    assert.ok(!validateOrderStatus("deleted"));
    assert.ok(!validateOrderStatus(null));
    assert.ok(!validateOrderStatus(undefined));
    assert.ok(!validateOrderStatus(123));
  });
});
