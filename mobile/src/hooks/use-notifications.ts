import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/src/services/supabase";

export type NotificationKind =
  | "like"
  | "comment"
  | "follow"
  | "team_join_request";

export type Notification = {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  actor: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
  } | null;
  // type-specific payload
  feedId?: string;
  feedSnippet?: string;
  commentContent?: string;
  teamId?: string;
  teamName?: string;
};

const LIMIT_PER_KIND = 30;
const TOTAL_LIMIT = 50;

const truncate = (s: string | null, n: number): string => {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n).trim()}…` : s;
};

const wrap = (e: { message?: string } | null): never => {
  throw new Error(e?.message || JSON.stringify(e));
};

type ProfileLite = {
  id: string;
  nickname: string;
  profile_image_url: string | null;
};

type LikeRow = {
  feed_id: string;
  user_id: string;
  created_at: string;
  user: ProfileLite | null;
  feed: { id: string; content: string | null; author_id: string } | null;
};

type CommentRow = {
  id: string;
  feed_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: ProfileLite | null;
  feed: { id: string; content: string | null; author_id: string } | null;
};

type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at: string;
  follower: ProfileLite | null;
};

type TeamRequestRow = {
  team_id: string;
  user_id: string;
  joined_at: string;
  user: ProfileLite | null;
  team: { id: string; name: string; leader_id: string } | null;
};

const mapActor = (p: ProfileLite | null) =>
  p
    ? {
        id: p.id,
        nickname: p.nickname,
        profileImageUrl: p.profile_image_url,
      }
    : null;

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Notification[]> => {
      // Run all four lookups in parallel.
      const [likesResp, commentsResp, followsResp, teamReqResp] =
        await Promise.all([
          supabase
            .from("feed_likes")
            .select(
              `feed_id, user_id, created_at,
               user:profiles!user_id(id, nickname, profile_image_url),
               feed:feeds!feed_id(id, content, author_id)`,
            )
            .order("created_at", { ascending: false })
            .limit(LIMIT_PER_KIND),
          supabase
            .from("feed_comments")
            .select(
              `id, feed_id, author_id, content, created_at,
               author:profiles!author_id(id, nickname, profile_image_url),
               feed:feeds!feed_id(id, content, author_id)`,
            )
            .order("created_at", { ascending: false })
            .limit(LIMIT_PER_KIND),
          supabase
            .from("follows")
            .select(
              `follower_id, following_id, created_at,
               follower:profiles!follower_id(id, nickname, profile_image_url)`,
            )
            .eq("following_id", userId!)
            .order("created_at", { ascending: false })
            .limit(LIMIT_PER_KIND),
          supabase
            .from("team_members")
            .select(
              `team_id, user_id, joined_at,
               user:profiles!user_id(id, nickname, profile_image_url),
               team:teams!team_id(id, name, leader_id)`,
            )
            .eq("role", "pending")
            .order("joined_at", { ascending: false })
            .limit(LIMIT_PER_KIND),
        ]);

      if (likesResp.error) wrap(likesResp.error);
      if (commentsResp.error) wrap(commentsResp.error);
      if (followsResp.error) wrap(followsResp.error);
      if (teamReqResp.error) wrap(teamReqResp.error);

      const likes = ((likesResp.data ?? []) as unknown as LikeRow[])
        .filter((r) => r.feed?.author_id === userId && r.user_id !== userId)
        .map<Notification>((r) => ({
          id: `like:${r.feed_id}:${r.user_id}`,
          kind: "like",
          createdAt: r.created_at,
          actor: mapActor(r.user),
          feedId: r.feed_id,
          feedSnippet: truncate(r.feed?.content ?? null, 40),
        }));

      const comments = (
        (commentsResp.data ?? []) as unknown as CommentRow[]
      )
        .filter((r) => r.feed?.author_id === userId && r.author_id !== userId)
        .map<Notification>((r) => ({
          id: `comment:${r.id}`,
          kind: "comment",
          createdAt: r.created_at,
          actor: mapActor(r.author),
          feedId: r.feed_id,
          feedSnippet: truncate(r.feed?.content ?? null, 30),
          commentContent: truncate(r.content, 60),
        }));

      const follows = ((followsResp.data ?? []) as unknown as FollowRow[]).map<Notification>(
        (r) => ({
          id: `follow:${r.follower_id}`,
          kind: "follow",
          createdAt: r.created_at,
          actor: mapActor(r.follower),
        }),
      );

      const teamRequests = (
        (teamReqResp.data ?? []) as unknown as TeamRequestRow[]
      )
        .filter((r) => r.team?.leader_id === userId && r.user_id !== userId)
        .map<Notification>((r) => ({
          id: `team_join:${r.team_id}:${r.user_id}`,
          kind: "team_join_request",
          createdAt: r.joined_at,
          actor: mapActor(r.user),
          teamId: r.team_id,
          teamName: r.team?.name ?? "팀",
        }));

      const merged = [...likes, ...comments, ...follows, ...teamRequests].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return merged.slice(0, TOTAL_LIMIT);
    },
  });
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// 누적 dismissed id 캡 — 같은 id 가 다시 잡히는 걸 방지하기 위해 보관하지만 무한정
// 늘어나면 안 됨. dismiss-all 호출 시 id 목록은 비우므로 일반적인 사용에선 가득 찰
// 일이 거의 없다.
const DISMISSED_CAP = 200;

// 알림 테이블에 read 컬럼이 없어서, 사용자의 dismiss 액션을 디바이스에 저장한다:
//   ids       — 개별 스와이프-삭제로 숨긴 알림 id 들 (FIFO, 200개 cap)
//   lastSeenAt — "모두 읽음" 누른 시각. 그 이전 알림은 모두 숨김 처리.
// 첫 실행으로 lastSeenAt 이 null 이면 7일 컷 폴백 — 첫 진입에서 99+ 압도 방지.
const dismissalKey = (userId: string) => `notifications:dismissals:${userId}`;

export type NotificationDismissals = {
  ids: string[];
  lastSeenAt: string | null;
};

const emptyDismissals: NotificationDismissals = { ids: [], lastSeenAt: null };

const readDismissals = async (
  userId: string,
): Promise<NotificationDismissals> => {
  const raw = await AsyncStorage.getItem(dismissalKey(userId));
  if (!raw) return emptyDismissals;
  try {
    const parsed = JSON.parse(raw);
    return {
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((x: unknown) => typeof x === "string") : [],
      lastSeenAt: typeof parsed.lastSeenAt === "string" ? parsed.lastSeenAt : null,
    };
  } catch {
    return emptyDismissals;
  }
};

const writeDismissals = (userId: string, d: NotificationDismissals) =>
  AsyncStorage.setItem(dismissalKey(userId), JSON.stringify(d));

export function useNotificationDismissals(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications-dismissals", userId],
    enabled: !!userId,
    queryFn: () => readDismissals(userId!),
  });
}

export function useDismissNotification(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) return;
      const cur = await readDismissals(userId);
      if (cur.ids.includes(id)) return;
      const next = [...cur.ids, id];
      // FIFO cap
      const trimmed = next.length > DISMISSED_CAP ? next.slice(-DISMISSED_CAP) : next;
      await writeDismissals(userId, { ...cur, ids: trimmed });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-dismissals", userId] });
    },
  });
}

export function useDismissAllNotifications(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) return;
      // lastSeenAt 가 모든 ids 를 덮으므로 명시 ids 는 비워도 안전.
      await writeDismissals(userId, {
        ids: [],
        lastSeenAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-dismissals", userId] });
    },
  });
}

// 원본 알림 + dismissals 를 합쳐서 화면/카운트 양쪽이 같은 가시 목록을 사용하도록.
const applyDismissals = (
  notifications: Notification[] | undefined,
  d: NotificationDismissals | undefined,
): Notification[] => {
  if (!notifications) return [];
  const ids = new Set(d?.ids ?? []);
  // lastSeenAt 가 없으면 7일 컷 폴백.
  const cutoff = d?.lastSeenAt
    ? new Date(d.lastSeenAt).getTime()
    : Date.now() - SEVEN_DAYS_MS;
  return notifications.filter(
    (n) => !ids.has(n.id) && new Date(n.createdAt).getTime() > cutoff,
  );
};

// 화면용: dismiss 가 반영된 가시 알림 목록.
export function useVisibleNotifications(userId: string | undefined) {
  const q = useNotifications(userId);
  const dq = useNotificationDismissals(userId);
  const data = applyDismissals(q.data, dq.data);
  return { ...q, data };
}

export function useRecentNotificationCount(userId: string | undefined) {
  const q = useNotifications(userId);
  const dq = useNotificationDismissals(userId);
  const visible = applyDismissals(q.data, dq.data);
  return { count: visible.length, ...q };
}
