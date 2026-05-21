import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { X } from "lucide-react-native";

import { colors } from "@/src/lib/colors";
import { useAuthStore } from "@/src/store/auth-store";
import {
  useBoardPost,
  useUpdateBoardPost,
  BOARD_USER_CATEGORIES,
  type BoardCategory,
} from "@/src/hooks/use-board-posts";
import { KeyboardSafeScroll } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

export default function EditBoardPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: post, isLoading } = useBoardPost(id, userId);
  const updatePost = useUpdateBoardPost(userId);

  const [category, setCategory] = useState<BoardCategory>("free");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // post 로드되면 폼 1회 채우기.
  useEffect(() => {
    if (post && !prefilled) {
      // notice 는 admin 전용이라 일반 사용자는 못 고름 — 자유로 폴백.
      setCategory(post.category === "notice" ? "free" : post.category);
      setTitle(post.title);
      setContent(post.content);
      setPrefilled(true);
    }
  }, [post, prefilled]);

  if (isLoading || !post) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (userId !== post.authorId) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-gray-400 mb-4">본인 글만 수정할 수 있어요.</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-gray-900 px-5 py-3 rounded-2xl"
        >
          <Text className="text-white font-black">돌아가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const onSubmit = async () => {
    const t = title.trim();
    const c = content.trim();
    if (t.length === 0) {
      showAlert("제목 필요", "글 제목을 입력해주세요.");
      return;
    }
    if (c.length === 0) {
      showAlert("내용 필요", "글 내용을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await updatePost.mutateAsync({
        postId: post.id,
        category,
        title: t,
        content: c,
      });
      router.back();
    } catch (err: unknown) {
      showAlert("수정 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-bold text-gray-900">글 수정</Text>
          <Pressable
            onPress={() => router.back()}
            className="p-2 bg-gray-100 rounded-full"
            disabled={submitting}
          >
            <X size={20} color="#374151" />
          </Pressable>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-bold text-gray-700">카테고리</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {BOARD_USER_CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  disabled={submitting}
                  className={`px-3.5 py-1.5 rounded-full border ${
                    active
                      ? "bg-gray-900 border-gray-900"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Text
                    className={`text-xs font-black ${
                      active ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">제목</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="제목을 입력하세요"
            placeholderTextColor="#9CA3AF"
            maxLength={200}
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">내용</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="다이버들과 나누고 싶은 이야기를 적어보세요"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            maxLength={20000}
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 min-h-48"
          />
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className="bg-brand-600 p-4 rounded-2xl items-center mt-2"
        >
          {submitting ? (
            <ActivityIndicator color={colors.brand.fg} />
          ) : (
            <Text className="text-brand-fg font-black">저장</Text>
          )}
        </Pressable>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
