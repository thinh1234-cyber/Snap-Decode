// ═══════════════════════════════════════════════════════════
// RUN_TESTS.JS — Automated Unit Test Suite for SnapQRDecoder
// Evaluates accuracy and latency across 6-Pass Computer Vision Pipeline
// ═══════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const SnapQRDecoder = require("../js/modules/qr-decoder.js");

const FIXTURES_FILE = path.join(__dirname, "fixtures", "test_cases.json");

if (!fs.existsSync(FIXTURES_FILE)) {
  console.error("❌ Test fixtures file not found. Run 'python tests/generate_test_cases.py' first.");
  process.exit(1);
}

const rawData = fs.readFileSync(FIXTURES_FILE, "utf-8");
const testCases = JSON.parse(rawData);

console.log("\n" + "=".repeat(75));
console.log("   🧪 SNAP-DECODE: CLIENT-SIDE JS QR DECODER (6-PASS PIPELINE) TEST SUITE");
console.log("=".repeat(75) + "\n");

let passedCount = 0;
let totalTime = 0;
const results = [];

for (const tc of testCases) {
  const uint8Data = new Uint8ClampedArray(tc.data);
  const imageData = {
    data: uint8Data,
    width: tc.width,
    height: tc.height
  };

  const start = performance.now();
  const res = SnapQRDecoder.decodeFromImageData(imageData);
  const elapsed = Math.round(performance.now() - start);
  totalTime += elapsed;

  const isMatched = res.success && res.text === tc.expected;
  if (isMatched) {
    passedCount++;
  }

  results.push({
    id: tc.id,
    name: tc.name,
    dimension: `${tc.width}x${tc.height}`,
    success: isMatched ? "✅ PASS" : "❌ FAIL",
    passNumber: res.pass !== undefined ? `Pass ${res.pass}` : "N/A",
    elapsedMs: `${elapsed}ms`,
    decodedText: res.text || res.error || "No text",
    expected: tc.expected
  });
}

// Print formatted test results table
console.log("| # | Kịch bản kiểm thử                         | Kích thước | Kết quả | Pipeline Pass | Thời gian |");
console.log("|---|-------------------------------------------|------------|---------|---------------|-----------|");
results.forEach((r, idx) => {
  const num = String(idx + 1).padEnd(2);
  const name = r.name.padEnd(41);
  const dim = r.dimension.padEnd(10);
  const stat = r.success.padEnd(7);
  const pass = r.passNumber.padEnd(13);
  const time = r.elapsedMs.padEnd(9);
  console.log(`| ${num}| ${name} | ${dim} | ${stat} | ${pass} | ${time} |`);
});

console.log("\n" + "-".repeat(75));
console.log(`📊 TỔNG KẾT: ${passedCount}/${testCases.length} kịch bản đạt (${((passedCount / testCases.length) * 100).toFixed(1)}%)`);
console.log(`⚡ Tổng thời gian chạy: ${totalTime}ms | Trung bình: ${(totalTime / testCases.length).toFixed(1)}ms/mã`);
console.log("-".repeat(75) + "\n");

if (passedCount !== testCases.length) {
  console.error("❌ Một số kịch bản kiểm thử chưa đạt. Chi tiết thất bại:");
  results.filter(r => r.success.includes("FAIL")).forEach(r => {
    console.error(` - [${r.id}] ${r.name}`);
    console.error(`   Kỳ vọng: "${r.expected}"`);
    console.error(`   Thực tế: "${r.decodedText}"`);
  });
  process.exit(1);
} else {
  console.log("🎉 TẤT CẢ TEST CASES ĐÃ VƯỢT QUA XUẤT SẮC!\n");
  process.exit(0);
}
