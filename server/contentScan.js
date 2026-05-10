// Keyword/phrase content scanner. Returns categorized flags with counts and
// short excerpts so the Super Admin and readers can see what was detected.
//
// Categories are defined as arrays of trigger phrases. At scan time each
// phrase is matched word-boundary, case-insensitive against the book text.

export const CATEGORIES = {
  ableism: {
    label: 'Ableism',
    terms: ['ableist', 'retard', 'retarded', 'cripple', 'crippled', 'spaz', 'spastic', 'midget', 'gimp', 'imbecile'],
  },
  assault: {
    label: 'Assault',
    terms: ['assaulted', 'assault', 'beaten up', 'punched in the', 'kicked in the', 'stabbed', 'attacked her', 'attacked him', 'attacked them', 'jumped him', 'jumped her', 'mugging', 'mugged'],
  },
  attempted_rape: {
    label: 'Attempted rape',
    terms: ['attempted rape', 'tried to rape', 'almost raped', 'tried to force himself', 'forced himself on', 'forced herself on', 'wouldn\u2019t take no for an answer', 'pinned her down'],
  },
  cheating: {
    label: 'Cheating / Infidelity',
    terms: ['cheating on', 'cheated on', 'having an affair', 'had an affair', 'infidelity', 'adultery', 'unfaithful', 'two-timing', 'mistress', 'the other woman', 'the other man', 'plagiarism', 'plagiarized', 'plagiarised', 'academic dishonesty'],
  },
  child_abuse: {
    label: 'Child abuse',
    terms: ['child abuse', 'abused as a child', 'molested', 'molestation', 'pedophile', 'pedophilia', 'paedophile', 'paedophilia', 'child molester', 'beat the child', 'beat his son', 'beat his daughter', 'beat her son', 'beat her daughter', 'hit the child', 'hit his son', 'hit her daughter'],
  },
  depression: {
    label: 'Depression',
    terms: ['depression', 'depressed', 'clinically depressed', 'feel hopeless', 'feels hopeless', 'felt hopeless', 'no reason to live', 'nothing to live for', 'crushing sadness', 'unbearable sadness', 'major depressive', 'antidepressant', 'antidepressants'],
  },
  domestic_violence: {
    label: 'Domestic violence',
    terms: ['domestic violence', 'domestic abuse', 'beat his wife', 'beat her husband', 'beat his girlfriend', 'beat her boyfriend', 'spousal abuse', 'battered woman', 'battered wife', 'abusive husband', 'abusive partner', 'abusive boyfriend', 'abusive girlfriend', 'hit his wife', 'hit her husband'],
  },
  drug_overdose: {
    label: 'Drug overdose',
    terms: ['overdose', 'overdosed', 'overdosing', 'od\u2019d', 'drug overdose', 'heroin overdose', 'fentanyl overdose', 'pill overdose', 'took too many pills'],
  },
  eating_disorder: {
    label: 'Eating disorders',
    terms: ['anorexia', 'anorexic', 'bulimia', 'bulimic', 'binge eating', 'binge ate', 'binged and purged', 'purging', 'starve myself', 'starving herself', 'starving himself', 'throw up after eating', 'making herself throw up', 'making himself throw up', 'eating disorder'],
  },
  explicit_sex: {
    label: 'Explicit sexual content',
    terms: ['pornography', 'pornographic', 'porn', 'fucked her', 'fucked him', 'fucking her', 'fucking him', 'his cock', 'her pussy', 'blowjob', 'oral sex', 'eating her out', 'going down on her', 'going down on him', 'thrust into her', 'thrust into him', 'her wet', 'his erection', 'rock-hard', 'climaxed', 'orgasm', 'orgasmed'],
  },
  self_harm: {
    label: 'Self-harm / Suicide',
    terms: ['suicide', 'suicidal', 'kill myself', 'killed himself', 'killed herself', 'took his own life', 'took her own life', 'cutting myself', 'cut herself', 'cut himself', 'self-harm', 'self harm', 'slit her wrists', 'slit his wrists', 'hanged himself', 'hanged herself', 'jumped off the bridge', 'noose around his neck', 'noose around her neck'],
  },
  hate_speech: {
    label: 'Hate speech / Racism',
    terms: ['nigger', 'nigga', 'kike', 'spic', 'chink', 'gook', 'wetback', 'faggot', 'tranny', 'racial slur', 'racist remark', 'white supremacy', 'white supremacist', 'kkk', 'klan rally', 'lynching', 'lynched', 'ethnic cleansing'],
  },
  gore: {
    label: 'Gore / Graphic violence',
    terms: ['blood gushed', 'blood spurted', 'intestines spilled', 'decapitated', 'dismembered', 'severed head', 'severed arm', 'severed leg', 'guts spilled', 'ripped apart', 'torn limb from limb', 'eviscerated', 'disemboweled', 'skull caved', 'brains splattered', 'blood pooled'],
  },
  animal_abuse: {
    label: 'Animal abuse',
    terms: ['kicked the dog', 'kicked the cat', 'beat the dog', 'beat the cat', 'tortured the cat', 'tortured the dog', 'killed the dog', 'killed the cat', 'drowned the kittens', 'drowned the puppies', 'animal abuse', 'animal cruelty', 'skinned alive', 'set the dog on fire', 'set the cat on fire'],
  },
  incest: {
    label: 'Incest',
    terms: ['incest', 'incestuous', 'slept with my brother', 'slept with my sister', 'slept with her father', 'slept with his mother', 'slept with her uncle', 'slept with his aunt', 'molested by her father', 'molested by his father', 'molested by her uncle', 'father raped his daughter', 'mother raped her son'],
  },
  trafficking: {
    label: 'Human trafficking',
    terms: ['human trafficking', 'sex trafficking', 'trafficked', 'sex slave', 'sex slaves', 'forced into prostitution', 'sold into slavery', 'kidnapped and sold'],
  },
  mass_violence: {
    label: 'Weapons / Mass violence',
    terms: ['school shooting', 'mass shooting', 'shooter opened fire', 'opened fire on the crowd', 'opened fire on', 'gun rampage', 'active shooter', 'bomb threat', 'suicide bomber', 'improvised explosive', 'pipe bomb', 'mass casualty', 'gunned down the'],
  },
};

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
function escapeRegex(s) { return s.replace(ESCAPE_RE, '\\$&'); }

