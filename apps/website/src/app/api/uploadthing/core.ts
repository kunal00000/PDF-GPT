import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { type FileRouter, createUploadthing } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ "application/pdf": { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {
      const { getUser } = getKindeServerSession();
      const user = getUser();

      if (!user || !user.id) throw new Error(`Unauthorized`);

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
