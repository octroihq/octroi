/**
 * A fake Nano node that answers `block_info` from the recorded replies, so the
 * suite runs with no network — same rule as CI everywhere else in the repo.
 */
import fixtures from "./fixtures/block-info.json" with { type: "json" };

export type Reply = Record<string, unknown>;

export const SEND = fixtures.stateSend;
export const RECEIVE = fixtures.stateReceive;
export const LEGACY_SEND = fixtures.legacySend;
export const NOT_FOUND = fixtures.notFound;

/** The account the recorded state send paid, and the one it came from. */
export const PAY_TO = SEND.reply.contents.link_as_account;
export const PAYER = SEND.reply.block_account;
/** 50 XNO, in raw. */
export const SEND_AMOUNT = BigInt(SEND.reply.amount);
/** Unix ms shortly after the recorded send was first seen by the node. */
export const SEND_SEEN_MS = Number(SEND.reply.local_timestamp) * 1_000;

export interface FakeNode {
  fetch: typeof fetch;
  /** Every JSON body the adapter posted. */
  readonly requests: Reply[];
}

type Answer = Reply | { status: number; text: string } | Error;

/** Answer by hash; `answers` overrides or adds to the recorded replies. */
export function fakeNode(answers: Record<string, Answer> = {}): FakeNode {
  const requests: Reply[] = [];
  const table: Record<string, Answer> = {
    [SEND.hash]: SEND.reply,
    [RECEIVE.hash]: RECEIVE.reply,
    [LEGACY_SEND.hash]: LEGACY_SEND.reply,
    ...answers,
  };

  const impl = async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Reply;
    requests.push(body);
    const answer = table[String(body["hash"])] ?? NOT_FOUND.reply;
    if (answer instanceof Error) throw answer;
    if ("status" in answer && "text" in answer && typeof answer.text === "string") {
      return new Response(answer.text, { status: answer.status as number });
    }
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  return { fetch: impl as unknown as typeof fetch, requests };
}

/** A copy of the recorded send with some fields replaced. */
export function sendWith(patch: Reply, contents: Reply = {}): Reply {
  return { ...SEND.reply, ...patch, contents: { ...SEND.reply.contents, ...contents } };
}
