const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

/**
 * Extended A20 bug verification tests.
 *
 * The bug: Intl.NumberFormat("pt-BR") inserts U+00A0 (non-breaking space)
 * between "R$" and the number. When this is sent to an ESC/POS printer
 * via latin1 encoding, the 0xA0 byte corrupts the next digit, turning
 * "1" into "A" (so "120" becomes "A20").
 *
 * These tests verify that sanitizeForPrinter fixes this for a wide range
 * of values, and that the final output sent to the printer contains only
 * safe ASCII characters.
 */

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function sanitizeForPrinter(text) {
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/\ufeff/g, "")
    .replace(/[\u2000-\u200b]/g, " ");
}

function align(left, right, width = 32) {
  const cleanLeft = String(left).slice(0, Math.max(1, width - String(right).length - 1));
  const spaces = Math.max(1, width - cleanLeft.length - String(right).length);
  return `${cleanLeft}${" ".repeat(spaces)}${right}`;
}

/**
 * Verify that a string contains only printable ASCII + newlines.
 * This is what the ESC/POS printer can safely handle.
 */
function assertPrinterSafe(text, label) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const isPrintable = (code >= 0x20 && code <= 0x7e) || code === 0x0a;
    assert.ok(isPrintable,
      `${label}: char at pos ${i} is U+${code.toString(16).padStart(4, "0")} (not printer-safe)`
    );
  }
}

/**
 * Verify that a formatted value, after sanitization, contains the expected
 * digit sequence and does NOT contain the corrupted "A" version.
 */
function assertNoA20(value, expectedDigits) {
  const raw = money.format(value);
  const sanitized = sanitizeForPrinter(raw);

  // Must contain the expected digits
  assert.ok(sanitized.includes(expectedDigits),
    `Expected '${expectedDigits}' in '${sanitized}' (from ${value})`
  );

  // Must not contain U+00A0
  assert.ok(!sanitized.includes("\u00a0"),
    `U+00A0 found in sanitized output '${sanitized}'`
  );

  // Must be printer-safe
  assertPrinterSafe(sanitized, `money.format(${value})`);

  // The first digit after "R$ " must be a digit, not a letter
  const match = sanitized.match(/R\$\s*(.)/);
  if (match) {
    const firstCharAfterSymbol = match[1];
    assert.ok(/[0-9-]/.test(firstCharAfterSymbol),
      `First char after 'R$ ' is '${firstCharAfterSymbol}', expected a digit (value=${value})`
    );
  }
}

// ============================================================
// Test suite: specific values from the user's request
// ============================================================

describe("A20 bug fix — specific monetary values", () => {
  it("R$ 120,00 — the original bug value", () => {
    assertNoA20(120, "120,00");
  });

  it("R$ 220,00", () => {
    assertNoA20(220, "220,00");
  });

  it("R$ 1.000,00", () => {
    assertNoA20(1000, "1.000,00");
  });

  it("R$ 12,50", () => {
    assertNoA20(12.5, "12,50");
  });

  it("R$ 1,00", () => {
    assertNoA20(1, "1,00");
  });

  it("R$ 0,00", () => {
    assertNoA20(0, "0,00");
  });

  it("R$ 99.999,99", () => {
    assertNoA20(99999.99, "99.999,99");
  });

  it("R$ 0,50", () => {
    assertNoA20(0.5, "0,50");
  });

  it("R$ 16,00 (Marmitex pequena)", () => {
    assertNoA20(16, "16,00");
  });

  it("R$ 22,00 (Marmitex grande)", () => {
    assertNoA20(22, "22,00");
  });

  it("R$ 18,00 (Prato feito)", () => {
    assertNoA20(18, "18,00");
  });

  it("R$ 6,00 (Refrigerante)", () => {
    assertNoA20(6, "6,00");
  });

  it("R$ 8,00 (Suco natural)", () => {
    assertNoA20(8, "8,00");
  });
});

// ============================================================
// Test: raw Intl output vs sanitized (prove the bug exists before fix)
// ============================================================

describe("A20 bug — Intl.NumberFormat raw output analysis", () => {
  const testValues = [1, 6, 8, 12.5, 16, 18, 22, 44, 120, 220, 500, 1000, 1234.56, 99999.99];

  for (const value of testValues) {
    it(`money.format(${value}) — raw must not contain U+00A0 after sanitization`, () => {
      const raw = money.format(value);
      const sanitized = sanitizeForPrinter(raw);

      // After sanitization: no NBSP
      assert.ok(!sanitized.includes("\u00a0"),
        `Sanitized '${sanitized}' still contains U+00A0`
      );

      // After sanitization: only printable ASCII
      assertPrinterSafe(sanitized, `sanitized(${value})`);
    });
  }
});

