import { z } from 'zod/v3';

export const VersionInfoSchema = z.object({
  Version: z.string(),
  Time: z.string().optional(),
  Origin: z
    .object({
      VCS: z.string().optional(),
      URL: z.string().optional(),
      Hash: z.string().optional(),
      Ref: z.string().optional(),
    })
    .optional(),
});
