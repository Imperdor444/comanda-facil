const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Import from print-server.js
const { sanitizeForPrinter, isPrivateIp, isValidPort } = require("../print-server.js");

// ============================================================
// isPrivateIp tests
// ============================================================

describe("isPrivateIp", () => {
  it("should accept 192.168.x.x addresses", () => {
    assert.ok(isPrivateIp("192.168.1.223"));
    assert.ok(isPrivateIp("192.168.0.1"));
    assert.ok(isPrivateIp("192.168.255.255"));
  });

  it("should accept 10.x.x.x addresses", () => {
    assert.ok(isPrivateIp("10.0.0.1"));
    assert.ok(isPrivateIp("10.255.255.255"));
  });

  it("should accept 172.16-31.x.x addresses", () => {
    assert.ok(isPrivateIp("172.16.0.1"));
    assert.ok(isPrivateIp("172.31.255.255"));
    assert.ok(isPrivateIp("172.20.0.1"));
  });

  it("should accept 127.x.x.x loopback addresses", () => {
    assert.ok(isPrivateIp("127.0.0.1"));
    assert.ok(isPrivateIp("127.255.255.255"));
  });

  it("should reject public IP addresses", () => {
    assert.ok(!isPrivateIp("8.8.8.8"));
    assert.ok(!isPrivateIp("1.1.1.1"));
    assert.ok(!isPrivateIp("200.100.50.25"));
    assert.ok(!isPrivateIp("172.32.0.1")); // just outside 172.16-31 range
    assert.ok(!isPrivateIp("172.15.0.1")); // just outside 172.16-31 range
  });

  it("should reject invalid inputs", () => {
    assert.ok(!isPrivateIp(""));
    assert.ok(!isPrivateIp(null));
    assert.ok(!isPrivateIp(undefined));
    assert.ok(!isPrivateIp("not-an-ip"));
    assert.ok(!isPrivateIp("256.1.2.3"));
    assert.ok(!isPrivateIp("1.2.3"));
    assert.ok(!isPrivateIp("1.2.3.4.5"));
    assert.ok(!isPrivateIp("192.168.1.-1"));
  });

  it("should reject hostnames (prevent DNS rebinding)", () => {
    assert.ok(!isPrivateIp("example.com"));
    assert.ok(!isPrivateIp("localhost"));
    assert.ok(!isPrivateIp("printer.local"));
  });

  it("should reject 0.0.0.0", () => {
    assert.ok(!isPrivateIp("0.0.0.0"));
  });
});

// ============================================================
// isValidPort tests
// ============================================================

describe("isValidPort", () => {
  it("should accept valid ports", () => {
    assert.ok(isValidPort(1));
    assert.ok(isValidPort(80));
    assert.ok(isValidPort(9100));
    assert.ok(isValidPort(65535));
  });

  it("should reject invalid ports", () => {
    assert.ok(!isValidPort(0));
    assert.ok(!isValidPort(-1));
    assert.ok(!isValidPort(65536));
    assert.ok(!isValidPort(100000));
    assert.ok(!isValidPort(NaN));
    assert.ok(!isValidPort(3.14));
  });
});

// ============================================================
// sanitizeForPrinter (imported from print-server.js)
// ============================================================

describe("sanitizeForPrinter (from print-server)", () => {
  it("should remove non-breaking spaces", () => {
    assert.equal(sanitizeForPrinter("R$\u00a0120,00"), "R$ 120,00");
  });

  it("should handle combined problematic characters", () => {
    const input = "\ufeffR$\u00a01.234,56\u202f-\u2003teste";
    const result = sanitizeForPrinter(input);
    assert.ok(!result.includes("\u00a0"));
    assert.ok(!result.includes("\ufeff"));
    assert.ok(!result.includes("\u202f"));
    assert.ok(!result.includes("\u2003"));
    assert.equal(result, "R$ 1.234,56 - teste");
  });
});

// ============================================================
// CORS behavior (unit-level)
// ============================================================

describe("CORS allowed origins list", () => {
  const ALLOWED_ORIGINS = [
    "https://imperdor444.github.io",
    "http://127.0.0.1",
    "http://localhost",
  ];

  function isOriginAllowed(origin) {
    return ALLOWED_ORIGINS.some((allowed) =>
      origin === allowed || origin.startsWith(allowed + ":")
    );
  }

  it("should allow the GitHub Pages origin", () => {
    assert.ok(isOriginAllowed("https://imperdor444.github.io"));
  });

  it("should allow localhost with port", () => {
    assert.ok(isOriginAllowed("http://127.0.0.1:8080"));
    assert.ok(isOriginAllowed("http://localhost:3000"));
  });

  it("should reject unknown origins", () => {
    assert.ok(!isOriginAllowed("https://evil.com"));
    assert.ok(!isOriginAllowed("https://attacker.github.io"));
    assert.ok(!isOriginAllowed("http://192.168.1.100"));
  });
});
