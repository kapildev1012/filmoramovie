/**
 * i18n — lightweight translation system for Filmora Movie.
 * Add keys to the `en` locale then copy + translate into other locales.
 */

export const SUPPORTED_LOCALES = ['en', 'hi', 'ja', 'fr', 'es', 'de', 'pt', 'ko', 'zh'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ja: '日本語',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  pt: 'Português',
  ko: '한국어',
  zh: '中文',
};

export type TranslationKey =
  | 'nav.movies'
  | 'nav.series'
  | 'nav.anime'
  | 'nav.search'
  | 'nav.watchlist'
  | 'nav.signin'
  | 'nav.profile'
  | 'nav.signout'
  | 'nav.notifications'
  | 'nav.allCaughtUp'
  | 'nav.openSearch'
  | 'nav.searchPlaceholder'
  | 'home.trendingNow'
  | 'home.latestMovies'
  | 'home.latestTV'
  | 'home.topRated'
  | 'home.action'
  | 'home.comedy'
  | 'home.horror'
  | 'home.scifi'
  | 'home.drama'
  | 'home.anime'
  | 'home.netflix'
  | 'home.disney'
  | 'home.marvel'
  | 'home.popular'
  | 'home.comingSoon'
  | 'home.continueWatching'
  | 'browse.movies'
  | 'browse.series'
  | 'browse.anime'
  | 'browse.viewAll'
  | 'browse.noResults'
  | 'browse.resetFilters'
  | 'browse.previous'
  | 'browse.next'
  | 'anime.heroLabel'
  | 'anime.topAiring'
  | 'anime.popular'
  | 'anime.movies'
  | 'anime.romance'
  | 'anime.action'
  | 'anime.fantasy'
  | 'anime.scifi'
  | 'anime.upcoming'
  | 'footer.tagline'
  | 'footer.allRights'
  | 'footer.poweredBy'
  | 'common.signedIn';

type Translations = Record<TranslationKey, string>;

const en: Translations = {
  'nav.movies': 'Movies',
  'nav.series': 'Series',
  'nav.anime': 'Anime',
  'nav.search': 'Search',
  'nav.watchlist': 'Watchlist',
  'nav.signin': 'Sign in',
  'nav.profile': 'Profile',
  'nav.signout': 'Sign out',
  'nav.notifications': 'Notifications',
  'nav.allCaughtUp': "You're all caught up.",
  'nav.openSearch': 'Open search',
  'nav.searchPlaceholder': 'Search movies, shows…',
  'home.trendingNow': 'Trending Now',
  'home.latestMovies': 'Latest Movies',
  'home.latestTV': 'Latest TV Shows',
  'home.topRated': 'Top Rated',
  'home.action': 'Action',
  'home.comedy': 'Comedy',
  'home.horror': 'Horror',
  'home.scifi': 'Sci-Fi',
  'home.drama': 'Drama',
  'home.anime': 'Anime',
  'home.netflix': 'Netflix Originals',
  'home.disney': 'Disney',
  'home.marvel': 'Marvel',
  'home.popular': 'Popular Right Now',
  'home.comingSoon': 'Coming Soon',
  'home.continueWatching': 'Continue Watching',
  'browse.movies': 'Movies',
  'browse.series': 'Series',
  'browse.anime': 'Anime',
  'browse.viewAll': 'View all',
  'browse.noResults': 'No results found',
  'browse.resetFilters': 'Reset filters',
  'browse.previous': 'Previous',
  'browse.next': 'Next',
  'anime.heroLabel': 'Top Anime',
  'anime.topAiring': 'Top Airing',
  'anime.popular': 'Most Popular',
  'anime.movies': 'Anime Movies',
  'anime.romance': 'Romance',
  'anime.action': 'Action',
  'anime.fantasy': 'Fantasy',
  'anime.scifi': 'Sci-Fi',
  'anime.upcoming': 'Upcoming',
  'footer.tagline': 'Every movie & show, one clean place.',
  'footer.allRights': 'All rights reserved.',
  'footer.poweredBy': 'Powered by TMDB',
  'common.signedIn': 'Signed in',
};

