import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ChatPage() {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) {
        redirect("/auth/login");
    }

    return (
        <div className="flex-1 w-full flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold">
                        Welcome to Context Blocks Chat
                    </h1>
                    <p className="text-muted-foreground">
                        Your modular AI conversation platform is ready. Chat
                        interface coming soon.
                    </p>
                </div>
            </div>
        </div>
    );
}
