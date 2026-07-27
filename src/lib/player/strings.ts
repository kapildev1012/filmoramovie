// src/lib/player/strings.ts — UI chrome strings for the player, per locale.
//
// Kept separate from src/lib/i18n.ts on purpose: that module's `TranslationKey`
// is a closed union used by the site chrome, and the player would add ~50 keys
// to it that nothing else consumes. This module reuses i18n's `Locale` type so
// there is still exactly one list of supported locales in the codebase.
//
// Missing keys fall back to English (`pt(locale, key)`), so a partially
// translated locale degrades per-string instead of breaking the UI.

import type { Locale } from '../i18n';

export type PlayerStringKey =
  | 'play' | 'pause' | 'replay' | 'watchAgain' | 'back'
  | 'mute' | 'unmute' | 'volume' | 'brightness'
  | 'zoomIn' | 'zoomOut' | 'fillScreen' | 'resetZoom'
  | 'fullscreen' | 'exitFullscreen' | 'pip'
  | 'settings' | 'more' | 'close' | 'cancel' | 'retry' | 'reload'
  | 'speed' | 'normal'
  | 'audioAndSubtitles' | 'audio' | 'subtitles' | 'off'
  | 'noAudioTracks' | 'noSubtitles' | 'tracksOnServer' | 'tracksOnServerHint'
  | 'subtitleSize' | 'subtitleBackdrop' | 'small' | 'medium' | 'large'
  | 'skipIntro' | 'skipRecap' | 'skipCredits'
  | 'upNext' | 'nextEpisode' | 'prevEpisode' | 'episodes' | 'season' | 'episode' | 'noEpisodes'
  | 'playingInSeconds' | 'startingNow'
  | 'loading' | 'buffering' | 'slowNetwork' | 'offline'
  | 'errNetwork' | 'errUnsupported' | 'errDecode' | 'errDrm' | 'errGeo' | 'errNotFound' | 'errUnknown'
  | 'seek' | 'forward10' | 'back10'
  | 'statePaused' | 'statePlaying' | 'stateMuted' | 'stateUnmuted' | 'stateEnded'
  | 'servers' | 'server' | 'trailer' | 'fullTitle' | 'shortcuts' | 'gestures'
  | 'auto' | 'autoBestHint' | 'bestQuality' | 'chooseServer'
  | 'serverSwitched' | 'serverFellBack' | 'tapToUnmute' | 'embedAudioHint'
  | 'live' | 'relatedTitles' | 'playerRegion';

type Dict = Record<PlayerStringKey, string>;

const en: Dict = {
  play: 'Play', pause: 'Pause', replay: 'Replay', watchAgain: 'Watch again', back: 'Back',
  mute: 'Mute', unmute: 'Unmute', volume: 'Volume', brightness: 'Brightness',
  zoomIn: 'Zoom in', zoomOut: 'Zoom out', fillScreen: 'Fill screen', resetZoom: 'Reset zoom',
  fullscreen: 'Full screen', exitFullscreen: 'Exit full screen', pip: 'Picture in picture',
  settings: 'Settings', more: 'More', close: 'Close', cancel: 'Cancel', retry: 'Try again', reload: 'Reload',
  speed: 'Playback speed', normal: 'Normal',
  audioAndSubtitles: 'Audio & Subtitles', audio: 'Audio', subtitles: 'Subtitles', off: 'Off',
  noAudioTracks: 'This source offers only one audio track.',
  noSubtitles: 'No subtitles available for this title.',
  tracksOnServer: 'Managed by the streaming server',
  tracksOnServerHint:
    'This server plays inside its own player, so audio and subtitle tracks are chosen in its menu. Switch servers if your language is missing.',
  subtitleSize: 'Subtitle size', subtitleBackdrop: 'Subtitle background',
  small: 'Small', medium: 'Medium', large: 'Large',
  skipIntro: 'Skip intro', skipRecap: 'Skip recap', skipCredits: 'Skip credits',
  upNext: 'Up next', nextEpisode: 'Next episode', prevEpisode: 'Previous episode',
  noEpisodes: 'No episodes listed for this season yet.',
  episodes: 'Episodes', season: 'Season', episode: 'Episode',
  playingInSeconds: 'Playing in {n}s', startingNow: 'Starting…',
  loading: 'Loading', buffering: 'Buffering', slowNetwork: 'Slow connection — lowering quality',
  errNetwork: 'Connection lost while loading the video.',
  errUnsupported: 'This browser cannot play this video format.',
  errDecode: 'The video stream is damaged and cannot be decoded.',
  errDrm: 'This title is protected and cannot be played here.',
  errGeo: 'This title is not available in your region.',
  errNotFound: 'No playable source was found for this title.',
  errUnknown: 'Playback stopped unexpectedly.',
  seek: 'Seek', forward10: 'Forward 10 seconds', back10: 'Back 10 seconds',
  statePaused: 'Paused', statePlaying: 'Playing', stateMuted: 'Muted', stateUnmuted: 'Sound on',
  stateEnded: 'Ended',
  servers: 'Servers', server: 'Server', trailer: 'Trailer', fullTitle: 'Full title',
  auto: 'Auto',
  autoBestHint: 'Pick the best available server automatically',
  bestQuality: 'Best',
  chooseServer: 'Choose server',
  serverSwitched: 'Switched to {name} — the previous server did not respond',
  serverFellBack:
    'That server stopped responding, so playback moved to another one automatically. You can pick a different server above.',
  tapToUnmute: 'Tap to unmute',
  embedAudioHint:
    'This server plays in its own player, so sound is controlled inside the video. If it starts silent, tap the speaker in the video.',
  shortcuts: 'Keyboard shortcuts', gestures: 'Touch gestures', live: 'Live',
  relatedTitles: 'More like this',
  playerRegion: 'Video player',
  offline: 'You are offline. Reconnect to keep watching.',
};

