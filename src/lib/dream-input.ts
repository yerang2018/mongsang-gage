import { z } from "zod";
import { isValidBirthDate } from "./birth-date";

export const DreamInputSchema = z.object({
  dreamText: z.string().trim().min(10, "꿈 내용을 조금만 더 적어 주세요 (10자 이상).").max(2000, "꿈 내용은 2000자 이내로 줄여 주세요."),
  excludedScenes: z.string().trim().max(200).optional().default(""),
  birthDate: z.string().trim().refine((value) => isValidBirthDate(value), "생년월일을 확인해 주세요.").optional().default(""),
  pledge: z.literal(true, { error: "판매 서약에 체크해 주세요." }),
  visibility: z.enum(["private", "shared"]).default("private"),
});

export type DreamRequestInput = z.infer<typeof DreamInputSchema>;
