import { z } from 'zod';

export const reviewerRoles = ['Warranty Supervisor', 'Warranty Lead Roughneck'] as const;
export const profileSettingsSchema = z.object({
  login_id: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Use letters, numbers, dots, underscores or hyphens.'),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
});