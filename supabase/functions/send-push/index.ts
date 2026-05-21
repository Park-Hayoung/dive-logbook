// Supabase Edge Function: send-push
//
// 호출 경로: Supabase Database Webhooks (대시보드에서 설정)
//   * board_comments INSERT → 글 작성자(루트댓글) / 부모 댓글 작성자(대댓글) 에게 푸시
//   * board_posts INSERT (category = 'notice') → 모든 토큰 보유 사용자에게 브로드캐스트
//
// 페이로드 (Supabase webhook 표준):
//   {
//     type: "INSERT",
//     table: "board_comments" | "board_posts",
//     schema: "public",
//     record: { ...row },
//     old_record: null
//   }
//
// 토큰 보유 사용자 조회 + Expo Push API 호출. 무효 토큰은 정리.
//
// 배포:
//   cd dive-logbook
//   npx supabase functions deploy send-push --no-verify-jwt
//   (webhook 이 service-role JWT 없이 호출하므로 --no-verify-jwt)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old_record: any;
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  channelId?: string;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (payload.type !== "INSERT") {
    return new Response(JSON.stringify({ skipped: "not an insert" }), {
      status: 200,
    });
  }

  try {
    if (payload.table === "board_comments") {
      await handleCommentInsert(payload.record);
    } else if (payload.table === "board_posts") {
      await handlePostInsert(payload.record);
    } else {
      return new Response(
        JSON.stringify({ skipped: `unhandled table: ${payload.table}` }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("[send-push] handler error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Handlers
// ────────────────────────────────────────────────────────────────────────────

async function handleCommentInsert(comment: {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  content: string;
}) {
  // 알림 대상 결정 — 대댓글이면 부모 댓글 작성자, 루트댓글이면 글 작성자.
  let targetUserId: string | null = null;
  let titlePrefix = "";

  if (comment.parent_comment_id) {
    const { data: parent } = await supabase
      .from("board_comments")
      .select("author_id")
      .eq("id", comment.parent_comment_id)
      .maybeSingle();
    targetUserId = parent?.author_id ?? null;
    titlePrefix = "내 댓글에 답글";
  } else {
    const { data: post } = await supabase
      .from("board_posts")
      .select("author_id, title")
      .eq("id", comment.post_id)
      .maybeSingle();
    targetUserId = post?.author_id ?? null;
    titlePrefix = post?.title ? `📝 ${truncate(post.title, 30)}` : "내 글에 댓글";
  }

  if (!targetUserId || targetUserId === comment.author_id) return;

  const authorNickname = await fetchNickname(comment.author_id);
  await sendToUser(targetUserId, {
    title: titlePrefix,
    body: `${authorNickname}: ${truncate(comment.content, 80)}`,
    data: { url: `/board/${comment.post_id}` },
  });
}

async function handlePostInsert(post: {
  id: string;
  author_id: string;
  category: string;
  title: string;
  content: string;
}) {
  // 공지 카테고리만 브로드캐스트.
  if (post.category !== "notice") return;

  const { data: tokens } = await supabase
    .from("profile_push_tokens")
    .select("token, user_id");
  if (!tokens || tokens.length === 0) return;

  const messages: ExpoMessage[] = tokens
    .filter((t) => t.user_id !== post.author_id) // 본인 제외
    .map((t) => ({
      to: t.token,
      title: `📢 공지: ${truncate(post.title, 40)}`,
      body: truncate(post.content, 100),
      data: { url: `/board/${post.id}` },
      sound: "default",
      channelId: "default",
    }));

  await sendExpoBatch(messages);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function sendToUser(
  userId: string,
  msg: Omit<ExpoMessage, "to" | "sound" | "channelId">,
): Promise<void> {
  const { data: tokens } = await supabase
    .from("profile_push_tokens")
    .select("token")
    .eq("user_id", userId);
  if (!tokens || tokens.length === 0) return;

  const messages: ExpoMessage[] = tokens.map((t) => ({
    to: t.token,
    title: msg.title,
    body: msg.body,
    data: msg.data,
    sound: "default",
    channelId: "default",
  }));

  await sendExpoBatch(messages);
}

// Expo 는 한 번에 최대 100개. 큰 묶음은 청크로 쪼개서 보냄.
async function sendExpoBatch(messages: ExpoMessage[]): Promise<void> {
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.warn("[send-push] expo API failed:", res.status, await res.text());
      continue;
    }
    const json = (await res.json()) as { data: ExpoTicket[] };
    await cleanupInvalidTokens(chunk, json.data ?? []);
  }
}

// 토큰 무효(DeviceNotRegistered) 시 DB 에서 정리.
async function cleanupInvalidTokens(
  sent: ExpoMessage[],
  tickets: ExpoTicket[],
): Promise<void> {
  const invalidTokens: string[] = [];
  tickets.forEach((t, idx) => {
    if (t.status === "error" && t.details?.error === "DeviceNotRegistered") {
      invalidTokens.push(sent[idx].to);
    }
  });
  if (invalidTokens.length > 0) {
    await supabase
      .from("profile_push_tokens")
      .delete()
      .in("token", invalidTokens);
  }
}

async function fetchNickname(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .maybeSingle();
  return data?.nickname ?? "(알수없음)";
}

function truncate(s: string | null, max: number): string {
  if (!s) return "";
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
