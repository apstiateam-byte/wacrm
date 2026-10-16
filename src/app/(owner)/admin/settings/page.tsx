import { AdminSettingsView } from "@/components/admin/admin-console";
import { PageHeader } from "@/components/owner/ui";

export const metadata = { title: "Settings · Owner console" };

export default function OwnerSettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Billing switches, trial length, GST and Razorpay connection." />
      <AdminSettingsView />
    </div>
  );
}
