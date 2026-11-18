// 한글 닉네임 끝의 받침에 맞춰 주격 조사를 붙여요.
export function subjectParticle(name: string): string {
  const text = name.replace(/\([^)]*\)$/, "").trim();
  const last = text.charCodeAt(text.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0 ? "이" : "가";
}
