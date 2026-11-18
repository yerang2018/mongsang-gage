// SQL 연습 검사: Supabase 없이 내 컴퓨터 안의 임시 DB(PGlite)에서 마이그레이션을 실행해 봄
// 실행: npx tsx scripts/check-sql.ts
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Supabase에 원래 있는 auth 스키마·역할을 흉내 내는 최소 준비물
const SUPABASE_STUB = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, is_anonymous boolean not null default false);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
`;

async function main() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = "supabase/migrations";
  for (const f of (await fs.readdir(dir)).sort()) {
    const sql = await fs.readFile(`${dir}/${f}`, "utf8");
    await db.exec(sql);
    await db.exec(sql); // 두 번 실행해도 괜찮은지
    console.log("OK", f);
  }

  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  const as = (id: string) => db.exec(`select set_config('request.jwt.claim.sub', '${id}', false)`);

  // 가입 → 프로필 + 구슬 (v3, 0013: 이메일로 바로 가입 270)
  const ok = (label: string, pass: boolean, detail?: unknown) => {
    console.log(pass ? "OK  ·" : "FAIL·", label, detail ?? "");
    if (!pass) process.exitCode = 1;
  };
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
  await as(A);
  let s = await db.query<{ bead_balance: number }>("select * from public.my_summary()");
  ok("이메일 가입 구슬 300", s.rows[0].bead_balance === 300, s.rows[0]);

  // 매일 첫 방문 구슬은 없앰 (v3)
  const d1 = await db.query<{ claim_daily_bonus: boolean }>("select public.claim_daily_bonus()");
  s = await db.query("select * from public.my_summary()");
  ok("매일 첫 방문 구슬 없음", d1.rows[0].claim_daily_bonus === false && s.rows[0].bead_balance === 300);

  // 닉네임
  await db.exec(`select public.set_nickname('보희')`);
  await as(B);
  try {
    await db.exec(`select public.set_nickname('보희')`);
    console.log("FAIL: 중복 닉네임이 통과됨");
  } catch (e) {
    console.log("중복 닉네임 거절:", (e as Error).message);
  }
  try {
    await db.exec(`select public.set_nickname('a')`);
    console.log("FAIL: 1글자 닉네임이 통과됨");
  } catch (e) {
    console.log("짧은 닉네임 거절:", (e as Error).message);
  }
  await db.exec(`select public.set_nickname('문희')`);
  const p = await db.query("select nickname from public.profiles order by nickname");
  console.log("닉네임들", p.rows);

  // 꿈 저장: 하루 3번까지만 구슬 +30
  const awards: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = await db.query<{ beads_awarded: number }>(
      `select * from public.record_dream('${A}', '돼지꿈 ${i}', null, 'shared', '돼지꿈', array['돼지'], 72::smallint, 'A', array['재물운'], '재물운이 와요', '풀이', '{"color":"빨강","item":"키링"}', '[]', null)`,
    );
    awards.push(r.rows[0].beads_awarded);
  }
  await as(A);
  s = await db.query("select * from public.my_summary()");
  ok("꿈 기록 구슬 50씩 하루 3번 (잔액 450)", awards.join(",") === "50,50,50,0" && s.rows[0].bead_balance === 450, [awards, s.rows[0]]);

  // ───── 4단계: 사고팔기 ─────
  const C = "33333333-3333-3333-3333-333333333333";
  await db.exec(`insert into auth.users (id) values ('${C}')`);
  await as(C);
  await db.exec(`select public.set_nickname('선덕')`);

  const dream = async (owner: string, grade: string, visibility = "shared") => {
    const r = await db.query<{ dream_id: string }>(
      `select * from public.record_dream('${owner}', '꿈', null, '${visibility}', '꿈', array['용'], 50::smallint, '${grade}', array['재물운'], '좋아요', '풀이', null, '[]', '{"scene_reading":"x"}')`,
    );
    return r.rows[0].dream_id;
  };
  const list = (seller: string, id: string, type: string, price: number) =>
    db.query(`select public.list_dream_for_sale('${seller}', '${id}', '${type}', ${price})`);
  const buy = async (buyer: string, id: string, cheer: string | null) => {
    await as(buyer);
    const r = await db.query<{ buy_dream: string }>(`select public.buy_dream($1, $2)`, [id, cheer]);
    return r.rows[0].buy_dream;
  };
  const balance = async (id: string) => {
    await as(id);
    return (await db.query<{ bead_balance: number }>("select * from public.my_summary()")).rows[0].bead_balance;
  };
  const expectFail = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      console.log("FAIL:", label, "이(가) 통과됨");
      process.exitCode = 1;
    } catch (e) {
      console.log("거절 OK ·", label, "→", (e as Error).message);
    }
  };

  const aDream = await dream(A, "A");
  const bDream = await dream(A, "B");
  const cDream = await dream(A, "C");
  const privDream = await dream(A, "S", "private");

  await expectFail("액땜몽 판매", () => list(A, cDream, "beads", 100));
  const laterSale = await dream(A, "S", "private");
  await list(A, laterSale, "beads", 200);
  const laterRow = await db.query<{ visibility: string; sale_status: string }>("select visibility, sale_status from public.dreams where id = $1", [laterSale]);
  if (laterRow.rows[0].visibility !== "shared" || laterRow.rows[0].sale_status !== "on_sale") throw Error("해몽 후 판매 선택 실패");
  console.log("OK 해몽 후 비공개 꿈 판매 선택");
  await db.query("update public.dreams set visibility = 'private', sale_status = 'none' where id = $1", [laterSale]);
  await expectFail("남의 꿈 판매", () => list(B, aDream, "beads", 300));
  await expectFail("평몽을 응원 한마디로 판매 (v3는 구슬만)", () => list(A, bDream, "cheer", 0));
  await expectFail("꿈값 0구슬로 판매", () => list(A, aDream, "beads", 0));
  await list(A, aDream, "beads", 300);
  await list(A, bDream, "beads", 30);
  console.log("판매 등록 OK (소길몽 300 구슬, 평몽 30 구슬)");

  await as(""); // 로그인 안 한 사람
  const card = await db.query("select title, grade, price, seller_nickname, expired, has_reading from public.get_sale_card($1)", [aDream]);
  console.log("로그인 전 판매 카드", card.rows[0]);
  await expectFail("로그인 안 하고 구매", () => buy("", aDream, null));

  await expectFail("자기 꿈 구매", () => buy(A, aDream, null));
  const [a0, b0] = [await balance(A), await balance(B)];
  // 구슬 시험을 위해 B에게 넉넉히 (가입 구슬이 적어져서)
  await db.exec(`insert into public.bead_ledger (user_id, delta, reason, ref_key) values ('${B}', 2000, 'test_adjust', 'b')`);
  const b1 = await balance(B);
  const trade1 = await buy(B, aDream, "합격 기원!");
  const [a1, b2] = [await balance(A), await balance(B)];
  ok("구매: 구매자 -300, 판매자 +300 (수수료 없음)", b1 - b2 === 300 && a1 - a0 === 300, { 판매자: [a0, a1], 구매자: [b0, b1, b2] });
  await expectFail("같은 꿈 두 번째 구매", () => buy(C, aDream, null));
  await expectFail("산 꿈 되팔기", () => list(B, aDream, "beads", 300));
  const owner = await db.query("select owner_id = $1 as buyer_owns from public.dreams where id = $2", [B, aDream]);
  console.log("꿈 소유가 구매자에게 넘어감", owner.rows[0]);

  await expectFail("51자 응원 한마디", () => buy(C, bDream, "가".repeat(51)));
  await db.exec(`insert into public.bead_ledger (user_id, delta, reason, ref_key) values ('${C}', 2000, 'test_adjust', 'c')`);
  const c0 = await balance(C);
  const a2 = await balance(A);
  await buy(C, bDream, null);
  ok("평몽 30구슬 구매 (응원 한마디 없이도), 판매자 +30", c0 - (await balance(C)) === 30 && (await balance(A)) - a2 === 30);

  // 증서: 판 사람·산 사람만
  await as(B);
  const cert = await db.query("select title, price, cheer_message, seller_nickname, buyer_nickname from public.trade_certificate($1)", [trade1]);
  console.log("구매자가 본 증서", cert.rows[0]);
  await as(C);
  const certC = await db.query("select * from public.trade_certificate($1)", [trade1]);
  console.log("남이 본 증서 줄 수 (0이어야 함)", certC.rows.length);

  // 하루 판매 3건: A는 오늘 2건 팔았으니 3건째는 되고 4건째는 막힘
  const ss1 = await dream(A, "SS");
  const ss2 = await dream(A, "SS");
  await list(A, ss1, "beads", 700);
  await list(A, ss2, "beads", 700);
  await buy(C, ss1, null);
  console.log("3건째 판매 OK, 구매자 잔액", await balance(C));
  await expectFail("하루 판매 3건 초과(구매)", () => buy(B, ss2, null));
  await expectFail("하루 판매 3건 초과(등록)", async () => list(A, await dream(A, "A"), "beads", 300));

  // 잔액 부족: C(300)가 B의 700 구슬 꿈 사기
  // 구슬을 300개만 남겨 두고 시험 (가입 구슬이 넉넉해져서)
  await db.exec(`insert into public.bead_ledger (user_id, delta, reason, ref_key) values ('${C}', 300 - ${await balance(C)}, 'test_adjust', 'x')`);
  const bSS = await dream(B, "SS");
  await list(B, bSS, "beads", 700);
  await expectFail("구슬 부족", () => buy(C, bSS, null));
  console.log("실패한 구매 뒤 잔액 그대로", await balance(C));

  // 24시간 규칙 없앰(0010): 오래된 꿈도 팔 수 있고, 마감 없이 팔릴 때까지 장터에
  const old = await dream(B, "A");
  await db.exec(`update public.dreams set created_at = now() - interval '10 days' where id = '${old}'`);
  await list(B, old, "beads", 300);
  const oldRow = await db.query<{ sale_expires_at: string | null }>("select sale_expires_at from public.dreams where id = $1", [old]);
  console.log("열흘 지난 꿈 판매 등록, 마감 없음:", oldRow.rows[0].sale_expires_at === null ? "OK" : "FAIL");
  await buy(C, old, null);
  console.log("열흘 지난 꿈 구매 OK, 구매자 잔액", await balance(C));
  // 예전에 마감이 정해진 채로 남은 꿈은 마감이 지나면 못 삼
  const expired = await dream(B, "A");
  await db.exec(`update public.dreams set sale_status = 'on_sale', price_type = 'beads', price = 300, sale_expires_at = now() - interval '1 minute' where id = '${expired}'`);
  await expectFail("마감 지난 꿈 구매", () => buy(C, expired, null));

  // ───── 공개 장터 ─────
  await as(""); // 로그인 안 한 사람도 볼 수 있어야 함
  const market = await db.query<{ dream_id: string }>("select dream_id from public.market_listings()");
  const ids = market.rows.map((r) => r.dream_id);
  console.log(
    "장터: 판매 중 2개만 (팔린 꿈·마감 꿈 제외)",
    ids.length === 2 && ids.includes(ss2) && ids.includes(bSS) && !ids.includes(expired) && !ids.includes(old) && !ids.includes(aDream) ? "OK" : `FAIL ${ids}`,
  );
  const tagged = await db.query("select 1 from public.market_listings('합격운')");
  console.log("장터: 없는 운 태그로 거르면 0개", tagged.rows.length === 0 ? "OK" : "FAIL");
  const recent = await db.query<Record<string, unknown>>("select * from public.market_recent_sales()");
  console.log("방금 팔린 꿈", recent.rows.length, "개, 산 사람 정보 없음:", !("buyer_id" in recent.rows[0]) ? "OK" : "FAIL");
  const shown = await db.query<{ seller_nickname: string; listed_at: string | null }>("select seller_nickname, listed_at from public.market_listings()");
  console.log("장터: 닉네임 가림·내놓은 시각", shown.rows.map((r) => r.seller_nickname), shown.rows.every((r) => r.listed_at && r.seller_nickname.includes("*")) ? "OK" : "FAIL");
  const masks = await db.query<{ m: string }>("select public.mask_nickname(n) as m from unnest(array['예랑','김예랑','꿈꾸는토끼']) n");
  console.log("닉네임 가리기 (예*, 김**, 꿈**)", masks.rows.map((r) => r.m).join(", "));

  // ───── 꿈 구해요: 요청 → 꿈 내밀기(기록 후 3일까지) → 요청한 사람이 삼 ─────
  const E = "55555555-5555-5555-5555-555555555555";
  const F = "66666666-6666-6666-6666-666666666666";
  await db.exec(`insert into auth.users (id) values ('${E}'), ('${F}')`);
  await as(E);
  await db.exec(`select public.set_nickname('김유신')`);
  await as(F);
  await db.exec(`select public.set_nickname('김춘추')`);
  const ask = async (who: string, tag: string, msg: string | null) => {
    await as(who);
    return (await db.query<{ id: string }>("select public.create_dream_request($1, $2) as id", [tag, msg])).rows[0].id;
  };
  const offer = (who: string, req: string, d: string, type: string, price: number) =>
    db.query<{ id: string }>("select public.offer_dream($1, $2, $3, $4, $5) as id", [who, req, d, type, price]);

  await expectFail("로그인 안 하고 꿈 구하기", () => ask("", "합격운", null));
  await expectFail("없는 운으로 꿈 구하기", () => ask(E, "로또운", null));
  const req = await ask(E, "합격운", "내일 면접이에요");
  await expectFail("꿈 구해요 동시에 두 개", () => ask(E, "재물운", null));

  await expectFail("내 요청에 내 꿈 내밀기", async () => offer(E, req, await dream(E, "A"), "beads", 300));
  const fOld = await dream(F, "A");
  await db.exec(`update public.dreams set created_at = now() - interval '10 days' where id = '${fOld}'`);
  await expectFail("소길몽을 응원 한마디로 내밀기", () => offer(F, req, fOld, "cheer", 0));
  const resp = (await offer(F, req, fOld, "beads", 300)).rows[0].id;
  console.log("열흘 지난 꿈 내밀기 OK (기록 후 기간 제한 없음)");
  await expectFail("같은 요청에 두 번 내밀기", async () => offer(F, req, await dream(F, "B"), "cheer", 0));

  await as("");
  const pub = await db.query<{ requester_nickname: string; offer_count: number }>(
    "select requester_nickname, offer_count from public.open_dream_requests() where request_id = $1",
    [req],
  );
  const offers = await db.query<Record<string, unknown>>("select * from public.request_offers($1)", [req]);
  console.log(
    "로그인 전 장터의 꿈 구해요",
    pub.rows[0],
    "내민 꿈",
    offers.rows.length,
    "개, 꿈 원문 없음:",
    !("text" in (offers.rows[0] ?? {})) ? "OK" : "FAIL",
  );

  const buyOffer = async (who: string, id: string, cheer: string | null) => {
    await as(who);
    return (await db.query<{ id: string }>("select public.buy_offered_dream($1, $2) as id", [id, cheer])).rows[0].id;
  };
  await expectFail("요청 안 한 사람이 내민 꿈 사기", () => buyOffer(B, resp, null));
  await db.exec(`insert into public.bead_ledger (user_id, delta, reason, ref_key) values ('${E}', 1000, 'test_adjust', 'e')`);
  const [e0, f0] = [await balance(E), await balance(F)];
  const reqTrade = await buyOffer(E, resp, "고마워!");
  ok("내민 꿈 구매: 요청자 -300, 내민 사람 +300", e0 - (await balance(E)) === 300 && (await balance(F)) - f0 === 300);
  const after = await db.query<{ status: string; owner_ok: boolean; linked: boolean }>(
    `select r.status, d.owner_id = '${E}' as owner_ok, t.request_id = r.id as linked
     from public.dream_requests r, public.dreams d, public.trades t
     where r.id = '${req}' and d.id = '${fOld}' and t.id = '${reqTrade}'`,
  );
  console.log("요청 끝남·꿈 소유 이전·거래에 요청 연결", after.rows[0]);
  await expectFail("이미 고른 요청에서 또 사기", () => buyOffer(E, resp, null));
  await as("");
  const stillOpen = await db.query("select 1 from public.open_dream_requests() where request_id = $1", [req]);
  console.log("끝난 요청은 장터에서 빠짐", stillOpen.rows.length === 0 ? "OK" : "FAIL");
  await ask(E, "재물운", null);
  console.log("요청이 끝나면 새로 구하기 OK");

  // ───── 익명 시작: 200 → 이메일 연결 +70 (한 번만) (v3, 0013) ─────
  const D = "44444444-4444-4444-4444-444444444444";
  await db.exec(`insert into auth.users (id, is_anonymous) values ('${D}', true)`);
  ok("익명 가입 구슬 300", (await balance(D)) === 300);
  await db.exec(`update auth.users set is_anonymous = false where id = '${D}'`);
  ok("이메일 연결 후 370", (await balance(D)) === 370);
  await db.exec(`update auth.users set is_anonymous = true where id = '${D}'`);
  await db.exec(`update auth.users set is_anonymous = false where id = '${D}'`);
  ok("연결을 또 해도 그대로 370", (await balance(D)) === 370);

  // ───── 기존 잔액 10분의 1, 판매 중 꿈값 새 등급표 (0013을 데이터가 있는 상태에서 다시 실행) ─────
  const K = "cdcdcdcd-0000-0000-0000-000000000001";
  await db.exec(`insert into auth.users (id) values ('${K}')`);
  await db.exec(`insert into public.bead_ledger (user_id, delta, reason, ref_key) values ('${K}', 1560, 'signup_topup', 'old'), ('${K}', 100, 'bead_purchase', 'paid1')`);
  // K의 잔액: 가입 270 + 예전 1560 + 꿈 기록 2번(10+10) + 충전 100 = 1950 → 예전 몫 1850은 185, 충전 100은 그대로 → 270
  await as(K);
  await db.exec(`select public.set_nickname('환산')`);
  const oldListing = await dream(K, "SS");
  await db.exec(`update public.dreams set sale_status = 'on_sale', price_type = 'beads', price = 700, listed_at = now() where id = '${oldListing}'`);
  const oldCheer = await dream(K, "B");
  await db.exec(`update public.dreams set sale_status = 'on_sale', price_type = 'cheer', price = 0, listed_at = now() where id = '${oldCheer}'`);
  const sql13 = await fs.readFile("supabase/migrations/0013_bead_units.sql", "utf8");
  await db.exec(sql13);
  await db.exec(sql13); // 두 번 실행해도 한 번만 환산
  ok("기존 잔액 10분의 1 (충전 구슬은 그대로): 2060 → 296", (await balance(K)) === 296, await balance(K));
  const prices = await db.query<{ id: string; price_type: string; price: number }>("select id, price_type, price from public.dreams where id in ($1, $2)", [oldListing, oldCheer]);
  const pmap = Object.fromEntries(prices.rows.map((r) => [r.id, `${r.price_type}:${r.price}`]));
  ok("판매 중 꿈값: 대길몽 700 → 300구슬, 평몽 응원 한마디 → 30구슬", pmap[oldListing] === "beads:300" && pmap[oldCheer] === "beads:30", pmap);

  // ───── 행동 지표·AI 원가 (0011) ─────
  const check = (label: string, ok: boolean, detail?: unknown) => {
    console.log(ok ? "OK  ·" : "FAIL·", label, detail ?? "");
    if (!ok) process.exitCode = 1;
  };
  const V1 = "aaaaaaaa-0000-0000-0000-000000000001";
  const trackRow = (type: string, dedup: string | null, user: string | null = null, meta: object | null = null, visitor = V1) =>
    db.query(
      `insert into public.events (visitor_id, user_id, type, app_env, dedup_key, meta) values ($1, $2, $3, 'production', $4, $5)
       on conflict (visitor_id, type, dedup_key) do nothing`,
      [visitor, user, type, dedup, meta ? JSON.stringify(meta) : null],
    );
  await trackRow("first_visit", "first");
  await trackRow("first_visit", "first"); // 새로고침해도 한 번
  await trackRow("share_visit", `sale:${ss2}`, null, { target: "sale", id: ss2, via: "share" });
  await trackRow("share_visit", `sale:${ss2}`, null, { target: "sale", id: ss2, via: "share" });
  await trackRow("share_attempt", null, B, { target: "sale", id: ss2, method: "native" });
  await trackRow("share_attempt", null, B, { target: "sale", id: ss2, method: "native" }); // 시도는 누를 때마다
  const evCount = await db.query<{ type: string; n: number }>(
    "select type, count(*)::int as n from public.events where visitor_id = $1 group by type order by type",
    [V1],
  );
  const byType = Object.fromEntries(evCount.rows.map((r) => [r.type, r.n]));
  check("첫 방문·공유 링크 방문은 한 번만, 공유 시도는 누를 때마다", byType.first_visit === 1 && byType.share_visit === 1 && byType.share_attempt === 2, byType);

  // 브라우저(로그인한 사람)가 직접 넣을 수 있는 건 가짜 문 기록뿐
  await db.exec("grant insert on public.events to authenticated; grant usage on schema public to authenticated, anon;");
  await as(B);
  await db.exec("set role authenticated");
  await expectFail("브라우저가 공유 방문 기록을 직접 넣기", () =>
    db.query(`insert into public.events (user_id, type, visitor_id, app_env) values ('${B}', 'share_visit', '${V1}', 'production')`),
  );
  await db.query(`insert into public.events (user_id, type, meta) values ('${B}', 'fake_door', '{"door":"voice_record"}')`);
  console.log("가짜 문 기록은 그대로 넣을 수 있음 OK");
  await db.exec("reset role");

  // 집계 함수: 서버 비밀 키(service_role)만
  await db.exec("set role anon");
  await expectFail("로그인 안 한 사람이 지표 보기", () => db.query("select * from public.metrics_report(current_date, current_date)"));
  await db.exec("reset role");
  await db.exec("set role authenticated");
  await expectFail("로그인한 사람이 지표 보기", () => db.query("select * from public.metrics_report(current_date, current_date)"));
  await db.exec("reset role");

  // 다음 주 재방문: G는 0일·10일째 행동(재방문), H는 0일·17일째 행동(재방문 아님), I는 아직 13일이 안 지남(계산 안 함)
  const [G, H, I] = ["77777777-7777-7777-7777-777777777777", "88888888-8888-8888-8888-888888888888", "99999999-9999-9999-9999-999999999999"];
  await db.exec(`insert into auth.users (id) values ('${G}'), ('${H}'), ('${I}')`);
  const aged = async (owner: string, daysAgo: number) => {
    const id = await dream(owner, "A");
    await db.exec(`update public.dreams set created_at = now() - interval '${daysAgo} days' where id = '${id}'`);
  };
  await aged(G, 20);
  await aged(G, 10);
  await aged(H, 20);
  await aged(H, 3);
  await aged(I, 5);
  const report = async () => {
    const r = await db.query<{ metric: string; numerator: string | null; denominator: string | null }>(
      "select * from public.metrics_report((now() at time zone 'Asia/Seoul')::date - 30, (now() at time zone 'Asia/Seoul')::date)",
    );
    return Object.fromEntries(r.rows.map((x) => [x.metric, [x.numerator === null ? null : Number(x.numerator), x.denominator === null ? null : Number(x.denominator)]]));
  };
  let m = await report();
  check("다음 주 재방문 1/2 (13일이 안 지난 사람 제외)", m["9 다음 주 재방문 (7~13일)"]?.[0] === 1 && m["9 다음 주 재방문 (7~13일)"]?.[1] === 2, m["9 다음 주 재방문 (7~13일)"]);
  const tradesNow = Number((await db.query<{ n: number }>("select count(*)::int as n from public.trades")).rows[0].n);
  check("구매 성공 = 거래 표 줄 수", m["7 꿈 구매 성공"]?.[0] === tradesNow, [m["7 꿈 구매 성공"], tradesNow]);
  check("첫 방문 1, 공유 링크 방문 1", m["1 첫 방문 (방문자 수)"]?.[0] === 1 && m["6 공유 링크 방문자"]?.[0] === 1);
  check("유료 전환율은 미측정(NULL), 현금 매출 0", m["11b 유료 전환율"]?.[0] === null && m["11 현금 매출"]?.[0] === 0);

  // 운영자·시험 계정 빼기: B를 빼면 B가 낀 거래가 빠짐
  const withB = Number((await db.query<{ n: number }>(`select count(*)::int as n from public.trades where buyer_id = '${B}' or seller_id = '${B}'`)).rows[0].n);
  await db.exec(`insert into public.metrics_excluded_users (user_id, note) values ('${B}', '시험') on conflict do nothing`);
  m = await report();
  check("제외한 계정의 거래는 안 셈", m["7 꿈 구매 성공"]?.[0] === tradesNow - withB, [m["7 꿈 구매 성공"], tradesNow, withB]);

  // AI 호출 기록: 요청 1번에 시도 2번(실패→성공)이면 요청 1·성공 1·다시 시도 1
  const R1 = "bbbbbbbb-0000-0000-0000-000000000001";
  await db.exec(`insert into public.ai_calls (app_env, call_type, request_id, attempt, model, outcome, error_status, prompt_tokens, output_tokens)
    values ('production', 'interpret', '${R1}', 1, 'm1', 'error', 503, null, null),
           ('production', 'interpret', '${R1}', 2, 'm2', 'success', null, 1200, 800)`);
  m = await report();
  check(
    "AI 요청 성공 1/1, 다시 시도 1, 입력 토큰 1200, 비용은 미확인(NULL)",
    m["12 AI 해몽 요청 / 성공"]?.[0] === 1 && m["12b AI 다시 시도한 요청"]?.[0] === 1 && m["12e AI 입력 토큰 (전체 환경)"]?.[0] === 1200 && m["12h AI 비용"]?.[0] === null,
  );

  // ───── 구슬 충전 주문 (0012) ─────
  const ADMIN = A;
  const order = async (who: string, won = 1000, beads = 100) =>
    (await db.query<{ order_id: string; order_code: string }>("select * from public.create_bead_order($1, $2, $3)", [who, won, beads])).rows[0];
  const confirm = (id: string) => db.query<{ n: number }>("select public.confirm_bead_order($1, $2) as n", [id, ADMIN]);
  const refund = (id: string) => db.query<{ r: string }>("select public.refund_bead_order($1, $2) as r", [id, ADMIN]);

  const J = "abababab-0000-0000-0000-000000000001";
  await db.exec(`insert into auth.users (id) values ('${J}')`);
  await expectFail("닉네임 없이 충전 주문", () => order(J));
  await as(J);
  await db.exec(`select public.set_nickname('충전러')`);
  const j0 = await balance(J);
  const o1 = await order(J);
  check("주문번호 4자리", /^\d{4}$/.test(o1.order_code), o1.order_code);
  check("입금 전엔 구슬 그대로", (await balance(J)) === j0);
  const first = (await confirm(o1.order_id)).rows[0].n;
  const again = (await confirm(o1.order_id)).rows[0].n;
  check("입금 확인하면 구슬 +100, 두 번 눌러도 한 번만", first === 100 && again === 0 && (await balance(J)) === j0 + 100, [first, again, await balance(J)]);

  // 입금 대기 주문은 3개까지, 번호는 서로 다름
  const p1 = await order(J);
  const p2 = await order(J);
  const p3 = await order(J);
  check("입금 대기 주문 번호가 서로 다름", new Set([p1.order_code, p2.order_code, p3.order_code]).size === 3);
  await expectFail("입금 대기 주문 4개째", () => order(J));
  check("입금 전 주문 취소", (await refund(p1.order_id)).rows[0].r === "cancelled" && (await balance(J)) === j0 + 100);
  await expectFail("취소한 주문 입금 확인", () => confirm(p1.order_id));

  // 환불: 충전 구슬을 쓰지 않았을 때만 (구슬 회수)
  await confirm(p2.order_id);
  check("쓰지 않은 충전은 환불 (구슬 회수)", (await refund(p2.order_id)).rows[0].r === "refunded" && (await balance(J)) === j0 + 100);
  await confirm(p3.order_id);
  await db.exec(`insert into public.bead_ledger (user_id, delta, reason, ref_key) values ('${J}', -${j0 + 150}, 'test_spend', 'x')`);
  await expectFail("충전 구슬을 쓴 뒤 환불", () => refund(p3.order_id));
  await expectFail("환불한 주문 또 환불", () => refund(p2.order_id));

  // 보안: 함수는 서버만, 주문은 내 것만 보임
  await db.exec("grant select on public.bead_orders to authenticated");
  await as(J);
  await db.exec("set role authenticated");
  await expectFail("브라우저에서 직접 입금 확인", () => db.query("select public.confirm_bead_order($1, $2)", [p3.order_id, J]));
  await expectFail("브라우저에서 직접 충전 주문", () => db.query("select * from public.create_bead_order($1, 1000, 100)", [J]));
  const mine = await db.query("select id from public.bead_orders");
  await db.exec("reset role");
  await as(B);
  await db.exec("set role authenticated");
  const others = await db.query("select id from public.bead_orders");
  await db.exec("reset role");
  check("내 주문만 보임 (충전러 4개, 다른 사람 0개)", mine.rows.length === 4 && others.rows.length === 0, [mine.rows.length, others.rows.length]);

  // ───── 꿈 선물: 행운 세트·응원 카드 (0014) ─────
  const gift = async (who: string, kind: string, dreamId: string, openAt: string | null = null, recipient = "받는이") => {
    await as(who);
    return (await db.query<{ t: string }>("select public.create_gift($1, $2, '보내는이', $3, '시험 잘 봐!', $4) as t", [kind, dreamId, recipient, openAt])).rows[0].t;
  };
  type GiftRow = { opened: boolean; title: string | null; dream_text: string | null; reading: unknown; message: string | null; on_sale: boolean | null; sender_name: string };
  const openGift = async (token: string) => {
    await as(""); // 받는 사람은 로그인 없이
    return (await db.query<GiftRow>("select * from public.get_gift($1)", [token])).rows[0];
  };

  // B는 aDream을 산 사람 → 행운 세트로 바로 열리는 선물
  const lucky = await gift(B, "luck_set", aDream);
  check("선물 토큰은 64자", lucky.length === 64);
  const opened = await openGift(lucky);
  check("행운 세트를 열면 꿈 원문·자세한 해몽·메시지까지", opened.opened && !!opened.dream_text && !!opened.reading && opened.message === "시험 잘 봐!", opened);
  await openGift(lucky);
  const views = await db.query<{ view_count: number; first_viewed_at: string | null }>("select view_count, first_viewed_at from public.gifts where token = $1", [lucky]);
  check("열어 본 횟수 2, 처음 본 시각 기록", views.rows[0].view_count === 2 && !!views.rows[0].first_viewed_at);
  await expectFail("같은 거래로 선물 두 번", () => gift(B, "luck_set", aDream));
  await expectFail("남이 산 꿈을 행운 세트로", () => gift(C, "luck_set", aDream));

  // E는 fOld를 산 사람 → 내일 아침에 열리는 선물: 열리기 전엔 이름·시각만
  const later = await gift(E, "luck_set", fOld, new Date(Date.now() + 86400_000).toISOString());
  const sealed = await openGift(later);
  check("열리기 전엔 보낸 사람 이름만 (제목·원문·메시지 없음)", !sealed.opened && sealed.sender_name === "보내는이" && !sealed.title && !sealed.dream_text && !sealed.message, sealed);
  const sealedViews = await db.query<{ view_count: number }>("select view_count from public.gifts where token = $1", [later]);
  check("열리기 전 조회는 안 셈", sealedViews.rows[0].view_count === 0);

  // 응원 카드: 판매 중인 꿈 → 등급·한 줄·메시지만, 원문·해몽 없음
  // (0015에서 새 응원 카드를 막았으므로 0014 규칙을 보는 동안만 막는 트리거를 잠깐 끔)
  await db.exec("alter table public.gifts disable trigger gifts_no_new_cheer");
  const cheerCard = await gift(C, "cheer_card", ss2);
  const cc = await openGift(cheerCard);
  check("응원 카드는 원문·해몽 없이 제목·메시지만, 판매 중 표시", cc.opened && !!cc.title && !cc.dream_text && !cc.reading && cc.on_sale === true && cc.message === "시험 잘 봐!", cc);
  await expectFail("남의 나만 보기 꿈을 응원 카드로", () => gift(C, "cheer_card", privDream));
  await expectFail("액땜몽을 응원 카드로", () => gift(A, "cheer_card", cDream));
  await expectFail("열리는 시각이 지난 때", () => gift(C, "cheer_card", ss2, new Date(Date.now() - 3600_000).toISOString()));
  await expectFail("열리는 시각이 60일 넘게 뒤", () => gift(C, "cheer_card", ss2, new Date(Date.now() + 61 * 86400_000).toISOString()));
  await expectFail("받는 사람 이름 13자", () => gift(C, "cheer_card", ss2, null, "가".repeat(13)));
  await expectFail("로그인 안 하고 선물 만들기", () => gift("", "cheer_card", ss2));
  await db.exec("alter table public.gifts enable trigger gifts_no_new_cheer");
  await expectFail("응원 카드는 이제 새로 못 만듦 (0015)", () => gift(E, "cheer_card", ss2));
  const keptCheer = await openGift(cheerCard);
  check("이미 만든 응원 카드는 계속 열림", keptCheer.opened && !!keptCheer.title, keptCheer);
  const none = await db.query("select * from public.get_gift($1)", ["x".repeat(64)]);
  check("없는 토큰은 아무것도 안 보임", none.rows.length === 0);

  // 보낸 선물 목록은 보낸 사람만
  await db.exec("grant select on public.gifts to authenticated");
  await as(C);
  await db.exec("set role authenticated");
  const cGifts = await db.query("select id from public.gifts");
  await db.exec("reset role");
  check("내가 보낸 선물만 보임 (C는 1개)", cGifts.rows.length === 1, cGifts.rows.length);

  // ───── 신고·자동 숨김 (0015) ─────
  const reportDream = async (who: string, dreamId: string, reason = "copied", detail: string | null = "https://example.com/글") => {
    await as(who);
    return (await db.query<{ r: string }>("select public.report_dream($1, $2, $3) as r", [dreamId, reason, detail])).rows[0].r;
  };
  const onMarket = async (id: string) => (await db.query("select 1 from public.market_listings() where dream_id = $1", [id])).rows.length > 0;
  const saleCard = async (id: string) => (await db.query("select 1 from public.get_sale_card($1)", [id])).rows.length > 0;

  check("신고 전: ss2는 장터·판매 카드에 보임", (await onMarket(ss2)) && (await saleCard(ss2)));
  await expectFail("내 꿈은 신고 못 함", () => reportDream(A, ss2));
  await expectFail("로그인 안 하고 신고", () => reportDream("", ss2));
  await expectFail("없는 사유로 신고", () => reportDream(B, ss2, "fake"));
  await expectFail("공개 안 된 꿈(나만 보기)은 신고 못 함", () => reportDream(B, privDream));
  await expectFail("설명 301자", () => reportDream(B, ss2, "ad", "가".repeat(301)));
  check("첫 신고 → reported", (await reportDream(B, ss2)) === "reported");
  await expectFail("같은 사람이 같은 꿈 두 번 신고", () => reportDream(B, ss2, "ad"));
  check("두 번째 신고 → reported (아직 보임)", (await reportDream(C, ss2, "personal_info", null)) === "reported" && (await onMarket(ss2)));
  check("세 번째 신고 → hidden", (await reportDream(E, ss2, "offensive", null)) === "hidden");
  const hid = await db.query<{ sale_status: string; hidden_at: string | null; hidden_prev_status: string }>("select sale_status, hidden_at, hidden_prev_status from public.dreams where id = $1", [ss2]);
  check("숨기면 장터에서 내림 (판매 상태 none, 전 상태 on_sale 기억)", hid.rows[0].sale_status === "none" && !!hid.rows[0].hidden_at && hid.rows[0].hidden_prev_status === "on_sale", hid.rows[0]);
  check("숨긴 꿈은 장터·판매 카드에 안 보임", !(await onMarket(ss2)) && !(await saleCard(ss2)));
  await expectFail("숨긴 꿈은 살 수 없음", () => buy(C, ss2, null));
  const myReports = async (who: string) => {
    await as(who);
    await db.exec("grant select on public.dream_reports to authenticated");
    await db.exec("set role authenticated");
    const r = await db.query("select id from public.dream_reports");
    await db.exec("reset role");
    return r.rows.length;
  };
  check("내가 한 신고만 보임 (B 1개)", (await myReports(B)) === 1);

  // 관리자: 문제없음 → 다시 장터에, 신고는 dismissed
  await as("");
  const shown2 = await db.query<{ r: string }>("select public.resolve_dream_reports($1, 'dismiss', $2) as r", [ss2, A]);
  check("문제없음 → 다시 판매 중·장터에 보임", shown2.rows[0].r === "shown" && (await onMarket(ss2)) && (await saleCard(ss2)));
  const dismissed = await db.query<{ n: number }>("select count(*)::int as n from public.dream_reports where dream_id = $1 and status = 'dismissed'", [ss2]);
  check("신고 3건 모두 dismissed", dismissed.rows[0].n === 3, dismissed.rows[0]);
  // 관리자: 신고가 적어도 숨김 유지(인정) 가능
  const kept = await db.query<{ r: string }>("select public.resolve_dream_reports($1, 'hide', $2) as r", [ss2, A]);
  check("숨김 유지 → hidden", kept.rows[0].r === "hidden" && !(await onMarket(ss2)));
  await expectFail("이상한 처리 방법", () => db.query("select public.resolve_dream_reports($1, 'delete', $2)", [ss2, A]));
  await expectFail("로그인한 사람은 관리자 처리 함수 못 씀", async () => {
    await as(B);
    await db.exec("set role authenticated");
    try {
      await db.query("select public.resolve_dream_reports($1, 'dismiss', $2)", [ss2, B]);
    } finally {
      await db.exec("reset role");
    }
  });
  // 팔린 꿈을 숨기면: 산 사람 것은 그대로, 방금 팔린 꿈 목록에서만 빠짐
  const soldRow = await db.query<{ dream_id: string }>("select dream_id from public.market_recent_sales() limit 1");
  const soldId = soldRow.rows[0].dream_id;
  await as("");
  await db.query("select public.resolve_dream_reports($1, 'hide', $2)", [soldId, A]);
  const sold = await db.query<{ sale_status: string }>("select sale_status from public.dreams where id = $1", [soldId]);
  const recentRows = await db.query("select 1 from public.market_recent_sales() where dream_id = $1", [soldId]);
  check("팔린 꿈을 숨겨도 sold 그대로, 방금 팔린 꿈에서 빠짐", sold.rows[0].sale_status === "sold" && recentRows.rows.length === 0, sold.rows[0]);

  // 자동 장터 등록: 기록·보상·판매 상태가 함께 완료되고 오류 시 전부 취소돼요.
  const autoRecord = (grade: string, price: number) => db.query<{ dream_id: string; beads_awarded: number }>(
    "select * from public.record_market_dream($1, '자동 등록 검사 꿈', null, $2, '자동 등록 꿈', array['달'], 50::smallint, $3, array['재물운'], '공개 해몽 한 줄', '비공개 상세 해몽', null, '[]', null)", [A, price, grade]);
  const automatic = await autoRecord("A", 100);
  const autoDream = await db.query<{ sale_status: string; visibility: string; price: number; pledged: boolean }>(
    "select sale_status, visibility, price, sale_pledged_at is not null as pledged from public.dreams where id=$1", [automatic.rows[0].dream_id]);
  check("새 꿈은 즉시 장터에 등록", autoDream.rows[0].sale_status === "on_sale" && autoDream.rows[0].visibility === "shared" && autoDream.rows[0].price === 100 && autoDream.rows[0].pledged);
  const beforeInvalid = await db.query<{ n: number }>("select count(*)::int as n from public.dreams");
  await expectFail("잘못된 꿈값은 자동 등록 거절", () => autoRecord("A", 1));
  const afterInvalid = await db.query<{ n: number }>("select count(*)::int as n from public.dreams");
  check("등록 실패 시 꿈이 중복 저장되지 않음", beforeInvalid.rows[0].n === afterInvalid.rows[0].n);
  const unlucky = await autoRecord("C", 0);
  const unluckyDream = await db.query<{ sale_status: string }>("select sale_status from public.dreams where id=$1", [unlucky.rows[0].dream_id]);
  check("액땜몽 판매 불가 유지", unluckyDream.rows[0].sale_status === "none");
  await expectFail("일반 사용자는 자동 등록 함수를 직접 실행할 수 없음", async () => {
    await db.exec("set role authenticated");
    try { await autoRecord("A", 100); } finally { await db.exec("reset role"); }
  });

}

main().catch((e) => {
  console.error("SQL 오류:", e.message);
  process.exit(1);
});
