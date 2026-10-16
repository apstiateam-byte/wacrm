import { Suspense } from "react";

import { EventsList } from "@/components/owner/events-list";
import { LoadingBlock } from "@/components/owner/ui";

export const metadata = { title: "Webhook events · Owner console" };

export default function OwnerEventsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <EventsList />
    </Suspense>
  );
}
