import { SiAstro, SiTypescript, SiTailwindcss, SiPreact } from 'react-icons/si';

const TechStack = () => {
  const techs = [
    {
      name: 'Astro',
      icon: SiAstro,
      url: 'https://astro.build'
    },
    {
      name: 'TypeScript',
      icon: SiTypescript,
      url: 'https://www.typescriptlang.org'
    },
    {
      name: 'Tailwind CSS',
      icon: SiTailwindcss,
      url: 'https://tailwindcss.com'
    },
    {
      name: 'Preact',
      icon: SiPreact,
      url: 'https://preactjs.com'
    }
  ];

  return (
    <div className="text-center">
      <h3 className="text-sm font-semibold text-text uppercase tracking-wider mb-4">Tech Stack</h3>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        {techs.map((tech) => (
          <a
            key={tech.name}
            href={tech.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-bg/80 rounded-full border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 text-text/80 hover:text-text flex items-center gap-2"
          >
            <tech.icon className="w-4 h-4" />
            {tech.name}
          </a>
        ))}
      </div>
    </div>
  );
};

export default TechStack; 