const hi: Translations = {
  'nav.movies': 'फ़िल्में',
  'nav.series': 'सीरीज़',
  'nav.anime': 'एनीमे',
  'nav.search': 'खोजें',
  'nav.watchlist': 'वॉचलिस्ट',
  'nav.signin': 'साइन इन',
  'nav.profile': 'प्रोफ़ाइल',
  'nav.signout': 'साइन आउट',
  'nav.notifications': 'सूचनाएं',
  'nav.allCaughtUp': 'सब अपडेट है।',
  'nav.openSearch': 'खोज खोलें',
  'nav.searchPlaceholder': 'फ़िल्में, शो खोजें…',
  'home.trendingNow': 'अभी ट्रेंडिंग',
  'home.latestMovies': 'नई फ़िल्में',
  'home.latestTV': 'नए टीवी शो',
  'home.topRated': 'सर्वश्रेष्ठ',
  'home.action': 'एक्शन',
  'home.comedy': 'कॉमेडी',
  'home.horror': 'हॉरर',
  'home.scifi': 'साइ-फ़ाई',
  'home.drama': 'ड्रामा',
  'home.anime': 'एनीमे',
  'home.netflix': 'नेटफ्लिक्स ओरिजिनल',
  'home.disney': 'डिज़्नी',
  'home.marvel': 'मार्वेल',
  'home.popular': 'अभी लोकप्रिय',
  'home.comingSoon': 'जल्द आ रहा है',
  'home.continueWatching': 'देखते रहें',
  'browse.movies': 'फ़िल्में',
  'browse.series': 'सीरीज़',
  'browse.anime': 'एनीमे',
  'browse.viewAll': 'सभी देखें',
  'browse.noResults': 'कोई परिणाम नहीं',
  'browse.resetFilters': 'फ़िल्टर रीसेट करें',
  'browse.previous': 'पिछला',
  'browse.next': 'अगला',
  'anime.heroLabel': 'टॉप एनीमे',
  'anime.topAiring': 'टॉप एयरिंग',
  'anime.popular': 'सबसे लोकप्रिय',
  'anime.movies': 'एनीमे फ़िल्में',
  'anime.romance': 'रोमांस',
  'anime.action': 'एक्शन',
  'anime.fantasy': 'फैंटेसी',
  'anime.scifi': 'साइ-फ़ाई',
  'anime.upcoming': 'आने वाला',
  'footer.tagline': 'हर फ़िल्म और शो, एक जगह।',
  'footer.allRights': 'सर्वाधिकार सुरक्षित।',
  'footer.poweredBy': 'TMDB द्वारा संचालित',
  'common.signedIn': 'साइन इन',
};

const ja: Translations = {
  'nav.movies': '映画',
  'nav.series': 'シリーズ',
  'nav.anime': 'アニメ',
  'nav.search': '検索',
  'nav.watchlist': 'ウォッチリスト',
  'nav.signin': 'サインイン',
  'nav.profile': 'プロフィール',
  'nav.signout': 'サインアウト',
  'nav.notifications': '通知',
  'nav.allCaughtUp': 'すべてチェック済みです。',
  'nav.openSearch': '検索を開く',
  'nav.searchPlaceholder': '映画・番組を検索…',
  'home.trendingNow': '今トレンド',
  'home.latestMovies': '最新映画',
  'home.latestTV': '最新テレビ',
  'home.topRated': '高評価',
  'home.action': 'アクション',
  'home.comedy': 'コメディ',
  'home.horror': 'ホラー',
  'home.scifi': 'SF',
  'home.drama': 'ドラマ',
  'home.anime': 'アニメ',
  'home.netflix': 'Netflixオリジナル',
  'home.disney': 'ディズニー',
  'home.marvel': 'マーベル',
  'home.popular': '人気急上昇',
  'home.comingSoon': '近日公開',
  'home.continueWatching': '続きを見る',
  'browse.movies': '映画',
  'browse.series': 'シリーズ',
  'browse.anime': 'アニメ',
  'browse.viewAll': 'すべて見る',
  'browse.noResults': '結果なし',
  'browse.resetFilters': 'フィルターをリセット',
  'browse.previous': '前へ',
  'browse.next': '次へ',
  'anime.heroLabel': 'トップアニメ',
  'anime.topAiring': '放送中トップ',
  'anime.popular': '最人気',
  'anime.movies': 'アニメ映画',
  'anime.romance': 'ロマンス',
  'anime.action': 'アクション',
  'anime.fantasy': 'ファンタジー',
  'anime.scifi': 'SF',
  'anime.upcoming': '近日公開',
  'footer.tagline': 'すべての映画・番組が一か所に。',
  'footer.allRights': '全著作権所有。',
  'footer.poweredBy': 'TMDBによる',
  'common.signedIn': 'サインイン済み',
};

