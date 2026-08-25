import { SessionChatReplay } from "@/components/session-chat-replay";

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  return <SessionChatReplay sessionId={params.id} />;
}
