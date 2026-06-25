const SUPABASE_URL = "https://eskoaldublplqjkxghtj.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVza29hbGR1YmxwbHFqa3hnaHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc1NDIsImV4cCI6MjA5NTgyMzU0Mn0.p6lMGao-9ay55rndkMC8Z3HLWWu8AAlxQNi5e_E-H0o";
const headers = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=minimal" };

const IMAGE_MAP = {
  marmitex: "assets/products/marmitex.jpg",
  local: "assets/products/marmitex.jpg",
  espetinhos: "assets/products/espetinhos.jpg",
  porcoes: "assets/products/espetinhos.jpg",
  bebidas: "assets/products/bebidas.jpg",
  sobremesas: "assets/products/sobremesas.jpg",
};

async function main() {
  for (const [cat, url] of Object.entries(IMAGE_MAP)) {
    const r = await fetch(SUPABASE_URL + "/rest/v1/products?category=eq." + cat, {
      method: "PATCH", headers,
      body: JSON.stringify({ image_url: url })
    });
    console.log(cat.padEnd(14) + "=> " + url + " (" + r.status + ")");
  }

  // Verify
  const res = await fetch(SUPABASE_URL + "/rest/v1/products?active=eq.true&select=name,category,image_url&order=category,name", { headers });
  const products = await res.json();
  console.log("\nVerification:");
  products.forEach(p => console.log("  " + p.category.padEnd(14) + p.name.padEnd(30) + p.image_url));
}
main().catch(console.error);
