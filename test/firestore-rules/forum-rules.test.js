/* CHECKLIST_PHANQUYEN_DIENDAN_ALN.md PASS 2 — Firestore Rules Unit Tests (emulator).
   Chạy: firebase emulators:exec --only firestore "npm test" (từ thư mục này).
   Không cần project Firebase thật — chạy hoàn toàn trên emulator local. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const RULES_PATH = path.join(__dirname, "..", "..", "firestore.rules");

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
    // users — role nguồn duy nhất (users/{uid}.role), không dùng custom claims
    await db.collection("users").doc("cn1").set({ role: "cn", status: "active", name: "CN Test" });
    await db.collection("users").doc("kts1").set({ role: "kts", status: "active", name: "KTS Test" });
    await db.collection("users").doc("dn1").set({ role: "dn", status: "active", name: "DN Test" });
    await db.collection("users").doc("h4kEguPEyMcwJwl89stc0Q6j2si2").set({ role: "founder", status: "active", name: "Founder Test" });

    await db.collection("forumConfig").doc("flags").set({ FORUM_P2_ENABLED: true });

    // Bài public đang hiển thị (vd category hoi_kts)
    await db.collection("forumPosts").doc("post_public").set({
      category: "hoi_kts", categoryVisibility: "public", status: "visible", hidden: false,
      authorUid: "cn1", text: "Câu hỏi công khai",
    });
    // Bài public nhưng đã bị ẩn (Founder toggleHidden) — không lộ ra ngoài
    await db.collection("forumPosts").doc("post_public_hidden").set({
      category: "hoi_kts", categoryVisibility: "public", status: "visible", hidden: true,
      authorUid: "cn1", text: "Bài đã bị ẩn",
    });
    // Bài public nhưng đang chờ duyệt — không lộ ra ngoài
    await db.collection("forumPosts").doc("post_public_pending").set({
      category: "hoi_kts", categoryVisibility: "public", status: "pending", hidden: false,
      authorUid: "cn1", text: "Bài chờ duyệt",
    });
    // Bài khu KTS-only (vd hoi_dap)
    await db.collection("forumPosts").doc("post_kts").set({
      category: "hoi_dap", categoryVisibility: "kts", status: "visible", hidden: false,
      authorUid: "kts1", text: "Câu hỏi kỹ thuật KTS-only",
    });

    // Comment dưới bài public
    await db.collection("forumPosts").doc("post_public")
      .collection("comments").doc("c1")
      .set({ categoryVisibility: "public", status: "visible", authorUid: "kts1", text: "Trả lời" });
    // Comment dưới bài KTS-only
    await db.collection("forumPosts").doc("post_kts")
      .collection("comments").doc("c2")
      .set({ categoryVisibility: "kts", status: "visible", authorUid: "kts1", text: "Trả lời KTS" });
  });
}

async function main() {
  const rules = fs.readFileSync(RULES_PATH, "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: "aln-forum-rules-test",
    firestore: { rules },
  });

  await seed();

  const anon = testEnv.unauthenticatedContext().firestore();
  const cn = testEnv.authenticatedContext("cn1").firestore();
  const kts = testEnv.authenticatedContext("kts1").firestore();
  const dn = testEnv.authenticatedContext("dn1").firestore();
  const founder = testEnv.authenticatedContext("h4kEguPEyMcwJwl89stc0Q6j2si2").firestore();

  console.log("\nforumPosts — đọc\n");

  await check("Khách vãng lai đọc bài public → PASS", async () => {
    await assertSucceeds(anon.collection("forumPosts").doc("post_public").get());
  });

  await check("Khách vãng lai đọc bài khu KTS → DENY", async () => {
    await assertFails(anon.collection("forumPosts").doc("post_kts").get());
  });

  await check("Khách vãng lai đọc bài public nhưng ĐÃ ẨN (hidden) → DENY", async () => {
    await assertFails(anon.collection("forumPosts").doc("post_public_hidden").get());
  });

  await check("Khách vãng lai đọc bài public nhưng CHỜ DUYỆT (pending) → DENY", async () => {
    await assertFails(anon.collection("forumPosts").doc("post_public_pending").get());
  });

  await check("CN đã đăng nhập đọc bài public → PASS", async () => {
    await assertSucceeds(cn.collection("forumPosts").doc("post_public").get());
  });

  await check("CN đọc khu KTS → DENY", async () => {
    await assertFails(cn.collection("forumPosts").doc("post_kts").get());
  });

  await check("KTS đọc khu KTS → PASS", async () => {
    await assertSucceeds(kts.collection("forumPosts").doc("post_kts").get());
  });

  await check("KTS đọc bài public → PASS", async () => {
    await assertSucceeds(kts.collection("forumPosts").doc("post_public").get());
  });

  await check("DN (P2 bật) đọc khu KTS → DENY (hoi_dap/vat_lieu/nghe KTS-only vĩnh viễn)", async () => {
    await assertFails(dn.collection("forumPosts").doc("post_kts").get());
  });

  await check("DN (P2 bật) đọc bài public → PASS", async () => {
    await assertSucceeds(dn.collection("forumPosts").doc("post_public").get());
  });

  await check("Founder đọc mọi khu (public lẫn KTS) → PASS", async () => {
    await assertSucceeds(founder.collection("forumPosts").doc("post_public").get());
    await assertSucceeds(founder.collection("forumPosts").doc("post_kts").get());
  });

  console.log("\nforumPosts — ghi (client luôn DENY, mọi ghi qua Cloud Functions)\n");

  await check("Khách vãng lai ghi thẳng vào forumPosts → DENY", async () => {
    await assertFails(anon.collection("forumPosts").add({ category: "hoi_kts", text: "spam" }));
  });

  await check("CN đã đăng nhập ghi thẳng vào forumPosts → DENY (phải qua Cloud Function)", async () => {
    await assertFails(cn.collection("forumPosts").add({ category: "hoi_kts", text: "spam" }));
  });

  await check("Founder ghi thẳng vào forumPosts → DENY (kể cả Founder cũng phải qua Cloud Function)", async () => {
    await assertFails(founder.collection("forumPosts").add({ category: "hoi_kts", text: "spam" }));
  });

  await check("Sửa bài của người khác qua client → DENY (chỉ Cloud Function được sửa)", async () => {
    await assertFails(cn.collection("forumPosts").doc("post_public").update({ text: "hack" }));
  });

  console.log("\ncomments — đọc / ghi\n");

  await check("Khách vãng lai đọc comment dưới bài public → PASS", async () => {
    await assertSucceeds(anon.collection("forumPosts").doc("post_public").collection("comments").doc("c1").get());
  });

  await check("Khách vãng lai đọc comment dưới bài khu KTS → DENY", async () => {
    await assertFails(anon.collection("forumPosts").doc("post_kts").collection("comments").doc("c2").get());
  });

  await check("KTS đọc comment dưới bài khu KTS → PASS", async () => {
    await assertSucceeds(kts.collection("forumPosts").doc("post_kts").collection("comments").doc("c2").get());
  });

  await check("Khách vãng lai ghi thẳng comment → DENY", async () => {
    await assertFails(anon.collection("forumPosts").doc("post_public").collection("comments").add({ text: "spam" }));
  });

  console.log("\n" + passed + " passed, " + failed + " failed\n");

  await testEnv.cleanup();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
