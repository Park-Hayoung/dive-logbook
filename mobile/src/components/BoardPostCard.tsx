import { View, Text, Pressable } from "react-native";
import { Heart, MessageCircle, Eye, Image as ImageIcon, Pin } from "lucide-react-native";

import type { BoardPostListItem, BoardCategory } from "@/src/hooks/use-board-posts";
import { BOARD_CATEGORY_LABEL } from "@/src/hooks/use-board-posts";
import { formatRelative } from "@/src/lib/format";

type Props = {
  post: BoardPostListItem;
  onPress?: () => void;
};

// 카테고리별 색상 — 시각적 구분. notice 만 강조색, 나머지는 톤다운된 파스텔.
const CATEGORY_STYLE: Record<BoardCategory, { bg: string; fg: string }> = {
  free:     { bg: "bg-gray-100",    fg: "text-gray-700" },
  question: { bg: "bg-amber-50",    fg: "text-amber-700" },
  review:   { bg: "bg-blue-50",     fg: "text-blue-700" },
  gear:     { bg: "bg-violet-50",   fg: "text-violet-700" },
  meetup:   { bg: "bg-emerald-50",  fg: "text-emerald-700" },
  notice:   { bg: "bg-rose-500",    fg: "text-white" },
};

export function BoardPostCard({ post, onPress }: Props) {
  const cat = CATEGORY_STYLE[post.category];

  return (
    <Pressable
      onPress={onPress}
      className="bg-white px-4 py-4 border-b border-gray-100 active:bg-gray-50"
    >
      {/* Header row: pin + category + title */}
      <View className="flex-row items-center gap-1.5 mb-1">
        {post.isPinned && (
          <Pin size={11} color="#E11D48" fill="#E11D48" />
        )}
        <View className={`px-1.5 py-0.5 rounded-md ${cat.bg}`}>
          <Text className={`text-[10px] font-black ${cat.fg}`}>
            {BOARD_CATEGORY_LABEL[post.category]}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          className="flex-1 text-sm font-black text-gray-900"
        >
          {post.title}
        </Text>
        {post.mediaCount > 0 && (
          <View className="flex-row items-center gap-0.5">
            <ImageIcon size={11} color="#9CA3AF" />
            {post.mediaCount > 1 && (
              <Text className="text-[10px] font-bold text-gray-400">
                {post.mediaCount}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Content preview — 2 lines */}
      {post.contentPreview ? (
        <Text
          numberOfLines={2}
          className="text-xs text-gray-500 leading-relaxed mb-2"
        >
          {post.contentPreview}
        </Text>
      ) : null}

      {/* Meta row: author · time · view · comment · like */}
      <View className="flex-row items-center gap-2">
        <Text className="text-[11px] font-bold text-gray-600">
          {post.author?.nickname ?? "(알수없음)"}
        </Text>
        <Text className="text-[11px] text-gray-300">·</Text>
        <Text className="text-[11px] text-gray-400">
          {formatRelative(post.createdAt)}
        </Text>
        <View className="flex-1" />
        <MetaCount Icon={Eye} value={post.viewCount} />
        <MetaCount Icon={MessageCircle} value={post.commentCount} />
        <MetaCount Icon={Heart} value={post.likeCount} />
      </View>
    </Pressable>
  );
}

function MetaCount({
  Icon,
  value,
}: {
  Icon: typeof Heart;
  value: number;
}) {
  return (
    <View className="flex-row items-center gap-0.5">
      <Icon size={11} color="#9CA3AF" />
      <Text className="text-[10px] font-bold text-gray-500">{value}</Text>
    </View>
  );
}
