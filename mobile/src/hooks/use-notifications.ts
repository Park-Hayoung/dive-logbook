import { useQuery } from "@tanstack/react-query";
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

export function useRecentNotificationCount(userId: string | undefined) {
  const q = useNotifications(userId);
  const since = Date.now() - SEVEN_DAYS_MS;
  const recent =
    q.data?.filter((n) => new Date(n.createdAt).getTime() >= since) ?? [];
  return { count: recent.length, ...q };
}