const fr: Translations = {
  'nav.movies': 'Films',
  'nav.series': 'Séries',
  'nav.anime': 'Anime',
  'nav.search': 'Recherche',
  'nav.watchlist': 'Liste',
  'nav.signin': 'Connexion',
  'nav.profile': 'Profil',
  'nav.signout': 'Déconnexion',
  'nav.notifications': 'Notifications',
  'nav.allCaughtUp': 'Tout est à jour.',
  'nav.openSearch': 'Ouvrir la recherche',
  'nav.searchPlaceholder': 'Rechercher films, séries…',
  'home.trendingNow': 'Tendances',
  'home.latestMovies': 'Derniers films',
  'home.latestTV': 'Dernières séries',
  'home.topRated': 'Mieux notés',
  'home.action': 'Action',
  'home.comedy': 'Comédie',
  'home.horror': 'Horreur',
  'home.scifi': 'Sci-Fi',
  'home.drama': 'Drame',
  'home.anime': 'Anime',
  'home.netflix': 'Netflix Originals',
  'home.disney': 'Disney',
  'home.marvel': 'Marvel',
  'home.popular': 'Populaire en ce moment',
  'home.comingSoon': 'Prochainement',
  'home.continueWatching': 'Continuer à regarder',
  'browse.movies': 'Films',
  'browse.series': 'Séries',
  'browse.anime': 'Anime',
  'browse.viewAll': 'Voir tout',
  'browse.noResults': 'Aucun résultat',
  'browse.resetFilters': 'Réinitialiser',
  'browse.previous': 'Précédent',
  'browse.next': 'Suivant',
  'anime.heroLabel': 'Top Anime',
  'anime.topAiring': 'En diffusion',
  'anime.popular': 'Plus populaires',
  'anime.movies': 'Films animés',
  'anime.romance': 'Romance',
  'anime.action': 'Action',
  'anime.fantasy': 'Fantaisie',
  'anime.scifi': 'SF',
  'anime.upcoming': 'À venir',
  'footer.tagline': 'Tous les films et séries au même endroit.',
  'footer.allRights': 'Tous droits réservés.',
  'footer.poweredBy': 'Propulsé par TMDB',
  'common.signedIn': 'Connecté',
};

const es: Translations = {
  'nav.movies': 'Películas',
  'nav.series': 'Series',
  'nav.anime': 'Anime',
  'nav.search': 'Buscar',
  'nav.watchlist': 'Mi lista',
  'nav.signin': 'Iniciar sesión',
  'nav.profile': 'Perfil',
  'nav.signout': 'Cerrar sesión',
  'nav.notifications': 'Notificaciones',
  'nav.allCaughtUp': 'Todo al día.',
  'nav.openSearch': 'Abrir búsqueda',
  'nav.searchPlaceholder': 'Buscar películas, series…',
  'home.trendingNow': 'En tendencia',
  'home.latestMovies': 'Últimas películas',
  'home.latestTV': 'Últimas series',
  'home.topRated': 'Mejor valoradas',
  'home.action': 'Acción',
  'home.comedy': 'Comedia',
  'home.horror': 'Terror',
  'home.scifi': 'Ciencia ficción',
  'home.drama': 'Drama',
  'home.anime': 'Anime',
  'home.netflix': 'Netflix Originales',
  'home.disney': 'Disney',
  'home.marvel': 'Marvel',
  'home.popular': 'Popular ahora',
  'home.comingSoon': 'Próximamente',
  'home.continueWatching': 'Continuar viendo',
  'browse.movies': 'Películas',
  'browse.series': 'Series',
  'browse.anime': 'Anime',
  'browse.viewAll': 'Ver todo',
  'browse.noResults': 'Sin resultados',
  'browse.resetFilters': 'Resetear filtros',
  'browse.previous': 'Anterior',
  'browse.next': 'Siguiente',
  'anime.heroLabel': 'Top Anime',
  'anime.topAiring': 'En emisión',
  'anime.popular': 'Más populares',
  'anime.movies': 'Películas anime',
  'anime.romance': 'Romance',
  'anime.action': 'Acción',
  'anime.fantasy': 'Fantasía',
  'anime.scifi': 'Ciencia ficción',
  'anime.upcoming': 'Próximamente',
  'footer.tagline': 'Todas las películas y series en un lugar.',
  'footer.allRights': 'Todos los derechos reservados.',
  'footer.poweredBy': 'Desarrollado por TMDB',
  'common.signedIn': 'Sesión iniciada',
};

