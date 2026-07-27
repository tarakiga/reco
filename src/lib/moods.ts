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
  /** Release-date window (ISO "YYYY-MM-DD"), e.g. for an era mood like classic Hollywood. */
  releaseDateGte?: string;
  releaseDateLte?: string;
  /** TMDB original-language code (e.g. "en") — keeps an era mood to its industry. */
  originalLanguage?: string;
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
  /** Hand-picked TMDB TV ids, in curated order. Presence enables the mood's TV tab.
   *  TV is always curated: TMDB's TV genre vocabulary has no Romance/Horror/Thriller/
   *  Action/Adventure/Sci-Fi, so Discover queries return 0-2 results for these moods. */
  manualTv?: number[];
  /** Blurb override for the TV tab, when the shared blurb does not fit shows. */
  blurbTv?: string;
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
    // cosy-night-in
    manualTv: [
      4586, 61662, 97546, 8592, 48891, 1421, 1420, 107113, 32726, 70785, 39793, 66134, 61828, 2430,
      124834,
    ],
    // Gilmore Girls, Schitt's Creek, Ted Lasso, Parks and Rec, Brooklyn Nine-Nine,
    // Modern Family, New Girl, Only Murders, Bob's Burgers, Anne with an E, Call the
    // Midwife, The Durrells, Detectorists, Doc Martin, Heartstopper.
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
    // edge-of-your-seat
    manualTv: [
      1396, 60059, 69740, 67744, 43982, 1427, 34415, 49010, 1407, 2288, 1973, 1405, 70453, 39852,
      80307, 78191,
    ],
    // Breaking Bad, Better Call Saul, Ozark, Mindhunter, Line of Duty, Broadchurch,
    // The Killing, The Fall, Homeland, Prison Break, 24, Dexter, Sharp Objects, The
    // Sinner, Bodyguard, You.
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
    // need-a-laugh
    manualTv: [
      2316, 8592, 48891, 2710, 4589, 18347, 4608, 1400, 1668, 4546, 2490, 815, 2207, 62649, 83631,
      126027,
    ],
    // The Office, Parks and Rec, Brooklyn Nine-Nine, It's Always Sunny, Arrested
    // Development, Community, 30 Rock, Seinfeld, Friends, Curb Your Enthusiasm, The IT
    // Crowd, Peep Show, Fawlty Towers, Superstore, What We Do in the Shadows, Ghosts.
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
    // a-good-cry
    manualTv: [
      67136, 1274, 54344, 81355, 89905, 79410, 46619, 240667, 111141, 99581, 136311, 1416, 39793,
      46880,
    ],
    // This Is Us, Six Feet Under, The Leftovers, When They See Us, Normal People, After
    // Life, Rectify, One Day, Maid, Unorthodox, Shrinking, Grey's Anatomy, Call the
    // Midwife, The Fosters.
  },
  {
    slug: "mind-benders",
    label: "Mind-benders",
    emoji: "🤯",
    blurb: "Twist endings, time loops and puzzle-box films that mess with your head.",
    kind: "mood",
    // mind-benders
    blurbTv: "Twist endings, time loops and puzzle-box shows that mess with your head.",
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
    // mind-benders
    manualTv: [
      70523, 95396, 63247, 1920, 4607, 1705, 67195, 69061, 81349, 86340, 73411, 84977, 63646, 93784,
      90669, 894,
    ],
    // Dark, Severance, Westworld, Twin Peaks, Lost, Fringe, Legion, The OA, Devs,
    // Undone, Maniac, Russian Doll, Counterpart, Tales from the Loop, 1899, The Prisoner.
  },
  {
    slug: "so-bad-its-good",
    label: "So bad they're good",
    emoji: "📼",
    blurb: "Gloriously terrible cult films and Z-movies that are a riot to watch.",
    kind: "mood",
    // so-bad-its-good
    blurbTv: "Gloriously terrible cult TV that is a riot to watch.",
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
    // so-bad-its-good
    manualTv: [69050, 2384, 2119, 3291, 12751, 3318, 2898, 237],
    // Riverdale, Knight Rider, Airwolf, Manimal, Automan, Street Hawk, Small Wonder,
    // Mortal Kombat: Conquest. Shorter than the movie list on purpose: the TV canon here
    // is thin, and this list is expected to grow.
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
    // b-movie-mashups
    manualTv: [
      61345, 62264, 65988, 65820, 71693, 62413, 62517, 58811, 10268, 73536, 39351, 1310, 67726,
    ],
    // Z Nation, Ash vs Evil Dead, Wynonna Earp, Van Helsing, Blood Drive, Killjoys, Zoo,
    // Helix, Primeval, Dinotopia, Grimm, Sanctuary, Beyond.
  },
  {
    slug: "popcorn-action",
    label: "Popcorn action",
    emoji: "🍿",
    blurb: "Turn-your-brain-off blockbusters: fast cars, big explosions, zero homework.",
    kind: "mood",
    // popcorn-action
    blurbTv: "Turn-your-brain-off action: fast cars, big explosions, zero homework.",
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
    // popcorn-action
    manualTv: [
      1973, 32573, 41727, 73544, 108978, 73375, 76479, 77169, 71790, 32798, 2919, 47450, 1412, 67178,
      110492, 205715,
    ],
    // 24, Strike Back, Banshee, Warrior, Reacher, Jack Ryan, The Boys, Cobra Kai,
    // S.W.A.T., Hawaii Five-0, Burn Notice, Into the Badlands, Arrow, The Punisher,
    // Peacemaker, Gen V.
  },
  {
    slug: "grindhouse",
    label: "Grindhouse",
    emoji: "🎞️",
    blurb: "Lo-fi, lurid exploitation cinema, gleefully over the top.",
    kind: "mood",
    // grindhouse
    blurbTv: "Lo-fi, lurid exploitation TV, gleefully over the top.",
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
    // grindhouse
    manualTv: [
      46296, 47665, 41727, 62264, 64230, 60626, 42295, 71693, 75663, 129418, 72339, 1409, 126118,
      40008, 47640, 54671,
    ],
    // Spartacus, Black Sails, Banshee, Ash vs Evil Dead, Preacher, From Dusk Till Dawn,
    // Hemlock Grove, Blood Drive, Deadly Class, Brand New Cherry Flavor, Happy!, Sons of
    // Anarchy, Chapelwaite, Hannibal, The Strain, Penny Dreadful.
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
    // date-night
    manualTv: [
      91239, 196454, 56570, 62084, 92875, 89905, 240667, 88324, 91602, 61418, 82596, 100883, 124834,
      62668, 250923, 194766,
    ],
    // Bridgerton, Queen Charlotte, Outlander, Poldark, Sanditon, Normal People, One Day,
    // Virgin River, Modern Love, Jane the Virgin, Emily in Paris, Never Have I Ever,
    // Heartstopper, Lovesick, Nobody Wants This, The Summer I Turned Pretty.
  },
  {
    slug: "epic-adventures",
    label: "Epic adventures",
    emoji: "🌌",
    blurb: "Sweeping, big-screen journeys.",
    kind: "mood",
    // epic-adventures
    blurbTv: "Sweeping journeys with whole seasons to breathe.",
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
    // epic-adventures
    manualTv: [
      1399, 94997, 84773, 44217, 63333, 1891, 126308, 70593, 71912, 82452, 46296, 47665, 71914,
      70484, 56570,
    ],
    // Game of Thrones, House of the Dragon, Rings of Power, Vikings, The Last Kingdom,
    // Rome, Shogun, Kingdom, The Witcher, Avatar: The Last Airbender, Spartacus, Black
    // Sails, The Wheel of Time, Britannia, Outlander.
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
    // family-movie-night
    manualTv: [
      82728, 82452, 40075, 1877, 72350, 15260, 92685, 60554, 85349, 68267, 74728, 95599, 115577,
      82856,
    ],
    // Bluey, Avatar: The Last Airbender, Gravity Falls, Phineas and Ferb, DuckTales,
    // Adventure Time, The Owl House, Star Wars Rebels, Amphibia, Trollhunters, Carmen
    // Sandiego, Kipo, Sonic Prime, The Mandalorian.
  },
  {
    slug: "true-stories",
    label: "Based on a true story",
    emoji: "🎬",
    blurb: "Real events, dramatised.",
    kind: "mood",
    query: { withKeywords: "9672", withoutGenres: "99", voteAverageGte: 6.8, voteCountGte: 300 },
    // true-stories
    manualTv: [
      87108, 65494, 4613, 81355, 63351, 67744, 64513, 91275, 72039, 82883, 74140, 122066, 110695,
      114925, 95665, 155537,
    ],
    // Chernobyl, The Crown, Band of Brothers, When They See Us, Narcos, Mindhunter,
    // American Crime Story, Unbelievable, Escape at Dannemora, The Act, Waco, The
    // Dropout, Dopesick, Pam & Tommy, Inventing Anna, Black Bird.
  },
  {
    slug: "inspirational",
    label: "Inspirational",
    emoji: "✨",
    blurb: "Uplifting, faith-based and true-triumph films to lift your spirit.",
    kind: "mood",
    // inspirational
    blurbTv: "Uplifting, faith-based and true-triumph shows to lift your spirit.",
    // Hybrid: a hand-picked seed of beloved inspirational classics that TMDB's
    // "christian film" keyword misses (Miracle on 34th Street, sports underdogs,
    // true-triumph stories), pinned ahead of the auto-updating faith-based query
    // (keyword #253695, no voteAverageGte so God's Not Dead etc. still appear).
    // Miracle on 34th Street, Pursuit of Happyness, Rudy, Remember the Titans,
    // The Blind Side, Field of Dreams, Hidden Figures, Cool Runnings, Invictus,
    // Coach Carter, October Sky, McFarland USA, Wonder, Hacksaw Ridge, Chariots
    // of Fire, The Greatest Showman, Dead Poets Society, Good Will Hunting.
    manual: [
      11881, 1402, 14534, 10637, 22881, 2323, 381284, 864, 22954, 7214, 13466, 228203, 406997,
      324786, 9443, 316029, 207, 489,
    ],
    query: { withKeywords: "253695", voteCountGte: 80, sortBy: "vote_count.desc" },
    // inspirational
    manualTv: [
      97546, 4278, 126929, 97401, 125935, 76922, 85077, 2243, 2440, 4550, 1781, 61865,
    ],
    // Ted Lasso, Friday Night Lights, Welcome to Wrexham, Cheer, Abbott Elementary,
    // Queer Eye, The Chosen, Touched by an Angel, Highway to Heaven, 7th Heaven, Little
    // House on the Prairie, When Calls the Heart.
  },
  {
    slug: "classic-hollywood",
    label: "Classic Hollywood",
    emoji: "🎩",
    blurb: "Hollywood's golden age: timeless classics from the 1930s to the 1960s.",
    kind: "mood",
    // classic-hollywood
    blurbTv: "Television's golden age: the shows that invented the medium, from the 1950s to the 1960s.",
    // Hybrid: a verified seed of the canon (a Discover era query alone surfaces
    // some acclaimed-but-obscure titles and misses the most iconic), pinned ahead
    // of an era-constrained fill. Seed (curated order):
    // North by Northwest, Casablanca, Citizen Kane, Gone with the Wind, The Wizard
    // of Oz, Vertigo, Rear Window, Psycho, Sunset Boulevard, Singin' in the Rain,
    // 12 Angry Men, Some Like It Hot, Roman Holiday, It's a Wonderful Life, The
    // Maltese Falcon, Double Indemnity, Notorious, Rebecca, All About Eve, The
    // Apartment, On the Waterfront, The Bridge on the River Kwai, Lawrence of
    // Arabia, Breakfast at Tiffany's, To Kill a Mockingbird, Ben-Hur, King Kong,
    // Modern Times, It Happened One Night, The Philadelphia Story.
    manual: [
      213, 289, 15, 770, 630, 426, 567, 539, 599, 872, 389, 239, 804, 1585, 963, 996, 303, 223,
      705, 284, 654, 826, 947, 164, 595, 665, 244, 3082, 3078, 981,
    ],
    // Backfill: acclaimed English-language films of the golden age, by recognition.
    query: {
      originalLanguage: "en",
      releaseDateGte: "1930-01-01",
      releaseDateLte: "1969-12-31",
      withoutGenres: "99",
      voteAverageGte: 7.3,
      voteCountGte: 600,
      sortBy: "vote_count.desc",
    },
    // classic-hollywood
    manualTv: [
      2730, 4439, 5273, 6357, 5133, 106, 2132, 4177, 3713, 1018, 10952, 10980, 2774, 10083, 4357, 253,
    ],
    // I Love Lucy, The Honeymooners, Alfred Hitchcock Presents, The Twilight Zone, Leave
    // It to Beaver, The Andy Griffith Show, The Dick Van Dyke Show, Perry Mason,
    // Gunsmoke, Bonanza, Rawhide, Have Gun Will Travel, The Untouchables, The Fugitive,
    // Mission: Impossible, Star Trek. Several are low-vote on TMDB but canonical for the
    // era, so the usual vote heuristic was relaxed here deliberately.
  },
  {
    slug: "teen-outsiders",
    label: "Teen outsiders",
    emoji: "🖤",
    blurb: "Misfits, cliques and gangs: kids finding where they belong (or don't).",
    kind: "mood",
    // Hand-picked: no genre/keyword query captures this, since it spans comedy, horror,
    // musical and drama, unified by teen cliques/gangs as the engine of the story
    // rather than any one genre. Curated order: literal street-gang rivalry first
    // (West Side Story's spiritual cousins), then John Hughes-era clique dramedies,
    // then outsider horror, then clique satire, then more recent misfit stories.
    // Breakfast Club, West Side Story, Lost Boys, The Outsiders, The Warriors,
    // Rebel Without a Cause, Rumble Fish, Grease, Pretty in Pink, Sixteen Candles,
    // Some Kind of Wonderful, Can't Buy Me Love, Heathers, Dazed and Confused, The
    // Craft, Fright Night, Ginger Snaps, Teen Wolf, Empire Records, Clueless,
    // Cruel Intentions, 10 Things I Hate About You, Donnie Darko, Thirteen, Easy
    // A, Perks of Being a Wallflower, Lady Bird, The Edge of Seventeen, Eighth
    // Grade, Foxfire.
    manual: [
      2108, 1725, 1547, 227, 11474, 221, 232, 621, 11522, 15144, 15143, 12919, 2640, 9571, 9100,
      11797, 9871, 11824, 13531, 9603, 796, 4951, 141, 11023, 37735, 84892, 391713, 376660, 489925,
      18555,
    ],
    // teen-outsiders
    manualTv: [
      1101, 2382, 2327, 2673, 95, 1432, 1948, 900, 85552, 81356, 124834, 100883, 76148, 76747, 85702,
      117488,
    ],
    // My So-Called Life, Freaks and Geeks, Dawson's Creek, The O.C., Buffy, Veronica
    // Mars, Degrassi, Skins, Euphoria, Sex Education, Heartstopper, Never Have I Ever,
    // Derry Girls, On My Block, PEN15, Yellowjackets.
  },
  {
    slug: "martial-arts-underdogs",
    label: "Martial arts underdogs",
    emoji: "🥋",
    blurb: "Scrappy fighters, brutal training montages, one last shot at the title.",
    kind: "mood",
    // Hand-picked: TMDB's martial-arts/kickboxing keywords are inconsistent and
    // would mix in wuxia epics and modern stunt spectacles that don't share this
    // tone: a nobody trains under a mentor and beats the champion in the ring or
    // tournament. Curated order: the dojo classic that defines the formula, the
    // 80s/90s tournament wave, then modern films working the same formula.
    // Enter the Dragon, The Karate Kid, American Ninja, The Last Dragon, No
    // Retreat No Surrender, Bloodsport, Kickboxer, Best of the Best, Lionheart,
    // Only the Strong, The Quest, Ong-Bak, Undisputed II, Never Back Down, Ip
    // Man, Redbelt, Warrior.
    manual: [
      9461, 1885, 12500, 13938, 12721, 11690, 10222, 238751, 9399, 15797, 9103, 9316, 15255, 8456,
      14756, 12400, 59440,
    ],
    // martial-arts-underdogs
    manualTv: [
      77169, 73544, 1472, 47450, 86752, 62127, 42705, 77939, 80623, 90660, 225180,
    ],
    // Cobra Kai, Warrior, Kung Fu (1972), Into the Badlands, Wu Assassins, Iron Fist,
    // Fighting Spirit, Megalobox, Baki, Kengan Ashura, Blue Eye Samurai. Leans more on
    // anime than the movie list does, which is the only way the underdog-fighter shape
    // exists in long-form TV.
  },
  {
    slug: "dystopian-futures",
    label: "Dystopian futures",
    emoji: "🏙️",
    blurb: "Totalitarian regimes and broken societies, imagined at their worst.",
    kind: "mood",
    // Hand-picked: spans an animated fable, a German TV movie and a Spanish
    // horror-thriller, so no genre/keyword query captures it without pulling in
    // unrelated sci-fi action. Chronological across the genre's eras: the
    // foundational classics, the 60s-70s New Hollywood wave, then modern
    // systems-of-control films.
    // Metropolis, Animal Farm, Fahrenheit 451, A Clockwork Orange, THX 1138,
    // Soylent Green, Logan's Run, Wir (We), Nineteen Eighty-Four, Brazil,
    // Gattaca, Brave New World, Equilibrium, V for Vendetta, Children of Men,
    // Snowpiercer, The Platform.
    manual: [
      19, 11848, 1714, 185, 636, 12101, 10803, 255656, 9314, 68, 782, 27260, 7299, 752, 9693,
      110415, 619264,
    ],
    // dystopian-futures
    manualTv: [
      69478, 42009, 48866, 79680, 125988, 106379, 62017, 63247, 93405, 87104, 46511, 100088, 108545,
      62858, 93289, 90972,
    ],
    // The Handmaid's Tale, Black Mirror, The 100, Snowpiercer, Silo, Fallout, The Man in
    // the High Castle, Westworld, Squid Game, Years and Years, Utopia, The Last of Us, 3
    // Body Problem, Colony, Brave New World, Station Eleven.
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
    // spooky-season
    manualTv: [
      72844, 109958, 1413, 66732, 1402, 97400, 79242, 54671, 75191, 71116, 124364, 128098, 40008,
      16118, 86850, 92916,
    ],
    // The Haunting of Hill House, Bly Manor, American Horror Story, Stranger Things, The
    // Walking Dead, Midnight Mass, Chilling Adventures of Sabrina, Penny Dreadful, The
    // Terror, Castle Rock, From, Interview with the Vampire, Hannibal, Salem's Lot,
    // Dracula, Marianne.
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
    // valentines-picks
    manualTv: [
      91239, 196454, 56570, 62084, 92875, 89905, 240667, 61418, 91602, 62668, 124834, 100883, 88324,
      82596, 194766,
    ],
    // Bridgerton, Queen Charlotte, Outlander, Poldark, Sanditon, Normal People, One Day,
    // Jane the Virgin, Modern Love, Lovesick, Heartstopper, Never Have I Ever, Virgin
    // River, Emily in Paris, The Summer I Turned Pretty.
  },
  {
    slug: "summer-blockbusters",
    label: "Summer blockbusters",
    emoji: "☀️",
    blurb: "Big, loud and fun.",
    kind: "occasion",
    season: [6, 7, 8],
    query: { withGenres: "28|12|878", voteCountGte: 1500 },
    // summer-blockbusters
    manualTv: [
      1399, 94997, 66732, 76479, 82856, 84958, 85271, 202555, 71912, 119051, 106379, 95557, 94605,
      111110, 110492, 108978,
    ],
    // Game of Thrones, House of the Dragon, Stranger Things, The Boys, The Mandalorian,
    // Loki, WandaVision, Daredevil: Born Again, The Witcher, Wednesday, Fallout,
    // Invincible, Arcane, One Piece, Peacemaker, Reacher.
  },
];

