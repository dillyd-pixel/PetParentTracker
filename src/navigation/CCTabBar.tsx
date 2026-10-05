/**
 * The bottom nav bar of the Command Center shell (design Phase A).
 *
 * Exactly five slots, left to right:
 *
 *     Home | Pets | + | Records | More
 *
 * The four real slots are the tabs of `MainTabParamList`, drawn in declaration
 * order with the raised "+" inserted between Pets and Records (the third tab
 * position). The "+" is not a route: pressing it opens the root-stack Quick Add
 * modal via `onQuickAdd`, so there is no dead tap and no throwaway screen.
 *
 * Why a custom bar rather than the navigator's own: a detached, glowing centre
 * button (and a per-item press animation) is not expressible in tab bar styles.
 * This bar draws everything itself and hands navigation back to react-navigation
 * through `navigation.emit('tabPress')` + `navigate`, exactly as the default bar
 * does — so back behaviour, the focused route and deep links are unchanged.
 *
 * Every item scales subtly on press (Pressable + Animated, `useNativeDriver`,
 * which react-native-web also honours), matching the app's existing animation
 * style. Colours come from `../theme`; nothing here is hard-coded.
 */
import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SHADOW, SPACE } from '../theme';

/** The label and glyph for each of the four real slots. */
const SLOT: Record<string, { label: string; glyph: string }> = {
  Home: { label: 'Home', glyph: '🏠' },
  Pets: { label: 'Pets', glyph: '🐾' },
  Records: { label: 'Records', glyph: '🗂️' },
  More: { label: 'More', glyph: '☰' },
};

/** How far above the bar's top edge the "+" button floats. */
const PLUS_RAISE = 24;

interface TabItemProps {
  label: string;
  glyph: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
}

/** One slot: glyph over label, with a subtle spring-scale on press. */
function TabItem({
  label,
  glyph,
  focused,
  onPress,
  onLongPress,
  accessibilityLabel,
}: TabItemProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = useCallback(
    (toValue: number) => {
      Animated.spring(scale, {
        toValue,
        speed: 40,
        bounciness: 6,
        useNativeDriver: true,
      }).start();
    },
    [scale],
  );

  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => spring(0.88)}
      onPressOut={() => spring(1)}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={`nav-${label.toLowerCase()}`}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale }] }]}>
        <Text style={[styles.glyph, focused ? styles.glyphActive : null]}>{glyph}</Text>
        <Text style={[styles.label, focused ? styles.labelActive : null]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export interface CCTabBarProps extends BottomTabBarProps {
  /** Opened by the raised centre button (the root stack's Quick Add sheet). */
  onQuickAdd: () => void;
}

export function CCTabBar({
  state,
  descriptors,
  navigation,
  onQuickAdd,
}: CCTabBarProps): React.JSX.Element {
  // Read insets from context (never `useSafeAreaInsets`) so the bar still
  // renders if no provider is mounted — on web the insets are zero anyway.
  const insets = React.useContext(SafeAreaInsetsContext);
  const bottomPad = Math.max(insets?.bottom ?? 0, 8);

  const plusScale = useRef(new Animated.Value(1)).current;
  const springPlus = useCallback(
    (toValue: number) => {
      Animated.spring(plusScale, {
        toValue,
        speed: 40,
        bounciness: 8,
        useNativeDriver: true,
      }).start();
    },
    [plusScale],
  );

  const renderSlot = (routeIndex: number): React.JSX.Element => {
    const route = state.routes[routeIndex];
    const focused = state.index === routeIndex;
    const { options } = descriptors[route.key];
    const slot = SLOT[route.name] ?? { label: route.name, glyph: '•' };

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name as never);
      }
    };

    const onLongPress = () => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

    return (
      <TabItem
        key={route.key}
        label={slot.label}
        glyph={slot.glyph}
        focused={focused}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={
          typeof options.tabBarLabel === 'string' ? options.tabBarLabel : slot.label
        }
      />
    );
  };

  // The "+" sits in the middle: two slots, the button, then the rest.
  const plusIndex = 2;

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad }]}>
      {state.routes.map((route, index) => (
        <React.Fragment key={route.key}>
          {index === plusIndex ? (
            <Pressable
              style={styles.plusSlot}
              onPress={onQuickAdd}
              onPressIn={() => springPlus(0.9)}
              onPressOut={() => springPlus(1)}
              accessibilityRole="button"
              accessibilityLabel="Quick add"
              testID="nav-quick-add"
            >
              <Animated.View style={[styles.plus, { transform: [{ scale: plusScale }] }]}>
                <Text style={styles.plusGlyph}>＋</Text>
              </Animated.View>
            </Pressable>
          ) : null}
          {renderSlot(index)}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLOR.surface,
    borderTopWidth: 1,
    borderTopColor: COLOR.divider,
    paddingTop: 8,
    // The raised "+" overflows the bar on purpose.
    overflow: 'visible',
    shadowColor: '#202126',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 12,
  },
  item: { flex: 1, alignItems: 'center', paddingTop: 2 },
  itemInner: { alignItems: 'center', gap: 2 },
  glyph: { fontSize: 17, opacity: 0.55 },
  glyphActive: { opacity: 1 },
  label: { fontFamily: FONT_BODY, fontSize: 11, color: COLOR.textMuted },
  labelActive: { color: COLOR.accent, fontWeight: '700' },

  plusSlot: { width: 72, alignItems: 'center' },
  plus: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -PLUS_RAISE,
    marginBottom: SPACE.s1,
    borderWidth: 4,
    borderColor: COLOR.surface,
    ...SHADOW.pop,
  },
  plusGlyph: {
    fontFamily: FONT_HEAD,
    color: COLOR.white,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
  },
});
