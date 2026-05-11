import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { backgroundOptions, lottieBackgrounds } from '../background/lottieBackgrounds';
import { live2dModelOptions } from '../live2dModelRegistry';
import { styles } from '../styles/appStyles';

export function AnimationDrawer({
  authSession,
  costumeNames,
  currentBackground,
  currentCostume,
  currentModel,
  onBackgroundSelect,
  onChangeProfileName,
  onCostumeSelect,
  onLogout,
  onModelSelect,
  onSaveProfile,
  profileLoading,
  profileName,
}) {
  const [activeTab, setActiveTab] = useState('backgrounds');
  const isRobotModel = currentModel === 'robot';
  const hasCostumes = !isRobotModel && (costumeNames?.length || 0) > 0;
  const showThirdTab = false;

  const tabTitle = useMemo(() => {
    if (activeTab === 'backgrounds') return 'Фоны';
    if (activeTab === 'models') return 'Модели';
    return 'Костюмы';
  }, [activeTab]);

  const safeActiveTab = showThirdTab ? activeTab : activeTab === 'costumes' ? 'backgrounds' : activeTab;

  const getCostumeLabel = useMemo(
    () => (name) => {
      if (currentModel === 'model') {
        if (name == null) return 'Наряд 1';
        if (name === 'costume_v0101') return 'Наряд 2';
      }

      return name ?? 'Стандартный';
    },
    [currentModel]
  );

  return (
    <View style={styles.screenCard}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Настройки</Text>
        <Text style={styles.screenSubtitle}>Профиль, модель, фон и наряды персонажа</Text>
      </View>

      <View style={styles.settingsProfileSection}>
        <Text style={styles.sectionTitle}>Профиль</Text>
        <TextInput
          style={styles.profileInput}
          placeholder="Твоё имя"
          placeholderTextColor="#7dd3c7"
          value={profileName}
          onChangeText={onChangeProfileName}
        />
        <Text style={styles.profileCodeLabel}>Код входа: {authSession?.access_code || 'нет данных'}</Text>
        <View style={styles.settingsActionRow}>
          <Pressable
            style={[styles.drawerCompactButton, styles.settingsPrimaryButton, profileLoading && styles.chatPrimaryButtonDisabled]}
            onPress={onSaveProfile}
            disabled={profileLoading}
          >
            {profileLoading ? <ActivityIndicator color="#ecfeff" /> : <Text style={styles.drawerCompactButtonText}>Сохранить</Text>}
          </Pressable>
          <Pressable style={styles.drawerLogoutButton} onPress={onLogout}>
            <Text style={styles.drawerLogoutButtonText}>Выйти</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabRowWrap}>
        <View style={showThirdTab ? styles.tabGridThree : styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, safeActiveTab === 'backgrounds' && styles.tabBtnActive]}
            onPress={() => setActiveTab('backgrounds')}
          >
            <Text style={[styles.tabBtnText, safeActiveTab === 'backgrounds' && styles.tabBtnTextActive]}>Фоны</Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, safeActiveTab === 'models' && styles.tabBtnActive]}
            onPress={() => setActiveTab('models')}
          >
            <Text style={[styles.tabBtnText, safeActiveTab === 'models' && styles.tabBtnTextActive]}>Модели</Text>
          </Pressable>

          {showThirdTab ? (
            <Pressable
              style={[styles.tabBtn, safeActiveTab === 'costumes' && styles.tabBtnActive]}
              onPress={() => setActiveTab('costumes')}
            >
              <Text style={[styles.tabBtnText, safeActiveTab === 'costumes' && styles.tabBtnTextActive]}>Костюмы</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionTitle}>{tabTitle}</Text>

      {safeActiveTab === 'backgrounds' ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {backgroundOptions.map((option) => {
            const selected = option.key === currentBackground;

            return (
              <Pressable
                key={option.key}
                onPress={() => onBackgroundSelect(option.key)}
                style={[styles.bgPreviewCard, selected && styles.bgPreviewCardActive]}
              >
                <LottieView autoPlay loop source={lottieBackgrounds[option.key]} style={styles.bgPreviewLottie} />
                <View style={styles.bgPreviewOverlay}>
                  <Text style={styles.bgPreviewText}>{option.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : safeActiveTab === 'models' ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {live2dModelOptions.map((model) => {
            const selected = model.key === currentModel;

            return (
              <Pressable
                key={model.key}
                onPress={() => onModelSelect(model.key)}
                style={[styles.modelBtn, selected && styles.modelBtnActive]}
              >
                <Text style={[styles.modelBtnText, selected && styles.modelBtnTextActive]}>{model.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {costumeNames.length > 0 ? (
            <>
              <Pressable
                onPress={() => onCostumeSelect(null)}
                style={[styles.itemBtn, currentCostume == null && styles.itemBtnActive]}
              >
                <Text style={[styles.itemText, currentCostume == null && styles.itemTextActive]}>{getCostumeLabel(null)}</Text>
              </Pressable>

              {costumeNames.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => onCostumeSelect(name)}
                  style={[styles.itemBtn, currentCostume === name && styles.itemBtnActive]}
                >
                  <Text style={[styles.itemText, currentCostume === name && styles.itemTextActive]}>{getCostumeLabel(name)}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>У этой модели нет отдельных костюмов.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
