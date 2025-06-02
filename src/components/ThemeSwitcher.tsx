import React, { useState, useEffect } from 'react';

const ThemeSwitcher = () => {
  const [theme, setTheme] = useState('autumn');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'autumn';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const themes = [
    { id: 'autumn', icon: '🍂', label: 'Autumn' },
    { id: 'winter', icon: '❄️', label: 'Winter' },
    { id: 'spring', icon: '🌸', label: 'Spring' },
    { id: 'summer', icon: '☀️', label: 'Summer' }
  ];

  const switchTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Dispatch custom event for theme change
    const event = new CustomEvent('theme-changed', {
      detail: { theme: newTheme }
    });
    document.dispatchEvent(event);
  };

  return (
    <div className="theme-switcher flex gap-2 p-2 bg-white/80 rounded-full shadow-lg">
      {themes.map(t => (
        <button
          key={t.id}
          className={`p-2 rounded-full transition-all ${
            theme === t.id ? 'bg-gray-200 scale-110' : 'hover:bg-gray-100'
          }`}
          onClick={() => switchTheme(t.id)}
          title={t.label}
          aria-label={t.label}
        >
          <span className="text-xl">{t.icon}</span>
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitcher;
