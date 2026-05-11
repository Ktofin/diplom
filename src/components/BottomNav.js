import { Pressable, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

const NAV_ITEMS = [
  { key: 'chat', label: 'Чат' },
  { key: 'camera', label: 'Камера' },
  { key: 'settings', label: 'Настройки' },
];

export function BottomNav({ activeView, onSelect }) {
  return (
    <View style={styles.bottomNav}>
      {NAV_ITEMS.map((item) => {
        const active = activeView === item.key;
        return (
          <Pressable
            key={item.key}
            style={[styles.bottomNavButton, active && styles.bottomNavButtonActive]}
            onPress={() => onSelect(item.key)}
          >
            <Text style={[styles.bottomNavText, active && styles.bottomNavTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
