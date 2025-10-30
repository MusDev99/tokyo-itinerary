import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

interface Phrase {
  jp: string;
  en: string;
}

interface Category {
  name: string;
  phrases: Phrase[];
}

interface JapaneseDictionaryProps {
  dictionaryData: {
    categories: Category[];
  };
}

const JapaneseDictionary = ({ dictionaryData }: JapaneseDictionaryProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCategories, setFilteredCategories] = useState(dictionaryData.categories);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    if (!lowerCaseSearchTerm) {
      setFilteredCategories(dictionaryData.categories);
      return;
    }

    const newFilteredCategories = dictionaryData.categories
      .map(category => {
        const filteredPhrases = category.phrases.filter(phrase =>
          phrase.jp.toLowerCase().includes(lowerCaseSearchTerm) ||
          phrase.en.toLowerCase().includes(lowerCaseSearchTerm)
        );
        return {
          ...category,
          phrases: filteredPhrases,
        };
      })
      .filter(category => category.phrases.length > 0); // Only show categories with matching phrases

    setFilteredCategories(newFilteredCategories);
  }, [searchTerm, dictionaryData.categories]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`Copied \"${text}\" to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="p-4 sm:p-6">
      <input
        type="text"
        placeholder="Search Japanese or English phrases..."
        className="w-full p-3 mb-6 border border-primary/30 rounded-lg bg-bg text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
        value={searchTerm}
        onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
      />

      {filteredCategories.length === 0 && searchTerm && (
        <p className="text-center text-text/70">No phrases found for \"{searchTerm}\".</p>
      )}

      {filteredCategories.map((category, index) => (
        <div key={category.name} className={index > 0 ? 'mt-8' : ''}>
          <h2 className="text-xl font-bold mb-4 text-text">{category.name}</h2>
          <ul className="space-y-3">
            {category.phrases.map(phrase => (
              <li key={phrase.jp} className="flex items-center justify-between p-3 bg-bg-alt rounded-lg shadow-sm border border-primary/10">
                <div className="flex-1">
                  <p className="text-lg font-semibold text-text jp-text">{phrase.jp}</p>
                  <p className="text-sm text-text/70">{phrase.en}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(phrase.jp)}
                  className="ml-4 p-2 bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-colors duration-200"
                  title="Copy Japanese phrase"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75m1.5 0H18a2.25 2 0 0 1 2.25 2.25v10.5a2.25 2 0 0 1-2.25 2.25H8.25A2.25 2 0 0 1 6 18V8.25m6.75 0v.008v.007H12v-.008-.007Z" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default JapaneseDictionary;