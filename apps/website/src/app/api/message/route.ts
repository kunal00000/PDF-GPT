import { NextRequest } from 'next/server';

import { db } from '@/db';
import { SendMessageValidator } from '@/lib/SendMessageValidator';
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

  await db.message.create({
    data: { text: message, isUserMessage: true, userId, fileId },
  });
};
