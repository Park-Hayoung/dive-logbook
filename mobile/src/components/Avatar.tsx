import { View, Text, Image } from "react-native";

type Props = {
  uri?: string | null;
  name?: string | null;
  /** Pixel size; the component renders a circle of this diameter. */
  size?: number;
};

export function Avatar({ uri, name, size = 40 }: Props) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  const fontSize = Math.max(10, Math.floor(size / 2.5));
  return (
    <View
      style={{ width: size, height: size }}
      className="rounded-full bg-brand-50 items-center justify-center overflow-hidden"
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{ fontSize }}
          className="font-black text-brand-600"
        >
          {initial}
        </Text>
      )}
    </View>
  );
}
