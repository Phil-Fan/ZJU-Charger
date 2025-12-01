import { isNightTime } from '@/lib/time';

export function NightNotice() {
  if (!isNightTime()) return null;
  return (
    <div className="w-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
      <p className="text-sm text-blue-800 dark:text-blue-200">夜深了，充电服务可能暂停，请注意休息 🌙</p>
    </div>
  );
}