const hi: Partial<Dict> = {
  play: 'चलाएँ', pause: 'रोकें', replay: 'फिर चलाएँ', watchAgain: 'फिर देखें', back: 'वापस',
  mute: 'म्यूट करें', unmute: 'अनम्यूट करें', volume: 'आवाज़', brightness: 'चमक',
  zoomIn: 'ज़ूम इन', zoomOut: 'ज़ूम आउट', fillScreen: 'स्क्रीन भरें', resetZoom: 'ज़ूम रीसेट',
  fullscreen: 'फ़ुल स्क्रीन', exitFullscreen: 'फ़ुल स्क्रीन बंद करें', pip: 'पिक्चर इन पिक्चर',
  settings: 'सेटिंग', more: 'और', close: 'बंद करें', cancel: 'रद्द करें', retry: 'फिर कोशिश करें', reload: 'रीलोड',
  speed: 'गति', normal: 'सामान्य',
  audioAndSubtitles: 'ऑडियो और सबटाइटल', audio: 'ऑडियो', subtitles: 'सबटाइटल', off: 'बंद',
  noAudioTracks: 'इस स्रोत में केवल एक ऑडियो ट्रैक है।',
  noSubtitles: 'इस टाइटल के लिए सबटाइटल उपलब्ध नहीं हैं।',
  tracksOnServer: 'स्ट्रीमिंग सर्वर द्वारा नियंत्रित',
  tracksOnServerHint:
    'यह सर्वर अपने प्लेयर में चलता है, इसलिए ऑडियो और सबटाइटल उसके मेन्यू में चुनें। आपकी भाषा न मिले तो सर्वर बदलें।',
  subtitleSize: 'सबटाइटल का आकार', subtitleBackdrop: 'सबटाइटल पृष्ठभूमि',
  small: 'छोटा', medium: 'मध्यम', large: 'बड़ा',
  skipIntro: 'इंट्रो छोड़ें', skipRecap: 'रीकैप छोड़ें', skipCredits: 'क्रेडिट छोड़ें',
  upNext: 'आगे', nextEpisode: 'अगला एपिसोड', prevEpisode: 'पिछला एपिसोड',
  noEpisodes: 'इस सीज़न के एपिसोड अभी उपलब्ध नहीं हैं।',
  episodes: 'एपिसोड', season: 'सीज़न', episode: 'एपिसोड',
  playingInSeconds: '{n} सेकंड में चलेगा', startingNow: 'शुरू हो रहा है…',
  loading: 'लोड हो रहा है', buffering: 'बफ़र हो रहा है', slowNetwork: 'धीमा कनेक्शन — क्वालिटी घटाई जा रही है',
  errNetwork: 'वीडियो लोड करते समय कनेक्शन टूट गया।',
  errUnsupported: 'यह ब्राउज़र इस वीडियो फ़ॉर्मैट को नहीं चला सकता।',
  errDecode: 'वीडियो स्ट्रीम ख़राब है।',
  errDrm: 'यह टाइटल सुरक्षित है और यहाँ नहीं चल सकता।',
  errGeo: 'यह टाइटल आपके क्षेत्र में उपलब्ध नहीं है।',
  errNotFound: 'इस टाइटल के लिए कोई स्रोत नहीं मिला।',
  errUnknown: 'प्लेबैक अचानक रुक गया।',
  seek: 'सीक', forward10: '10 सेकंड आगे', back10: '10 सेकंड पीछे',
  statePaused: 'रुका हुआ', statePlaying: 'चल रहा है', stateMuted: 'म्यूट', stateUnmuted: 'आवाज़ चालू',
  stateEnded: 'समाप्त',
  servers: 'सर्वर', server: 'सर्वर', trailer: 'ट्रेलर', fullTitle: 'पूरा टाइटल',
  auto: 'ऑटो',
  autoBestHint: 'सबसे अच्छा उपलब्ध सर्वर अपने आप चुनें',
  bestQuality: 'सर्वश्रेष्ठ',
  chooseServer: 'सर्वर चुनें',
  serverSwitched: '{name} पर बदल दिया — पिछला सर्वर जवाब नहीं दे रहा था',
  serverFellBack:
    'वह सर्वर जवाब नहीं दे रहा था, इसलिए प्लेबैक अपने आप दूसरे सर्वर पर चला गया। आप ऊपर से कोई और सर्वर चुन सकते हैं।',
  tapToUnmute: 'आवाज़ चालू करने के लिए टैप करें',
  embedAudioHint:
    'यह सर्वर अपने प्लेयर में चलता है, इसलिए आवाज़ वीडियो के अंदर से नियंत्रित होती है। आवाज़ न आए तो वीडियो में स्पीकर पर टैप करें।',
  shortcuts: 'कीबोर्ड शॉर्टकट', gestures: 'टच जेस्चर', live: 'लाइव', relatedTitles: 'इसी तरह के और',
  playerRegion: 'वीडियो प्लेयर',
  offline: 'आप ऑफ़लाइन हैं। देखना जारी रखने के लिए फिर से कनेक्ट करें।',
};

