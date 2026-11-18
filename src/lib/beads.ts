// 구슬 충전 설정 (2026-11-03 v3: 꿈은 구슬로만 사고, 모자라면 돈으로 충전)
// 사용자 변경: 900원 = 100구슬. 기존 충전 주문에 저장된 지급량은 유지해요.
// 실제 지급은 DB 함수 confirm_bead_order 가 주문 때 저장한 구슬 수로 함 → 여기를 바꿔도 이미 만든 주문은 그대로
export const BEAD_PACKS = [
  { id: "p1000", won: 900, beads: 100 },
  { id: "p3000", won: 1900, beads: 300 },
  { id: "p5000", won: 2900, beads: 500 },
] as const;
export type BeadPack = (typeof BEAD_PACKS)[number];

export function packById(id: string | null | undefined): BeadPack | undefined {
  return BEAD_PACKS.find((p) => p.id === id);
}
