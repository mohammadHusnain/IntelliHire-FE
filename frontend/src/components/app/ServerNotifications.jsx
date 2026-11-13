import { useCallback, useEffect, useRef, useState } from "react";
import { notificationsApi } from "@/api/notificationsApi";
import { useAuthStore } from "@/store/authStore";
import { NotificationsPopover } from "@/components/app/HeaderMenus";

export default function ServerNotifications({ emptyText }) {
  const userId = useAuthStore((state) => state.user?.id);
  if (!userId) return null;
  return <ServerNotificationsForUser key={userId} emptyText={emptyText} />;
}

function ServerNotificationsForUser({ emptyText }) {
  const [list, setList] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const countPending = useRef(false);
  const pagePending = useRef(false);
  const retryPage = useRef(1);
  const markAllPending = useRef(false);
  const [readAllBusy, setReadAllBusy] = useState(false);

  const refreshCount = useCallback(async (signal) => {
    if (countPending.current) return;
    countPending.current = true;
    try {
      setUnreadCount(await notificationsApi.unreadCount({ signal }));
    } catch (cause) {
      if (!signal?.aborted) setError(cause?.message || "Couldn't refresh the notification count.");
    } finally {
      countPending.current = false;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => !controller.signal.aborted && refreshCount(controller.signal));
    const interval = window.setInterval(() => void refreshCount(), 60000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refreshCount]);

  const loadPage = useCallback(async (nextPage = 1) => {
    if (pagePending.current) return;
    pagePending.current = true;
    retryPage.current = nextPage;
    const append = nextPage > 1;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const result = await notificationsApi.list(nextPage);
      setList((current) => append ? [...current, ...result.results] : result.results);
      setPage(nextPage);
      setHasNext(result.hasNext);
      void refreshCount();
    } catch (cause) {
      setError(cause?.message || "Couldn't load notifications.");
    } finally {
      pagePending.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [refreshCount]);

  const onRead = useCallback(async (id) => {
    setError("");
    try {
      await notificationsApi.markRead(id);
      setList((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
      void refreshCount();
    } catch (cause) {
      setError(cause?.message || "Couldn't mark this notification as read.");
    }
  }, [refreshCount]);

  const onReadAll = useCallback(async () => {
    if (markAllPending.current) return;
    markAllPending.current = true;
    setReadAllBusy(true);
    setError("");
    try {
      await notificationsApi.markAllRead();
      setList((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (cause) {
      setError(cause?.message || "Couldn't mark notifications as read.");
    } finally {
      markAllPending.current = false;
      setReadAllBusy(false);
    }
  }, []);

  return (
    <NotificationsPopover
      list={list}
      unreadCount={unreadCount}
      onOpen={() => void loadPage(1)}
      onRead={onRead}
      onReadAll={onReadAll}
      loading={loading}
      loadingMore={loadingMore}
      hasMore={hasNext}
      onLoadMore={() => void loadPage(page + 1)}
      readAllBusy={readAllBusy}
      error={error}
      onRetry={() => void loadPage(retryPage.current)}
      emptyText={emptyText}
    />
  );
}
