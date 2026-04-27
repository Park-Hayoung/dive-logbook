import { View, Text } from "react-native";
import type { ReactNode } from "react";

type StatBoxProps = {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  icon?: ReactNode;
};

export function StatBox({ label, value, unit, highlighted, icon }: StatBoxProps) {
  return (
    <View
      className={`flex flex-col items-center p-3 rounded-2xl border ${
        highlighted
          ? "bg-brand-600 border-brand-600"
          : "bg-white border-gray-100"
      }`}
    >
      <View className="flex-row items-center gap-1 mb-1">
        {icon}
        <Text
          className={`text-[9px] font-black uppercase ${
            highlighted ? "text-brand-100" : "text-gray-400"
          }`}
        >
          {label}
        </Text>
      </View>
      <Text
        className={`text-base font-black leading-none ${
          highlighted ? "text-white" : "text-gray-900"
        }`}
      >
        {value}
        {unit && <Text className="text-[10px] font-normal ml-0.5">{unit}</Text>}
      </Text>
    </View>
  );
}
