import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Heart,
  MessageCircle,
  Send,
  Eye,
  Pencil,
  Trash2,
  CornerDownRight,
  X,
  Flag,
} from "lucide-react-native";

import { colors } from "@/src/lib/colors";
import { useAuthStore } from "@/src/store/auth-store";
import {
  useBoardPost,
  useToggleBoardPostLike,
  useDeleteBoardPost,
  useIncrementBoardView,
  BOARD_CATEGORY_LABEL,
} from "@/src/hooks/use-board-posts";
import {
  useBoardComments,
  useAddBoardComment,
  useUpdateBoardComment,
  useDeleteBoardComment,
  useToggleBoardCommentLike,
  type BoardComment,
} from "@/src/hooks/use-board-comments";
import { useBoardMedia } from "@/src/hooks/use-board-media";
import {
  useReportBoardPost,
  useReportBoardComment,
  DuplicateReportError,
  type BoardReportReason,
} from "@/src/hooks/use-board-reports";
import {
  FeedMediaCarousel,
  type FeedMediaItem,
} from "@/src/components/FeedMediaCarousel";
import { VideoPlayerModal } from "@/src/components/VideoPlayerModal";
import { ReportSheet } from "@/src/components";
import { formatRelative } from "@/src/lib/format";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

export default function BoardPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: post, isLoading } = useBoardPost(id, userId);
  const { data: comments = [], isLoading: commentsLoading } = useBoardComments(
    id,
    userId,
  );
  const { data: media = [] } = useBoardMedia(id);

  const togglePostLike = useToggleBoardPostLike(userId);
  const deletePost = useDeleteBoardPost(userId);
  const incrementView = useIncrementBoardView();
  const addComment = useAddBoardComment(id, userId);
  const updateComment = useUpdateBoardComment(id, userId);
  const deleteComment = useDeleteBoardComment(id, userId);
  const toggleCommentLike = useToggleBoardCommentLike(id, userId);

  const reportPost = useReportBoardPost(userId);
  const reportComment = useReportBoardComment(userId);

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; nickname: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(true);
  // 신고 대상: null=닫힘 / { kind:'post', id } / { kind:'comment', id }
  const [reportTarget, setReportTarget] = useState<
    | { kind: "post"; id: string }
    | { kind: "comment"; id: string }
    | null
  >(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  const { width: screenWidth } = useWindowDimensions();
  // 바깥 ScrollView padding 16*2 + 카드 px-5(20*2) = 72
  const mediaWidth = Math.max(0, screenWidth - 72);
  const mediaHeight = 240;

  // 진입 시 조회수 +1 (id 처음 로드될 때 한 번).
  useEffect(() => {
    if (!id) return;
    incrementView.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        edges={["top"]}
        className="flex-1 items-center justify-center bg-gray-50 p-6"
      >
        <Text className="text-gray-400 mb-4">글을 찾을 수 없어요.</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-gray-900 px-5 py-3 rounded-2xl"
        >
          <Text className="text-white font-black">돌아가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isAuthor = !!userId && userId === post.authorId;

  const onSubmitDraft = async () => {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      if (editing) {
        await updateComment.mutateAsync({
          commentId: editing.id,
          content: text,
        });
        setEditing(null);
      } else {
        await addComment.mutateAsync({
          content: text,
          parentCommentId: replyTo?.id ?? null,
        });
        setReplyTo(null);
      }
      setDraft("");
    } catch (err: unknown) {
      showAlert("처리 실패", friendlyError(err));
    } finally {
      setPosting(false);
    }
  };

  const onDeletePost = () => {
    showAlert("글 삭제", "이 글을 정말 삭제하시겠어요?", [
      { text: "취소" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost.mutateAsync(post.id);
            router.back();
          } catch (err) {
            showAlert("삭제 실패", friendlyError(err));
          }
        },
      },
    ]);
  };

  const onDeleteComment = (commentId: string) => {
    showAlert("댓글 삭제", "이 댓글을 정말 삭제하시겠어요?", [
      { text: "취소" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteComment.mutateAsync(commentId);
          } catch (err) {
            showAlert("삭제 실패", friendlyError(err));
          }
        },
      },
    ]);
  };

  const onStartEditComment = (c: BoardComment) => {
    setEditing({ id: c.id, content: c.content });
    setReplyTo(null);
    setDraft(c.content);
  };

  const onStartReply = (c: BoardComment) => {
    if (!c.author) return;
    setReplyTo({ id: c.id, nickname: c.author.nickname });
    setEditing(null);
    setDraft("");
  };

  const cancelComposerMode = () => {
    setReplyTo(null);
    setEditing(null);
    setDraft("");
  };

  const onSubmitReport = async (input: {
    reason: BoardReportReason;
    detail: string | null;
  }) => {
    if (!reportTarget) return;
    setReportSubmitting(true);
    try {
      if (reportTarget.kind === "post") {
        await reportPost.mutateAsync({
          postId: reportTarget.id,
          reason: input.reason,
          detail: input.detail,
        });
      } else {
        await reportComment.mutateAsync({
          commentId: reportTarget.id,
          reason: input.reason,
          detail: input.detail,
        });
      }
      setReportTarget(null);
      showAlert(
        "신고 접수됨",
        "운영자가 검토 후 처리할게요. 감사합니다.",
      );
    } catch (err: unknown) {
      if (err instanceof DuplicateReportError) {
        setReportTarget(null);
        showAlert("이미 신고했어요", "동일한 글/댓글은 한 번만 신고할 수 있어요.");
      } else {
        showAlert("신고 실패", friendlyError(err));
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
          >
            <ChevronLeft size={22} color="#374151" />
          </Pressable>
          <Text className="font-black text-base flex-1">
            {BOARD_CATEGORY_LABEL[post.category]} 게시판
          </Text>
          {isAuthor ? (
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/board/edit/[id]",
                    params: { id: post.id },
                  })
                }
                hitSlop={6}
                className="w-9 h-9 bg-gray-100 rounded-full items-center justify-center"
              >
                <Pencil size={14} color="#374151" />
              </Pressable>
              <Pressable
                onPress={onDeletePost}
                hitSlop={6}
                className="w-9 h-9 bg-red-50 rounded-full items-center justify-center"
              >
                <Trash2 size={14} color="#DC2626" />
              </Pressable>
            </View>
          ) : (
            userId && (
              <Pressable
                onPress={() => setReportTarget({ kind: "post", id: post.id })}
                hitSlop={6}
                className="w-9 h-9 bg-rose-50 rounded-full items-center justify-center"
                accessibilityLabel="이 글 신고"
              >
                <Flag size={14} color="#E11D48" />
              </Pressable>
            )
          )}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Post body */}
          <View className="bg-white rounded-3xl border border-gray-100 px-5 py-5 mb-3">
            <View className="flex-row items-center gap-1.5 mb-2">
              <View className="px-2 py-0.5 rounded-md bg-gray-100">
                <Text className="text-[10px] font-black text-gray-700">
                  {BOARD_CATEGORY_LABEL[post.category]}
                </Text>
              </View>
              {post.isPinned && (
                <View className="px-2 py-0.5 rounded-md bg-rose-500">
                  <Text className="text-[10px] font-black text-white">공지</Text>
                </View>
              )}
            </View>

            <Text className="text-lg font-black text-gray-900 mb-3">
              {post.title}
            </Text>

            <Pressable
              onPress={() =>
                post.author &&
                router.push({
                  pathname: "/profile/[id]",
                  params: { id: post.author.id },
                })
              }
              className="flex-row items-center gap-2 mb-4"
            >
              <View className="w-8 h-8 rounded-full bg-brand-50 items-center justify-center">
                {post.author?.profileImageUrl ? (
                  <Image
                    source={{ uri: post.author.profileImageUrl }}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <Text className="text-xs font-black text-brand-700">
                    {post.author?.nickname?.charAt(0) ?? "?"}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-xs font-black text-gray-900">
                  {post.author?.nickname ?? "(알수없음)"}
                </Text>
                <Text className="text-[10px] text-gray-400">
                  {formatRelative(post.createdAt)}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Eye size={12} color="#9CA3AF" />
                <Text className="text-[10px] font-bold text-gray-500">
                  {post.viewCount}
                </Text>
              </View>
            </Pressable>

            <Text className="text-sm text-gray-800 leading-7 mb-4">
              {post.content}
            </Text>

            {media.length > 0 && (
              <View className="mb-4">
                <FeedMediaCarousel
                  items={media.map<FeedMediaItem>((m) => ({
                    id: m.id,
                    url: m.storageUrl,
                    kind: m.kind,
                    thumbnailUrl: m.thumbnailUrl,
                  }))}
                  width={mediaWidth}
                  height={mediaHeight}
                  isActive={isFocused && !videoUrl}
                  onPressVideo={(url) => setVideoUrl(url)}
                />
              </View>
            )}

            <View className="flex-row items-center gap-4 pt-3 border-t border-gray-100">
              <Pressable
                onPress={() =>
                  togglePostLike.mutate({
                    postId: post.id,
                    currentlyLiked: post.myLiked,
                  })
                }
                className="flex-row items-center gap-1.5"
                hitSlop={8}
              >
                <Heart
                  size={18}
                  color={post.myLiked ? "#EF4444" : "#9CA3AF"}
                  fill={post.myLiked ? "#EF4444" : "transparent"}
                />
                <Text
                  className={`text-xs font-bold ${
                    post.myLiked ? "text-red-500" : "text-gray-500"
                  }`}
                >
                  {post.likeCount}
                </Text>
              </Pressable>
              <View className="flex-row items-center gap-1.5">
                <MessageCircle size={18} color="#9CA3AF" />
                <Text className="text-xs font-bold text-gray-500">
                  {post.commentCount}
                </Text>
              </View>
            </View>
          </View>

          {/* Comments header */}
          <Text className="text-[10px] font-black text-gray-400 uppercase mb-2 px-1">
            댓글 {post.commentCount}
          </Text>

          {commentsLoading ? (
            <ActivityIndicator />
          ) : comments.length === 0 ? (
            <View className="bg-white p-6 rounded-3xl items-center">
              <Text className="text-gray-400 text-xs">
                첫 댓글을 남겨보세요.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {comments.map((c) => (
                <CommentBubble
                  key={c.id}
                  comment={c}
                  currentUserId={userId}
                  onReply={() => onStartReply(c)}
                  onEdit={() => onStartEditComment(c)}
                  onDelete={() => onDeleteComment(c.id)}
                  onToggleLike={() =>
                    toggleCommentLike.mutate({
                      commentId: c.id,
                      currentlyLiked: c.myLiked,
                    })
                  }
                  onReport={() =>
                    setReportTarget({ kind: "comment", id: c.id })
                  }
                  onReplyToReply={(reply) => onStartReply(reply)}
                  onEditReply={(reply) => onStartEditComment(reply)}
                  onDeleteReply={(replyId) => onDeleteComment(replyId)}
                  onToggleReplyLike={(reply) =>
                    toggleCommentLike.mutate({
                      commentId: reply.id,
                      currentlyLiked: reply.myLiked,
                    })
                  }
                  onReportReply={(reply) =>
                    setReportTarget({ kind: "comment", id: reply.id })
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Composer */}
        <View className="bg-white border-t border-gray-100">
          {(replyTo || editing) && (
            <View className="px-5 pt-2 pb-1 flex-row items-center gap-2">
              <Text className="text-[11px] font-bold text-gray-500 flex-1">
                {editing
                  ? "댓글 수정 중"
                  : `${replyTo!.nickname} 님에게 답글`}
              </Text>
              <Pressable onPress={cancelComposerMode} hitSlop={8}>
                <X size={14} color="#9CA3AF" />
              </Pressable>
            </View>
          )}
          <View className="px-5 py-3 flex-row items-center gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={
                editing
                  ? "댓글을 수정하세요"
                  : replyTo
                    ? "답글을 입력하세요"
                    : "댓글을 남겨보세요"
              }
              placeholderTextColor="#9CA3AF"
              editable={!posting}
              multiline
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 bg-gray-50 max-h-32"
            />
            <Pressable
              onPress={onSubmitDraft}
              disabled={posting || !draft.trim()}
              className={`w-11 h-11 rounded-full items-center justify-center ${
                draft.trim() ? "bg-brand-600" : "bg-gray-200"
              }`}
            >
              {posting ? (
                <ActivityIndicator size="small" color={colors.brand.fg} />
              ) : (
                <Send size={16} color={colors.brand.fg} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <VideoPlayerModal url={videoUrl} onClose={() => setVideoUrl(null)} />
      <ReportSheet
        visible={reportTarget !== null}
        targetLabel={reportTarget?.kind === "comment" ? "댓글" : "게시글"}
        submitting={reportSubmitting}
        onClose={() => {
          if (!reportSubmitting) setReportTarget(null);
        }}
        onSubmit={onSubmitReport}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment Bubble (root + replies)
// ─────────────────────────────────────────────────────────────────────────────

type CommentBubbleProps = {
  comment: BoardComment;
  currentUserId: string | undefined;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  onReport: () => void;
  onReplyToReply: (reply: BoardComment) => void;
  onEditReply: (reply: BoardComment) => void;
  onDeleteReply: (replyId: string) => void;
  onToggleReplyLike: (reply: BoardComment) => void;
  onReportReply: (reply: BoardComment) => void;
};

function CommentBubble({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onToggleLike,
  onReport,
  onReplyToReply,
  onEditReply,
  onDeleteReply,
  onToggleReplyLike,
  onReportReply,
}: CommentBubbleProps) {
  return (
    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <CommentRow
        comment={comment}
        currentUserId={currentUserId}
        onReply={onReply}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleLike={onToggleLike}
        onReport={onReport}
      />
      {comment.replies.length > 0 && (
        <View className="bg-gray-50 border-t border-gray-100">
          {comment.replies.map((r) => (
            <View
              key={r.id}
              className="flex-row gap-2 px-3 py-3 border-b border-gray-100 last:border-b-0"
            >
              <CornerDownRight size={12} color="#D1D5DB" />
              <View className="flex-1">
                <CommentRow
                  comment={r}
                  currentUserId={currentUserId}
                  onReply={() => onReplyToReply(r)}
                  onEdit={() => onEditReply(r)}
                  onDelete={() => onDeleteReply(r.id)}
                  onToggleLike={() => onToggleReplyLike(r)}
                  onReport={() => onReportReply(r)}
                  isReply
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

type CommentRowProps = {
  comment: BoardComment;
  currentUserId: string | undefined;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  onReport: () => void;
  isReply?: boolean;
};

function CommentRow({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onToggleLike,
  onReport,
  isReply,
}: CommentRowProps) {
  const isMine =
    !!currentUserId && !comment.isDeleted && comment.author?.id === currentUserId;

  return (
    <View className={isReply ? "" : "p-3"}>
      <View className="flex-row items-center gap-2 mb-1">
        <View className="w-7 h-7 rounded-full bg-brand-50 items-center justify-center">
          {comment.author?.profileImageUrl ? (
            <Image
              source={{ uri: comment.author.profileImageUrl }}
              className="w-7 h-7 rounded-full"
            />
          ) : (
            <Text className="text-[10px] font-black text-brand-700">
              {comment.author?.nickname?.charAt(0) ?? "?"}
            </Text>
          )}
        </View>
        <Text className="font-black text-xs text-gray-900">
          {comment.author?.nickname ?? (comment.isDeleted ? "—" : "Unknown")}
        </Text>
        <Text className="text-[10px] text-gray-400">
          {formatRelative(comment.createdAt)}
        </Text>
      </View>

      <Text
        className={`text-sm mt-0.5 ${
          comment.isDeleted ? "text-gray-400 italic" : "text-gray-800"
        }`}
      >
        {comment.content}
      </Text>

      {!comment.isDeleted && (
        <View className="flex-row items-center gap-3 mt-2">
          <Pressable
            onPress={onToggleLike}
            hitSlop={6}
            className="flex-row items-center gap-1"
          >
            <Heart
              size={12}
              color={comment.myLiked ? "#EF4444" : "#9CA3AF"}
              fill={comment.myLiked ? "#EF4444" : "transparent"}
            />
            {comment.likeCount > 0 && (
              <Text
                className={`text-[10px] font-bold ${
                  comment.myLiked ? "text-red-500" : "text-gray-500"
                }`}
              >
                {comment.likeCount}
              </Text>
            )}
          </Pressable>
          {!isReply && (
            <Pressable onPress={onReply} hitSlop={6}>
              <Text className="text-[10px] font-bold text-gray-500">답글</Text>
            </Pressable>
          )}
          {isMine ? (
            <>
              <Pressable onPress={onEdit} hitSlop={6}>
                <Text className="text-[10px] font-bold text-gray-500">
                  수정
                </Text>
              </Pressable>
              <Pressable onPress={onDelete} hitSlop={6}>
                <Text className="text-[10px] font-bold text-red-500">
                  삭제
                </Text>
              </Pressable>
            </>
          ) : (
            currentUserId && (
              <Pressable onPress={onReport} hitSlop={6}>
                <Text className="text-[10px] font-bold text-rose-500">
                  신고
                </Text>
              </Pressable>
            )
          )}
        </View>
      )}
    </View>
  );
}
