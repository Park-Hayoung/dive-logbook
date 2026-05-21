import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type BoardCommentAuthor = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
};

export type BoardComment = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  isDeleted: boolean;
  author: BoardCommentAuthor | null;
  likeCount: number;
  myLiked: boolean;
  replies: BoardComment[];
};

type CommentRow = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  deleted_at: string | null;
  author:
    | { id: string; nickname: string; profile_image_url: string | null }
    | null;
  board_comment_likes: { count: number }[] | null;
};

// 댓글 트리 빌드 — 1단까지만. 깊이 강제는 DB 트리거가 함.
function toTree(
  rows: CommentRow[],
  myLikedSet: Set<string>,
): BoardComment[] {
  const toItem = (r: CommentRow): BoardComment => ({
    id: r.id,
    postId: r.post_id,
    parentCommentId: r.parent_comment_id,
    content: r.deleted_at ? "삭제된 댓글입니다." : r.content,
    createdAt: r.created_at,
    isDeleted: !!r.deleted_at,
    author: r.deleted_at
      ? null
      : r.author
        ? {
            id: r.author.id,
            nickname: r.author.nickname,
            profileImageUrl: r.author.profile_image_url,
          }
        : null,
    likeCount: r.board_comment_likes?.[0]?.count ?? 0,
    myLiked: myLikedSet.has(r.id),
    replies: [],
  });

  const byId = new Map<string, BoardComment>();
  const roots: BoardComment[] = [];

  for (const r of rows) {
    byId.set(r.id, toItem(r));
  }
  for (const r of rows) {
    const item = byId.get(r.id)!;
    if (r.parent_comment_id) {
      const parent = byId.get(r.parent_comment_id);
      if (parent) parent.replies.push(item);
      else roots.push(item); // parent not visible — show as root (방어적)
    } else {
      roots.push(item);
    }
  }

  // 삭제된 루트 + 자식 0 → 보이지 말자 (clutter 줄임).
  return roots.filter((r) => !(r.isDeleted && r.replies.length === 0));
}

export function useBoardComments(
  postId: string | undefined,
  currentUserId: string | undefined,
) {
  return useQuery({
    queryKey: ["board-comments", postId, currentUserId ?? "anon"],
    enabled: !!postId,
    queryFn: async (): Promise<BoardComment[]> => {
      const { data, error } = await supabase
        .from("board_comments")
        .select(
          `id, post_id, parent_comment_id, content, created_at, deleted_at,
           author:profiles!author_id(id, nickname, profile_image_url),
           board_comment_likes(count)`,
        )
        .eq("post_id", postId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as CommentRow[];

      let myLikedSet = new Set<string>();
      if (currentUserId && rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: mine } = await supabase
          .from("board_comment_likes")
          .select("comment_id")
          .eq("user_id", currentUserId)
          .in("comment_id", ids);
        myLikedSet = new Set(
          ((mine ?? []) as { comment_id: string }[]).map((r) => r.comment_id),
        );
      }

      return toTree(rows, myLikedSet);
    },
  });
}

// 댓글/대댓글 작성. parentCommentId 가 있으면 대댓글 (DB 트리거가 깊이=1 강제).
export function useAddBoardComment(
  postId: string | undefined,
  currentUserId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      content: string;
      parentCommentId?: string | null;
    }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      if (!postId) throw new Error("postId is required");
      const { error } = await supabase.from("board_comments").insert({
        post_id: postId,
        author_id: currentUserId,
        parent_comment_id: input.parentCommentId ?? null,
        content: input.content,
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-comments", postId] });
      qc.invalidateQueries({ queryKey: ["board-post", postId] });
      qc.invalidateQueries({ queryKey: ["board-posts"] });
    },
  });
}

export function useUpdateBoardComment(
  postId: string | undefined,
  currentUserId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { commentId: string; content: string }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase
        .from("board_comments")
        .update({
          content: input.content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.commentId)
        .eq("author_id", currentUserId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-comments", postId] });
    },
  });
}

export function useDeleteBoardComment(
  postId: string | undefined,
  currentUserId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase
        .from("board_comments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("author_id", currentUserId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-comments", postId] });
      qc.invalidateQueries({ queryKey: ["board-post", postId] });
      qc.invalidateQueries({ queryKey: ["board-posts"] });
    },
  });
}

export function useToggleBoardCommentLike(
  postId: string | undefined,
  currentUserId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      commentId: string;
      currentlyLiked: boolean;
    }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      if (input.currentlyLiked) {
        const { error } = await supabase
          .from("board_comment_likes")
          .delete()
          .eq("comment_id", input.commentId)
          .eq("user_id", currentUserId);
        if (error) throw new Error(error.message || JSON.stringify(error));
      } else {
        const { error } = await supabase
          .from("board_comment_likes")
          .insert({ comment_id: input.commentId, user_id: currentUserId });
        if (error) throw new Error(error.message || JSON.stringify(error));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-comments", postId] });
    },
  });
}
