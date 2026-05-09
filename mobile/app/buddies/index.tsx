// 버디 관리 — 내가 등록한 단골 버디 리스트. 가장 최근에 같이 다이빙한 순으로 정렬.

import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Plus,
  Trash2,
  User,
  Users,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useUserBuddies,
  useRemoveBuddy,
  type UserBuddy,
} from "@/src/hooks/use-buddies";
import { showAlert } from "@/src/lib/alert";
import { friendlyError } from "@/src/lib/error-messages";

export default function BuddiesListScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: items, isLoading } = useUserBuddies(userId);
  const remove = useRemoveBuddy(userId);

  const onDelete = (item: UserBuddy) => {
    showAlert(
      "버디 삭제",
      `${item.nickname} 님을 버디 목록에서 삭제할까요?\n과거 다이브 기록의 연결은 유지돼요.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              await remove.mutateAsync(item.id);
            } catch (err) {
              showAlert("삭제 실패", friendlyError(err));
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row justify-between items-center border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base">버디 관리</Text>
        <Pressable
          onPress={() => router.push("/buddies/add" as never)}
          hitSlop={8}
          className="w-10 h-10 bg-brand-50 rounded-full items-center justify-center"
        >
          <Plus size={18} color={colors.brand[700]} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : !items || items.length === 0 ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Users size={32} color="#D1D5DB" />
            <Text className="text-gray-400 text-xs text-center mt-3 leading-5">
              아직 등록된 버디가 없어요.{"\n"}
              우상단 + 버튼으로 첫 버디를 추가해보세요.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {items.map((item) => (
              <View
                key={item.id}
                className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3"
              >
                <Avatar uri={item.profileImageUrl} size={44} />
                <View className="flex-1 min-w-0">
                  <Text
                    className="font-black text-sm text-gray-900"
                    numberOfLines={1}
                  >
                    {item.nickname}
                  </Text>
                  <Text className="text-[11px] text-gray-500 mt-0.5" numberOfLines={1}>
                    {item.lastDivedAt
                      ? `최근 ${item.lastDivedAt.slice(0, 10)} 함께 다이빙`
                      : item.divingOrg || item.certification
                      ? [item.divingOrg, item.certification]
                          .filter(Boolean)
                          .join(" · ")
                      : "아직 함께한 다이브 없음"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onDelete(item)}
                  hitSlop={8}
                  disabled={remove.isPending}
                  className="w-9 h-9 rounded-full bg-red-50 items-center justify-center"
                >
                  <Trash2 size={15} color="#DC2626" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Avatar({ uri, size }: { uri: string | null; size: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="bg-brand-50"
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-brand-50 items-center justify-center"
    >
      <User size={size * 0.5} color={colors.brand[700]} />
    </View>
  );
}
