if (!process.env.HF_TOKEN) throw new Error('HF_TOKEN is required.');
if (!process.env.PINECONE_API_KEY)
  throw new Error('PINECONE_API_KEY is required.');
if (!process.env.PINECONE_ENV) throw new Error('PINECONE_ENV is required.');
if (!process.env.STRIPE_API_KEY) throw new Error('STRIPE_API_KEY is required.');

export const HF_TOKEN = process.env.HF_TOKEN;
export const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
export const PINECONE_ENV = process.env.PINECONE_ENV;
export const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
