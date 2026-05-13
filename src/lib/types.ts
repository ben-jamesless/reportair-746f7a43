/**
 * Shared domain types used across multiple components.
 */

export type GuestNote = {
  id: string;
  photo_id?: string;
  guest_name: string;
  guest_email?: string | null;
  body: string;
  created_at: string;
};
