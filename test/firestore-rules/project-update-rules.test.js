/* Test rule chống gian lận nội bộ trên projects/designProjects:
   thành viên (memberUids) chỉ được sửa stage/progress/updatedAt/payments;
   CẤM totalFee/escrow/memberUids/kts/cn/dn. Founder sửa tự do.
   Chạy: firebase emulators:exec --only firestore "npm test" (từ thư mục này). */
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const RULES_PATH = path.join(__dirname, "..", "..", "firestore.rules");
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";

let testEnv;
let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failed++;
    console.error("  ✗ " + name);
    console.error("    " + (e.message || e));
  }
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("users").doc(FOUNDER_UID).set({ role: "founder", status: "active" });
    await db.collection("users").doc("cn1").set({ role: "cn", status: "active" });
    await db.collection("users").doc("kts1").set({ role: "kts", status: "active" });
    await db.collection("projects").doc("projX").set({
      cn: { uid: "cn1" }, kts: { uid: "kts1" }, dn: { uid: "dn1" },
      memberUids: ["cn1", "kts1", "dn1"],
      stage: "C1", progress: { C1: 0.5, C2: 0, C3: 0, C4: 0 },
      totalFee: 125000000, escrow: 75000000,
    });
    await db.collection("designProjects").doc("desX").set({
      designer: { uid: "des1" }, cn: { uid: "cn1" }, dn: null,
      memberUids: ["cn1", "des1"],
      stage: "C1", progress: { C1: 0 }, totalFee: 50000000,
    });
  });
}

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: "aln-rules-test-projects",
    firestore: { rules: fs.readFileSync(RULES_PATH, "utf8") },
  });
  await seed();

  const asCn = testEnv.authenticatedContext("cn1").firestore();
  const asKts = testEnv.authenticatedContext("kts1").firestore();
  const asStranger = testEnv.authenticatedContext("stranger9").firestore();
  const asFounder = testEnv.authenticatedContext(FOUNDER_UID).firestore();

  console.log("\nprojects/{pid} update — whitelist field cho thành viên:");

  await check("CN thành viên advance chặng (stage+progress+updatedAt) → OK", () =>
    assertSucceeds(asCn.collection("projects").doc("projX").update({
      stage: "C2", "progress.C1": 1, updatedAt: new Date(),
    })));

  await check("CN ghi payment record chờ Founder xác nhận → OK", () =>
    assertSucceeds(asCn.collection("projects").doc("projX").update({
      "payments.C1": { amount: 1, status: "pending" }, updatedAt: new Date(),
    })));

  await check("KTS tự sửa totalFee → BỊ CHẶN", () =>
    assertFails(asKts.collection("projects").doc("projX").update({ totalFee: 999999999 })));

  await check("KTS tự sửa escrow → BỊ CHẶN", () =>
    assertFails(asKts.collection("projects").doc("projX").update({ escrow: 999999999 })));

  await check("Thành viên tự thêm người vào memberUids → BỊ CHẶN", () =>
    assertFails(asCn.collection("projects").doc("projX").update({
      memberUids: ["cn1", "kts1", "dn1", "hacker"],
    })));

  await check("Thành viên tự đổi kts.uid (cướp dự án) → BỊ CHẶN", () =>
    assertFails(asKts.collection("projects").doc("projX").update({ kts: { uid: "kts9" } })));

  await check("Trộn field hợp lệ + cấm (stage + totalFee) → BỊ CHẶN", () =>
    assertFails(asCn.collection("projects").doc("projX").update({
      stage: "C3", totalFee: 1,
    })));

  await check("Người ngoài dự án sửa stage → BỊ CHẶN", () =>
    assertFails(asStranger.collection("projects").doc("projX").update({ stage: "C4" })));

  await check("Founder sửa totalFee → OK", () =>
    assertSucceeds(asFounder.collection("projects").doc("projX").update({ totalFee: 130000000 })));

  console.log("\ndesignProjects/{pid} update — cùng whitelist:");

  await check("Designer thành viên chạm updatedAt → OK", async () => {
    const asDes = testEnv.authenticatedContext("des1").firestore();
    await assertSucceeds(asDes.collection("designProjects").doc("desX").update({ updatedAt: new Date() }));
  });

  await check("Designer tự sửa totalFee → BỊ CHẶN", async () => {
    const asDes = testEnv.authenticatedContext("des1").firestore();
    await assertFails(asDes.collection("designProjects").doc("desX").update({ totalFee: 1 }));
  });

  await testEnv.cleanup();
  console.log(`\nKết quả: ${passed} pass, ${failed} fail`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
