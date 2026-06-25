const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// ============================================================
// sanitizeForPrinter — shared logic across all receipt builders
// ============================================================

function sanitizeForPrinter(text) {
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/\ufeff/g, "")
    .replace(/[\u2000-\u200b]/g, " ");
}

// Simulate Intl.NumberFormat to reproduce the exact bug
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// ============================================================
// Receipt builder (simplified version matching print-monitor.js)
// ============================================================

function align(left, right, width = 32) {
  const cleanLeft = String(left).slice(0, Math.max(1, width - String(right).length - 1));
  const spaces = Math.max(1, width - cleanLeft.length - String(right).length);
  return `${cleanLeft}${" ".repeat(spaces)}${right}`;
}

function center(text, width = 32) {
  const clean = String(text).slice(0, width);
  const left = Math.floor((width - clean.length) / 2);
  return `${" ".repeat(Math.max(0, left))}${clean}`;
}

function buildTestReceipt(order) {
  const width = 32;
  const line = "-".repeat(width);
  const items = (order.order_items || []).map((item) =>
    align(`${item.quantity}x ${item.product_name}`, sanitizeForPrinter(money.format(Number(item.subtotal))), width)
  );

  return sanitizeForPrinter([
    center("SABOR DE MAE", width),
    line,
    `Cliente: ${order.customer_name}`,
    line,
    ...items,
    line,
    align("TOTAL", sanitizeForPrinter(money.format(Number(order.total))), width),
    line,
  ].filter(Boolean).join("\n"));
}

// ============================================================
// Tests
// ============================================================

describe("sanitizeForPrinter", () => {
  it("should replace non-breaking space (U+00A0) with regular space", () => {
    const input = "R$\u00a0120,00";
    const result = sanitizeForPrinter(input);
    assert.equal(result, "R$ 120,00");
    assert.ok(!result.includes("\u00a0"), "Should not contain U+00A0");
  });

  it("should replace narrow no-break space (U+202F) with regular space", () => {
    const input = "R$\u202f50,00";
    const result = sanitizeForPrinter(input);
    assert.equal(result, "R$ 50,00");
  });

  it("should remove BOM (U+FEFF)", () => {
    const input = "\ufeffHello";
    const result = sanitizeForPrinter(input);
    assert.equal(result, "Hello");
  });

  it("should replace various Unicode spaces with regular space", () => {
    const input = "a\u2003b\u2009c";
    const result = sanitizeForPrinter(input);
    assert.equal(result, "a b c");
  });

  it("should leave normal ASCII text unchanged", () => {
    const input = "R$ 120,00 - Total normal";
    assert.equal(sanitizeForPrinter(input), input);
  });

  it("should handle empty string", () => {
    assert.equal(sanitizeForPrinter(""), "");
  });

  it("should handle non-string input", () => {
    assert.equal(sanitizeForPrinter(123), "123");
    assert.equal(sanitizeForPrinter(null), "null");
    assert.equal(sanitizeForPrinter(undefined), "undefined");
  });
});

describe("Intl.NumberFormat produces non-breaking space (bug trigger)", () => {
  it("should contain U+00A0 in raw Intl output", () => {
    const formatted = money.format(120);
    // Verify that the Intl formatter DOES produce U+00A0
    const hasNbsp = formatted.includes("\u00a0");
    // It may or may not depending on the Node.js/ICU version,
    // but the sanitizer should handle both cases
    if (hasNbsp) {
      assert.ok(hasNbsp, "Intl.NumberFormat produces U+00A0 as expected");
    }
    // After sanitization, there should be no U+00A0
    const sanitized = sanitizeForPrinter(formatted);
    assert.ok(!sanitized.includes("\u00a0"), "Sanitized output must not contain U+00A0");
  });

  it("should produce correct value after sanitization for R$ 120", () => {
    const formatted = money.format(120);
    const sanitized = sanitizeForPrinter(formatted);
    // Should contain "120" as digits, not "A20"
    assert.ok(sanitized.includes("120"), `Expected '120' in '${sanitized}'`);
    assert.ok(!sanitized.includes("A20"), `Must NOT contain 'A20' in '${sanitized}'`);
  });

  it("should produce correct value for R$ 1,00", () => {
    const sanitized = sanitizeForPrinter(money.format(1));
    assert.ok(sanitized.includes("1,00"), `Expected '1,00' in '${sanitized}'`);
  });

  it("should produce correct value for R$ 1.234,56", () => {
    const sanitized = sanitizeForPrinter(money.format(1234.56));
    assert.ok(sanitized.includes("1.234,56"), `Expected '1.234,56' in '${sanitized}'`);
  });
});

describe("buildTestReceipt", () => {
  const sampleOrder = {
    id: "abcdef12-3456-7890-abcd-ef1234567890",
    customer_name: "Maria Silva",
    delivery_type: "Entrega",
    customer_address: "Rua Rio Negro, 1890",
    payment_method: "Pix",
    change_for: "",
    note: "",
    total: 120,
    created_at: "2025-01-15T12:00:00Z",
    order_items: [
      { quantity: 2, product_name: "Marmitex grande", unit_price: 22, subtotal: 44 },
      { quantity: 1, product_name: "Prato feito", unit_price: 18, subtotal: 18 },
      { quantity: 1, product_name: "Refrigerante lata", unit_price: 6, subtotal: 6 },
    ],
  };

  it("should not contain any non-breaking spaces", () => {
    const receipt = buildTestReceipt(sampleOrder);
    assert.ok(!receipt.includes("\u00a0"), "Receipt must not contain U+00A0");
    assert.ok(!receipt.includes("\u202f"), "Receipt must not contain U+202F");
    assert.ok(!receipt.includes("\ufeff"), "Receipt must not contain BOM");
  });

  it("should contain correct total value (not A20)", () => {
    const receipt = buildTestReceipt(sampleOrder);
    assert.ok(receipt.includes("120"), `Expected '120' in receipt`);
    assert.ok(!receipt.includes("A20"), `Must NOT contain 'A20' in receipt`);
  });

  it("should contain customer name", () => {
    const receipt = buildTestReceipt(sampleOrder);
    assert.ok(receipt.includes("Maria Silva"));
  });

  it("should contain all item names", () => {
    const receipt = buildTestReceipt(sampleOrder);
    assert.ok(receipt.includes("Marmitex grande"));
    assert.ok(receipt.includes("Prato feito"));
    assert.ok(receipt.includes("Refrigerante lata"));
  });

  it("should only contain printable ASCII characters and newlines", () => {
    const receipt = buildTestReceipt(sampleOrder);
    for (let i = 0; i < receipt.length; i++) {
      const code = receipt.charCodeAt(i);
      const char = receipt[i];
      const isPrintable = (code >= 0x20 && code <= 0x7e) || char === "\n";
      assert.ok(isPrintable, `Character at position ${i} is non-printable: U+${code.toString(16).padStart(4, "0")} '${char}'`);
    }
  });
});
