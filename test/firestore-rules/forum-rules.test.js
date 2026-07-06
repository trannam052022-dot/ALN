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
    // KTS mới đăng ký, chờ Founder duyệt — role đúng nhưng status 'pending'
    await db.collection("users").doc("ktsPending").set({ role: "kts", status: "pending", name: "KTS Chờ" });
    // KTS đã bị Founder từ chối — role vẫn 'kts' nhưng status 'rejected'
    await db.collection("users").doc("ktsRejected").set({ role: "kts", status: "rejected", name: "KTS Từ chối" });

    // Dự án + stage để test quyền GHI của isKts (ghi stages = quyền KTS)
    await db.collection("projects").doc("proj1").set({
      cn: { uid: "cn1" }, kts: { uid: "kts1" }, dn: { uid: "dn1" },
      memberUids: ["cn1", "kts1", "dn1"], stage: "C1",
    });
    await db.collection("projects").doc("proj1").collection("stages").doc("C2")
      .set({ note: "seed" });

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
  const ktsPending = testEnv.authenticatedContext("ktsPending").firestore();
  const ktsRejected = testEnv.authenticatedContext("ktsRejected").firestore();
  const newbie = testEnv.authenticatedContext("newbie").firestore();

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

  console.log("\nusers — chặn tự sửa role (PASS 3, kéo lên trước khi deploy PASS 2)\n");

  await check("CN tự sửa role của chính mình thành 'kts' → DENY (chặn leo thang đặc quyền)", async () => {
    await assertFails(cn.collection("users").doc("cn1").update({ role: "kts" }));
  });

  await check("CN tự sửa role của chính mình thành 'founder' → DENY", async () => {
    await assertFails(cn.collection("users").doc("cn1").update({ role: "founder" }));
  });

  await check("CN tự sửa field khác (name) của chính mình, không đụng role → PASS", async () => {
    await assertSucceeds(cn.collection("users").doc("cn1").update({ name: "Tên mới" }));
  });

  await check("Founder sửa role của người khác (duyệt KTS) → PASS", async () => {
    await assertSucceeds(founder.collection("users").doc("cn1").update({ role: "kts" }));
  });

  console.log("\nusers — chặn tự phong role đặc quyền lúc TẠO + tự kích active (PASS 3+)\n");

  await check("Người mới tự tạo doc role:'cn' status:'active' → PASS (CN active ngay)", async () => {
    await assertSucceeds(newbie.collection("users").doc("newbie").set({ role: "cn", status: "active", name: "Newbie" }));
  });

  await check("Người mới tự tạo doc role:'kts' status:'pending' → PASS (đúng luồng đăng ký KTS)", async () => {
    await assertSucceeds(testEnv.authenticatedContext("applyKts").firestore()
      .collection("users").doc("applyKts").set({ role: "kts", status: "pending", name: "Apply KTS" }));
  });

  await check("Người mới tự tạo doc role:'kts' status:'active' → DENY (tự kích active)", async () => {
    await assertFails(testEnv.authenticatedContext("hackKts").firestore()
      .collection("users").doc("hackKts").set({ role: "kts", status: "active", name: "Hack" }));
  });

  await check("Người mới tự tạo doc role:'founder' → DENY (tự phong founder)", async () => {
    await assertFails(testEnv.authenticatedContext("hackFdr").firestore()
      .collection("users").doc("hackFdr").set({ role: "founder", status: "active", name: "Hack" }));
  });

  await check("CN tự kích status của mình 'active'→giữ nguyên (sửa name) → PASS", async () => {
    await assertSucceeds(cn.collection("users").doc("cn1").update({ name: "CN đổi tên" }));
  });

  await check("KTS pending tự sửa status của mình thành 'active' → DENY (tự kích active)", async () => {
    await assertFails(ktsPending.collection("users").doc("ktsPending").update({ status: "active" }));
  });

  console.log("\nisKts/isDesigner — quyền GHI stages phải kèm status=='active'\n");

  await check("KTS active ghi stages dự án → PASS", async () => {
    await assertSucceeds(kts.collection("projects").doc("proj1").collection("stages").doc("C2").set({ note: "kts active" }));
  });

  await check("KTS pending ghi stages dự án → DENY (chưa được Founder duyệt)", async () => {
    await assertFails(ktsPending.collection("projects").doc("proj1").collection("stages").doc("C2").set({ note: "pending" }));
  });

  await check("KTS bị từ chối ghi stages dự án → DENY (status 'rejected')", async () => {
    await assertFails(ktsRejected.collection("projects").doc("proj1").collection("stages").doc("C2").set({ note: "rejected" }));
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
