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
    <div className="theme-switcher flex gap-1 p-1 glass-effect rounded-full shadow-lg border border-primary/20">
      {themes.map(t => (
        <button
          key={t.id}
          className={`relative p-2 rounded-full transition-all duration-300 group ${
            theme === t.id 
              ? 'bg-gradient-to-r from-primary to-accent scale-110 shadow-md' 
              : 'hover:bg-primary/10 hover:scale-105'
          }`}
          onClick={() => switchTheme(t.id)}
          title={t.label}
          aria-label={t.label}
        >
          {/* Active indicator */}
          {theme === t.id && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-accent opacity-20 animate-pulse" />
          )}
          
          <span className={`relative z-10 text-xl transition-all duration-300 ${
            theme === t.id ? 'drop-shadow-sm' : 'group-hover:scale-110'
          }`}>
            {t.icon}
          </span>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-text text-bg text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            {t.label}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-text" />
          </div>
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitcher;