const ja: Partial<Dict> = {
  play: '再生', pause: '一時停止', replay: '再再生', watchAgain: 'もう一度見る', back: '戻る',
  mute: 'ミュート', unmute: 'ミュート解除', volume: '音量', brightness: '明るさ',
  zoomIn: '拡大', zoomOut: '縮小', fillScreen: '画面に合わせる', resetZoom: 'ズームをリセット',
  fullscreen: '全画面', exitFullscreen: '全画面を終了', pip: 'ピクチャーインピクチャー',
  settings: '設定', more: 'その他', close: '閉じる', cancel: 'キャンセル', retry: '再試行', reload: '再読み込み',
  speed: '再生速度', normal: '標準',
  audioAndSubtitles: '音声と字幕', audio: '音声', subtitles: '字幕', off: 'オフ',
  noAudioTracks: 'このソースの音声トラックは1つだけです。',
  noSubtitles: 'この作品に利用できる字幕はありません。',
  tracksOnServer: 'ストリーミングサーバー側で管理',
  tracksOnServerHint:
    'このサーバーは独自のプレーヤーで再生するため、音声と字幕はそのメニューで選択します。言語が無い場合はサーバーを切り替えてください。',
  subtitleSize: '字幕サイズ', subtitleBackdrop: '字幕の背景',
  small: '小', medium: '中', large: '大',
  skipIntro: 'イントロをスキップ', skipRecap: 'あらすじをスキップ', skipCredits: 'クレジットをスキップ',
  upNext: '次のエピソード', nextEpisode: '次のエピソード', prevEpisode: '前のエピソード',
  noEpisodes: 'このシーズンのエピソードはまだありません。',
  episodes: 'エピソード', season: 'シーズン', episode: 'エピソード',
  playingInSeconds: '{n}秒後に再生', startingNow: '開始中…',
  loading: '読み込み中', buffering: 'バッファ中', slowNetwork: '通信が遅いため画質を下げています',
  errNetwork: '読み込み中に接続が切断されました。',
  errUnsupported: 'このブラウザーはこの形式を再生できません。',
  errDecode: '映像データが破損しています。',
  errDrm: 'この作品は保護されており再生できません。',
  errGeo: 'この作品はお住まいの地域では利用できません。',
  errNotFound: '再生可能なソースが見つかりませんでした。',
  errUnknown: '再生が予期せず停止しました。',
  seek: 'シーク', forward10: '10秒進む', back10: '10秒戻る',
  statePaused: '一時停止', statePlaying: '再生中', stateMuted: 'ミュート', stateUnmuted: '音声オン',
  stateEnded: '終了',
  servers: 'サーバー', server: 'サーバー', trailer: '予告編', fullTitle: '本編',
  auto: '自動',
  autoBestHint: '利用できる最良のサーバーを自動で選択します',
  bestQuality: '最適',
  chooseServer: 'サーバーを選択',
  serverSwitched: '{name} に切り替えました — 前のサーバーが応答しませんでした',
  serverFellBack:
    'サーバーが応答しなくなったため、自動的に別のサーバーで再生を続けました。上から別のサーバーを選べます。',
  tapToUnmute: 'タップで音声をオンに',
  embedAudioHint:
    'このサーバーは独自のプレーヤーで再生するため、音量は動画内で操作します。無音で始まる場合は動画内のスピーカーをタップしてください。',
  shortcuts: 'キーボードショートカット', gestures: 'タッチ操作', live: 'ライブ', relatedTitles: '関連作品',
  playerRegion: '動画プレーヤー',
  offline: 'オフラインです。接続を確認して再開してください。',
};

