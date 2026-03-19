import type { PanelId } from "@/components/home/FeatureMenu";
import type { MixLayer, VibeId } from "@/features/music/types";
import type { MoodId, MoodSuggestion } from "@/features/mood/types";

export type AppLanguage = "en" | "ja";

type TranslationShape = {
  sidebar: {
    brand: string;
    navAriaLabel: string;
    languageLabel: string;
    languageAriaLabel: string;
    english: string;
    japanese: string;
  };
  nav: Record<PanelId, string>;
  common: {
    start: string;
    pause: string;
    resume: string;
    reset: string;
    cancel: string;
    open: string;
    save: string;
    delete: string;
    confirmDelete: string;
    custom: string;
    on: string;
    off: string;
    active: string;
    volume: string;
  };
  focus: {
    title: string;
    subtitle: string;
    subtitleFocusMode: string;
    modeLabel: string;
    exit: string;
    sessionPresets: string;
    lightPreset: string;
    deepPreset: string;
    focusMinutes: string;
    breakMinutes: string;
    intentionLabel: string;
    intentionPlaceholder: string;
    focusSession: string;
    breakSession: string;
    statusIdle: string;
    statusFocus: string;
    statusBreak: string;
    sessionStatusTitle: string;
    intentionPrefix: string;
    cozyAudio: string;
    takeYourTime: string;
    focusModeButton: string;
    playMusic: string;
    pauseMusic: string;
    newTrack: string;
    rain: string;
    vinyl: string;
    completionTitle: string;
    completionMinutes: string;
    startBreak: string;
    continueFocusing: string;
    dismiss: string;
    completionLines: string[];
    customPresetAria: string;
  };
  music: {
    title: string;
    subtitle: string;
    vibe: string;
    play: string;
    pause: string;
    newTrack: string;
    rain: string;
    vinyl: string;
    mix: string;
    resetMix: string;
    mixHelp: string;
    groups: {
      global: string;
      music: string;
      atmosphere: string;
    };
    layers: Record<MixLayer, string>;
    nowPlaying: string;
    vibeLabel: string;
    keyLabel: string;
    tempoLabel: string;
    sectionLabel: string;
    rainLabel: string;
    vinylLabel: string;
  };
  vibes: Record<VibeId, string>;
  sections: Record<string, string>;
  breathe: {
    title: string;
    subtitle: string;
    patterns: {
      "4444": string;
      "446": string;
      "478": string;
    };
    phaseLabels: {
      inhale: string;
      hold: string;
      exhale: string;
      holdOut: string;
    };
  };
  mood: {
    title: string;
    subtitle: string;
    prompt: string;
    emptyState: string;
    moods: Record<MoodId, string>;
    suggestions: Record<MoodId, MoodSuggestion[]>;
  };
  gratitude: {
    title: string;
    subtitle: string;
    entryLabel: string;
    placeholder: string;
    save: string;
    recentEntries: string;
    emptyState: string;
  };
  compliment: {
    title: string;
    subtitle: string;
    sweetNote: string;
    keepToday: string;
    showAnother: string;
  };
};

