import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import tokens from '@repo/tokens';

const input = 'border-line bg-paper text-ink font-ui min-h-12 rounded-md border px-3.5 text-[15px]';

/** A password with an eye that shows or hides it (D-091). */
export function PasswordField({
  label,
  value,
  onChangeText,
  isNew,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  isNew?: boolean;
}): React.JSX.Element {
  const [shown, setShown] = useState(false);
  return (
    <View className="gap-1.5">
      <Text className="font-ui text-ink text-[13px]">{label}</Text>
      <View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!shown}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          textContentType={isNew ? 'newPassword' : 'password'}
          autoCapitalize="none"
          className={`${input} pr-[52px]`}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          accessibilityState={{ selected: shown }}
          onPress={() => setShown((s) => !s)}
          className="absolute right-1 top-1 h-10 w-10 items-center justify-center rounded-full"
        >
          <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} color={tokens.colors['ink-muted']} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Six boxes for the emailed code (D-091): typing moves on, Backspace moves back, and pasting the code or the phone's
 * one-time-code suggestion (the first box) fills all six.
 */
export function CodeBoxes({ onChange }: { onChange: (code: string) => void }): React.JSX.Element {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const boxes = useRef<(TextInput | null)[]>([]);
  const put = (from: number, text: string): void => {
    const next = [...digits];
    const typed = text.replace(/\D/g, '').slice(0, 6 - from);
    if (!typed) {
      next[from] = '';
    } else {
      typed.split('').forEach((d, i) => (next[from + i] = d));
      boxes.current[Math.min(from + typed.length, 5)]?.focus();
    }
    setDigits(next);
    onChange(next.join(''));
  };
  return (
    <View className="flex-row gap-2" accessibilityLabel="6-digit code">
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          value={d}
          onChangeText={(t) => put(i, t)}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
              boxes.current[i - 1]?.focus();
              put(i - 1, '');
            }
          }}
          keyboardType="number-pad"
          maxLength={i === 0 ? 6 : 1}
          textContentType={i === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          accessibilityLabel={`Digit ${i + 1}`}
          className="border-line bg-paper text-ink font-ui-semibold h-14 flex-1 rounded-md border text-center text-[22px]"
        />
      ))}
    </View>
  );
}
