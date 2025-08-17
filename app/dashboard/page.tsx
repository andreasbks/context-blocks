import { currentUser } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <div className="flex-1 flex flex-col justify-center items-center max-w-4xl p-5">
      <div className="text-center space-y-6">
        <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl">
          This is an authenticated route. You are:{" "}
          {` ${user?.firstName} ${user?.lastName} ${user?.emailAddresses[0].emailAddress}`}
        </p>
      </div>
    </div>
  );
}