// ============================================================
// Test: receipt line (align function) with formatted values
// ============================================================

describe("A20 bug — receipt TOTAL line", () => {
  const testCases = [
    { total: 120, expect: "120,00" },
    { total: 220, expect: "220,00" },
    { total: 1000, expect: "1.000,00" },
    { total: 12.5, expect: "12,50" },
    { total: 44, expect: "44,00" },
    { total: 6, expect: "6,00" },
  ];

  for (const { total, expect: expectedDigits } of testCases) {
    it(`TOTAL line for R$ ${total} contains '${expectedDigits}' and is printer-safe`, () => {
      const formatted = sanitizeForPrinter(money.format(total));
      const line = align("TOTAL", formatted, 32);

      assert.ok(line.includes(expectedDigits),
        `Expected '${expectedDigits}' in '${line}'`
      );
      assert.ok(!line.includes("A20"),
        `'A20' corruption found in '${line}'`
      );
      assertPrinterSafe(line, `TOTAL line for ${total}`);
    });
  }
});

// ============================================================
// Test: manual NBSP injection (simulate worst case)
// ============================================================

describe("A20 bug — manual NBSP injection", () => {
  it("should fix 'R$\\u00a0120,00' → 'R$ 120,00'", () => {
    const corrupted = "R$\u00a0120,00";
    const fixed = sanitizeForPrinter(corrupted);
    assert.equal(fixed, "R$ 120,00");
    assertPrinterSafe(fixed, "manual NBSP 120");
  });

  it("should fix 'R$\\u00a0220,00' → 'R$ 220,00'", () => {
    const corrupted = "R$\u00a0220,00";
    const fixed = sanitizeForPrinter(corrupted);
    assert.equal(fixed, "R$ 220,00");
  });

  it("should fix 'R$\\u00a01.000,00' → 'R$ 1.000,00'", () => {
    const corrupted = "R$\u00a01.000,00";
    const fixed = sanitizeForPrinter(corrupted);
    assert.equal(fixed, "R$ 1.000,00");
  });

  it("should fix 'R$\\u00a012,50' → 'R$ 12,50'", () => {
    const corrupted = "R$\u00a012,50";
    const fixed = sanitizeForPrinter(corrupted);
    assert.equal(fixed, "R$ 12,50");
  });

  it("should leave 'R$ 120,00' (normal space) unchanged", () => {
    const normal = "R$ 120,00";
    assert.equal(sanitizeForPrinter(normal), normal);
  });

  it("should fix multiple NBSP in one string", () => {
    const corrupted = "2x\u00a0Marmitex\u00a0grande\u00a0\u00a0R$\u00a044,00";
    const fixed = sanitizeForPrinter(corrupted);
    assert.ok(!fixed.includes("\u00a0"));
    assert.ok(fixed.includes("44,00"));
    assertPrinterSafe(fixed, "multiple NBSP");
  });
});

// ============================================================
// Test: latin1 encoding safety (what the printer actually receives)
// ============================================================

describe("A20 bug — latin1 Buffer encoding safety", () => {
  const testCases = [
    { value: 120, digits: "120,00" },
    { value: 220, digits: "220,00" },
    { value: 1000, digits: "1.000,00" },
    { value: 12.5, digits: "12,50" },
    { value: 16, digits: "16,00" },
    { value: 22, digits: "22,00" },
  ];

  for (const { value, digits } of testCases) {
    it(`Buffer.from(sanitized(${value}), 'latin1') produces no 0xA0 bytes`, () => {
      const sanitized = sanitizeForPrinter(money.format(value));
      const buf = Buffer.from(sanitized, "latin1");

      for (let i = 0; i < buf.length; i++) {
        assert.ok(buf[i] !== 0xa0,
          `Byte 0xA0 found at position ${i} in latin1 buffer for value ${value}`
        );
      }

      // Verify the buffer decodes back with expected digits
      const decoded = buf.toString("latin1");
      assert.ok(decoded.includes(digits),
        `Decoded buffer '${decoded}' doesn't contain expected '${digits}' for ${value}`
      );
    });
  }
});
