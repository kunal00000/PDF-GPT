import { AppRouter } from '@/trpc';
import { inferRouterOutputs } from '@trpc/server';

type RouterOutput = inferRouterOutputs<AppRouter>;

export type UserFile = RouterOutput['getUserFiles'][0];
