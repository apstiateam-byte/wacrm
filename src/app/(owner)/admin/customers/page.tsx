import { Suspense } from "react";

import { CustomersList } from "@/components/owner/customers-list";
import { LoadingBlock } from "@/components/owner/ui";

export const metadata = { title: "Customers · Owner console" };

export default function OwnerCustomersPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CustomersList />
    </Suspense>
  );
}
