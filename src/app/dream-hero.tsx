import { GradeBadge } from "@/app/market/listing-card";

export default function DreamHero({ grade, score }: {
  grade: string;
  score?: number | null;
}) {
  return (
    <div className="flex items-center gap-2 py-3">
      <GradeBadge code={grade} />
      {score != null && <span className="text-sm font-bold">{score}점</span>}
    </div>
  );
}
