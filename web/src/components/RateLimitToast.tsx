interface RateLimitToastProps {
  visible: boolean;
  message?: string | null;
}

export function RateLimitToast({ visible, message }: RateLimitToastProps) {
  if (!visible) return null;
  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 p-4 rounded-lg shadow-lg">
        <p className="font-medium">请求过于频繁</p>
        <p className="text-sm mt-1">{message ?? '请稍后再试，避免频繁刷新页面'}</p>
      </div>
    </div>
  );
}
