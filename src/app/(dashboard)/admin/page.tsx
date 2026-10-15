import { AdminConsole } from "@/components/admin/admin-console";

// Platform admin console. Access is enforced by /api/admin/* (only
// users in `platform_admins`); non-admins see a "not authorised" note.
export default function AdminPage() {
  return <AdminConsole />;
}
