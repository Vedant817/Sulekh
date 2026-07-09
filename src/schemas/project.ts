import { z } from "zod";

/** Target listing board. BSE SME in v1; architecture ready for NSE Emerge. */
export const targetBoardSchema = z.enum(["BSE_SME", "NSE_EMERGE"]);
export type TargetBoard = z.infer<typeof targetBoardSchema>;

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the project a name of at least 2 characters")
    .max(160, "Keep the name under 160 characters"),
  targetBoard: targetBoardSchema.default("BSE_SME"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
