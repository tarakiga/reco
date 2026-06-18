// Curated mood & occasion definitions → TMDB Discover queries. Pure data so it
// can be unit-tested and reused by the service + pages. Genre/keyword ids are
// TMDB's stable ids. `withGenres`/`withKeywords` use "|" for OR.

export interface MoodQuery {
  withGenres?: string;
  withoutGenres?: string;
  withKeywords?: string;
  voteAverageGte?: number;
  voteCountGte?: number;
  sortBy?: string; // default popularity.desc
  mediaType?: "movie" | "tv"; // default movie
  /** US certification ceiling, e.g. "PG-13" — keeps mature titles out of family/cosy moods. */
  certificationLte?: string;
}

export interface Mood {
  slug: string;
  label: string;
  emoji: string;
  blurb: string;
  kind: "mood" | "occasion";
  /** TMDB Discover query. Omitted when the mood is a hand-picked `manual` list. */
  query?: MoodQuery;
  /** Hand-picked TMDB movie ids, in curated order. Takes precedence over `query`. */
  manual?: number[];
  /** Months (1-12) an occasion is featured on the home page; omitted = evergreen. */
  season?: number[];
}

// Genre ids: Action 28 · Adventure 12 · Animation 16 · Comedy 35 · Crime 80
// Documentary 99 · Drama 18 · Family 10751 · Fantasy 14 · Horror 27
// Mystery 9648 · Romance 10749 · Sci-Fi 878 · Thriller 53
// Keyword ids: christmas 207317 · halloween 3335 · tearjerker 156924
// mind-bending 362567 · based-on-true-story 9672