const de: Translations = {
  'nav.movies': 'Filme',
  'nav.series': 'Serien',
  'nav.anime': 'Anime',
  'nav.search': 'Suche',
  'nav.watchlist': 'Merkliste',
  'nav.signin': 'Anmelden',
  'nav.profile': 'Profil',
  'nav.signout': 'Abmelden',
  'nav.notifications': 'Benachrichtigungen',
  'nav.allCaughtUp': 'Alles auf dem neuesten Stand.',
  'nav.openSearch': 'Suche öffnen',
  'nav.searchPlaceholder': 'Filme, Serien suchen…',
  'home.trendingNow': 'Trending',
  'home.latestMovies': 'Neue Filme',
  'home.latestTV': 'Neue Serien',
  'home.topRated': 'Bestbewertet',
  'home.action': 'Action',
  'home.comedy': 'Komödie',
  'home.horror': 'Horror',
  'home.scifi': 'Sci-Fi',
  'home.drama': 'Drama',
  'home.anime': 'Anime',
  'home.netflix': 'Netflix Originale',
  'home.disney': 'Disney',
  'home.marvel': 'Marvel',
  'home.popular': 'Gerade beliebt',
  'home.comingSoon': 'Demnächst',
  'home.continueWatching': 'Weiterschauen',
  'browse.movies': 'Filme',
  'browse.series': 'Serien',
  'browse.anime': 'Anime',
  'browse.viewAll': 'Alle anzeigen',
  'browse.noResults': 'Keine Ergebnisse',
  'browse.resetFilters': 'Filter zurücksetzen',
  'browse.previous': 'Zurück',
  'browse.next': 'Weiter',
  'anime.heroLabel': 'Top Anime',
  'anime.topAiring': 'Aktuell laufend',
  'anime.popular': 'Beliebteste',
  'anime.movies': 'Anime-Filme',
  'anime.romance': 'Romanze',
  'anime.action': 'Action',
  'anime.fantasy': 'Fantasy',
  'anime.scifi': 'Science-Fiction',
  'anime.upcoming': 'Demnächst',
  'footer.tagline': 'Alle Filme & Serien an einem Ort.',
  'footer.allRights': 'Alle Rechte vorbehalten.',
  'footer.poweredBy': 'Betrieben von TMDB',
  'common.signedIn': 'Angemeldet',
};

const pt: Translations = {
  'nav.movies': 'Filmes',
  'nav.series': 'Séries',
  'nav.anime': 'Anime',
  'nav.search': 'Pesquisar',
  'nav.watchlist': 'Minha lista',
  'nav.signin': 'Entrar',
  'nav.profile': 'Perfil',
  'nav.signout': 'Sair',
  'nav.notifications': 'Notificações',
  'nav.allCaughtUp': 'Tudo em dia.',
  'nav.openSearch': 'Abrir pesquisa',
  'nav.searchPlaceholder': 'Pesquisar filmes, séries…',
  'home.trendingNow': 'Em Alta',
  'home.latestMovies': 'Últimos Filmes',
  'home.latestTV': 'Últimas Séries',
  'home.topRated': 'Mais Bem Avaliados',
  'home.action': 'Ação',
  'home.comedy': 'Comédia',
  'home.horror': 'Terror',
  'home.scifi': 'Ficção Científica',
  'home.drama': 'Drama',
  'home.anime': 'Anime',
  'home.netflix': 'Originais Netflix',
  'home.disney': 'Disney',
  'home.marvel': 'Marvel',
  'home.popular': 'Popular Agora',
  'home.comingSoon': 'Em Breve',
  'home.continueWatching': 'Continuar Assistindo',
  'browse.movies': 'Filmes',
  'browse.series': 'Séries',
  'browse.anime': 'Anime',
  'browse.viewAll': 'Ver tudo',
  'browse.noResults': 'Sem resultados',
  'browse.resetFilters': 'Redefinir filtros',
  'browse.previous': 'Anterior',
  'browse.next': 'Próximo',
  'anime.heroLabel': 'Top Anime',
  'anime.topAiring': 'No Ar',
  'anime.popular': 'Mais Populares',
  'anime.movies': 'Filmes Anime',
  'anime.romance': 'Romance',
  'anime.action': 'Ação',
  'anime.fantasy': 'Fantasia',
  'anime.scifi': 'Ficção Científica',
  'anime.upcoming': 'Em Breve',
  'footer.tagline': 'Todos os filmes e séries em um só lugar.',
  'footer.allRights': 'Todos os direitos reservados.',
  'footer.poweredBy': 'Desenvolvido com TMDB',
  'common.signedIn': 'Conectado',
};

