import { HuggingFaceStream, StreamingTextResponse } from 'ai';
import { HuggingFaceInferenceEmbeddings } from 'langchain/embeddings/hf';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { NextRequest } from 'next/server';

import { HF_TOKEN } from '@/config/envs';
import { db } from '@/db';
import { pinecone } from '@/lib/pinecone';
import { SendMessageValidator } from '@/lib/validators/SendMessageValidator';
import { HfInference } from '@huggingface/inference';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';

// Create a new HuggingFace Inference instance
const Hf = new HfInference(HF_TOKEN);

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

    const formattedPrevMessages = prevMessages.map((msg) => ({
      role: msg.isUserMessage ? ('user' as const) : ('assistant' as const),
      content: msg.text,
    }));

    const builtPrompt = `<|assistant|>Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. <|endoftext|>
    <|prompter|>If you don't know the answer, just say that you don't know, don't try to make up an answer.<|endoftext|>
  
          PREVIOUS CONVERSATION:<|endoftext|>
          ${formattedPrevMessages.map(
            (mes: {
              content: string;
              role: 'user' | 'system' | 'assistant';
            }) => {
              if (mes.role === 'user')
                return `<|prompter|>${mes.content}<|endoftext|>`;
              return `<|assistant|>${mes.content}<|endoftext|>`;
            },
          )}
  
          <|prompter|>CONTEXT:
          ${results.map((r) => r.pageContent).join('\n\n')}
  
          USER INPUT: ${message}<|endoftext|><|assistant|>`;

    const response = await Hf.textGenerationStream({
      model: 'OpenAssistant/oasst-sft-4-pythia-12b-epoch-3.5',
      inputs: builtPrompt,
      parameters: {
        max_new_tokens: 200,
        // @ts-ignore (this is a valid parameter specifically in OpenAssistant models)
        typical_p: 0.2,
        repetition_penalty: 1,
        truncate: 1000,
        return_full_text: false,
      },
    });

    // Convert the response into a friendly text-stream
    const stream = HuggingFaceStream(response, {
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