export function getMoodBySlug(slug: string): Mood | undefined {
  return MOODS.find((m) => m.slug === slug);
}

export type MoodMedia = "movie" | "tv";

/** A mood shows its TV tab only once it has a curated TV list. */
export function hasTvTab(mood: Mood): boolean {
  return (mood.manualTv?.length ?? 0) > 0;
}

/** Blurb for a tab: TV falls back to the shared blurb unless overridden. */
export function moodBlurb(mood: Mood, media: MoodMedia): string {
  return media === "tv" ? (mood.blurbTv ?? mood.blurb) : mood.blurb;
}

/** Mood rails always pinned to the front of the home page, in order. */
export const PINNED_MOOD_SLUGS = ["mind-benders", "so-bad-its-good"] as const;

/**
 * Home-page mood rails: the pinned moods first, then the remaining slots filled
 * "seasonally" — any in-season occasions take priority, and a daily-rotating
 * slice of the other evergreen moods backfills whenever fewer occasions are in
 * season than there are slots (so the section stays full year-round).
 * Deterministic given the date.
 */
export function featuredMoods(month: number, dayOfYear: number, count = 4): Mood[] {
  const pinned = PINNED_MOOD_SLUGS.map(getMoodBySlug).filter((m): m is Mood => m !== undefined);
  const seen = new Set(pinned.map((m) => m.slug));

  const occasions = MOODS.filter((m) => m.kind === "occasion" && m.season?.includes(month));
  const evergreen = MOODS.filter((m) => m.kind === "mood" && !seen.has(m.slug));
  const offset = ((dayOfYear % evergreen.length) + evergreen.length) % evergreen.length;
  const rotated = [...evergreen.slice(offset), ...evergreen.slice(0, offset)];

  const fillers: Mood[] = [];
  for (const m of [...occasions, ...rotated]) {
    if (seen.has(m.slug)) continue;
    seen.add(m.slug);
    fillers.push(m);
    if (pinned.length + fillers.length >= count) break;
  }
  return [...pinned, ...fillers].slice(0, count);
}
