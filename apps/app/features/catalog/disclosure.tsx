import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

/** A section that opens and closes with a + / − button (D-051). */
export function Disclosure({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View className="border-line border-t">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        className="min-h-[52px] flex-row items-center justify-between"
      >
        <Text className="font-ui-semibold text-ink text-sm">{title}</Text>
        <View className="border-line bg-paper h-[30px] w-[30px] items-center justify-center rounded-full border">
          <Text className="font-ui text-ink text-lg leading-5">{open ? '−' : '+'}</Text>
        </View>
      </Pressable>
      {open ? <View className="gap-2 pb-4">{children}</View> : null}
    </View>
  );
}
