import { z } from "zod";

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const invitePortalUserSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  jobTitle: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type InvitePortalUserInput = z.infer<typeof invitePortalUserSchema>;

export const acceptInvitationSchema = z
  .object({
    token: z.string().trim().min(1, "Invalid invitation link"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
