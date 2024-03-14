import { PINECONE_API_KEY, PINECONE_ENV } from '@/config/envs';
import { Pinecone } from '@pinecone-database/pinecone';

export const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
});
