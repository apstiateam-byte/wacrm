import { CustomerDetail } from "@/components/owner/customer-detail";

export const metadata = { title: "Customer · Owner console" };

export default async function OwnerCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}