const fr: Partial<Dict> = {
  play: 'Lecture', pause: 'Pause', replay: 'Revoir', watchAgain: 'Revoir', back: 'Retour',
  mute: 'Couper le son', unmute: 'Activer le son', volume: 'Volume', brightness: 'Luminosité',
  zoomIn: 'Zoom avant', zoomOut: 'Zoom arrière', fillScreen: 'Remplir l’écran', resetZoom: 'Réinitialiser le zoom',
  fullscreen: 'Plein écran', exitFullscreen: 'Quitter le plein écran', pip: 'Image dans l’image',
  settings: 'Paramètres', more: 'Plus', close: 'Fermer', cancel: 'Annuler', retry: 'Réessayer', reload: 'Recharger',
  speed: 'Vitesse de lecture', normal: 'Normale',
  audioAndSubtitles: 'Audio et sous-titres', audio: 'Audio', subtitles: 'Sous-titres', off: 'Désactivés',
  noAudioTracks: 'Cette source ne propose qu’une piste audio.',
  noSubtitles: 'Aucun sous-titre disponible pour ce titre.',
  tracksOnServer: 'Géré par le serveur de streaming',
  tracksOnServerHint:
    'Ce serveur utilise son propre lecteur : les pistes audio et les sous-titres se choisissent dans son menu. Changez de serveur si votre langue manque.',
  subtitleSize: 'Taille des sous-titres', subtitleBackdrop: 'Fond des sous-titres',
  small: 'Petite', medium: 'Moyenne', large: 'Grande',
  skipIntro: 'Passer l’intro', skipRecap: 'Passer le résumé', skipCredits: 'Passer le générique',
  upNext: 'À suivre', nextEpisode: 'Épisode suivant', prevEpisode: 'Épisode précédent',
  noEpisodes: 'Aucun épisode listé pour cette saison.',
  episodes: 'Épisodes', season: 'Saison', episode: 'Épisode',
  playingInSeconds: 'Lecture dans {n}s', startingNow: 'Démarrage…',
  loading: 'Chargement', buffering: 'Mise en mémoire tampon', slowNetwork: 'Connexion lente — qualité réduite',
  errNetwork: 'Connexion perdue pendant le chargement.',
  errUnsupported: 'Ce navigateur ne peut pas lire ce format.',
  errDecode: 'Le flux vidéo est endommagé.',
  errDrm: 'Ce titre est protégé et ne peut pas être lu ici.',
  errGeo: 'Ce titre n’est pas disponible dans votre région.',
  errNotFound: 'Aucune source lisible trouvée pour ce titre.',
  errUnknown: 'La lecture s’est arrêtée de façon inattendue.',
  seek: 'Navigation', forward10: 'Avancer de 10 secondes', back10: 'Reculer de 10 secondes',
  statePaused: 'En pause', statePlaying: 'Lecture', stateMuted: 'Son coupé', stateUnmuted: 'Son activé',
  stateEnded: 'Terminé',
  servers: 'Serveurs', server: 'Serveur', trailer: 'Bande-annonce', fullTitle: 'Titre complet',
  auto: 'Auto',
  autoBestHint: 'Choisir automatiquement le meilleur serveur disponible',
  bestQuality: 'Meilleur',
  chooseServer: 'Choisir un serveur',
  serverSwitched: 'Passage à {name} — le serveur précédent ne répondait plus',
  serverFellBack:
    'Ce serveur ne répondait plus, la lecture est passée automatiquement à un autre. Vous pouvez en choisir un autre ci-dessus.',
  tapToUnmute: 'Appuyez pour activer le son',
  embedAudioHint:
    'Ce serveur utilise son propre lecteur : le son se règle dans la vidéo. Si elle démarre en silence, appuyez sur le haut-parleur dans la vidéo.',
  shortcuts: 'Raccourcis clavier', gestures: 'Gestes tactiles', live: 'Direct', relatedTitles: 'Dans le même genre',
  playerRegion: 'Lecteur vidéo',
  offline: 'Vous êtes hors ligne. Reconnectez-vous pour continuer.',
};

