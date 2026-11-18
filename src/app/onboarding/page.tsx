import { redirect } from "next/navigation";

// 예전 두 번째 화면. 첫 화면으로 합쳐서 화면은 없고, 옛 링크(?next=…)만 첫 화면으로 넘김 (2026-11-17)
export default async function OnboardingMoved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["next", "error"]) {
    const value = sp[key];
    if (typeof value === "string") query.set(key, value);
  }
  const qs = query.toString();
  redirect(qs ? `/?${qs}` : "/");
}
