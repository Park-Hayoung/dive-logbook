import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

// 마이그레이션 024_board.sql 의 board_category enum 과 1:1 대응.
export type BoardCategory =
  | "free"
  | "question"
  | "review"
  | "gear"
  | "meetup"
  | "notice";

export type BoardCategoryFilter = BoardCategory | "all";

export const BOARD_CATEGORIES: { value: BoardCategory; label: string }[] = [
  { value: "free", label: "자유" },
  { value: "question", label: "질문" },
  { value: "review", label: "후기" },
  { value: "gear", label: "장비" },
  { value: "meetup", label: "모임" },
  { value: "notice", label: "공지" },
];

// 사용자가 작성 화면에서 고를 수 있는 카테고리 — notice 는 admin 전용이라 제외.
export const BOARD_USER_CATEGORIES = BOARD_CATEGORIES.filter(
  (c) => c.value !== "notice",
);

export const BOARD_CATEGORY_LABEL: Record<BoardCategory, string> = {
  free: "자유",
  question: "질문",
  review: "후기",
  gear: "장비",
  meetup: "모임",
  notice: "공지",
};

export type BoardAuthor = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
};

export type BoardPostListItem = {
  id: string;
  authorId: string;
  category: BoardCategory;
  title: string;
  contentPreview: string;
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
  author: BoardAuthor | null;
  likeCount: number;
  commentCount: number;
  mediaCount: number;
};

export type BoardPostDetail = {
  id: string;
  authorId: string;
  category: BoardCategory;
  title: string;
  content: string;
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author: BoardAuthor | null;
  likeCount: number;
  commentCount: number;
  myLiked: boolean;
};


type ListRow = {
  id: string;
  author_id: string;
  category: BoardCategory;
  title: string;
  content: string;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  author:
    | { id: string; nickname: string; profile_image_url: string | null }
    | null;
  board_post_likes: { count: number }[] | null;
  board_comments: { count: number }[] | null;
  board_post_media: { count: number }[] | null;
};

type DetailRow = {
  id: string;
  author_id: string;
  category: BoardCategory;
  title: string;
  content: string;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  author:
    | { id: string; nickname: string; profile_image_url: string | null }
    | null;
  board_post_likes: { count: number }[] | null;
  board_comments: { count: number }[] | null;
};

