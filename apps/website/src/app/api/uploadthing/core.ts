import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { HuggingFaceInferenceEmbeddings } from 'langchain/embeddings/hf';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { type FileRouter, createUploadthing } from 'uploadthing/next';

import { HF_TOKEN } from '@/config/envs';
import { db } from '@/db';
import { pinecone } from '@/lib/pinecone';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: '4MB' } })
    .middleware(async ({ req }) => {
      const { getUser } = getKindeServerSession();
      const user = getUser();

      if (!user || !user.id) throw new Error(`Unauthorized`);

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: `https://uploadthing-prod.s3.us-west-2.amazonaws.com/${file.key}`,
          uploadStatus: 'PROCESSING',
        },
      });

      try {
        const response = await fetch(
          `https://uploadthing-prod.s3.us-west-2.amazonaws.com/${file.key}`,
        );

        const blob = await response.blob();

        const loader = new PDFLoader(blob);

        const pageLevelDocs = await loader.load();

        pageLevelDocs.forEach((pageLevelDoc) => {
          pageLevelDoc.metadata = {
            ...pageLevelDoc.metadata,
            fileId: createdFile.id,
          };
        });

        const pagesAmt = pageLevelDocs.length; // pages count

        // vectorize and index entire document
        const pineconeIndex = await pinecone.Index('docuconvo');

        const embeddings = new HuggingFaceInferenceEmbeddings({
          model: 'sentence-transformers/all-MiniLM-L6-v2',
          apiKey: HF_TOKEN,
        });

        await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
          pineconeIndex,
        });

        // set upload status to failed
        await db.file.update({
          data: {
            uploadStatus: 'SUCCESS',
          },
          where: {
            id: createdFile.id,
          },
        });
      } catch (err) {
        console.error(err);

        // set upload status to failed
        await db.file.update({
          data: {
            uploadStatus: 'FAILED',
          },
          where: {
            id: createdFile.id,
          },
        });
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
