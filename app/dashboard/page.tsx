export default function DashboardPage() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <div className="flex-1 flex flex-col justify-center items-center max-w-4xl p-5">
          <div className="text-center space-y-6">
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
              Context Blocks Chat
            </h1>
            <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl">
              Modular, branchable AI conversations. Branch, remix, and merge
              context blocks to explore ideas in parallel.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
