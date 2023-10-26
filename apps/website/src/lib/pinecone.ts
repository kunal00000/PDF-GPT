import { Pinecone } from '@pinecone-database/pinecone';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENV = process.env.PINECONE_ENV;
if (!PINECONE_API_KEY || !PINECONE_ENV) {
  throw new Error('Pineconde API key is required.');
}

export const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
  environment: PINECONE_ENV,
});
