import { describe, it, expect } from "vitest";

type Role = "owner" | "editor" | "viewer";
type M = { user_id: string; role: Role };

/** Mirror of the UI guard in InvitesManager.changeRole. */
const canChangeRole = (members: M[], targetUserId: string, newRole: Role) => {
  const target = members.find((m) => m.user_id === targetUserId);
  if (!target) return false;
  if (target.role === newRole) return false;
  const ownerCount = members.filter((m) => m.role === "owner").length;
  if (target.role === "owner" && newRole !== "owner" && ownerCount <= 1) return false;
  return true;
};

describe("project role change guard", () => {
  it("blocks demoting the last owner", () => {
    const members: M[] = [
      { user_id: "a", role: "owner" },
      { user_id: "b", role: "editor" },
    ];
    expect(canChangeRole(members, "a", "editor")).toBe(false);
  });

  it("allows demoting an owner when another owner exists", () => {
    const members: M[] = [
      { user_id: "a", role: "owner" },
      { user_id: "b", role: "owner" },
    ];
    expect(canChangeRole(members, "a", "editor")).toBe(true);
  });

  it("allows promoting an editor to owner", () => {
    const members: M[] = [
      { user_id: "a", role: "owner" },
      { user_id: "b", role: "editor" },
    ];
    expect(canChangeRole(members, "b", "owner")).toBe(true);
  });
});
