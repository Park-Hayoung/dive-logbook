import { useRef } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Heart,
  MessageCircle,
  UserPlus,
  Users,
  Trash2,
} from "lucide-react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useVisibleNotifications,
  useDismissNotification,
  useDismissAllNotifications,
  type Notification,
} from "@/src/hooks/use-notifications";

const formatRelative = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useVisibleNotifications(userId);
  const dismiss = useDismissNotification(userId);
  const dismissAll = useDismissAllNotifications(userId);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base flex-1">알림</Text>
        {notifications.length > 0 ? (
          <Pressable
            onPress={() => dismissAll.mutate()}
            hitSlop={8}
            disabled={dismissAll.isPending}
            className="px-3 py-1.5 rounded-full bg-brand-50"
          >
            <Text className="text-[11px] font-black text-brand-700">
              모두 읽음
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View className="bg-red-50 border border-red-100 p-4 rounded-2xl">
            <Text className="text-[10px] font-bold text-red-700">
              알림을 불러오지 못했어요
            </Text>
            <Text className="text-[10px] text-red-600 mt-1">
              {error instanceof Error ? error.message : "알 수 없는 오류"}
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs text-center">
              아직 도착한 알림이 없어요.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {notifications.map((n) => (
              <SwipeableNotificationRow
                key={n.id}
                n={n}
                onPress={() => handlePress(n, router)}
                onDismiss={() => dismiss.mutate(n.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function handlePress(n: Notification, router: ReturnType<typeof useRouter>) {
  if ((n.kind === "like" || n.kind === "comment") && n.feedId) {
    router.push({ pathname: "/feed/[id]", params: { id: n.feedId } });
  } else if (n.kind === "follow" && n.actor) {
    router.push({ pathname: "/profile/[id]", params: { id: n.actor.id } });
  } else if (n.kind === "team_join_request" && n.teamId) {
    router.push({ pathname: "/team/[id]", params: { id: n.teamId } });
  }
}

function SwipeableNotificationRow({
  n,
  onPress,
  onDismiss,
}: {
  n: Notification;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const ref = useRef<SwipeableMethods>(null);

  const renderRightActions = () => (
    <View className="justify-center pl-2">
      <Pressable
        onPress={() => {
          ref.current?.close();
          onDismiss();
        }}
        className="bg-red-500 h-full px-5 rounded-2xl items-center justify-center"
      >
        <Trash2 size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
    >
      <NotificationRow n={n} onPress={onPress} />
    </ReanimatedSwipeable>
  );
}

function NotificationRow({
  n,
  onPress,
}: {
  n: Notification;
  onPress: () => void;
}) {
  const initial = n.actor?.nickname?.charAt(0) ?? "?";
  const { icon, message } = describe(n);

  return (
    <Pressable
      onPress={onPress}
      className="bg-white p-3 rounded-2xl flex-row items-center gap-3 active:scale-95"
    >
      <View className="relative">
        <View className="w-11 h-11 rounded-full bg-brand-50 items-center justify-center">
          {n.actor?.profileImageUrl ? (
            <Image
              source={{ uri: n.actor.profileImageUrl }}
              className="w-11 h-11 rounded-full"
            />
          ) : (
            <Text className="text-base font-black text-brand-700">
              {initial}
            </Text>
          )}
        </View>
        <View className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white items-center justify-center">
          {icon}
        </View>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm text-gray-800 leading-5" numberOfLines={2}>
          {message}
        </Text>
        <Text className="text-[10px] text-gray-400 mt-0.5">
          {formatRelative(n.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

function describe(n: Notification): {
  icon: React.ReactNode;
  message: string;
} {
  const name = n.actor?.nickname ?? "Unknown";
  switch (n.kind) {
    case "like":
      return {
        icon: <Heart size={11} color="#EF4444" fill="#EF4444" />,
        message: `${name}님이 회원님의 글을 좋아해요${
          n.feedSnippet ? `: "${n.feedSnippet}"` : ""
        }`,
      };
    case "comment":
      return {
        icon: <MessageCircle size={11} color={colors.brand[700]} />,
        message: `${name}님이 댓글을 남겼어요${
          n.commentContent ? `: ${n.commentContent}` : ""
        }`,
      };
    case "follow":
      return {
        icon: <UserPlus size={11} color="#059669" />,
        message: `${name}님이 회원님을 팔로우해요`,
      };
    case "team_join_request":
      return {
        icon: <Users size={11} color="#D97706" />,
        message: `${name}님이 팀 "${n.teamName ?? ""}"에 가입을 요청했어요`,
      };
  }
}
