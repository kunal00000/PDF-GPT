import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { publicProcedure, router } from './trpc';
import { TRPCError } from '@trpc/server';

export const appRouter = router({
  authCallback: publicProcedure.query(() => {
    const { getUser } = getKindeServerSession();
    const user = getUser();

    if (!user.id || !user.email) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found' });
    }

    // check if the user is in the database

    return { success: true };
  })
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