const EN: TranslationShape = {
  sidebar: {
    brand: "A Peaceful Room",
    navAriaLabel: "Feature menu",
    languageLabel: "Language",
    languageAriaLabel: "Choose language",
    english: "English",
    japanese: "日本語"
  },
  nav: {
    focus: "Focus",
    music: "Music",
    breathe: "Breathe",
    mood: "Mood",
    gratitude: "Gratitude",
    compliment: "Compliment",
    reader: "Reader"
  },
  common: {
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    reset: "Reset",
    cancel: "Cancel",
    open: "Open",
    save: "Save",
    delete: "Delete",
    confirmDelete: "Confirm delete",
    custom: "Custom",
    on: "On",
    off: "Off",
    active: "Active",
    volume: "volume"
  },
  focus: {
    title: "Focus",
    subtitle: "A cozy workspace for one calm session.",
    subtitleFocusMode: "Focus Mode is on. Keep it simple.",
    modeLabel: "Focus Mode",
    exit: "Exit",
    sessionPresets: "Session Presets",
    lightPreset: "Light Focus",
    deepPreset: "Deep Focus",
    focusMinutes: "Focus minutes",
    breakMinutes: "Break minutes",
    intentionLabel: "What are you focusing on?",
    intentionPlaceholder: "One small intention for this session...",
    focusSession: "Focus Session",
    breakSession: "Break",
    statusIdle: "Take your time. Start when you're ready.",
    statusFocus: "Settle in. One small step at a time.",
    statusBreak: "Soft pause. Let your mind breathe.",
    sessionStatusTitle: "Session Status",
    intentionPrefix: "Intention",
    cozyAudio: "Cozy Audio",
    takeYourTime: "Take your time.",
    focusModeButton: "Focus Mode",
    playMusic: "Play Music",
    pauseMusic: "Pause Music",
    newTrack: "New Track",
    rain: "Rain",
    vinyl: "Vinyl",
    completionTitle: "✦ Session Complete",
    completionMinutes: "{minutes} minutes completed.",
    startBreak: "Start Break",
    continueFocusing: "Continue Focusing",
    dismiss: "Dismiss",
    completionLines: [
      "Nice work.",
      "You finished a focus session.",
      "That was a good stretch of focus.",
      "Well done. Ready for a pause?",
      "You made space for some real focus."
    ],
    customPresetAria: "Custom preset, use the minute inputs below"
  },
  music: {
    title: "Music",
    subtitle: "Procedural engine with evolving sections.",
    vibe: "Vibe",
    play: "Play",
    pause: "Pause",
    newTrack: "New Track",
    rain: "Rain",
    vinyl: "Vinyl",
    mix: "Mix",
    resetMix: "Reset Mix",
    mixHelp: "Master controls overall mix level. Output Boost controls final loudness before limiting.",
    groups: {
      global: "Global",
      music: "Music",
      atmosphere: "Atmosphere"
    },
    layers: {
      master: "Master",
      outputBoost: "Output Boost",
      chords: "Chords",
      melody: "Melody",
      bass: "Bass",
      drums: "Drums",
      rain: "Rain",
      vinyl: "Vinyl"
    },
    nowPlaying: "Now Playing",
    vibeLabel: "Vibe",
    keyLabel: "Key",
    tempoLabel: "Tempo",
    sectionLabel: "Section",
    rainLabel: "Rain",
    vinylLabel: "Vinyl"
  },
  vibes: {
    lofi: "Lofi",
    piano: "Piano",
    jazz: "Jazz"
  },
  sections: {
    intro: "Intro",
    main: "Main",
    mainA: "Main A",
    mainB: "Main B",
    variation: "Variation",
    break: "Break",
    transition: "Transition",
    return: "Return",
    outro: "Outro"
  },
  breathe: {
    title: "Breathe",
    subtitle: "Choose a gentle pattern, then press Start.",
    patterns: {
      "4444": "Box Breathing (4-4-4-4)",
      "446": "Calm Breathing (4-4-6)",
      "478": "Deep Relaxation (4-7-8)"
    },
    phaseLabels: {
      inhale: "inhale",
      hold: "hold",
      exhale: "exhale",
      holdOut: "hold"
    }
  },
  mood: {
    title: "Mood",
    subtitle: "Select what you are feeling right now.",
    prompt: "You could try:",
    emptyState: "Pick one mood to get gentle suggestions.",
    moods: {
      stressed: "stressed",
      tired: "tired",
      restless: "restless",
      lonely: "lonely",
      overwhelmed: "overwhelmed",
      okay: "okay",
      peaceful: "peaceful"
    },
    suggestions: {
      stressed: [
        { text: "You could try a slower breathing cycle for a minute.", href: "/breathe" },
        { text: "Maybe head to a softer music layer for a few minutes.", href: "/music" }
      ],
      tired: [
        { text: "It might help to rest with quiet night music.", href: "/music" },
        { text: "You could keep things simple and write one gratitude line.", href: "/gratitude" }
      ],
      restless: [
        { text: "You could try one short focus block to settle in.", href: "/focus" },
        { text: "Maybe head to a calm breathing cycle first.", href: "/breathe" }
      ],
      lonely: [
        { text: "It might help to receive a gentle compliment.", href: "/compliment" },
        { text: "Maybe stay with soft music for a little while.", href: "/music" }
      ],
      overwhelmed: [
        { text: "You could take one 4-4-6 breath cycle first.", href: "/breathe" },
        { text: "Maybe keep it small with one gratitude note.", href: "/gratitude" }
      ],
      okay: [
        { text: "You could keep the mood and drift with soft dawn.", href: "/music" },
        { text: "Maybe turn this calm into one focus session.", href: "/focus" }
      ],
      peaceful: [
        { text: "You could stay here and enjoy a gentle track.", href: "/music" },
        { text: "Maybe carry this feeling into a gratitude note.", href: "/gratitude" }
      ]
    }
  },
  gratitude: {
    title: "Gratitude",
    subtitle: "What is one small thing you are grateful for?",
    entryLabel: "Gratitude entry",
    placeholder: "A quiet morning, warm tea, a kind message...",
    save: "Save",
    recentEntries: "Recent entries",
    emptyState: "Your gratitude list is empty. Add something you're thankful for today."
  },
  compliment: {
    title: "Compliment",
    subtitle: "A gentle line for this moment.",
    sweetNote: "Sweet Note",
    keepToday: "Keep this with you today.",
    showAnother: "Show another note"
  }
};

