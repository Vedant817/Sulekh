import { z } from "zod";

/** Roles a user may self-select at sign-up (admin is assigned out-of-band). */
export const signupRoleSchema = z.enum(["promoter", "intermediary"]);
export type SignupRole = z.infer<typeof signupRoleSchema>;

export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signupSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1, "Enter your name"),
  role: signupRoleSchema,
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
