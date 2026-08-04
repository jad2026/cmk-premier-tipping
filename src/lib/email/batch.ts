import { Resend } from "resend";

export type EmailMessage = { from: string; to: string; subject: string; html: string };

const MAX_BATCH_SIZE = 100;
const MAX_RETRIES = 4;

export async function sendEmailBatch(
  messages: EmailMessage[],
  tag: string,
): Promise<{ sent: number; failed: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, failed: messages.length };

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const chunk = messages.slice(i, i + MAX_BATCH_SIZE);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await resend.batch.send(chunk);

        if (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 429 && attempt < MAX_RETRIES) {
            const delay = Math.min(1000 * 2 ** (attempt + 1), 30_000);
            console.warn(`[${tag}] 429 on batch ${i / MAX_BATCH_SIZE + 1}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          console.error(`[${tag}] Batch ${i / MAX_BATCH_SIZE + 1} failed:`, error);
          failed += chunk.length;
          break;
        }

        const ids = (data as { data: { id: string }[] })?.data ?? [];
        sent += ids.length;
        failed += chunk.length - ids.length;
        break;
      } catch (e: unknown) {
        const statusCode = (e as { statusCode?: number })?.statusCode;
        if (statusCode === 429 && attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** (attempt + 1), 30_000);
          console.warn(`[${tag}] 429 (thrown) on batch ${i / MAX_BATCH_SIZE + 1}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        console.error(`[${tag}] Batch ${i / MAX_BATCH_SIZE + 1} error:`, e);
        failed += chunk.length;
        break;
      }
    }
  }

  console.log(`[${tag}] Batch send complete: ${sent} sent, ${failed} failed (${messages.length} total across ${Math.ceil(messages.length / MAX_BATCH_SIZE)} batches)`);
  return { sent, failed };
}
