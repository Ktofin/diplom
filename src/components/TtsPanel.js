import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function TtsPanel({
  loading,
  selectedSpeaker,
  speakers,
  text,
  onChangeText,
  onPlay,
  onSelectSpeaker,
}) {
  return (
    <View style={styles.ttsPanel}>
      <Text style={styles.ttsTitle}>Silero TTS</Text>
      <Text style={styles.ttsLabel}>Текст</Text>
      <TextInput
        multiline
        numberOfLines={4}
        placeholder="Введите текст для озвучки"
        placeholderTextColor="#94a3b8"
        style={styles.ttsInput}
        value={text}
        onChangeText={onChangeText}
      />

      <Text style={styles.ttsLabel}>Спикер</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.speakerRow}>
        {speakers.map((speaker) => {
          const selected = speaker === selectedSpeaker;
          return (
            <Pressable
              key={speaker}
              onPress={() => onSelectSpeaker(speaker)}
              style={[styles.speakerChip, selected && styles.speakerChipActive]}
            >
              <Text style={[styles.speakerChipText, selected && styles.speakerChipTextActive]}>
                {speaker}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={[styles.ttsButton, loading && styles.ttsButtonDisabled]} onPress={onPlay} disabled={loading}>
        {loading ? <ActivityIndicator color="#ecfeff" /> : <Text style={styles.ttsButtonText}>Озвучить</Text>}
      </Pressable>
    </View>
  );
}