const es: Partial<Dict> = {
  play: 'Reproducir', pause: 'Pausa', replay: 'Volver a ver', watchAgain: 'Volver a ver', back: 'Atrás',
  mute: 'Silenciar', unmute: 'Activar sonido', volume: 'Volumen', brightness: 'Brillo',
  zoomIn: 'Acercar', zoomOut: 'Alejar', fillScreen: 'Llenar pantalla', resetZoom: 'Restablecer zoom',
  fullscreen: 'Pantalla completa', exitFullscreen: 'Salir de pantalla completa', pip: 'Imagen en imagen',
  settings: 'Ajustes', more: 'Más', close: 'Cerrar', cancel: 'Cancelar', retry: 'Reintentar', reload: 'Recargar',
  speed: 'Velocidad', normal: 'Normal',
  audioAndSubtitles: 'Audio y subtítulos', audio: 'Audio', subtitles: 'Subtítulos', off: 'Desactivados',
  noAudioTracks: 'Esta fuente solo ofrece una pista de audio.',
  noSubtitles: 'No hay subtítulos disponibles para este título.',
  tracksOnServer: 'Gestionado por el servidor de streaming',
  tracksOnServerHint:
    'Este servidor usa su propio reproductor, así que el audio y los subtítulos se eligen en su menú. Cambia de servidor si falta tu idioma.',
  subtitleSize: 'Tamaño de subtítulos', subtitleBackdrop: 'Fondo de subtítulos',
  small: 'Pequeño', medium: 'Medio', large: 'Grande',
  skipIntro: 'Saltar intro', skipRecap: 'Saltar resumen', skipCredits: 'Saltar créditos',
  upNext: 'A continuación', nextEpisode: 'Episodio siguiente', prevEpisode: 'Episodio anterior',
  noEpisodes: 'Aún no hay episodios para esta temporada.',
  episodes: 'Episodios', season: 'Temporada', episode: 'Episodio',
  playingInSeconds: 'Se reproduce en {n}s', startingNow: 'Iniciando…',
  loading: 'Cargando', buffering: 'Almacenando en búfer', slowNetwork: 'Conexión lenta — bajando la calidad',
  errNetwork: 'Se perdió la conexión durante la carga.',
  errUnsupported: 'Este navegador no puede reproducir este formato.',
  errDecode: 'La transmisión de vídeo está dañada.',
  errDrm: 'Este título está protegido y no puede reproducirse aquí.',
  errGeo: 'Este título no está disponible en tu región.',
  errNotFound: 'No se encontró ninguna fuente reproducible.',
  errUnknown: 'La reproducción se detuvo inesperadamente.',
  seek: 'Buscar', forward10: 'Avanzar 10 segundos', back10: 'Retroceder 10 segundos',
  statePaused: 'En pausa', statePlaying: 'Reproduciendo', stateMuted: 'Silenciado', stateUnmuted: 'Sonido activado',
  stateEnded: 'Finalizado',
  servers: 'Servidores', server: 'Servidor', trailer: 'Tráiler', fullTitle: 'Título completo',
  auto: 'Auto',
  autoBestHint: 'Elegir automáticamente el mejor servidor disponible',
  bestQuality: 'Mejor',
  chooseServer: 'Elegir servidor',
  serverSwitched: 'Cambiado a {name}: el servidor anterior no respondía',
  serverFellBack:
    'Ese servidor dejó de responder, así que la reproducción pasó automáticamente a otro. Puedes elegir uno distinto arriba.',
  tapToUnmute: 'Toca para activar el sonido',
  embedAudioHint:
    'Este servidor usa su propio reproductor, así que el sonido se controla dentro del vídeo. Si empieza en silencio, toca el altavoz del vídeo.',
  shortcuts: 'Atajos de teclado', gestures: 'Gestos táctiles', live: 'En directo', relatedTitles: 'Más como esto',
  playerRegion: 'Reproductor de vídeo',
  offline: 'Estás sin conexión. Vuelve a conectarte para seguir viendo.',
};

