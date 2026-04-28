import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from "react-native";

type Props = Omit<ScrollViewProps, "children"> & {
  children: ReactNode;
  /** Extra space below the last input so the focused field is never flush with the keyboard. */
  bottomPadding?: number;
  /** Adjusts where padding/height anchors. Useful when there's a header above. */
  keyboardVerticalOffset?: number;
};

export function KeyboardSafeScroll({
  children,
  bottomPadding = 80,
  keyboardVerticalOffset = 0,
  contentContainerStyle,
  keyboardShouldPersistTaps = "handled",
  ...rest
}: Props) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={{ flex: 1 }}
    >
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { flexGrow: 1, paddingBottom: bottomPadding },
          contentContainerStyle,
        ]}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
