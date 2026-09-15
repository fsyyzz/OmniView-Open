/**
 * GitHub / Pandoc 风格 emoji shortcode 预处理
 * `:smile:` → 😄
 * 仅替换已知短码；未知短码原样保留；代码块与行内代码受保护
 */

/** 常用短码表（覆盖文档/发行说明高频场景，避免引入重量级依赖） */
export const EMOJI_SHORTCODE_MAP: Record<string, string> = {
  smile: '😄',
  smiley: '😃',
  grinning: '😀',
  blush: '😊',
  wink: '😉',
  heart_eyes: '😍',
  kissing_heart: '😘',
  thinking: '🤔',
  thinking_face: '🤔',
  sunglasses: '😎',
  slight_smile: '🙂',
  upside_down_face: '🙃',
  sob: '😭',
  joy: '😂',
  rofl: '🤣',
  cry: '😢',
  sweat_smile: '😅',
  disappointed: '😞',
  angry: '😠',
  rage: '😡',
  scream: '😱',
  sleeping: '😴',
  dizzy_face: '😵',
  exploding_head: '🤯',
  wave: '👋',
  thumbsup: '👍',
  thumbsdown: '👎',
  '+1': '👍',
  '-1': '👎',
  ok_hand: '👌',
  clap: '👏',
  pray: '🙏',
  fire: '🔥',
  rocket: '🚀',
  star: '⭐',
  sparkles: '✨',
  zap: '⚡',
  boom: '💥',
  tada: '🎉',
  confetti_ball: '🎊',
  gift: '🎁',
  balloon: '🎈',
  check: '✅',
  white_check_mark: '✅',
  heavy_check_mark: '✔️',
  x: '❌',
  negative_squared_cross_mark: '❎',
  warning: '⚠️',
  exclamation: '❗',
  question: '❓',
  information_source: 'ℹ️',
  bulb: '💡',
  book: '📖',
  books: '📚',
  memo: '📝',
  pencil: '✏️',
  pencil2: '✏️',
  mag: '🔍',
  link: '🔗',
  lock: '🔒',
  unlock: '🔓',
  key: '🔑',
  hammer: '🔨',
  wrench: '🔧',
  gear: '⚙️',
  bug: '🐛',
  package: '📦',
  label: '🏷️',
  pushpin: '📌',
  paperclip: '📎',
  file_folder: '📁',
  open_file_folder: '📂',
  page_facing_up: '📄',
  chart_with_upwards_trend: '📈',
  chart_with_downwards_trend: '📉',
  bar_chart: '📊',
  clipboard: '📋',
  calendar: '📅',
  hourglass: '⌛',
  hourglass_flowing_sand: '⏳',
  alarm_clock: '⏰',
  stopwatch: '⏱️',
  computer: '💻',
  keyboard: '⌨️',
  mobile_phone: '📱',
  email: '📧',
  envelope: '✉️',
  mailbox: '📫',
  bell: '🔔',
  no_bell: '🔕',
  speech_balloon: '💬',
  thought_balloon: '💭',
  eyes: '👀',
  brain: '🧠',
  muscle: '💪',
  unicorn: '🦄',
  dragon: '🐉',
  snake: '🐍',
  turtle: '🐢',
  octopus: '🐙',
  whale: '🐳',
  dog: '🐶',
  cat: '🐱',
  fox_face: '🦊',
  panda_face: '🐼',
  coffee: '☕',
  tea: '🍵',
  beer: '🍺',
  pizza: '🍕',
  cake: '🍰',
  apple: '🍎',
  green_apple: '🍏',
  earth_africa: '🌍',
  earth_americas: '🌎',
  earth_asia: '🌏',
  sunny: '☀️',
  cloud: '☁️',
  umbrella: '☔',
  snowflake: '❄️',
  rainbow: '🌈',
  ocean: '🌊',
  mountain: '⛰️',
  camping: '🏕️',
  house: '🏠',
  office: '🏢',
  hospital: '🏥',
  school: '🏫',
  car: '🚗',
  airplane: '✈️',
  ship: '🚢',
  bike: '🚲',
  traffic_light: '🚦',
  construction: '🚧',
  recycling_symbol: '♻️',
  arrow_right: '➡️',
  arrow_left: '⬅️',
  arrow_up: '⬆️',
  arrow_down: '⬇️',
  arrows_counterclockwise: '🔄',
  rewind: '⏪',
  fast_forward: '⏩',
  black_right_pointing_triangle: '▶',
  black_left_pointing_triangle: '◀',
  pause_button: '⏸️',
  play_or_pause_button: '⏯️',
  red_circle: '🔴',
  large_blue_circle: '🔵',
  green_circle: '🟢',
  yellow_circle: '🟡',
  purple_circle: '🟣',
  white_circle: '⚪',
  black_circle: '⚫',
  trophy: '🏆',
  medal: '🏅',
  sports_medal: '🏅',
  dart: '🎯',
  game_die: '🎲',
  video_game: '🎮',
  musical_note: '🎵',
  notes: '🎶',
  camera: '📷',
  movie_camera: '🎥',
  art: '🎨',
  mortar_board: '🎓',
  crown: '👑',
  gem: '💎',
  moneybag: '💰',
  dollar: '💵',
  credit_card: '💳',
  balance_scale: '⚖️',
  hammer_and_wrench: '🛠️',
  shield: '🛡️',
  sword: '⚔️',
  bomb: '💣',
  skull: '💀',
  ghost: '👻',
  robot: '🤖',
  alien: '👽',
  space_invader: '👾',
  hankey: '💩',
  hundred: '💯',
  '100': '💯',
  new: '🆕',
  free: '🆓',
  sos: '🆘',
  cool: '🆒',
  ok: '🆗',
  up: '🆙',
  vs: '🆚',
  abc: '🔤',
  abcd: '🔡',
  capital_abcd: '🔠',
  hash: '#️⃣',
  zero: '0️⃣',
  one: '1️⃣',
  two: '2️⃣',
  three: '3️⃣',
  four: '4️⃣',
  five: '5️⃣',
  six: '6️⃣',
  seven: '7️⃣',
  eight: '8️⃣',
  nine: '9️⃣',
  keycap_ten: '🔟',
};