const de: Partial<Dict> = {
  play: 'Abspielen', pause: 'Pause', replay: 'Erneut ansehen', watchAgain: 'Erneut ansehen', back: 'Zurück',
  mute: 'Stumm', unmute: 'Ton ein', volume: 'Lautstärke', brightness: 'Helligkeit',
  zoomIn: 'Vergrößern', zoomOut: 'Verkleinern', fillScreen: 'Bild füllen', resetZoom: 'Zoom zurücksetzen',
  fullscreen: 'Vollbild', exitFullscreen: 'Vollbild beenden', pip: 'Bild-in-Bild',
  settings: 'Einstellungen', more: 'Mehr', close: 'Schließen', cancel: 'Abbrechen', retry: 'Erneut versuchen', reload: 'Neu laden',
  speed: 'Geschwindigkeit', normal: 'Normal',
  audioAndSubtitles: 'Audio & Untertitel', audio: 'Audio', subtitles: 'Untertitel', off: 'Aus',
  noAudioTracks: 'Diese Quelle bietet nur eine Tonspur.',
  noSubtitles: 'Für diesen Titel sind keine Untertitel verfügbar.',
  tracksOnServer: 'Vom Streaming-Server verwaltet',
  tracksOnServerHint:
    'Dieser Server nutzt seinen eigenen Player – Ton und Untertitel werden in dessen Menü gewählt. Wechsle den Server, wenn deine Sprache fehlt.',
  subtitleSize: 'Untertitelgröße', subtitleBackdrop: 'Untertitelhintergrund',
  small: 'Klein', medium: 'Mittel', large: 'Groß',
  skipIntro: 'Intro überspringen', skipRecap: 'Rückblick überspringen', skipCredits: 'Abspann überspringen',
  upNext: 'Als Nächstes', nextEpisode: 'Nächste Folge', prevEpisode: 'Vorherige Folge',
  noEpisodes: 'Für diese Staffel sind noch keine Folgen gelistet.',
  episodes: 'Folgen', season: 'Staffel', episode: 'Folge',
  playingInSeconds: 'Start in {n}s', startingNow: 'Startet…',
  loading: 'Wird geladen', buffering: 'Puffern', slowNetwork: 'Langsame Verbindung – Qualität reduziert',
  errNetwork: 'Verbindung beim Laden verloren.',
  errUnsupported: 'Dieser Browser kann das Format nicht abspielen.',
  errDecode: 'Der Videostream ist beschädigt.',
  errDrm: 'Dieser Titel ist geschützt und kann hier nicht abgespielt werden.',
  errGeo: 'Dieser Titel ist in deiner Region nicht verfügbar.',
  errNotFound: 'Keine abspielbare Quelle gefunden.',
  errUnknown: 'Die Wiedergabe wurde unerwartet beendet.',
  seek: 'Suchen', forward10: '10 Sekunden vor', back10: '10 Sekunden zurück',
  statePaused: 'Pausiert', statePlaying: 'Wiedergabe', stateMuted: 'Stumm', stateUnmuted: 'Ton ein',
  stateEnded: 'Beendet',
  servers: 'Server', server: 'Server', trailer: 'Trailer', fullTitle: 'Ganzer Titel',
  auto: 'Auto',
  autoBestHint: 'Automatisch den besten verfügbaren Server wählen',
  bestQuality: 'Beste',
  chooseServer: 'Server wählen',
  serverSwitched: 'Zu {name} gewechselt – der vorherige Server antwortete nicht',
  serverFellBack:
    'Dieser Server antwortete nicht mehr, daher läuft die Wiedergabe automatisch über einen anderen. Oben kannst du einen anderen wählen.',
  tapToUnmute: 'Tippen, um den Ton einzuschalten',
  embedAudioHint:
    'Dieser Server nutzt seinen eigenen Player – der Ton wird im Video geregelt. Startet es stumm, tippe im Video auf das Lautsprechersymbol.',
  shortcuts: 'Tastenkürzel', gestures: 'Touch-Gesten', live: 'Live', relatedTitles: 'Ähnliche Titel',
  playerRegion: 'Videoplayer',
  offline: 'Du bist offline. Verbinde dich erneut, um weiterzuschauen.',
};

const pt: Partial<Dict> = {
  play: 'Reproduzir', pause: 'Pausar', replay: 'Ver de novo', watchAgain: 'Ver de novo', back: 'Voltar',
  mute: 'Sem som', unmute: 'Com som', volume: 'Volume', brightness: 'Brilho',
  zoomIn: 'Ampliar', zoomOut: 'Reduzir', fillScreen: 'Preencher ecrã', resetZoom: 'Redefinir zoom',
  fullscreen: 'Ecrã inteiro', exitFullscreen: 'Sair do ecrã inteiro', pip: 'Imagem sobre imagem',
  settings: 'Configurações', more: 'Mais', close: 'Fechar', cancel: 'Cancelar', retry: 'Tentar novamente', reload: 'Recarregar',
  speed: 'Velocidade', normal: 'Normal',
  audioAndSubtitles: 'Áudio e legendas', audio: 'Áudio', subtitles: 'Legendas', off: 'Desativadas',
  noAudioTracks: 'Esta fonte tem apenas uma faixa de áudio.',
  noSubtitles: 'Sem legendas disponíveis para este título.',
  tracksOnServer: 'Gerido pelo servidor de streaming',
  tracksOnServerHint:
    'Este servidor usa o seu próprio reprodutor, por isso o áudio e as legendas escolhem-se no menu dele. Troque de servidor se faltar o seu idioma.',
  subtitleSize: 'Tamanho das legendas', subtitleBackdrop: 'Fundo das legendas',
  small: 'Pequeno', medium: 'Médio', large: 'Grande',
  skipIntro: 'Saltar abertura', skipRecap: 'Saltar resumo', skipCredits: 'Saltar créditos',
  upNext: 'A seguir', nextEpisode: 'Episódio seguinte', prevEpisode: 'Episódio anterior',
  noEpisodes: 'Ainda sem episódios para esta temporada.',
  episodes: 'Episódios', season: 'Temporada', episode: 'Episódio',
  playingInSeconds: 'A iniciar em {n}s', startingNow: 'A iniciar…',
  loading: 'A carregar', buffering: 'A colocar em buffer', slowNetwork: 'Ligação lenta — a reduzir a qualidade',
  errNetwork: 'Ligação perdida durante o carregamento.',
  errUnsupported: 'Este navegador não reproduz este formato.',
  errDecode: 'O fluxo de vídeo está danificado.',
  errDrm: 'Este título é protegido e não pode ser reproduzido aqui.',
  errGeo: 'Este título não está disponível na sua região.',
  errNotFound: 'Nenhuma fonte reproduzível encontrada.',
  errUnknown: 'A reprodução parou inesperadamente.',
  seek: 'Procurar', forward10: 'Avançar 10 segundos', back10: 'Retroceder 10 segundos',
  statePaused: 'Em pausa', statePlaying: 'A reproduzir', stateMuted: 'Sem som', stateUnmuted: 'Com som',
  stateEnded: 'Terminado',
  servers: 'Servidores', server: 'Servidor', trailer: 'Trailer', fullTitle: 'Título completo',
  auto: 'Auto',
  autoBestHint: 'Escolher automaticamente o melhor servidor disponível',
  bestQuality: 'Melhor',
  chooseServer: 'Escolher servidor',
  serverSwitched: 'Mudou para {name} — o servidor anterior não respondeu',
  serverFellBack:
    'Esse servidor deixou de responder, por isso a reprodução passou automaticamente para outro. Pode escolher outro acima.',
  tapToUnmute: 'Toque para ativar o som',
  embedAudioHint:
    'Este servidor usa o seu próprio reprodutor, por isso o som controla-se dentro do vídeo. Se começar sem som, toque no altifalante do vídeo.',
  shortcuts: 'Atalhos de teclado', gestures: 'Gestos', live: 'Em direto', relatedTitles: 'Semelhantes',
  playerRegion: 'Reprodutor de vídeo',
  offline: 'Você está offline. Reconecte-se para continuar assistindo.',
};