export const MOODS: Mood[] = [
  {
    slug: "cosy-night-in",
    label: "Cosy night in",
    emoji: "🛋️",
    blurb: "Warm, comforting watches for a quiet evening.",
    kind: "mood",
    // Most-voted feel-good favourites (not this week's trending), capped at PG-13
    // so nothing harsh sneaks in.
    query: {
      withGenres: "35|10749|10751",
      withoutGenres: "27,53",
      voteAverageGte: 6.7,
      voteCountGte: 500,
      sortBy: "vote_count.desc",
      certificationLte: "PG-13",
    },
  },
  {
    slug: "edge-of-your-seat",
    label: "Edge of your seat",
    emoji: "😱",
    blurb: "Tense thrillers that won't let you breathe.",
    kind: "mood",
    // Hand-picked: the genre query (sorted by rating) crowned obscure titles and
    // mixed in prestige dramas that aren't thrillers. Curated for real tension.
    // Se7en, Silence of the Lambs, Prisoners, Zodiac, Gone Girl, No Country for
    // Old Men, Nightcrawler, Sicario, Wind River, A Quiet Place, Get Out, Sixth
    // Sense, Misery, Panic Room, Dragon Tattoo, Shutter Island, Uncut Gems, 127
    // Hours, Heat, Collateral, Drive, Invisible Man, Split, Searching, Run, Ready
    // or Not, Green Room, Don't Breathe, Buried.
    manual: [
      807, 274, 146233, 1949, 210577, 6977, 242582, 273481, 395834, 447332, 419430, 745, 1700,
      4547, 65754, 11324, 473033, 44115, 949, 1538, 64690, 570670, 358364, 489999, 546121, 567609,
      313922, 300669, 26388,
    ],
  },
  {
    slug: "need-a-laugh",
    label: "Need a laugh",
    emoji: "😂",
    blurb: "Comedies to reset your mood.",
    kind: "mood",
    // Hand-picked: the comedy genre sorted by popularity surfaced this week's
    // trending releases over actual comedies. Curated crowd-pleasers.
    // Girls Trip, The Wedding Ringer, Superbad, The Hangover, Bridesmaids, Step
    // Brothers, Anchorman, Dumb and Dumber, 21 Jump Street, Tropic Thunder, This
    // Is the End, Game Night, Booksmart, Pineapple Express, We're the Millers,
    // Horrible Bosses, Ted, The Other Guys, Borat, Zoolander, Talladega Nights,
    // Old School, Wedding Crashers, Dodgeball, Napoleon Dynamite, Mrs. Doubtfire,
    // Liar Liar, Ace Ventura, The Nice Guys, Spy, Hot Fuzz.
    manual: [
      417870, 252838, 8363, 18785, 55721, 12133, 8699, 8467, 64688, 7446, 109414, 445571, 505600,
      10189, 138832, 51540, 72105, 27581, 496, 9398, 9718, 11635, 9522, 9472, 8193, 788, 1624, 3049,
      290250, 238713, 4638,
    ],
  },
  {
    slug: "a-good-cry",
    label: "A good cry",
    emoji: "😭",
    blurb: "Bring the tissues.",
    kind: "mood",
    // Hand-picked: TMDB's "tearjerker" keyword only tags ~16 films, mostly
    // obscure foreign ones. Curated recognisable tearjerkers.
    // The Champ, Nobody's Boy: Remi, Marley & Me, Up, The Green Mile, Hachi,
    // Grave of the Fireflies, Bridge to Terabithia, My Girl, Steel Magnolias,
    // Terms of Endearment, The Fault in Our Stars, A Walk to Remember, P.S. I
    // Love You, The Notebook, Atonement, Manchester by the Sea, Coco, Life Is
    // Beautiful, Dead Poets Society, Old Yeller, The Pianist, Philadelphia,
    // Million Dollar Baby, Forrest Gump, Boy in the Striped Pyjamas, Five Feet
    // Apart, We Live in Time.
    manual: [
      30547, 458302, 14306, 14160, 497, 28178, 12477, 1265, 4032, 10860, 11050, 222935, 10229, 6023,
      11036, 4347, 334541, 354912, 637, 207, 22660, 423, 9800, 70, 13, 14574, 527641, 1100099,
    ],
  },
  {
    slug: "mind-benders",
    label: "Mind-benders",
    emoji: "🤯",
    blurb: "Twist endings, time loops and puzzle-box films that mess with your head.",
    kind: "mood",
    // Hand-picked: no genre or keyword query captures this well. Curated order.
    // Memento, Mulholland Drive, Usual Suspects, Predestination, Triangle, Inception,
    // The Prestige, Fight Club, Shutter Island, Donnie Darko, Primer, Coherence,
    // Eternal Sunshine, 12 Monkeys, Source Code, Arrival, Enemy, Oldboy, Sixth Sense,
    // Timecrimes, Mr. Nobody, Jacob's Ladder, Tenet, Dark City, The Machinist,
    // Identity, Perfect Blue, Paprika, Vanilla Sky, Looper.
    manual: [
      77, 1018, 629, 206487, 26466, 27205, 1124, 550, 11324, 141, 14337, 220289, 38, 63, 45612,
      329865, 181886, 670, 745, 14139, 31011, 2291, 577922, 2666, 4553, 2832, 10494, 4977, 1903, 59967,
    ],
  },
  {
    slug: "so-bad-its-good",
    label: "So bad they're good",
    emoji: "📼",
    blurb: "Gloriously terrible cult films and Z-movies that are a riot to watch.",
    kind: "mood",
    // Hand-picked like mind-benders: TMDB's "so bad it's good" keyword (#323812)
    // is applied too sparsely to use as a Discover filter, so it misses the
    // canon. Curated order.
    // The Room, Troll 2, Birdemic, Plan 9 from Outer Space, Manos, Samurai Cop,
    // Miami Connection, Sharknado, Mac and Me, Battlefield Earth, The Wicker Man
    // (2006), Showgirls, Cool as Ice, Fateful Findings, Robot Monster, Santa
    // Claus Conquers the Martians, Killer Klowns, Maximum Overdrive, The Toxic
    // Avenger, Rubber, Tammy and the T-Rex, Reefer Madness, Hard Ticket to
    // Hawaii, Deadly Prey, Dangerous Men, Street Trash, Mega Shark vs. Giant
    // Octopus, Anaconda, Snakes on a Plane, Kung Fury, The VelociPastor, Double
    // Down, Death Bed, Turkish Star Wars.
    manual: [
      17473, 26914, 40016, 10513, 22293, 65374, 59558, 205321, 20196, 5491, 9708, 10802, 1496,
      197599, 43353, 32307, 16296, 9980, 15239, 45649, 55563, 37833, 26011, 5753, 84140, 22172,
      17911, 9360, 326, 251516, 457712, 260928, 45795, 20787,
    ],
  },
  {
    slug: "b-movie-mashups",
    label: "B-movie mashups",
    emoji: "🦈",
    blurb: "Z-grade creature mashups where the title says it all: shark plus tornado, velociraptor plus pastor.",
    kind: "mood",
    // Hand-picked: TMDB's "creature feature" / "mockbuster" keywords are barely
    // applied to the films that define the genre (Sharknado isn't even tagged
    // "creature feature", and Sharknado 2 has no keywords), so a Discover filter
    // misses the canon. Curated.
    // Sharknado, Sharktopus, Mega Shark vs. Giant Octopus, Piranhaconda,
    // Dinoshark, VelociPastor, Cowboys vs. Dinosaurs, 2/3/5-Headed Shark Attack,
    // Mega Shark vs. Crocosaurus, Mega Python vs. Gatoroid, Boa vs. Python,
    // Komodo vs. Cobra, Arachnoquake, Lavalantula, Sharknado 2, Sharktopus vs.
    // Pteracuda, Sharktopus vs. Whalewolf, Dinocroc vs. Supergator, Ghost Shark,
    // Sand Sharks, RoboCroc, Frankenfish, Zombeavers, Iron Sky, Big Ass Spider!,
    // Eight Legged Freaks, Cocaine Bear, Sharkenstein, Dinocroc.
    manual: [
      205321, 46020, 17911, 115084, 35074, 457712, 337208, 86703, 342927, 460218, 52454, 56171,
      36086, 28509, 116463, 294562, 248504, 284711, 344147, 44809, 216539, 83896, 221737, 33641,
      254474, 10679, 166822, 8869, 804150, 402516, 4289,
    ],
  },
  {
    slug: "popcorn-action",
    label: "Popcorn action",
    emoji: "🍿",
    blurb: "Turn-your-brain-off blockbusters: fast cars, big explosions, zero homework.",
    kind: "mood",
    // Hand-picked: "mindless" is a tone judgment TMDB can't express. A popular
    // Action Discover query returns prestige films (Dark Knight, LOTR), the
    // opposite of this, so curate toward the fun-not-acclaimed end.
    // Fast & Furious x4, xXx x2, Transformers x2, Crank, Transporter x2, Bad Boys
    // x2, Con Air, The Rock, Armageddon, Expendables x2, G.I. Joe, San Andreas,
    // 2012, Independence Day, Olympus/London Has Fallen, Death Race, Wanted,
    // Shoot 'Em Up, Rampage, Skyscraper, Battleship, Hardcore Henry, Need for
    // Speed, Drive Angry, Commando, Cobra.
    manual: [
      9799, 51497, 168259, 385128, 7451, 47971, 1858, 38356, 1948, 4108, 9335, 9737, 8961, 1701,
      9802, 95, 27578, 76163, 14869, 254128, 14161, 602, 117263, 267860, 10483, 8909, 4141, 427641,
      447200, 44833, 325348, 136797, 47327, 10999, 9874,
    ],
  },
  {
    slug: "grindhouse",
    label: "Grindhouse",
    emoji: "🎞️",
    blurb: "Lo-fi, lurid exploitation cinema, gleefully over the top.",
    kind: "mood",
    // Hand-picked: TMDB's grindhouse/exploitation keywords are sparse and the
    // defining films (e.g. They Call Me Macho Woman) carry no keywords at all,
    // so no Discover filter works. Curated across the exploitation tradition:
    // vigilante/revenge, blaxploitation, women-with-guns, kung-fu, Troma,
    // splatter, ozploitation and neo-grindhouse.
    // They Call Me Macho Woman, Ms .45, I Spit on Your Grave, Switchblade
    // Sisters, Coffy, Foxy Brown, Faster Pussycat, Death Wish, Vigilante,
    // Thriller: A Cruel Picture, Class of Nuke 'Em High, Hobo with a Shotgun,
    // Machete, Planet Terror, Death Proof, Riki-Oh, The Street Fighter, The Five
    // Venoms, Black Dynamite, Dolemite, Shaft, Super Fly, Truck Turner,
    // Razorback, Turkey Shoot, Last House on the Left, Maniac, Basket Case,
    // Re-Animator, Maniac Cop, The Exterminator, Savage Streets, Lady Snowblood,
    // Caged Heat.
    manual: [
      86682, 22171, 25239, 52633, 22021, 22048, 315, 13939, 23587, 15018, 26554, 49010, 23631, 1992,
      1991, 17467, 40810, 13481, 24804, 19174, 482, 21968, 22121, 26178, 39899, 15516, 27346, 27813,
      1694, 14240, 37835, 14673, 2487, 39775,
    ],
  },
  {
    slug: "date-night",
    label: "Date night",
    emoji: "❤️",
    blurb: "Crowd-pleasers for two.",
    kind: "mood",
    // Romance-led (not just popular comedies, which drifted into Thor/Men in
    // Black) and capped at PG-13, so it stays on-vibe and distinct from cosy.
    query: {
      withGenres: "10749",
      withoutGenres: "27,53,16",
      voteAverageGte: 6.5,
      voteCountGte: 800,
      sortBy: "vote_count.desc",
      certificationLte: "PG-13",
    },
  },
  {
    slug: "epic-adventures",
    label: "Epic adventures",
    emoji: "🌌",
    blurb: "Sweeping, big-screen journeys.",
    kind: "mood",
    // Hand-picked: the genre query surfaced this week's trending releases and
    // small-scale films, not epics. Curated sweeping journeys.
    // Stardust, LOTR x3, The Hobbit, Raiders, Pirates of the Caribbean, Avatar,
    // Gladiator, Braveheart, Dune x2, Mad Max: Fury Road, The Last Samurai,
    // Master and Commander, Apocalypto, 300, Troy, Kingdom of Heaven, The Mummy,
    // National Treasure, Jurassic Park, Star Wars, The Revenant, The Princess
    // Bride, How to Train Your Dragon, Avatar: Way of Water, Last Crusade.
    manual: [
      2270, 120, 121, 122, 49051, 85, 22, 19995, 98, 197, 438631, 693134, 76341, 616, 8619, 1579,
      1317499, 652, 1495, 564, 2059, 329, 11, 281957, 2493, 10191, 76600, 89,
    ],
  },
  {
    slug: "family-movie-night",
    label: "Family movie night",
    emoji: "👨‍👩‍👧",
    blurb: "Something everyone can enjoy.",
    kind: "mood",
    // Most-voted family/animation, capped at PG-13 so mature anime (e.g. Demon
    // Slayer) can't slip in through the Animation genre.
    query: {
      withGenres: "10751|16",
      voteAverageGte: 6.5,
      voteCountGte: 200,
      sortBy: "vote_count.desc",
      certificationLte: "PG-13",
    },
  },
  {
    slug: "true-stories",
    label: "Based on a true story",
    emoji: "🎬",
    blurb: "Real events, dramatised.",
    kind: "mood",
    query: { withKeywords: "9672", withoutGenres: "99", voteAverageGte: 6.8, voteCountGte: 300 },
  },
  {
    slug: "inspirational",
    label: "Inspirational",
    emoji: "🙏",
    blurb: "Faith-based and uplifting films to lift your spirit.",
    kind: "mood",
    // Query-able (unlike the cult moods): TMDB's "christian film" keyword
    // (#253695) is well-applied. No voteAverageGte, so lower-rated favourites
    // (God's Not Dead) still appear; vote_count.desc surfaces the recognisable
    // ones first.
    query: { withKeywords: "253695", voteCountGte: 80, sortBy: "vote_count.desc" },
  },
  // Occasions — only featured on the home page in their season.
  {
    slug: "spooky-season",
    label: "Spooky season",
    emoji: "🎃",
    blurb: "Horror and dread for the season.",
    kind: "occasion",
    season: [10],
    query: { withGenres: "27", voteCountGte: 300 },
  },
  {
    slug: "festive-favourites",
    label: "Festive favourites",
    emoji: "🎄",
    blurb: "Christmas movies to get cosy with.",
    kind: "occasion",
    season: [11, 12],
    query: { withKeywords: "207317", withGenres: "10751|35|10749", voteAverageGte: 6, voteCountGte: 40 },
  },
  {
    slug: "valentines-picks",
    label: "Valentine's picks",
    emoji: "💘",
    blurb: "The great love stories, for the season of love.",
    kind: "occasion",
    season: [2],
    // Hand-picked: the romance query was overrun by steamy trending YA (the
    // After/Fault franchise) and, once tuned, just duplicated date-night.
    // Curated as iconic love stories instead, distinct from date-night.
    // Casablanca, Pride & Prejudice, The Notebook, Titanic, When Harry Met Sally,
    // Notting Hill, Pretty Woman, Before Sunrise/Sunset, Eternal Sunshine, La La
    // Land, Your Name, Brokeback Mountain, Call Me by Your Name, Atonement,
    // Moulin Rouge, Romeo + Juliet, Dirty Dancing, Ghost, Sleepless in Seattle,
    // You've Got Mail, 10 Things I Hate About You, Crazy Stupid Love, About Time,
    // Past Lives, Portrait of a Lady on Fire, In the Mood for Love, Amelie, Sense
    // and Sensibility, Roman Holiday, Silver Linings Playbook, 500 Days of Summer.
    manual: [
      289, 4348, 11036, 597, 639, 509, 114, 76, 80, 38, 313369, 372058, 142, 398818, 4347, 824, 454,
      88, 251, 858, 9489, 4951, 50646, 122906, 666277, 531428, 843, 194, 4584, 804, 82693, 19913,
    ],
  },
  {
    slug: "summer-blockbusters",
    label: "Summer blockbusters",
    emoji: "☀️",
    blurb: "Big, loud and fun.",
    kind: "occasion",
    season: [6, 7, 8],
    query: { withGenres: "28|12|878", voteCountGte: 1500 },
  },
];

export function getMoodBySlug(slug: string): Mood | undefined {
  return MOODS.find((m) => m.slug === slug);
}

/**
 * Home-page selection: any in-season occasions first, then a daily-rotating
 * slice of evergreen moods, capped at `count`. Deterministic given the date.
 */
export function featuredMoods(month: number, dayOfYear: number, count = 4): Mood[] {
  const occasions = MOODS.filter((m) => m.kind === "occasion" && m.season?.includes(month));
  const evergreen = MOODS.filter((m) => m.kind === "mood");
  const offset = ((dayOfYear % evergreen.length) + evergreen.length) % evergreen.length;
  const rotated = [...evergreen.slice(offset), ...evergreen.slice(0, offset)];
  return [...occasions, ...rotated].slice(0, count);
}
