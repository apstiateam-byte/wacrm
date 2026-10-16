import { Suspense } from "react";

import { PaymentsList } from "@/components/owner/payments-list";
import { LoadingBlock } from "@/components/owner/ui";

export const metadata = { title: "Payments · Owner console" };

export default function OwnerPaymentsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PaymentsList />
    </Suspense>
  );
}
