import { useEffect, useState } from 'preact/hooks';

interface CountdownProps {
  targetDate: string | Date;
}

function getTimeDiff(target: Date) {
  const now = new Date();
  let diff = target.getTime() - now.getTime();
  if (diff < 0) diff = 0;

  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  diff -= years * (1000 * 60 * 60 * 24 * 365);
  const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
  diff -= months * (1000 * 60 * 60 * 24 * 30);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= days * (1000 * 60 * 60 * 24);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= hours * (1000 * 60 * 60);
  const minutes = Math.floor(diff / (1000 * 60));
  diff -= minutes * (1000 * 60);
  const seconds = Math.floor(diff / 1000);

  return { years, months, days, hours, minutes, seconds };
}

const Countdown = ({ targetDate }: CountdownProps) => {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const [time, setTime] = useState(() => getTimeDiff(target));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeDiff(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div class="flex gap-2">
      <div class="flex flex-col items-center">
        <div class="px-3 py-1 bg-amber-100/50 rounded-lg border border-amber-200/50 text-amber-900 font-mono font-bold min-w-[3rem] text-center">
          {time.years}
        </div>
        <span class="text-xs text-amber-800/60 mt-1">Years</span>
      </div>
      <div class="flex flex-col items-center">
        <div class="px-3 py-1 bg-amber-100/50 rounded-lg border border-amber-200/50 text-amber-900 font-mono font-bold min-w-[3rem] text-center">
          {time.months}
        </div>
        <span class="text-xs text-amber-800/60 mt-1">Months</span>
      </div>
      <div class="flex flex-col items-center">
        <div class="px-3 py-1 bg-amber-100/50 rounded-lg border border-amber-200/50 text-amber-900 font-mono font-bold min-w-[3rem] text-center">
          {time.days}
        </div>
        <span class="text-xs text-amber-800/60 mt-1">Days</span>
      </div>
      <div class="flex flex-col items-center">
        <div class="px-3 py-1 bg-amber-100/50 rounded-lg border border-amber-200/50 text-amber-900 font-mono font-bold min-w-[3rem] text-center">
          {time.hours}
        </div>
        <span class="text-xs text-amber-800/60 mt-1">Hours</span>
      </div>
      <div class="flex flex-col items-center">
        <div class="px-3 py-1 bg-amber-100/50 rounded-lg border border-amber-200/50 text-amber-900 font-mono font-bold min-w-[3rem] text-center">
          {time.minutes}
        </div>
        <span class="text-xs text-amber-800/60 mt-1">Minutes</span>
      </div>
      <div class="flex flex-col items-center">
        <div class="px-3 py-1 bg-amber-100/50 rounded-lg border border-amber-200/50 text-amber-900 font-mono font-bold min-w-[3rem] text-center">
          {time.seconds}
        </div>
        <span class="text-xs text-amber-800/60 mt-1">Seconds</span>
      </div>
    </div>
  );
};

export default Countdown; 