const ko: Partial<Dict> = {
  play: '재생', pause: '일시정지', replay: '다시 재생', watchAgain: '다시 보기', back: '뒤로',
  mute: '음소거', unmute: '음소거 해제', volume: '음량', brightness: '밝기',
  zoomIn: '확대', zoomOut: '축소', fillScreen: '화면 채우기', resetZoom: '확대 초기화',
  fullscreen: '전체 화면', exitFullscreen: '전체 화면 종료', pip: '화면 속 화면',
  settings: '설정', more: '더보기', close: '닫기', cancel: '취소', retry: '다시 시도', reload: '새로 고침',
  speed: '재생 속도', normal: '기본',
  audioAndSubtitles: '음성 및 자막', audio: '음성', subtitles: '자막', off: '끄기',
  noAudioTracks: '이 소스에는 음성 트랙이 하나뿐입니다.',
  noSubtitles: '이 작품에 사용할 수 있는 자막이 없습니다.',
  tracksOnServer: '스트리밍 서버에서 관리',
  tracksOnServerHint:
    '이 서버는 자체 플레이어로 재생하므로 음성과 자막은 해당 메뉴에서 선택합니다. 원하는 언어가 없으면 서버를 변경하세요.',
  subtitleSize: '자막 크기', subtitleBackdrop: '자막 배경',
  small: '작게', medium: '보통', large: '크게',
  skipIntro: '인트로 건너뛰기', skipRecap: '요약 건너뛰기', skipCredits: '크레딧 건너뛰기',
  upNext: '다음 콘텐츠', nextEpisode: '다음 회차', prevEpisode: '이전 회차',
  noEpisodes: '이 시즌의 회차가 아직 없습니다.',
  episodes: '회차', season: '시즌', episode: '회차',
  playingInSeconds: '{n}초 후 재생', startingNow: '시작 중…',
  loading: '불러오는 중', buffering: '버퍼링 중', slowNetwork: '연결이 느려 화질을 낮춥니다',
  errNetwork: '불러오는 중 연결이 끊어졌습니다.',
  errUnsupported: '이 브라우저는 이 형식을 재생할 수 없습니다.',
  errDecode: '영상 데이터가 손상되었습니다.',
  errDrm: '보호된 콘텐츠로 여기서는 재생할 수 없습니다.',
  errGeo: '이 지역에서는 제공되지 않습니다.',
  errNotFound: '재생 가능한 소스를 찾을 수 없습니다.',
  errUnknown: '재생이 예기치 않게 중단되었습니다.',
  seek: '탐색', forward10: '10초 앞으로', back10: '10초 뒤로',
  statePaused: '일시정지됨', statePlaying: '재생 중', stateMuted: '음소거됨', stateUnmuted: '소리 켜짐',
  stateEnded: '종료',
  servers: '서버', server: '서버', trailer: '예고편', fullTitle: '본편',
  auto: '자동',
  autoBestHint: '사용 가능한 최적의 서버를 자동으로 선택',
  bestQuality: '최적',
  chooseServer: '서버 선택',
  serverSwitched: '{name}(으)로 전환했습니다 — 이전 서버가 응답하지 않았습니다',
  serverFellBack:
    '해당 서버가 응답하지 않아 자동으로 다른 서버로 재생을 이어갔습니다. 위에서 다른 서버를 선택할 수 있습니다.',
  tapToUnmute: '탭하여 소리 켜기',
  embedAudioHint:
    '이 서버는 자체 플레이어로 재생하므로 소리는 영상 안에서 조절합니다. 소리 없이 시작되면 영상의 스피커를 누르세요.',
  shortcuts: '키보드 단축키', gestures: '터치 제스처', live: '라이브', relatedTitles: '비슷한 콘텐츠',
  playerRegion: '동영상 플레이어',
  offline: '오프라인 상태입니다. 다시 연결한 후 계속 시청하세요.',
};

