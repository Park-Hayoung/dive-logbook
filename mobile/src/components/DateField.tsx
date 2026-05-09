import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";

type Mode = "date" | "datetime";

type Props = {
  label: string;
  value: Date | null;
  onChange: (next: Date) => void;
  mode?: Mode;
  placeholder?: string;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");

const formatYmd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatDateTime = (d: Date) =>
  `${formatYmd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  placeholder = "선택해주세요",
  disabled,
  minimumDate,
  maximumDate,
}: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");

  const display = value
    ? mode === "datetime"
      ? formatDateTime(value)
      : formatYmd(value)
    : "";

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android: dismiss closes picker; set keeps it
    if (Platform.OS === "android") {
      if (event.type === "dismissed") {
        setShowPicker(false);
        return;
      }
      if (selected) {
        if (mode === "datetime" && pickerMode === "date") {
          // First step done: now show time picker
          onChange(selected);
          setPickerMode("time");
          // Re-open as time picker on next render
          return;
        }
        onChange(selected);
        setShowPicker(false);
        setPickerMode("date");
      }
    } else {
      // iOS: spinner — change directly, user closes via "확인"
      if (selected) onChange(selected);
    }
  };

  return (
    <View className="gap-1">
      <Text className="text-xs font-bold text-gray-700">{label}</Text>
      <Pressable
        onPress={() => {
          if (disabled) return;
          setPickerMode("date");
          setShowPicker(true);
        }}
        className="border border-gray-200 rounded-2xl p-4 flex-row items-center gap-2 bg-white"
      >
        <CalendarDays size={16} color="#6B7280" />
        <Text
          className={`text-base ${
            display ? "text-gray-900" : "text-gray-400"
          }`}
        >
          {display || placeholder}
        </Text>
      </Pressable>

      {showPicker ? (
        <View>
          <DateTimePicker
            value={value ?? new Date()}
            mode={pickerMode}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={onPickerChange}
          />
          {Platform.OS === "ios" ? (
            <Pressable
              onPress={() => {
                setShowPicker(false);
                setPickerMode("date");
              }}
              className="bg-brand-600 mx-1 mt-1 p-3 rounded-xl items-center"
            >
              <Text className="text-brand-fg font-black text-sm">확인</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const dateToYmd = formatYmd;
