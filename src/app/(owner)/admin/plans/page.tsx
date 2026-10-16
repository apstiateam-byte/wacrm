import { AdminPlansView } from "@/components/admin/admin-console";
import { PageHeader } from "@/components/owner/ui";

export const metadata = { title: "Plans & pricing · Owner console" };

export default function OwnerPlansPage() {
  return (
    <div>
      <PageHeader
        title="Plans & pricing"
        description="Prices, limits and features for each plan. Price changes apply to new checkouts; existing subscribers keep their price until they switch."
      />
      <AdminPlansView />
    </div>
  );
}