const ko: Translations = {
  'nav.movies': '영화',
  'nav.series': '시리즈',
  'nav.anime': '애니메이션',
  'nav.search': '검색',
  'nav.watchlist': '찜 목록',
  'nav.signin': '로그인',
  'nav.profile': '프로필',
  'nav.signout': '로그아웃',
  'nav.notifications': '알림',
  'nav.allCaughtUp': '모두 확인했습니다.',
  'nav.openSearch': '검색 열기',
  'nav.searchPlaceholder': '영화, 시리즈 검색…',
  'home.trendingNow': '지금 인기',
  'home.latestMovies': '최신 영화',
  'home.latestTV': '최신 TV',
  'home.topRated': '최고 평점',
  'home.action': '액션',
  'home.comedy': '코미디',
  'home.horror': '공포',
  'home.scifi': 'SF',
  'home.drama': '드라마',
  'home.anime': '애니메이션',
  'home.netflix': '넷플릭스 오리지널',
  'home.disney': '디즈니',
  'home.marvel': '마블',
  'home.popular': '지금 인기 있는',
  'home.comingSoon': '개봉 예정',
  'home.continueWatching': '이어보기',
  'browse.movies': '영화',
  'browse.series': '시리즈',
  'browse.anime': '애니메이션',
  'browse.viewAll': '전체 보기',
  'browse.noResults': '결과 없음',
  'browse.resetFilters': '필터 초기화',
  'browse.previous': '이전',
  'browse.next': '다음',
  'anime.heroLabel': '인기 애니',
  'anime.topAiring': '방영 중',
  'anime.popular': '최고 인기',
  'anime.movies': '애니 영화',
  'anime.romance': '로맨스',
  'anime.action': '액션',
  'anime.fantasy': '판타지',
  'anime.scifi': 'SF',
  'anime.upcoming': '예정작',
  'footer.tagline': '모든 영화와 시리즈를 한 곳에서.',
  'footer.allRights': '모든 권리 보유.',
  'footer.poweredBy': 'TMDB 제공',
  'common.signedIn': '로그인됨',
};

const zh: Translations = {
  'nav.movies': '电影',
  'nav.series': '剧集',
  'nav.anime': '动漫',
  'nav.search': '搜索',
  'nav.watchlist': '收藏',
  'nav.signin': '登录',
  'nav.profile': '个人资料',
  'nav.signout': '退出登录',
  'nav.notifications': '通知',
  'nav.allCaughtUp': '已全部查看。',
  'nav.openSearch': '打开搜索',
  'nav.searchPlaceholder': '搜索电影、剧集…',
  'home.trendingNow': '正在流行',
  'home.latestMovies': '最新电影',
  'home.latestTV': '最新剧集',
  'home.topRated': '最高评分',
  'home.action': '动作',
  'home.comedy': '喜剧',
  'home.horror': '恐怖',
  'home.scifi': '科幻',
  'home.drama': '剧情',
  'home.anime': '动漫',
  'home.netflix': 'Netflix原创',
  'home.disney': '迪士尼',
  'home.marvel': '漫威',
  'home.popular': '热门',
  'home.comingSoon': '即将上映',
  'home.continueWatching': '继续观看',
  'browse.movies': '电影',
  'browse.series': '剧集',
  'browse.anime': '动漫',
  'browse.viewAll': '查看全部',
  'browse.noResults': '无结果',
  'browse.resetFilters': '重置筛选',
  'browse.previous': '上一页',
  'browse.next': '下一页',
  'anime.heroLabel': '热门动漫',
  'anime.topAiring': '正在播出',
  'anime.popular': '最受欢迎',
  'anime.movies': '动漫电影',
  'anime.romance': '浪漫',
  'anime.action': '动作',
  'anime.fantasy': '奇幻',
  'anime.scifi': '科幻',
  'anime.upcoming': '即将推出',
  'footer.tagline': '所有电影和剧集，一个地方。',
  'footer.allRights': '版权所有。',
  'footer.poweredBy': '由TMDB提供支持',
  'common.signedIn': '已登录',
};

const locales: Record<Locale, Translations> = { en, hi, ja, fr, es, de, pt, ko, zh };

/**
 * Get a translation for a key in the given locale.
 * Falls back to English if the key is missing in the locale.
 */
export function t(locale: Locale, key: TranslationKey): string {
  return locales[locale]?.[key] ?? locales['en'][key] ?? key;
}

/**
 * Detect locale from Accept-Language header or cookie.
 * Returns a supported locale or 'en' as the default.
 */
export function detectLocale(
  acceptLanguage: string | null,
  cookieLocale?: string | null
): Locale {
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }
  if (acceptLanguage) {
    const tags = acceptLanguage
      .split(',')
      .map((s) => s.split(';')[0].trim().toLowerCase().slice(0, 2));
    for (const tag of tags) {
      if (SUPPORTED_LOCALES.includes(tag as Locale)) return tag as Locale;
    }
  }
  return 'en';
}