// Build a single combined regex per category so each scan is one pass over text.
const COMPILED = Object.fromEntries(
  Object.entries(CATEGORIES).map(([key, { terms }]) => {
    const alts = terms.map(escapeRegex).join('|');
    return [key, new RegExp(`\\b(?:${alts})\\b`, 'gi')];
  })
);

const MAX_EXCERPTS_PER_CATEGORY = 5;
const EXCERPT_PAD = 60;

function makeExcerpt(text, start, end) {
  const from = Math.max(0, start - EXCERPT_PAD);
  const to = Math.min(text.length, end + EXCERPT_PAD);
  let snippet = text.slice(from, to).replace(/\s+/g, ' ').trim();
  if (from > 0) snippet = '\u2026' + snippet;
  if (to < text.length) snippet += '\u2026';
  return snippet;
}

export function scanText(rawText) {
  const text = String(rawText || '');
  const flags = {};
  let totalHits = 0;
  if (!text) return { flags, totalHits };

  for (const [key, re] of Object.entries(COMPILED)) {
    re.lastIndex = 0;
    const excerpts = [];
    let count = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      count += 1;
      if (excerpts.length < MAX_EXCERPTS_PER_CATEGORY) {
        excerpts.push(makeExcerpt(text, m.index, m.index + m[0].length));
      }
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
    if (count > 0) {
      flags[key] = { label: CATEGORIES[key].label, count, excerpts };
      totalHits += count;
    }
  }
  return { flags, totalHits };
}

export function categoryLabels(flags) {
  if (!flags || typeof flags !== 'object') return [];
  return Object.entries(flags)
    .map(([k, v]) => v?.label || CATEGORIES[k]?.label || k)
    .filter(Boolean);
}
