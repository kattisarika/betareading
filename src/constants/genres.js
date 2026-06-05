export const FICTION_SUBGENRES = [
  { value: 'action', label: 'Action' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'drama', label: 'Drama' },
  { value: 'erotica', label: 'Erotica' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'historical_fiction', label: 'Historical Fiction' },
  { value: 'horror', label: 'Horror' },
  { value: 'humor', label: 'Humor' },
  { value: 'lgbtq', label: 'LGBTQ+' },
  { value: 'literary_fiction', label: 'Literary Fiction' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'other', label: 'Other' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'romance', label: 'Romance' },
  { value: 'scifi', label: 'Sci-Fi' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'young_adult', label: 'Young Adult' },
  { value: 'kids', label: 'Kids Books' },
];

export const NON_FICTION_SUBGENRES = [
  { value: 'memoir', label: 'Memoir' },
  { value: 'biography', label: 'Biography' },
  { value: 'self_help', label: 'Self-Help' },
  { value: 'history', label: 'History' },
  { value: 'science', label: 'Science' },
  { value: 'business', label: 'Business' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'travel', label: 'Travel' },
];

export const AGE_GROUPS = [
  { value: 'kids', label: 'Kids' },
  { value: 'preteens_13', label: 'Preteens 13+' },
  { value: 'teenager_18', label: 'Teenager 18+' },
  { value: 'adults_25', label: 'Adults 25+' },
];

export const FICTION_SUBGENRE_VALUES = new Set(FICTION_SUBGENRES.map((g) => g.value));
export const NON_FICTION_SUBGENRE_VALUES = new Set(NON_FICTION_SUBGENRES.map((g) => g.value));

export const ALL_GENRE_LABELS = {
  fiction: 'Fiction',
  non_fiction: 'Non-Fiction',
  ...Object.fromEntries(FICTION_SUBGENRES.map((g) => [g.value, g.label])),
  ...Object.fromEntries(NON_FICTION_SUBGENRES.map((g) => [g.value, g.label])),
};

export const genreLabel = (v) => ALL_GENRE_LABELS[v] || v;

export function deriveBroadGenres(genres = []) {
  const broad = new Set();
  for (const g of genres) {
    if (g === 'non_fiction' || NON_FICTION_SUBGENRE_VALUES.has(g)) broad.add('non_fiction');
    else if (FICTION_SUBGENRE_VALUES.has(g) || g === 'fiction') broad.add('fiction');
  }
  return Array.from(broad);
}
