import { GoogleGenerativeAIStream, StreamingTextResponse } from 'ai';
import { NextRequest } from 'next/server';

import { GEMINI_API_KEY } from '@/config/envs';
import { db } from '@/db';
import { pinecone } from '@/lib/pinecone';
import { SendMessageValidator } from '@/lib/validators/SendMessageValidator';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PineconeStore } from '@langchain/pinecone';

// IMPORTANT! Set the runtime to edge
// export const runtime = 'edge';

export const POST = async (req: NextRequest) => {
  try {
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
      data: { text: message, isUserMessage: true, fileId },
    });

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // 1. vectorize incoming message
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: GEMINI_API_KEY,
      modelName: 'embedding-001',
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    });

    const pineconeIndex = await pinecone.Index('docs');

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
    });

    // 2. find similar vectors
    const results = await vectorStore.similaritySearch(message, 4, {
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

    const formattedPrevMessages = prevMessages.map(
      (msg: {
        id: string;
        text: string;
        isUserMessage: boolean;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        fileId: string | null;
      }) => ({
        role: msg.isUserMessage ? ('user' as const) : ('assistant' as const),
        content: msg.text,
      }),
    );

    const builtPrompt = `Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
  
          PREVIOUS CONVERSATION:
          ${formattedPrevMessages.map(
            (mes: {
              content: string;
              role: 'user' | 'system' | 'assistant';
            }) => {
              if (mes.role === 'user')
                return `<|user|>${mes.content}<|endoftext|>`;
              return `<|assistant|>${mes.content}<|endoftext|>`;
            },
          )}
  
          CONTEXT:
          ${results.map((r) => r.pageContent).join('\n\n')}
  
          USER INPUT: ${message}`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
    const response = await model.generateContentStream(builtPrompt);

    // Convert the response into a friendly text-stream
    const stream = GoogleGenerativeAIStream(response, {
      onStart: async () => {
        console.log('Start');
      },
      onCompletion: async (completion: string) => {
        console.log(completion);

        await db.message.create({
          data: {
            text: completion,
            isUserMessage: false,
            userId,
            fileId,
          },
        });
      },
    });

    // Respond with the stream
    return new StreamingTextResponse(stream);
  } catch (e) {
    console.log(e);
  }
};
