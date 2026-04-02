// R2 integration: replace with POST ${process.env.NEXT_PUBLIC_API_URL}/validation_batches/{id}/messages
// Oracle signal shape matches OracleSignal type in R2/src/types (to be published as npm package)
// Eigen: transcript docs stored with index_status/embedding_status lifecycle fields on backend

export type PostMessageInput = { batchId: string; text: string };
export type PostMessageResult = { messageId: string };

export async function postMessage(input: PostMessageInput): Promise<PostMessageResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl) {
    const res = await fetch(
      `${apiUrl}/validation_batches/${input.batchId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.text }),
      },
    );
    if (!res.ok) throw new Error(`postMessage failed: ${res.status}`);
    return res.json() as Promise<PostMessageResult>;
  }

  // Dev stub: generate a local message id
  await new Promise((r) => setTimeout(r, 200));
  return { messageId: `msg_${Date.now()}` };
}
