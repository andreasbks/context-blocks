import { prisma } from "./lib/db";

await prisma.user.create({
  data: {
    clerkUserId: "user_2t34567890",
    email: "test@test.com",
    firstName: "John",
    lastName: "Doe",
  },
});
