import { HuggingFaceInferenceEmbeddings } from 'langchain/embeddings/hf';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { NextRequest } from 'next/server';

import { HF_TOKEN } from '@/config/envs';
import { db } from '@/db';
import { pinecone } from '@/lib/pinecone';
import { SendMessageValidator } from '@/lib/validators/SendMessageValidator';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';

export const POST = async (req: NextRequest) => {
  // endpoint for asking a question to a pdf file

  const body = await req.json();

  const { getUser } = getKindeServerSession();
  const user = await getUser();

  const { id: userId } = user;

  if (!userId) throw new Response('Unauthorized', { status: 401 });

  const { fileId, message } = SendMessageValidator.parse(body);

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  });

  if (!file) throw new Response('Not Found', { status: 404 });

  // create message into postgres db (neon.tech)
  await db.message.create({
    data: { text: message, isUserMessage: true, userId, fileId },
  });

  // 1. vectorize incoming message
  const embeddings = new HuggingFaceInferenceEmbeddings({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    apiKey: HF_TOKEN,
  });

  const pineconeIndex = await pinecone.Index('docuconvo');

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
  });

  // 2. find similar vectors
  const result = await vectorStore.similaritySearch(message, 4, {
    fileId: file.id,
  });

  // 3. find prev 6 messages for context and format acc to roles(AI/User)
  const prevMessages = await db.message.findMany({
    where: {
      fileId,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 6,
  });

  const formattedMessages = prevMessages.map((msg) => ({
    role: msg.isUserMessage ? ('user' as const) : ('assistant' as const),
    content: msg.text,
  }));
};