const previewOf = (content: string, max = 120): string => {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

// ─────────────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────────────

// PostgREST .or() 안에서 콤마/괄호는 구분자라 escape 필요. % _ 는 ilike 와일드카드.
const escapeForOrIlike = (raw: string): string =>
  raw.replace(/[%_,()\\]/g, (ch) => `\\${ch}`);

export function useBoardPosts(
  category: BoardCategoryFilter,
  searchQuery?: string,
) {
  const trimmed = searchQuery?.trim() ?? "";
  return useQuery({
    queryKey: ["board-posts", category, trimmed],
    queryFn: async (): Promise<BoardPostListItem[]> => {
      // 검색어 있으면 먼저 닉네임 매치 author_id 들을 구한다.
      let nicknameAuthorIds: string[] = [];
      if (trimmed) {
        const escaped = escapeForOrIlike(trimmed);
        const { data: profileRows, error: profileErr } = await supabase
          .from("profiles")
          .select("id")
          .ilike("nickname", `%${escaped}%`)
          .limit(50);
        if (profileErr) throw profileErr;
        nicknameAuthorIds = (profileRows ?? []).map(
          (r) => (r as { id: string }).id,
        );
      }

      let q = supabase
        .from("board_posts")
        .select(
          `id, author_id, category, title, content, is_pinned, view_count, created_at,
           author:profiles!author_id(id, nickname, profile_image_url),
           board_post_likes(count),
           board_comments(count),
           board_post_media(count)`,
        )
        .is("deleted_at", null)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (category !== "all") {
        q = q.eq("category", category);
      }
      if (trimmed) {
        const escaped = escapeForOrIlike(trimmed);
        const orParts = [
          `title.ilike.%${escaped}%`,
          `content.ilike.%${escaped}%`,
        ];
        if (nicknameAuthorIds.length > 0) {
          orParts.push(`author_id.in.(${nicknameAuthorIds.join(",")})`);
        }
        q = q.or(orParts.join(","));
      }
      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as ListRow[];
      return rows.map((r) => ({
        id: r.id,
        authorId: r.author_id,
        category: r.category,
        title: r.title,
        contentPreview: previewOf(r.content),
        isPinned: r.is_pinned,
        viewCount: r.view_count,
        createdAt: r.created_at,
        author: r.author
          ? {
              id: r.author.id,
              nickname: r.author.nickname,
              profileImageUrl: r.author.profile_image_url,
            }
          : null,
        likeCount: r.board_post_likes?.[0]?.count ?? 0,
        commentCount: r.board_comments?.[0]?.count ?? 0,
        mediaCount: r.board_post_media?.[0]?.count ?? 0,
      }));
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────────────────────

export function useBoardPost(
  postId: string | undefined,
  currentUserId: string | undefined,
) {
  return useQuery({
    queryKey: ["board-post", postId, currentUserId ?? "anon"],
    enabled: !!postId,
    queryFn: async (): Promise<BoardPostDetail | null> => {
      const { data, error } = await supabase
        .from("board_posts")
        .select(
          `id, author_id, category, title, content, is_pinned, view_count, created_at, updated_at,
           author:profiles!author_id(id, nickname, profile_image_url),
           board_post_likes(count),
           board_comments(count)`,
        )
        .eq("id", postId!)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      let myLiked = false;
      if (currentUserId) {
        const { data: mine } = await supabase
          .from("board_post_likes")
          .select("post_id")
          .eq("post_id", postId!)
          .eq("user_id", currentUserId)
          .maybeSingle();
        myLiked = !!mine;
      }

      const r = data as DetailRow;
      return {
        id: r.id,
        authorId: r.author_id,
        category: r.category,
        title: r.title,
        content: r.content,
        isPinned: r.is_pinned,
        viewCount: r.view_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        author: r.author
          ? {
              id: r.author.id,
              nickname: r.author.nickname,
              profileImageUrl: r.author.profile_image_url,
            }
          : null,
        likeCount: r.board_post_likes?.[0]?.count ?? 0,
        commentCount: r.board_comments?.[0]?.count ?? 0,
        myLiked,
      };
    },
  });
}

// 상세 진입 시 한 번 호출. RPC (SECURITY DEFINER) 로 deleted_at 체크 + atomic 증가.
export function useIncrementBoardView() {
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.rpc("board_posts_increment_view", {
        p_post_id: postId,
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export type BoardMediaInsert = {
  storageUrl: string;
  kind: "image" | "video";
  provider?: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  fileSizeBytes?: number | null;
  originalFilename?: string | null;
};

export type CreateBoardPostInput = {
  category: BoardCategory;
  title: string;
  content: string;
  media?: BoardMediaInsert[];
};

export function useCreateBoardPost(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBoardPostInput): Promise<string> => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      const { data, error } = await supabase
        .from("board_posts")
        .insert({
          author_id: currentUserId,
          category: input.category,
          title: input.title,
          content: input.content,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      const postId = (data as { id: string }).id;

      if (input.media && input.media.length > 0) {
        const rows = input.media.map((m) => ({
          post_id: postId,
          storage_url: m.storageUrl,
          kind: m.kind,
          provider: m.provider ?? "synology",
          thumbnail_url: m.thumbnailUrl ?? null,
          duration_seconds: m.durationSeconds ?? null,
          width: m.width ?? null,
          height: m.height ?? null,
          file_size_bytes: m.fileSizeBytes ?? null,
          original_filename: m.originalFilename ?? null,
        }));
        const { error: mErr } = await supabase.from("board_post_media").insert(rows);
        if (mErr) throw new Error(mErr.message || JSON.stringify(mErr));
      }

      return postId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-posts"] });
    },
  });
}

export type UpdateBoardPostInput = {
  postId: string;
  category: BoardCategory;
  title: string;
  content: string;
};

export function useUpdateBoardPost(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBoardPostInput) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase
        .from("board_posts")
        .update({
          category: input.category,
          title: input.title,
          content: input.content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.postId)
        .eq("author_id", currentUserId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["board-posts"] });
      qc.invalidateQueries({ queryKey: ["board-post", vars.postId] });
    },
  });
}

// 소프트 삭제 — deleted_at 마킹. 댓글 보존 위해 hard delete 대신 권장.
export function useDeleteBoardPost(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase
        .from("board_posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", postId)
        .eq("author_id", currentUserId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: (_data, postId) => {
      qc.invalidateQueries({ queryKey: ["board-posts"] });
      qc.invalidateQueries({ queryKey: ["board-post", postId] });
    },
  });
}

export function useToggleBoardPostLike(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; currentlyLiked: boolean }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      if (input.currentlyLiked) {
        const { error } = await supabase
          .from("board_post_likes")
          .delete()
          .eq("post_id", input.postId)
          .eq("user_id", currentUserId);
        if (error) throw new Error(error.message || JSON.stringify(error));
      } else {
        const { error } = await supabase
          .from("board_post_likes")
          .insert({ post_id: input.postId, user_id: currentUserId });
        if (error) throw new Error(error.message || JSON.stringify(error));
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["board-posts"] });
      qc.invalidateQueries({ queryKey: ["board-post", vars.postId] });
    },
  });
}
