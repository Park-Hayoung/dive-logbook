import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Plus, Star, Trash2, Award } from "lucide-react-native";
import { Image } from "expo-image";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useCertifications,
  useDeleteCertification,
  useSetPrimaryCertification,
  type Certification,
} from "@/src/hooks/use-certifications";
import { colors } from "@/src/lib/colors";
import { showAlert } from "@/src/lib/alert";
import { friendlyError } from "@/src/lib/error-messages";

export default function CardsListScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const isOnboarding = from === "onboarding";
  const userId = useAuthStore((s) => s.user?.id);
  const { data: cards, isLoading } = useCertifications(userId);
  const del = useDeleteCertification(userId);
  const setPrimary = useSetPrimaryCertification(userId);

  const finishOnboarding = () => router.replace("/(tabs)" as never);

  const onDelete = (cert: Certification) => {
    showAlert("자격증 삭제", `${cert.organization} ${cert.level} 카드를 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await del.mutateAsync(cert);
          } catch (err) {
            showAlert("삭제 실패", friendlyError(err));
          }
        },
      },
    ]);
  };

  const onSetPrimary = async (cert: Certification) => {
    if (cert.is_primary) return;
    try {
      await setPrimary.mutateAsync(cert.id);
    } catch (err) {
      showAlert("대표 카드 설정 실패", friendlyError(err));
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        {isOnboarding ? (
          <View className="w-16" />
        ) : (
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
          >
            <ChevronLeft size={20} color="#374151" />
          </Pressable>
        )}
        <Text className="text-base font-black text-gray-900">자격증 카드</Text>
        {isOnboarding ? (
          <Pressable onPress={finishOnboarding} hitSlop={8} className="w-16 items-end">
            <Text className="text-xs font-black text-gray-500">건너뛰기</Text>
          </Pressable>
        ) : (
          <View className="w-10" />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text className="text-xs text-gray-500 leading-5 -mt-1">
          C-card 사진을 등록해두면 프로필에서 자격을 한눈에 보여줄 수 있어요.{"\n"}
          여러 단체 자격증을 모두 등록할 수 있고, 대표 카드를 골라 프로필에
          표시할 수 있어요.
        </Text>

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/profile/cards/capture" as never,
              params: isOnboarding ? { from: "onboarding" } : {},
            } as never)
          }
          className="border-2 border-dashed border-brand-300 rounded-2xl p-6 items-center justify-center bg-brand-50"
        >
          <View className="w-12 h-12 rounded-full bg-brand-600 items-center justify-center mb-2">
            <Plus size={22} color={colors.brand.fg} />
          </View>
          <Text className="text-sm font-black text-brand-700">
            자격증 카드 추가
          </Text>
          <Text className="text-[10px] text-brand-700/80 mt-1">
            촬영 또는 갤러리에서 선택
          </Text>
        </Pressable>

        {isLoading ? (
          <ActivityIndicator color={colors.brand[600]} />
        ) : (cards?.length ?? 0) === 0 ? (
          <View className="items-center py-10">
            <Award size={28} color="#9CA3AF" />
            <Text className="text-xs text-gray-400 mt-2">
              아직 등록된 자격증 카드가 없어요
            </Text>
          </View>
        ) : (
          cards!.map((cert) => (
            <CardRow
              key={cert.id}
              cert={cert}
              onSetPrimary={() => onSetPrimary(cert)}
              onDelete={() => onDelete(cert)}
              busy={del.isPending || setPrimary.isPending}
            />
          ))
        )}

        {isOnboarding && (cards?.length ?? 0) > 0 ? (
          <Pressable
            onPress={finishOnboarding}
            className="bg-brand-600 p-4 rounded-2xl items-center mt-4"
          >
            <Text className="text-brand-fg font-black">완료하고 시작하기</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CardRow({
  cert,
  onSetPrimary,
  onDelete,
  busy,
}: {
  cert: Certification;
  onSetPrimary: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <View className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
      <View
        style={{
          backgroundColor: "#F3F4F6",
          // 실물 카드는 카드 비율로 보여주는 게 자연스럽지만 e카드는 본체+메타가
          // 함께 들어 있어 contain 으로 원본 비율 유지.
          ...(cert.card_type === "physical"
            ? { aspectRatio: 85.6 / 53.98 }
            : { height: 220 }),
        }}
      >
        <Image
          source={{ uri: cert.card_image_url }}
          style={{ width: "100%", height: "100%" }}
          contentFit={cert.card_type === "physical" ? "cover" : "contain"}
        />
        <View className="absolute top-2 left-2 flex-row items-center gap-1.5">
          {cert.is_primary ? (
            <View className="flex-row items-center gap-1 bg-brand-600 px-2 py-1 rounded-full">
              <Star size={10} color={colors.brand.fg} fill={colors.brand.fg} />
              <Text className="text-[10px] font-black text-brand-fg">대표</Text>
            </View>
          ) : null}
          {cert.card_type === "electronic" ? (
            <View className="bg-black/60 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-black text-white">e카드</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="p-3 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-sm font-black text-gray-900">
            {cert.organization} · {cert.level}
          </Text>
          {cert.cert_number ? (
            <Text className="text-[10px] text-gray-500 mt-0.5">
              No. {cert.cert_number}
            </Text>
          ) : null}
        </View>
        <View className="flex-row gap-2">
          {!cert.is_primary ? (
            <Pressable
              onPress={onSetPrimary}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-full bg-gray-100"
            >
              <Text className="text-[10px] font-bold text-gray-700">
                대표 지정
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onDelete}
            disabled={busy}
            className="w-8 h-8 rounded-full bg-red-50 items-center justify-center"
          >
            <Trash2 size={14} color="#DC2626" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
