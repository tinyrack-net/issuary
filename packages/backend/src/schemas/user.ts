import z from "zod/v4";

export const UserSchema = z.object({
  id: z.string(),
})