const JA: TranslationShape = {
  sidebar: {
    brand: "やすらぎの部屋",
    navAriaLabel: "機能メニュー",
    languageLabel: "言語",
    languageAriaLabel: "言語を選択",
    english: "English",
    japanese: "日本語"
  },
  nav: {
    focus: "集中",
    music: "音楽",
    breathe: "呼吸",
    mood: "気分",
    gratitude: "感謝",
    compliment: "ひとこと",
    reader: "リーダー"
  },
  common: {
    start: "開始",
    pause: "一時停止",
    resume: "再開",
    reset: "リセット",
    cancel: "キャンセル",
    open: "開く",
    save: "保存する",
    delete: "削除",
    confirmDelete: "削除する",
    custom: "カスタム",
    on: "オン",
    off: "オフ",
    active: "有効",
    volume: "音量"
  },
  focus: {
    title: "集中",
    subtitle: "静かに集中できる、小さな作業スペースです。",
    subtitleFocusMode: "フォーカスモード中です。必要なものだけを表示します。",
    modeLabel: "フォーカスモード",
    exit: "終了",
    sessionPresets: "セッション設定",
    lightPreset: "ライト集中",
    deepPreset: "しっかり集中",
    focusMinutes: "集中時間（分）",
    breakMinutes: "休憩時間（分）",
    intentionLabel: "今回は何に集中しますか？",
    intentionPlaceholder: "今回の小さな目標を書いてみましょう…",
    focusSession: "集中セッション",
    breakSession: "休憩",
    statusIdle: "ゆっくりどうぞ。準備ができたら始めましょう。",
    statusFocus: "落ち着いて、ひとつずつ進めていきましょう。",
    statusBreak: "ひと息ついて、ゆっくり整えましょう。",
    sessionStatusTitle: "セッションの状態",
    intentionPrefix: "目標",
    cozyAudio: "おだやか音楽",
    takeYourTime: "ゆっくりどうぞ。",
    focusModeButton: "フォーカスモード",
    playMusic: "音楽を再生",
    pauseMusic: "音楽を一時停止",
    newTrack: "新しい曲",
    rain: "雨音",
    vinyl: "レコードノイズ",
    completionTitle: "✦ セッション完了",
    completionMinutes: "{minutes}分の集中を終えました。",
    startBreak: "休憩を始める",
    continueFocusing: "もう一度集中する",
    dismiss: "とじる",
    completionLines: [
      "よく頑張りました。",
      "集中セッションを終えました。",
      "とても良い集中時間でした。",
      "おつかれさまです。少し休みますか？",
      "自分のための時間を作れましたね。"
    ],
    customPresetAria: "カスタム設定です。下の分数入力を使ってください"
  },
  music: {
    title: "音楽",
    subtitle: "雰囲気に合わせて変化する、やさしい自動演奏です。",
    vibe: "雰囲気",
    play: "再生",
    pause: "一時停止",
    newTrack: "新しい曲",
    rain: "雨音",
    vinyl: "レコードノイズ",
    mix: "ミックス",
    resetMix: "ミックスをリセット",
    mixHelp: "マスターは全体音量、出力ブーストはリミッター前の最終音量です。",
    groups: {
      global: "全体",
      music: "音楽",
      atmosphere: "環境音"
    },
    layers: {
      master: "全体",
      outputBoost: "出力ブースト",
      chords: "コード",
      melody: "メロディ",
      bass: "ベース",
      drums: "ドラム",
      rain: "雨音",
      vinyl: "レコードノイズ"
    },
    nowPlaying: "再生中",
    vibeLabel: "雰囲気",
    keyLabel: "キー",
    tempoLabel: "テンポ",
    sectionLabel: "セクション",
    rainLabel: "雨音",
    vinylLabel: "レコードノイズ"
  },
  vibes: {
    lofi: "ローファイ",
    piano: "ピアノ",
    jazz: "ジャズ"
  },
  sections: {
    intro: "導入",
    main: "メイン",
    mainA: "メインA",
    mainB: "メインB",
    variation: "変化",
    break: "休止",
    transition: "つなぎ",
    return: "戻り",
    outro: "終わり"
  },
  breathe: {
    title: "呼吸",
    subtitle: "やさしいパターンを選んで、開始を押してください。",
    patterns: {
      "4444": "ボックス呼吸 (4-4-4-4)",
      "446": "落ち着く呼吸 (4-4-6)",
      "478": "深いリラックス (4-7-8)"
    },
    phaseLabels: {
      inhale: "吸う",
      hold: "止める",
      exhale: "吐く",
      holdOut: "止める"
    }
  },
  mood: {
    title: "気分",
    subtitle: "今の気持ちに近いものを選んでください。",
    prompt: "こんな過ごし方はいかがですか？",
    emptyState: "気分をひとつ選ぶと、やさしい提案が表示されます。",
    moods: {
      stressed: "緊張している",
      tired: "疲れている",
      restless: "落ち着かない",
      lonely: "さみしい",
      overwhelmed: "いっぱいいっぱい",
      okay: "ふつう",
      peaceful: "穏やか"
    },
    suggestions: {
      stressed: [
        { text: "1分だけ、ゆっくり呼吸してみませんか。", href: "/breathe" },
        { text: "数分だけ、やさしい音楽に身をゆだねるのもおすすめです。", href: "/music" }
      ],
      tired: [
        { text: "静かな夜の音楽で、少し休むと楽になるかもしれません。", href: "/music" },
        { text: "シンプルに、感謝をひとこと書いてみるのも良いですよ。", href: "/gratitude" }
      ],
      restless: [
        { text: "短い集中セッションをひとつだけ試すと、整いやすくなります。", href: "/focus" },
        { text: "まずは落ち着く呼吸から始めてみませんか。", href: "/breathe" }
      ],
      lonely: [
        { text: "やさしいひとことを受け取ると、少し心が軽くなるかもしれません。", href: "/compliment" },
        { text: "やわらかな音楽と一緒に、しばらく過ごしてみましょう。", href: "/music" }
      ],
      overwhelmed: [
        { text: "まずは4-4-6の呼吸を1サイクルだけ試してみましょう。", href: "/breathe" },
        { text: "小さく、感謝のメモをひとつ書くのもおすすめです。", href: "/gratitude" }
      ],
      okay: [
        { text: "このまま穏やかな気分で、やさしい音楽を流してみませんか。", href: "/music" },
        { text: "この落ち着きを、ひとつの集中セッションにつなげるのも良いです。", href: "/focus" }
      ],
      peaceful: [
        { text: "このまま、心地よい曲をゆっくり楽しんでください。", href: "/music" },
        { text: "この気持ちを、感謝のメモに残してみるのも素敵です。", href: "/gratitude" }
      ]
    }
  },
  gratitude: {
    title: "感謝",
    subtitle: "今日、感謝したい小さなことは何ですか？",
    entryLabel: "感謝のメモ",
    placeholder: "静かな朝、あたたかいお茶、やさしいひとこと…",
    save: "保存する",
    recentEntries: "最近のメモ",
    emptyState: "あなたの感謝リストは空です。今日の「ありがとう」をひとつ書いてみましょう。"
  },
  compliment: {
    title: "ひとこと",
    subtitle: "この瞬間のあなたへ、やさしい言葉です。",
    sweetNote: "やさしいメモ",
    keepToday: "今日のお守りにしてください。",
    showAnother: "別のひとことを見る"
  }
};

export const TRANSLATIONS: Record<AppLanguage, TranslationShape> = {
  en: EN,
  ja: JA
};