const SLOT_PREFIX = '\u0000OVEM';
const SLOT_SUFFIX = '\u0000';

function protectCodeSegments(source: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  const stash = (chunk: string): string => {
    const index = slots.length;
    slots.push(chunk);
    return `${SLOT_PREFIX}${index}${SLOT_SUFFIX}`;
  };

  let text = source.replace(
    /(^|\n)(```[\s\S]*?\n```[ \t]*(?:\n|$)|~~~[\s\S]*?\n~~~[ \t]*(?:\n|$))/g,
    (_m, lead: string, block: string) => `${lead}${stash(block)}`,
  );
  text = text.replace(/(?<!`)(`+)(?!`)([^\n]*?)\1(?!`)/g, (match) => stash(match));
  return { text, slots };
}

function restoreCodeSegments(text: string, slots: string[]): string {
  return text.replace(new RegExp(`${SLOT_PREFIX}(\\d+)${SLOT_SUFFIX}`, 'g'), (_m, index: string) => {
    return slots[Number(index)] ?? '';
  });
}

export interface EmojiProcessResult {
  markdown: string;
  replaceCount: number;
}

/**
 * 将 `:shortcode:` 替换为 Unicode emoji
 */
export function processEmojiShortcodes(source: string): EmojiProcessResult {
  if (!source) return { markdown: source, replaceCount: 0 };

  const { text: protectedText, slots } = protectCodeSegments(source);
  let replaceCount = 0;

  const replaced = protectedText.replace(/:([a-zA-Z0-9_+-]+):/g, (full, name: string) => {
    const emoji = EMOJI_SHORTCODE_MAP[name] || EMOJI_SHORTCODE_MAP[name.toLowerCase()];
    if (!emoji) return full;
    replaceCount += 1;
    return emoji;
  });

  return {
    markdown: restoreCodeSegments(replaced, slots),
    replaceCount,
  };
}

export function resolveEmojiShortcode(name: string): string | null {
  return EMOJI_SHORTCODE_MAP[name] || EMOJI_SHORTCODE_MAP[name.toLowerCase()] || null;
}
