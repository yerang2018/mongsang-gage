import assert from "node:assert/strict";
import { isValidBirthDate, todayInKorea } from "../src/lib/birth-date";
import { DreamInputSchema } from "../src/lib/dream-input";
import { buildDreamPrompt, buildReadingPrompt, DreamAISchema } from "../src/lib/dream";

assert.equal(todayInKorea(new Date("2026-11-08T16:00:00Z")), "2026-11-09");
assert.equal(isValidBirthDate("", "2026-11-09"), true);
assert.equal(isValidBirthDate("2000-02-29", "2026-11-09"), true);
assert.equal(isValidBirthDate("2001-02-29", "2026-11-09"), false);
assert.equal(isValidBirthDate("2000-13-01", "2026-11-09"), false);
assert.equal(isValidBirthDate("2000-04-31", "2026-11-09"), false);
assert.equal(isValidBirthDate("2026-11-10", "2026-11-09"), false);
assert.equal(isValidBirthDate("2000-1-1", "2026-11-09"), false);
assert.equal(isValidBirthDate("1899-01-01", "2026-11-09"), false);

assert.equal(DreamInputSchema.safeParse({ dreamText: "열 글자가 넘는 꿈 내용입니다" }).success, false);
const dreamText = "커다란 돼지가 들어와 제 품에 안겼어요.";
assert.equal(DreamInputSchema.parse({ dreamText, pledge: true }).birthDate, "");
assert.equal(DreamInputSchema.parse({ dreamText, pledge: true, birthDate: "2000-02-29" }).birthDate, "2000-02-29");
assert.equal(DreamInputSchema.safeParse({ dreamText, pledge: true, birthDate: "2001-02-29" }).success, false);
assert.equal(DreamInputSchema.safeParse({ dreamText, pledge: true, birthDate: "9999-01-01" }).success, false);
const oldClient = DreamInputSchema.parse({ dreamText, pledge: true, tomorrowEvent: "예전 입력" });
assert.equal("tomorrowEvent" in oldClient, false);
assert.equal("lucky" in DreamAISchema.shape, false);

const prompt = buildDreamPrompt({ dreamText: "$& {{birth_date}}가 적힌 종이를 봤어요", birthDate: "2000-02-29", characterDesc: "test" });
assert.ok(prompt.includes("$& {{birth_date}}가 적힌 종이를 봤어요"));
assert.ok(prompt.includes("- 생년월일(양력, 선택): 2000-02-29"));
assert.ok(prompt.includes('"징조"'));
assert.ok(!prompt.includes("내일 있는 일"));
assert.ok(!prompt.includes('"lucky"'));
const withoutDate = buildDreamPrompt({ dreamText, characterDesc: "test" });
assert.ok(withoutDate.includes("- 생년월일(양력, 선택): 없음"));
const reading = buildReadingPrompt({ dreamText, title: "돼지 꿈", gradeName: "길몽", score: 75, headline: "좋은 기운", interpretation: "예시 풀이" });
assert.ok(reading.includes('"징조"'));
console.log("PASS: optional/full birth date, invalid/future date rejection, old-client compatibility, prompt substitution, and removed lucky fields");
