import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

interface Props {
  targetDate: Date;
}

const Banner = ({ targetDate }: { targetDate: string | null }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!targetDate) return;

    const calculateTimeLeft = () => {
      const targetTime = new Date(targetDate).getTime();
      const difference = targetTime - new Date().getTime();

      if (difference > 0) {
        setIsVisible(true);
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setIsVisible(false);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!isVisible) {
    return null;
  }

  const timeUnits = [
    { value: timeLeft.days, label: 'D' },
    { value: timeLeft.hours, label: 'H' },
    { value: timeLeft.minutes, label: 'M' },
    { value: timeLeft.seconds, label: 'S' }
  ];

  return (
    <div class="sticky top-0 z-50 bg-gradient-to-r from-secondary via-primary to-secondary text-bg text-center py-2 px-4 sm:px-6 lg:px-8 shadow-lg animate-fade-in-down">
      <div class="flex items-center justify-center gap-2 sm:gap-4">
        <span class="text-xs sm:text-sm font-medium flex items-center gap-1.5">
          <svg class="w-4 h-4 animate-spin-slow" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
          </svg>
          Trip starts in
        </span>
        <div className="flex items-center gap-1 sm:gap-2">
          {timeUnits.map((unit, index) => (
            <div key={index} className="flex items-center">
              <div className="flex flex-col items-center rounded-lg px-2 py-1">
                <span className="text-base sm:text-lg font-extrabold text-bg drop-shadow-sm transition-all duration-300 hover:scale-110">
                  {unit.value}
                </span>
                <span className="text-[10px] sm:text-xs text-bg/70 font-semibold drop-shadow-sm">
                  {unit.label}
                </span>
              </div>
              {index < timeUnits.length - 1 && (
                <span className="text-bg/50 mx-0.5 sm:mx-1 font-bold drop-shadow-sm animate-pulse">
                  :
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Banner;