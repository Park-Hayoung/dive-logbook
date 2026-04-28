import { forwardRef, type ReactNode } from "react";
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

export const KeyboardSafeScroll = forwardRef<ScrollView, Props>(
  function KeyboardSafeScroll(
    {
      children,
      bottomPadding = 80,
      keyboardVerticalOffset = 0,
      contentContainerStyle,
      keyboardShouldPersistTaps = "handled",
      ...rest
    },
    ref,
  ) {
    return (
      <KeyboardAvoidingView
        // "padding" on both platforms is the most reliable on Android with
        // edgeToEdgeEnabled — "height" tries to resize the window which doesn't
        // work cleanly when content draws under system bars.
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={ref}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          // iOS auto-scrolls focused TextInput above the keyboard.
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
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
  },
);
