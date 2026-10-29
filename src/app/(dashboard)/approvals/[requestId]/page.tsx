import { ApprovalDetails } from "@/features/approvals/components/approval-details";

export default async function ApprovalPage({ params }: PageProps<"/approvals/[requestId]">) {
  const { requestId } = await params;
  return <ApprovalDetails requestId={requestId} />;
}
