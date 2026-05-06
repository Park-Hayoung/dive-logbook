import { useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Heart,
  MessageCircle,
  Send,
  MapPin,
  Anchor,
  Pencil,
  Trash2,
  Play,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useFeed,
  useToggleFeedLike,
  useDeleteFeed,
} from "@/src/hooks/use-feeds";
import {
  useFeedComments,
  useAddFeedComment,
} from "@/src/hooks/use-feed-comments";
import { useDiveMedia } from "@/src/hooks/use-dive-media";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

const formatRelative = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

export default function FeedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: feed, isLoading } = useFeed(id, userId);
  const { data: comments = [], isLoading: commentsLoading } =
    useFeedComments(id);
  const { data: diveMedia = [] } = useDiveMedia(feed?.linkedDiveId ?? undefined);
  const toggleLike = useToggleFeedLike(userId);
  const addComment = useAddFeedComment(id, userId);
  const deleteFeed = useDeleteFeed(userId);

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [feedImageRatio, setFeedImageRatio] = useState<number | null>(null);

  const { width: screenWidth } = useWindowDimensions();
  // outer ScrollView padding 20*2 + 카드 p-5 (20*2) = 80
  const carouselSize = Math.max(0, screenWidth - 80);

  const onSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      await addComment.mutateAsync(trimmed);
      setDraft("");
    } catch (err: unknown) {
      showAlert(
        "댓글 등록 실패",
        friendlyError(err),
      );
    } finally {
      setPosting(false);
    }
  };

  const onDelete = () => {
    if (!feed) return;
    showAlert("피드 삭제", "이 글을 정말 삭제하시겠어요?", [
      { text: "취소" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFeed.mutateAsync({
              feedId: feed.id,
              imageUrl: feed.imageUrl,
            });
            router.back();
          } catch (err: unknown) {
            showAlert(
              "삭제 실패",
              friendlyError(err),
            );
          }
        },
      },
    ]);
  };

  const onEdit = () => {
    if (!feed) return;
    router.push({ pathname: "/feed/edit/[id]", params: { id: feed.id } });
  };

  const onToggleLike = async () => {
    if (!feed) return;
    try {
      await toggleLike.mutateAsync({
        feedId: feed.id,
        currentlyLiked: feed.myLiked,
      });
    } catch (err: unknown) {
      showAlert(
        "처리 실패",
        friendlyError(err),
      );
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!feed) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-gray-400 mb-4">피드를 찾을 수 없어요.</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-gray-900 px-5 py-3 rounded-2xl"
        >
          <Text className="text-white font-black">돌아가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const initial = feed.author?.nickname?.charAt(0) ?? "?";
  const isAuthor = !!userId && userId === feed.authorId;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
          >
            <ChevronLeft size={22} color="#374151" />
          </Pressable>
          <Text className="font-black text-base flex-1">피드</Text>
          {isAuthor ? (
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={onEdit}
                hitSlop={6}
                className="w-9 h-9 bg-gray-100 rounded-full items-center justify-center"
              >
                <Pencil size={14} color="#374151" />
              </Pressable>
              <Pressable
                onPress={onDelete}
                hitSlop={6}
                className="w-9 h-9 bg-red-50 rounded-full items-center justify-center"
              >
                <Trash2 size={14} color="#DC2626" />
              </Pressable>
            </View>
          ) : null}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
            <Pressable
              onPress={() =>
                feed.author &&
                router.push({
                  pathname: "/profile/[id]",
                  params: { id: feed.author.id },
                })
              }
              className="flex-row items-center gap-3 mb-3"
            >
              <View className="w-11 h-11 rounded-full bg-brand-50 items-center justify-center">
                {feed.author?.profileImageUrl ? (
                  <Image
                    source={{ uri: feed.author.profileImageUrl }}
                    className="w-11 h-11 rounded-full"
                  />
                ) : (
                  <Text className="text-base font-black text-brand-600">
                    {initial}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="font-black text-sm text-gray-900">
                  {feed.author?.nickname ?? "Unknown"}
                </Text>
                <Text className="text-[10px] text-gray-400">
                  {formatRelative(feed.createdAt)}
                </Text>
              </View>
              {feed.type === "log" ? (
                <View className="bg-brand-50 px-2 py-1 rounded-lg">
                  <Text className="text-[10px] font-black text-brand-700">
                    LOG
                  </Text>
                </View>
              ) : null}
            </Pressable>

            {feed.content ? (
              <Text className="text-sm text-gray-800 leading-6 mb-3">
                {feed.content}
              </Text>
            ) : null}

            {feed.linkedDiveId && diveMedia.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                snapToInterval={carouselSize}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                className="mb-3"
              >
                {diveMedia.map((m) => {
                  const thumb = m.thumbnailUrl ?? m.storageUrl;
                  return (
                    <View
                      key={m.id}
                      style={{ width: carouselSize, height: carouselSize }}
                      className="rounded-2xl overflow-hidden bg-gray-100"
                    >
                      <Image
                        source={{ uri: thumb }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                      {m.kind === "video" ? (
                        <View className="absolute inset-0 items-center justify-center">
                          <View className="w-12 h-12 rounded-full bg-black/50 items-center justify-center">
                            <Play size={18} color="#fff" />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            ) : feed.imageUrl ? (
              <Image
                source={{ uri: feed.imageUrl }}
                onLoad={(e) => {
                  const { width, height } = e.nativeEvent.source;
                  if (width && height) setFeedImageRatio(width / height);
                }}
                style={{
                  width: "100%",
                  aspectRatio: feedImageRatio ?? 4 / 3,
                }}
                className="rounded-2xl mb-3 bg-gray-100"
                resizeMode="cover"
              />
            ) : null}

            {feed.location ? (
              <View className="flex-row items-center gap-1.5 mb-3">
                <MapPin size={12} color="#6B7280" />
                <Text className="text-xs text-gray-600">{feed.location}</Text>
              </View>
            ) : null}

            {feed.linkedDiveId ? (
              <Pressable
                onPress={() => router.push(`/log/${feed.linkedDiveId}`)}
                className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-2 rounded-xl mb-3"
              >
                <Anchor size={12} color="#2563EB" />
                <Text className="text-xs font-bold text-brand-700">
                  연결된 로그 보기
                </Text>
              </Pressable>
            ) : null}

            <View className="flex-row items-center gap-4 pt-3 border-t border-gray-100">
              <Pressable
                onPress={onToggleLike}
                className="flex-row items-center gap-1.5"
                hitSlop={8}
              >
                <Heart
                  size={18}
                  color={feed.myLiked ? "#EF4444" : "#9CA3AF"}
                  fill={feed.myLiked ? "#EF4444" : "transparent"}
                />
                <Text
                  className={`text-xs font-bold ${
                    feed.myLiked ? "text-red-500" : "text-gray-500"
                  }`}
                >
                  {feed.likeCount}
                </Text>
              </Pressable>
              <View className="flex-row items-center gap-1.5">
                <MessageCircle size={18} color="#9CA3AF" />
                <Text className="text-xs font-bold text-gray-500">
                  {feed.commentCount}
                </Text>
              </View>
            </View>
          </View>

          <Text className="text-[10px] font-black text-gray-400 uppercase mb-2 px-1">
            댓글 {comments.length}
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
                <View
                  key={c.id}
                  className="bg-white p-3 rounded-2xl flex-row gap-3"
                >
                  <Pressable
                    onPress={() =>
                      c.author &&
                      router.push({
                        pathname: "/profile/[id]",
                        params: { id: c.author.id },
                      })
                    }
                    hitSlop={4}
                  >
                    <View className="w-8 h-8 rounded-full bg-brand-50 items-center justify-center">
                      {c.author?.profileImageUrl ? (
                        <Image
                          source={{ uri: c.author.profileImageUrl }}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <Text className="text-xs font-black text-brand-600">
                          {c.author?.nickname?.charAt(0) ?? "?"}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      c.author &&
                      router.push({
                        pathname: "/profile/[id]",
                        params: { id: c.author.id },
                      })
                    }
                    className="flex-1"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="font-black text-xs text-gray-900">
                        {c.author?.nickname ?? "Unknown"}
                      </Text>
                      <Text className="text-[10px] text-gray-400">
                        {formatRelative(c.createdAt)}
                      </Text>
                    </View>
                    <Text className="text-sm text-gray-800 mt-0.5">
                      {c.content}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View className="px-5 py-3 bg-white border-t border-gray-100 flex-row items-center gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="댓글을 남겨보세요"
            placeholderTextColor="#9CA3AF"
            editable={!posting}
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 bg-gray-50"
          />
          <Pressable
            onPress={onSubmit}
            disabled={posting || !draft.trim()}
            className={`w-11 h-11 rounded-full items-center justify-center ${
              draft.trim() ? "bg-brand-600" : "bg-gray-200"
            }`}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={16} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
