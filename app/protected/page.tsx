import { redirect } from "next/navigation";

export default function ProtectedPage() {
    // Redirect to chat page instead
    redirect("/chat");
}
