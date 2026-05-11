import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProfile, loginAuth, logoutAuth, startAuth, updateProfile } from '../ai/api';
import { clearStoredSession, loadStoredSession, saveStoredSession } from '../ai/sessionStorage';

export function useAuthController(setStatusText) {
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState('start');
  const [authName, setAuthName] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authSession, setAuthSession] = useState(null);
  const [issuedAccessCode, setIssuedAccessCode] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const initializedSessionTokenRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await loadStoredSession();
        if (!cancelled && stored?.token) {
          setAuthSession(stored);
          setAuthName(stored.name || '');
        }
      } catch {
        // ignore local session load failure
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setProfileName(authSession?.name || '');
  }, [authSession?.name]);

  const loadProfile = useCallback(
    async (session = authSession) => {
      if (!session?.token) return null;

      const payload = await fetchProfile(session.token);
      const nextSession = {
        ...session,
        name: payload.name,
        access_code: payload.access_code,
      };
      setAuthSession(nextSession);
      setAuthName(payload.name);
      setProfileName(payload.name);
      await saveStoredSession(nextSession);
      return payload;
    },
    [authSession]
  );

  const handleAuthStart = useCallback(async () => {
    const name = authName.trim();
    if (name.length < 2) {
      setStatusText('Нужно имя не короче 2 символов');
      return;
    }

    setAuthLoading(true);
    try {
      const payload = await startAuth(name);
      setAuthSession(payload);
      setIssuedAccessCode(payload.access_code);
      setAuthCode(payload.access_code);
      await saveStoredSession(payload);
      setStatusText(`Профиль создан для ${payload.name}`);
    } catch (error) {
      setStatusText(`Ошибка входа: ${String(error?.message || error)}`);
    } finally {
      setAuthLoading(false);
    }
  }, [authName, setStatusText]);

  const handleAuthLogin = useCallback(async () => {
    const name = authName.trim();
    const code = authCode.trim();
    if (name.length < 2 || code.length < 8) {
      setStatusText('Укажи имя и 8-значный код');
      return;
    }

    setAuthLoading(true);
    try {
      const payload = await loginAuth(name, code);
      setAuthSession(payload);
      setIssuedAccessCode('');
      await saveStoredSession(payload);
      setStatusText(`Вход выполнен: ${payload.name}`);
    } catch (error) {
      setStatusText(`Ошибка авторизации: ${String(error?.message || error)}`);
    } finally {
      setAuthLoading(false);
    }
  }, [authCode, authName, setStatusText]);

  const handleLogout = useCallback(async () => {
    try {
      if (authSession?.token) {
        await logoutAuth(authSession.token).catch(() => undefined);
      }
    } finally {
      initializedSessionTokenRef.current = null;
      await clearStoredSession().catch(() => undefined);
      setAuthSession(null);
      setAuthCode('');
      setIssuedAccessCode('');
      setStatusText('Сессия завершена');
    }
  }, [authSession, setStatusText]);

  const handleSaveProfile = useCallback(async () => {
    const name = profileName.trim();
    if (!authSession?.token) return;
    if (name.length < 2) {
      setStatusText('Нужно имя не короче 2 символов');
      return;
    }

    setProfileLoading(true);
    try {
      const payload = await updateProfile(authSession.token, name);
      const nextSession = {
        ...authSession,
        name: payload.name,
        access_code: payload.access_code,
      };
      setAuthSession(nextSession);
      setAuthName(payload.name);
      setProfileName(payload.name);
      await saveStoredSession(nextSession);
      setStatusText('Профиль обновлён');
    } catch (error) {
      setStatusText(`Ошибка профиля: ${String(error?.message || error)}`);
    } finally {
      setProfileLoading(false);
    }
  }, [authSession, profileName, setStatusText]);

  return {
    authCode,
    authLoading,
    authMode,
    authName,
    authReady,
    authSession,
    handleAuthLogin,
    handleAuthStart,
    handleLogout,
    handleSaveProfile,
    initializedSessionTokenRef,
    issuedAccessCode,
    loadProfile,
    profileLoading,
    profileName,
    setAuthCode,
    setAuthMode,
    setAuthName,
    setAuthSession,
    setIssuedAccessCode,
    setProfileName,
  };
}