const zh: Partial<Dict> = {
  play: '播放', pause: '暂停', replay: '重新播放', watchAgain: '再看一次', back: '返回',
  mute: '静音', unmute: '取消静音', volume: '音量', brightness: '亮度',
  zoomIn: '放大', zoomOut: '缩小', fillScreen: '填满屏幕', resetZoom: '重置缩放',
  fullscreen: '全屏', exitFullscreen: '退出全屏', pip: '画中画',
  settings: '设置', more: '更多', close: '关闭', cancel: '取消', retry: '重试', reload: '重新加载',
  speed: '播放速度', normal: '正常',
  audioAndSubtitles: '音轨与字幕', audio: '音轨', subtitles: '字幕', off: '关闭',
  noAudioTracks: '此片源只有一条音轨。',
  noSubtitles: '此影片没有可用字幕。',
  tracksOnServer: '由串流服务器管理',
  tracksOnServerHint: '该服务器使用自己的播放器，音轨与字幕需在其菜单中选择。若缺少你的语言，请切换服务器。',
  subtitleSize: '字幕大小', subtitleBackdrop: '字幕背景',
  small: '小', medium: '中', large: '大',
  skipIntro: '跳过片头', skipRecap: '跳过前情提要', skipCredits: '跳过片尾',
  upNext: '接下来', nextEpisode: '下一集', prevEpisode: '上一集',
  noEpisodes: '本季暂无剧集。',
  episodes: '剧集', season: '季', episode: '集',
  playingInSeconds: '{n} 秒后播放', startingNow: '正在开始…',
  loading: '加载中', buffering: '缓冲中', slowNetwork: '网络较慢 — 正在降低画质',
  errNetwork: '加载时连接中断。',
  errUnsupported: '此浏览器无法播放该格式。',
  errDecode: '视频数据已损坏。',
  errDrm: '此影片受保护，无法在此播放。',
  errGeo: '此影片在你所在地区不可用。',
  errNotFound: '未找到可播放的片源。',
  errUnknown: '播放意外停止。',
  seek: '进度', forward10: '快进 10 秒', back10: '快退 10 秒',
  statePaused: '已暂停', statePlaying: '正在播放', stateMuted: '已静音', stateUnmuted: '已开启声音',
  stateEnded: '已结束',
  servers: '服务器', server: '服务器', trailer: '预告片', fullTitle: '正片',
  auto: '自动',
  autoBestHint: '自动选择可用的最佳服务器',
  bestQuality: '最佳',
  chooseServer: '选择服务器',
  serverSwitched: '已切换到 {name} — 上一个服务器没有响应',
  serverFellBack: '该服务器停止响应，已自动切换到其他服务器继续播放。你可以在上方另选一个。',
  tapToUnmute: '点按以开启声音',
  embedAudioHint: '该服务器使用自己的播放器，音量需在视频内控制。若开始时没有声音，请点按视频中的喇叭图标。',
  shortcuts: '键盘快捷键', gestures: '触摸手势', live: '直播', relatedTitles: '相似影片',
  playerRegion: '视频播放器',
  offline: '您已离线，请重新连接后继续观看。',
};

const dicts: Record<Locale, Partial<Dict>> = { en, hi, ja, fr, es, de, pt, ko, zh };

/**
 * Player string lookup. `vars` interpolates `{name}` placeholders, used by
 * countdowns ("Playing in {n}s") so plural/format differences stay in the
 * translation instead of being concatenated in JSX.
 */
export function pt_(
  locale: Locale,
  key: PlayerStringKey,
  vars?: Record<string, string | number>
): string {
  let value = dicts[locale]?.[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(v));
    }
  }
  return value;
}

/** Bound translator, so components take one `t` prop instead of a locale. */
export type PlayerT = (key: PlayerStringKey, vars?: Record<string, string | number>) => string;

export function createPlayerT(locale: Locale): PlayerT {
  return (key, vars) => pt_(locale, key, vars);
}
