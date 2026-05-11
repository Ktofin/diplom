import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function AuthScreen({
  authCode,
  authLoading,
  authMode,
  authName,
  onChangeAuthCode,
  onChangeAuthName,
  onLogin,
  onSetMode,
  onStart,
}) {
  return (
    <View style={styles.authOverlay}>
      <View style={styles.authCard}>
        <Text style={styles.authTitle}>Вход в систему</Text>
        <Text style={styles.authSubtitle}>
          Первый вход создаёт профиль и выдаёт 8-значный код. Потом входишь по имени и этому коду.
        </Text>

        <View style={styles.authModeRow}>
          <Pressable
            style={[styles.authModeButton, authMode === 'start' && styles.authModeButtonActive]}
            onPress={() => onSetMode('start')}
          >
            <Text style={[styles.authModeText, authMode === 'start' && styles.authModeTextActive]}>Первый вход</Text>
          </Pressable>
          <Pressable
            style={[styles.authModeButton, authMode === 'login' && styles.authModeButtonActive]}
            onPress={() => onSetMode('login')}
          >
            <Text style={[styles.authModeText, authMode === 'login' && styles.authModeTextActive]}>Вход по коду</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.authInput}
          placeholder="Твоё имя"
          placeholderTextColor="#7dd3c7"
          value={authName}
          onChangeText={onChangeAuthName}
        />

        {authMode === 'login' ? (
          <TextInput
            style={styles.authInput}
            placeholder="8-значный код"
            placeholderTextColor="#7dd3c7"
            value={authCode}
            onChangeText={onChangeAuthCode}
            keyboardType="number-pad"
          />
        ) : null}

        <Pressable
          style={[styles.authPrimaryButton, authLoading && styles.chatPrimaryButtonDisabled]}
          onPress={authMode === 'start' ? onStart : onLogin}
          disabled={authLoading}
        >
          {authLoading ? (
            <ActivityIndicator color="#ecfeff" />
          ) : (
            <Text style={styles.authPrimaryButtonText}>{authMode === 'start' ? 'Создать профиль' : 'Войти'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
