const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;

export const useInactivityLogout = () => {
  const { isLoggedIn, logout } = useAuth();

  let timer: ReturnType<typeof setTimeout> | null = null;

  function resetTimer() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      logout('inactivity');
    }, INACTIVITY_TIMEOUT_MS);
  }

  function start() {
    if (!import.meta.client) return;
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();
  }

  function stop() {
    if (!import.meta.client) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
  }

  watch(
    isLoggedIn,
    (loggedIn) => {
      if (loggedIn) {
        start();
      } else {
        stop();
      }
    },
    { immediate: true }
  );

  onUnmounted(stop);
};
