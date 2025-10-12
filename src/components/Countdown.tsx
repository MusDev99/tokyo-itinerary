import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

interface Props {
  targetDate: Date;
}

export default function Countdown({ targetDate }: Props) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const timeUnits = [
    { value: timeLeft.days, label: 'D' },
    { value: timeLeft.hours, label: 'H' },
    { value: timeLeft.minutes, label: 'M' },
    { value: timeLeft.seconds, label: 'S' }
  ];

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {timeUnits.map((unit, index) => (
        <div key={index} className="flex items-center">
          <div className="flex flex-col items-center bg-gradient-to-br from-white/90 to-white/70 rounded-lg px-2 py-1 shadow-sm border border-white/50">
            <span className="text-base sm:text-lg font-extrabold text-text drop-shadow-sm transition-all duration-300 hover:scale-110">
              {unit.value}
            </span>
            <span className="text-[10px] sm:text-xs text-text/70 font-semibold drop-shadow-sm">
              {unit.label}
            </span>
          </div>
          {index < timeUnits.length - 1 && (
            <span className="text-text/50 mx-0.5 sm:mx-1 font-bold drop-shadow-sm animate-pulse">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
} 