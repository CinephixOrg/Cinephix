// One-time (but safely re-runnable) script that populates the official
// content pool (backend/models/OfficialContent.js) officialContentService.js
// rotates through. Idempotent — inserts only items not already present
// (matched by exact text/pollQuestion), so re-running it just tops up any
// items added to the arrays below in a future pass, never duplicates.
//
// Content rules (all directly requested): purely informative, never an
// open-ended/comment-inviting question (this app has no comment-writing
// feature); polls are always closed-option with a fixed set of choices.
// English is the source-of-truth language for this pool — the app's own
// default/fallback language (mobile/src/i18n/index.ts) is English, and an
// earlier version of this pool was written in Turkish by mistake (fixed
// after direct user feedback: "dili neden türkçe... default dili ingilizce
// olsun").
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import OfficialContent from "../models/OfficialContent.js";

await mongoose.connect(process.env.MONGO_URI, { dbName: "cleaned_db" });

// ── Trivia (rich, hand-curated, ~150 items) ──────────────────────────────
const TRIVIA = [
  // Oscar / award records
  "Titanic and Ben-Hur share the record for the most Oscars won by a single film: 11 each. 🏆",
  "The Lord of the Rings: The Return of the King won every single category it was nominated in — 11 for 11. 🏆",
  "Walt Disney holds the record for the most Oscars won by one person in a single year: 4, in 1954. 🏆",
  "Katharine Hepburn is the only actor to win the Best Actress Oscar four times. 🏆",
  "Meryl Streep holds the record for the most Oscar nominations of all time: 21. 🏆",
  "Bong Joon-ho's Parasite became the first non-English-language film to win Best Picture, in 2020. 🏆",
  "Marlon Brando famously refused his Best Actor Oscar for The Godfather. 🏆",
  "Tatum O'Neal won an Oscar for Paper Moon at age 10, one of the youngest winners ever. 🏆",
  "John Williams has over 50 Oscar nominations — one of the most nominated people alive. 🏆",
  "Edith Head won 8 Oscars for costume design, a record in that category. 🏆",
  "Everything Everywhere All at Once won 7 Oscars in 2023, the most of any film that year. 🏆",
  "Roger Deakins won his first Oscar for Blade Runner 2049 after 16 prior nominations. 🏆",
  "The Artist won Best Picture in 2012 as a silent film — a rare feat in modern cinema. 🏆",
  "Charlie Chaplin wasn't invited to an Oscars ceremony until 44 years after his career began, for an honorary award. 🏆",
  "Oppenheimer won 7 Oscars in 2024, giving Christopher Nolan his first Best Director win. 🏆",
  // Franchise & sequel facts
  "The James Bond franchise has been running for over 60 years, one of the longest-running film series ever. 🎬",
  "Star Wars: A New Hope had such a small budget that the studio barely expected it to succeed. 🎬",
  "The T-Rex roar in Jurassic Park was partly created from a baby elephant's sound. 🦖",
  "The Fast & Furious franchise started as a small street-racing film before becoming a global action series. 🚗",
  "Toy Story (1995) was the first ever fully computer-animated feature film. 🧸",
  "The Harry Potter film series kept its main cast for the entire 10-year production. ⚡",
  "The Dark Knight trilogy was among the first major superhero franchises shot partly on IMAX cameras. 🦇",
  "Tom Cruise is known for performing many of his own stunts in the Mission: Impossible series. 🎬",
  "Rocky's original budget was just $1 million, yet it earned well over a hundred million at the box office. 🥊",
  "The 'facehugger' design in the Alien franchise was inspired by artist H.R. Giger's biomechanical style. 👽",
  "The Matrix's 'bullet time' effect was a genuine revolution in film camera technique at the time. 🕶️",
  "Shrek flipped the classic fairy tale formula on its head, changing how animated films could be told. 🐸",
  "The Indiana Jones series was designed as a tribute to classic 1930s adventure serials. 🎩",
  "The Lord of the Rings trilogy was filmed back-to-back in New Zealand as one continuous production. 💍",
  "The Minions started as side characters in Despicable Me before getting their own franchise. 🍌",
  // Director quirks
  "Christopher Nolan's films almost always feature imagery of clocks or time. Ever notice it? ⏱️",
  "Wes Anderson's films are known for their perfectly symmetrical framing. 🎥",
  "Quentin Tarantino's films frequently include close-up shots of characters' feet. 👟",
  "Alfred Hitchcock made a brief cameo in nearly every film he directed. 🎬",
  "Martin Scorsese's films often feature Rolling Stones songs on the soundtrack. 🎸",
  "Stanley Kubrick was famous for demanding dozens of takes to perfect a single scene. 🎬",
  "Tim Burton's films frequently feature snowy, gothic atmospheres. ❄️",
  "M. Night Shyamalan is known for giving himself small cameo roles in his films. 🎬",
  "Denis Villeneuve favors vast, quiet landscapes in his science fiction films. 🌌",
  "In Guillermo del Toro's films, monsters are usually misunderstood rather than truly evil. 👹",
  "Edgar Wright is known for editing his scenes in perfect sync with the music. 🎵",
  "Greta Gerwig's films frequently explore themes of growing up and identity. 🎬",
  "Bong Joon-ho often uses class inequality as a central theme in his films. 🎬",
  "Hayao Miyazaki frequently uses the theme of flight throughout his Studio Ghibli films. 🌬️",
  "Ridley Scott is known for both epic science fiction and sweeping historical dramas. 🎬",
  // Actor / casting facts
  "The feather-floating scene in Forrest Gump used a real feather instead of a special effect. 🪶",
  "Sigourney Weaver's Ripley in Alien became one of sci-fi's most iconic female leads. 👩‍🚀",
  "Heath Ledger reportedly isolated himself in a hotel room and kept a journal to prepare for the Joker in The Dark Knight. 🃏",
  "Robert Downey Jr.'s casting as Iron Man was considered a big risk by the studio at the time. 🤖",
  "Viggo Mortensen actually broke a toe on set during The Lord of the Rings and kept it in the scene. 💍",
  "Anthony Hopkins won an Oscar for The Silence of the Lambs despite only about 16 minutes of screen time. 🦋",
  "Keanu Reeves trained in kung fu for months to perform The Matrix's fight scenes. 🥋",
  "Charlize Theron trained extensively to convincingly perform Mad Max: Fury Road's demanding stunt work. 🚗",
  "Daniel Day-Lewis is famous for his intense 'method acting' approach to every role. 🎭",
  "Hugh Jackman played Wolverine for 17 years across the X-Men franchise. 🐺",
  "Natalie Portman trained in ballet for years to prepare for Black Swan. 🩰",
  "Tom Hardy performed almost every scene behind a mask in Mad Max: Fury Road. 🎭",
  "Will Smith became one of Hollywood's biggest stars after starting his career on The Fresh Prince of Bel-Air. 🎬",
  "Meryl Streep is known for spending long periods mastering different accents for her roles. 🗣️",
  "Zendaya became one of the youngest Emmy winners ever for her performance in Euphoria. 🏆",
  // Animation / Pixar / Disney
  "Pixar's first feature film, Toy Story, was released in 1995. 🧸",
  "Animators took real diving lessons to study underwater movement for Finding Nemo. 🐠",
  "Up's opening sequence tells an entire lifetime in just a few wordless minutes. 🎈",
  "Inside Out's emotion characters were inspired by real neuroscience research. 🧠",
  "Coco was made with deep respect for Mexico's Día de los Muertos traditions. 💀",
  "Wall-E has almost no dialogue in its first 40 minutes. 🤖",
  "Zootopia used its animal cast to explore themes of prejudice and bias. 🦊",
  "Frozen's song 'Let It Go' reportedly reshaped the entire film's story during production. ❄️",
  "The Lion King (1994) drew inspiration from Shakespeare's Hamlet. 🦁",
  "Spirited Away was one of the first animated films to win an Oscar, in 2003. 🐉",
  "The dragon designs in How to Train Your Dragon were inspired by cat movements. 🐉",
  "The Incredibles was one of the first major animated films centered on a superhero family. 🦸",
  "Animators researched with real chefs to get the cooking scenes right in Ratatouille. 🍽️",
  "Moana's ocean animation required an entirely custom water-simulation tool. 🌊",
  "Puss in Boots: The Last Wish stood out for trying a distinct new animation style. 🐱",
  // Practical effects / behind-the-scenes tech
  "The mechanical shark used in Jaws was nicknamed 'Bruce' by the crew. 🦈",
  "The T-800 skeleton scenes in The Terminator were achieved using stop-motion. 🤖",
  "Some of the dinosaurs in Jurassic Park were brought to life with full-size animatronics. 🦖",
  "King Kong (1933) used groundbreaking stop-motion effects for its era. 🦍",
  "The rotating hallway scene in 2001: A Space Odyssey was filmed inside a real spinning set. 🚀",
  "The truck-flip stunt in The Dark Knight was done for real, with no CGI. 🚚",
  "Most of the vehicle stunts in Mad Max: Fury Road were performed practically with minimal CGI. 🚗",
  "Avatar (2009) pushed motion-capture technology to a new level in filmmaking. 🌿",
  "The Matrix's 'bullet time' shot used over 120 cameras arranged around the set. 📸",
  "The zero-gravity scenes in Gravity were filmed using actors inside a specially rigged lightbox. 🌌",
  "E.T. was brought to life on screen using a real animatronic puppet. 👽",
  "A massive portion of a full-scale ship was built for Titanic's deck scenes. 🚢",
  "The DeLorean from Back to the Future became one of cinema's most iconic vehicles. 🚗",
  "The bear attack scene in The Revenant blended CGI with motion capture. 🐻",
  "Dune (2021) was shot across real, expansive desert locations. 🏜️",
  // Box office / records
  "Avatar (2009) held the title of highest-grossing film of all time for years. 🎬",
  "Avengers: Endgame set an opening-weekend box office record on release. 🦸",
  "Titanic stayed at the top of the box office for months after its 1997 release. 🚢",
  "The Lion King (2019) became one of the highest-grossing animated/live-action hybrids ever. 🦁",
  "Star Wars: The Force Awakens was one of the fastest films to reach $1 billion in the US. ⭐",
  "Barbie (2023) became the highest-grossing film ever directed by a woman. 💗",
  "Spider-Man: No Way Home helped revive theaters after the pandemic. 🕷️",
  "Frozen (2013) went down as one of the highest-grossing animated films ever made. ❄️",
  "Black Panther (2018) was the first superhero film ever nominated for Best Picture. 🐆",
  "Jurassic Park (1993) became the highest-grossing film of its time upon release. 🦖",
  // TV show facts
  "Friends kept its same six main cast members for all 10 seasons. ☕",
  "Breaking Bad's final season contains some of the show's most-watched episodes. 🧪",
  "Game of Thrones had one of the most talked-about final seasons in TV history. 🐉",
  "The Office (US) had low ratings in its first season before becoming a cult classic. 📎",
  "Stranger Things was written as a loving tribute to 1980s sci-fi and horror films. 🚲",
  "The Simpsons holds the record for the longest-running animated series in TV history. 🍩",
  "Chernobyl underwent extensive research to stay faithful to the real events. ☢️",
  "The Last of Us became one of the most acclaimed video game adaptations ever made. 🍄",
  "House of the Dragon is set 200 years before the events of Game of Thrones. 🐲",
  "Better Call Saul was designed as a prequel to the Breaking Bad universe. ⚖️",
  "Sherlock (BBC) brought the classic Sherlock Holmes stories into modern-day London. 🕵️",
  "The Crown told the story of the British royal family, recasting its leads every few seasons. 👑",
  "Avatar: The Last Airbender built its entire animated world around the four elements. 🌊",
  "X-Men '97 was designed as a direct continuation of the beloved '90s animated series. 🦸",
  "JUJUTSU KAISEN has become one of the most talked-about modern anime series. 👹",
  // Music / score facts
  "John Williams composed the iconic scores for Star Wars, Jaws, and Indiana Jones. 🎼",
  "Hans Zimmer's 'BRAAAM' sound in Inception changed how modern action films use music. 🎺",
  "Jaws' iconic two-note theme is one of the most tension-building scores in film history. 🎵",
  "Interstellar's score uses organ music to enhance its cosmic, otherworldly atmosphere. 🎹",
  "The Dark Knight's score uses a scraping string sound to reflect the Joker's chaos. 🎻",
  "Titanic's 'My Heart Will Go On' became one of the film's most memorable elements. 🎶",
  "Star Wars' opening theme is considered one of the most recognizable pieces of film music ever written. 🎬",
  "Rocky's 'Gonna Fly Now' became a lasting symbol of movie motivation music. 🥊",
  "The Lion King's 'Circle of Life' gives the film's opening scene an epic feel. 🦁",
  "Encanto's 'We Don't Talk About Bruno' became a massive music phenomenon after release. 🕯️",
  // Cinema history
  "The world's first feature-length film was shot in Australia back in 1906. 🎞️",
  "Cinema was exclusively black and white for years before color became widespread. ⚫⚪",
  "'The Jazz Singer,' released in 1927, was the first film with synchronized sound. 🎙️",
  "The Cannes Film Festival has been held since 1946, making it one of the most prestigious in the world. 🎞️",
  "IMAX technology was developed to give audiences a bigger, sharper theatrical experience. 🎥",
  "Dolby sound systems brought a major leap forward in film audio quality. 🔊",
  "A film's box office gross accounts for far more than just ticket sales in its home country — international markets matter just as much. 💰",
  // General industry facts
  "The final stage of filmmaking, after shooting wraps, is called 'post-production.' 🎬",
  "The finalized script used during filming is often called the 'shooting script.' 📜",
  "The first widespread 3D film screenings became popular in the 1950s. 🕶️",
  "A producer is involved in nearly every stage of a film, from budget to creative decisions. 🎬",
  "A storyboard maps out a film's scenes visually before filming even begins. 🖊️",
  "'Final cut' rights are often a major point of negotiation between a director and the studio. 🎬",
  "Green screen technology allows backgrounds to be digitally replaced after filming. 🟩",
  "A film's premiere is usually a special early screening held before the official release date. 🎟️",
  "Dolby Atmos delivers sound to audiences in a fully three-dimensional way. 🔊",
  "A TV show's 'pilot' episode is often made specifically to decide if the series will continue. 📺",
  "The rise of streaming platforms has completely reshaped how people watch movies and shows. 📱",
  "A 'director's cut' reflects the filmmaker's original, unaltered vision for the film. 🎬",
  "Film scores are usually composed after filming wraps, during the editing phase. 🎼",
  "Filming the same scene from multiple angles is known as shooting 'coverage.' 🎥",
  "A 'teaser' trailer is often released long before a film's actual release date. 🎞️",
  "Snow White and the Seven Dwarfs (1937) was the first-ever full-length animated feature film. ❄️",
  "A 'spin-off' is a new show or film built around characters from an existing story, told independently. 🎬",
  "IMAX screens offer a significantly larger viewing area than standard theater formats. 🎥",
  // Awards beyond the Oscars (Grammys, Globes, BAFTA, festivals)
  "The Lord of the Rings: The Fellowship of the Ring won a Grammy for its film score. 🎼",
  "Cate Blanchett has won major awards for playing real historical figures more than once in her career. 🏆",
  "The Golden Globes split their Best Picture award into Drama and Musical/Comedy categories. 🏆",
  "BAFTA, the British equivalent of the Oscars, has been awarded since 1949. 🏆",
  "The Screen Actors Guild Awards are voted on entirely by fellow actors. 🏆",
  "La La Land tied the record for the most Golden Globe wins by a single film: 7. 🏆",
  "The Cecil B. DeMille Award at the Golden Globes honors a lifetime of achievement in film. 🏆",
  "The Critics' Choice Awards are voted on by film critics rather than industry members. 🏆",
  "Some films have won 'Best Ensemble' at the SAG Awards without a single individual acting nomination elsewhere. 🏆",
  "The Palme d'Or is the highest prize awarded at the Cannes Film Festival. 🏆",
  "The Golden Lion is the top prize at the Venice Film Festival, one of the oldest film festivals in the world. 🏆",
  "The Sundance Film Festival has launched the careers of many now-famous independent filmmakers. 🏆",
  "A handful of directors have won the Palme d'Or more than once in their career. 🏆",
  "The American Film Institute releases an annual list honoring the year's best films and TV shows. 🏆",
  "Peabody Awards recognize storytelling excellence across both film and television. 🏆",
  // Sequels, prequels, remakes & reboots
  "Blade Runner 2049 arrived 35 years after the original Blade Runner. 🎬",
  "The Mad Max franchise had a 30-year gap between Beyond Thunderdome and Fury Road. 🎬",
  "Top Gun: Maverick arrived decades after the original, with Tom Cruise reprising his role. ✈️",
  "The Karate Kid franchise spawned Cobra Kai, a direct sequel series decades later. 🥋",
  "Creed continues the Rocky story by centering a new generation of boxer. 🥊",
  "Scream reinvented itself for a new generation while keeping its original meta-horror tone. 🔪",
  "The Grinch has been adapted for film multiple times across different decades. 🎄",
  "A Star Is Born has been remade several times across nearly a century of Hollywood. ⭐",
  "The Lion King (2019) was a photorealistic remake of the original 1994 animated classic. 🦁",
  "Dune had a big-screen adaptation in the 1980s before its acclaimed 2021 version. 🏜️",
  "Ocean's Eleven was itself a remake of a 1960s heist film. 🎩",
  "Disney has adapted The Jungle Book more than once, decades apart. 🐯",
  "The Halloween franchise has been rebooted multiple times with different continuities. 🎃",
  "Godzilla has appeared in both Japanese and American film franchises spanning decades. 🦖",
  "Stephen King's It was adapted both as a 1990 miniseries and a 2017 feature film. 🎈",
  // Streaming era & original content
  "Squid Game became one of the most-watched non-English-language shows on a major streaming platform. 🦑",
  "Stranger Things helped establish its streaming platform as a major original-content producer. 🚲",
  "The Mandalorian was one of the flagship original shows for its platform's 2019 launch. 🪐",
  "Ted Lasso became a major awards contender for a streaming platform's comedy slate. ⚽",
  "Many older films and shows found entirely new audiences after being added to streaming libraries. 📱",
  "Some films now debut simultaneously in theaters and on streaming platforms. 🎬",
  "Streaming platforms often release entire seasons of a show at once, encouraging binge-watching. 📺",
  "Documentary films have found a particularly large audience boost through streaming platforms. 🎥",
  "Some streaming-exclusive films have still received major awards consideration. 🏆",
  "International shows have crossed over to global audiences largely thanks to streaming. 🌍",
  "A single streaming platform can host thousands of movies and shows spanning decades of film history. 📚",
  "Streaming has changed how quickly word-of-mouth can turn a niche show into a global phenomenon. 🔥",
  "Some animated shows made specifically for streaming have become award-winning hits. 🎨",
  "The rise of streaming led several traditional studios to launch their own competing platforms. 🏢",
  "Many classic sitcoms found a massive resurgence in popularity after landing on streaming services. 📼",
  // Voice acting & animation dubbing
  "Robin Williams' performance as the Genie in Aladdin is considered one of animation's most iconic voice roles. 🧞",
  "Many animated films record voice performances before the animation itself is even finished. 🎙️",
  "Voice actors often perform their lines multiple times to give animators different expressive options. 🎭",
  "Some actors have built entire careers primarily around voice acting for animation. 🎬",
  "Anime series are often dubbed into many different languages for international audiences. 🌏",
  "Pixar films sometimes cast comedians specifically for their vocal timing and delivery. 😄",
  "Voice actors for long-running animated shows can stay in the same role for decades. 📺",
  "Some beloved voice performances are recast carefully after an original actor's passing. 🎤",
  "Video game voice acting has grown into a major industry alongside film and TV. 🎮",
  "Motion capture performances often combine physical acting and voice work in a single take. 🎬",
  "Dubbing a film into another language requires carefully matching dialogue timing to lip movements. 🗣️",
  "Some countries strongly prefer subtitles over dubbing for foreign films and shows. 📖",
  "Anime conventions often feature panels where voice actors meet their fans in person. 🎉",
  "A single voice actor can play multiple background characters within the same animated film. 🎭",
  "Localizing jokes and cultural references is one of the trickiest parts of dubbing animation. 🌐",
  // Stunt work & long single-take shots
  "1917 was edited to appear as if filmed in two continuous takes. 🎥",
  "Birdman was famously stitched together to look like one unbroken shot throughout the film. 🎬",
  "Children of Men features a widely praised long single-take action sequence. 🚗",
  "Atomic Blonde includes an extended hallway fight filmed to look like one continuous take. 🥋",
  "Stunt coordinators plan every fall, crash, and fight sequence for safety long before filming. 🎬",
  "Many action stars train for months specifically to convincingly perform their own stunts. 🥋",
  "Stunt doubles are carefully matched to an actor's build and movement style. 🎬",
  "Some of the most memorable car chases in film history were filmed with real vehicles, not CGI. 🚗",
  "Wire work allows performers to appear to fly or leap great distances safely on set. 🎬",
  "The 'Kuleshov effect' shows how editing can change the perceived emotion of the very same shot. 🎞️",
  "A single well-choreographed fight scene can take days to film from multiple angles. 🥋",
  "Practical stunt work often blends seamlessly with digital effects in modern action films. 🎬",
  "Some directors are known for insisting on real, in-camera stunts over CGI whenever possible. 🎬",
  "Extras in a large battle scene are sometimes multiplied digitally to look like thousands more. ⚔️",
  "High-speed chase scenes are often filmed at lower actual speeds and sped up in editing. 🚗",
  // Soundtracks & chart-topping songs
  "Purple Rain by Prince became a hit both as an album and as a film. 🎸",
  "The Bodyguard's soundtrack, featuring Whitney Houston, became one of the best-selling soundtracks ever. 🎤",
  "Guardians of the Galaxy's 'Awesome Mix' soundtrack became a hit in its own right, separate from the film. 🚀",
  "Saturday Night Fever and Dirty Dancing are both known for soundtracks as famous as the films themselves. 🎶",
  "'Eye of the Tiger' was written specifically for Rocky III and became a massive hit single. 🥊",
  "Original songs written for animated films regularly compete for major music awards. 🎵",
  "Some film scores have gone on to become concert staples performed by orchestras worldwide. 🎻",
  "A movie's soundtrack often gets released separately, sometimes generating buzz of its own. 💿",
  "Crossover hit singles show how closely film, TV, and music can intersect. 🎶",
  "Some composers reuse musical motifs across multiple films in the same franchise. 🎼",
  "Movie trailers often use dramatic music entirely different from the film's actual score. 🎬",
  "A well-placed needle-drop song can define a movie scene as much as the dialogue does. 🎧",
  "Original musicals written directly for film, rather than adapted from the stage, are a genre of their own. 🎭",
  "Some artists have written entire albums inspired by or tied to a single film. 🎤",
  "End-credits songs are sometimes commissioned separately just to accompany the credits roll. 🎬",
  // Anime & international cinema
  "Spirited Away remains one of the highest-grossing films in Japanese box office history. 🐉",
  "Studio Ghibli films are known for their hand-drawn animation even in the digital era. 🎨",
  "Your Name became one of the highest-grossing anime films of all time worldwide. 🌠",
  "Bollywood produces more films annually than almost any other film industry in the world. 🎬",
  "Parasite's success helped bring much wider global attention to Korean cinema. 🇰🇷",
  "Akira Kurosawa's samurai films influenced countless Western directors, including in the Western genre. 🎬",
  "Amélie became one of the most internationally beloved French films of its era. 🇫🇷",
  "City of God brought major international attention to Brazilian cinema. 🇧🇷",
  "Crouching Tiger, Hidden Dragon became a major crossover hit for wuxia films internationally. 🐉",
  "Nollywood, Nigeria's film industry, is one of the largest producers of films by volume in the world. 🎬",
  "Anime films are increasingly getting simultaneous theatrical releases across multiple countries. 🌏",
  "Cinema Paradiso is considered one of Italy's most beloved tributes to the love of film itself. 🇮🇹",
  "Roma was shot in black and white to evoke the director's own childhood memories. 🎥",
  "Train to Busan helped popularize Korean zombie films on the international stage. 🚄",
  "Anime openings and endings often feature original songs by popular musical artists. 🎵",
  // Famous long or delayed productions
  "Avatar's first sequel took over a decade of development before its release. 🌌",
  "The making of Apocalypse Now was so famously difficult it inspired its own behind-the-scenes documentary. 🎬",
  "Boyhood was filmed over 12 real years to show its cast actually aging on screen. 🎬",
  "Kill Bill was originally shot as one long film before being split into two volumes. ⚔️",
  "Some long-gestating passion projects take directors decades to finally bring to the screen. 🎬",
  "The Shining's production was known for its unusually long and demanding shoot. 🏨",
  "Titanic's production famously went over budget and schedule before becoming a massive hit. 🚢",
  "Fitzcarraldo's production involved literally hauling a real ship over a mountain. ⛵",
  "Development on some franchise films can stretch across a full decade before release. 🎬",
  "Waiting for a script to feel 'right' has delayed several major franchise films for years. 🎬",
  "Some visual effects-heavy blockbusters spend years in post-production alone. 🎬",
  "A film can spend more time in development limbo than it ultimately spends in production. 🎬",
  "Some troubled productions become almost as well known for their reshoots as for the finished film. 🎬",
  "Certain directors are known for taking years between projects to fully develop their next film. 🎬",
  "Animated films often take several years from initial pitch to final release. 🎬",
  // Child actors & long-running roles
  "Elijah Wood was a teenager when cast as Frodo in The Lord of the Rings trilogy. 💍",
  "Daniel Radcliffe played Harry Potter across 8 films spanning a full decade of his life. ⚡",
  "Macaulay Culkin became a household name as a child star through Home Alone. 🎄",
  "Millie Bobby Brown rose to fame as a young actor through Stranger Things. 🚲",
  "Drew Barrymore has been acting professionally since she was a small child. 🎬",
  "Some child actors go on to direct or produce films later in their own careers. 🎬",
  "Shirley Temple was one of the biggest box office draws in Hollywood as a child star. 🎬",
  "Jodie Foster transitioned from child actor to acclaimed adult performer and director. 🎬",
  "Some franchises recast their lead actor as the original ages out of the role over many films. 🎬",
  "Anna Paquin won an Oscar for a film role while still a child herself. 🏆",
  "Growing up on a long-running set can mean an actor spends more childhood time filming than at school. 🎬",
  "Some child stars deliberately step back from acting for years before returning as adults. 🎬",
  "Younger versions of a character are sometimes played by a different actor than the adult version. 🎬",
  "Several long-running franchises have followed the same actor from childhood into adulthood on screen. 🎬",
  "Casting directors often audition hundreds of children for a single major child role. 🎬",
  // Film preservation, restoration & technology
  "Many silent films from the early 1900s have been lost forever due to poor preservation. 🎞️",
  "Film restoration teams can spend years painstakingly cleaning up a single classic movie. 🎥",
  "Nitrate film stock, used in early cinema, was highly flammable and degraded easily over time. 🔥",
  "Some studios maintain massive archives dedicated purely to preserving film history. 🏛️",
  "4K restorations have brought many classic films back to theaters decades after their original release. 🎬",
  "Colorization technology can add color to originally black-and-white footage, though it remains controversial among purists. 🎨",
  "The Library of Congress maintains a National Film Registry to preserve culturally significant films. 🏛️",
  "Digital scanning has replaced physical film reels as the primary way movies are preserved today. 💾",
  "Some early color film processes required complex, multi-strip camera setups. 🎥",
  "Film preservationists often have to track down surviving prints scattered across the world. 🌍",
  "High frame rate filming, once rare, has been used to create an unusually smooth viewing experience. 🎥",
  "Motion capture technology has advanced enormously since its early use in modern blockbusters. 🎬",
  "Some directors deliberately shoot on physical film today for its distinct visual texture. 🎞️",
  "Digital projection has almost entirely replaced traditional film reel projection in modern theaters. 🎬",
  "Restoring a film's original sound mix can be just as challenging as restoring its picture. 🔊",
];

// ── App tips (describes real, already-built features) ───────────────────
// Plain text, no in-app links — a link mechanism was built and shipped for
// this category, then explicitly walked back (the user reconsidered:
// clickable links stay trivia-only, where they point at content detail
// pages via a real contentId/contentType — see officialContentService.js's
// two DB-native templates). officialContentService.js's tip-posting branch
// still passes through OfficialContent.linkWord/linkHref if a doc happens
// to have them, but none do anymore now that this array is back to plain
// strings — kept rather than ripped out, since a future ask could revive
// per-tip links without re-deriving the plumbing.
const TIPS = [
  "Tip: Rate the movies and shows you've watched to make your CineGraph even more accurate. 💡",
  "Tip: Add titles you love to your favorites to feature them on your profile. ⭐",
  "Tip: Add anything you want to watch to your Watchlist so you never forget it. 📋",
  "Tip: Check your profile's analysis section for a detailed breakdown of your taste. 📊",
  "Tip: Create your own public lists to share ideas and recommendations with others. 📚",
  "Tip: Try Sync to discover users whose taste is closest to yours. 🤝",
  "Tip: Sharing a review automatically posts it to your Media feed. ✍️",
  "Tip: Use the Friends tab in Media to filter the feed to just the people you follow. 👥",
  "Tip: Check Discover to catch this week's most popular movies and shows. 🔥",
  "Tip: Make your profile private so only approved followers can see your activity. 🔒",
  "Tip: Join a Group to connect with people who share your taste in film and TV. 💬",
  "Tip: Rate and review regularly if you want a shot at making the podiums. 🏆",
  "Tip: Liking a list is a great way to show appreciation to whoever made it. ❤️",
  "Tip: You can update your favorite movies and shows on your profile anytime. 🔄",
  "Tip: Check your notifications to see who followed you or liked your posts. 🔔",
  "Tip: Import your history from Letterboxd or TV Time to bring your past data into Cinephix. 📥",
  "Tip: On a title's detail page, you can see which of your friends have already watched it. 👀",
  "Tip: Look back through your analysis history to see how your taste has changed over time. 📈",
  "Tip: Check your badges and level on your profile to track your Cinephix journey. 🎖️",
  "Tip: Visit someone's profile to explore their favorites and recent activity. 🔍",
  "Tip: Use the search bar to find any movie or show in seconds. 🔎",
  "Tip: Adding a rating to your review makes it more useful for other users. 📝",
  "Tip: Use chat to send movie and show recommendations straight to your friends. 💬",
  "Tip: Leveling up your account unlocks new features along the way. 🔓",
  "Tip: Customize the app's theme to dark or light mode, whatever suits you. 🌗",
];

// ── Polls (closed-option only — never open-ended) ────────────────────────
const POLLS = [
  { pollQuestion: "Let's settle this once and for all: which is the goated sitcom?", pollOptions: ["Friends", "The Office", "Brooklyn Nine-Nine", "Parks and Recreation", "How I Met Your Mother"] },
  { pollQuestion: "Which is the best superhero franchise?", pollOptions: ["Marvel Cinematic Universe", "The Dark Knight Trilogy", "Spider-Man (Sam Raimi)", "X-Men", "The Avengers"] },
  { pollQuestion: "Which is the best sci-fi movie?", pollOptions: ["Interstellar", "Inception", "The Matrix", "Blade Runner 2049", "Dune"] },
  { pollQuestion: "Which is the best animation studio?", pollOptions: ["Pixar", "Studio Ghibli", "DreamWorks", "Disney Animation", "Illumination"] },
  { pollQuestion: "Which is the best horror franchise?", pollOptions: ["The Conjuring", "Halloween", "A Nightmare on Elm Street", "Scream", "Saw"] },
  { pollQuestion: "Which fantasy universe is your favorite?", pollOptions: ["Middle-earth (LOTR)", "Harry Potter", "Game of Thrones", "Narnia", "The Witcher"] },
  { pollQuestion: "Which is the best crime drama series?", pollOptions: ["Breaking Bad", "The Wire", "Money Heist", "Peaky Blinders", "Narcos"] },
  { pollQuestion: "Which is the best Christopher Nolan film?", pollOptions: ["Inception", "Interstellar", "The Dark Knight", "Oppenheimer", "Dunkirk"] },
  { pollQuestion: "Which is the best 2010s film?", pollOptions: ["Parasite", "Whiplash", "Mad Max: Fury Road", "La La Land", "Get Out"] },
  { pollQuestion: "Which is the best space movie?", pollOptions: ["Interstellar", "Gravity", "The Martian", "2001: A Space Odyssey", "Apollo 13"] },
  { pollQuestion: "What's your favorite anime?", pollOptions: ["Attack on Titan", "JUJUTSU KAISEN", "Death Note", "Demon Slayer", "One Piece"] },
  { pollQuestion: "Which is the best movie musical?", pollOptions: ["La La Land", "The Greatest Showman", "Wicked", "Encanto", "Grease"] },
  { pollQuestion: "Who's the best action hero?", pollOptions: ["John Wick", "James Bond", "Ethan Hunt (M:I)", "Jason Bourne", "Indiana Jones"] },
  { pollQuestion: "What's your favorite dystopian movie or show?", pollOptions: ["The Hunger Games", "Black Mirror", "1984", "Squid Game", "The Handmaid's Tale"] },
  { pollQuestion: "Which is the best psychological thriller?", pollOptions: ["Se7en", "Shutter Island", "Gone Girl", "Black Swan", "Parasite"] },
  { pollQuestion: "Which is the best acclaimed drama series?", pollOptions: ["Succession", "The Crown", "Chernobyl", "Better Call Saul", "The White Lotus"] },
  { pollQuestion: "What's your favorite comedy movie?", pollOptions: ["Superbad", "Bridesmaids", "The Hangover", "Deadpool", "Barbie"] },
  { pollQuestion: "Which is the best war movie?", pollOptions: ["Saving Private Ryan", "Dunkirk", "1917", "Full Metal Jacket", "Hacksaw Ridge"] },
  { pollQuestion: "What's your favorite single superhero movie?", pollOptions: ["The Dark Knight", "Spider-Man: Into the Spider-Verse", "Avengers: Endgame", "Black Panther", "Logan"] },
  { pollQuestion: "Which is the best classic (pre-2000) film?", pollOptions: ["The Godfather", "Star Wars", "Casablanca", "Jaws", "Pulp Fiction"] },
  // "This or That" — quick binary polls, a deliberately different pace/
  // format from the 5-option "which is the best X" polls above (approved
  // idea #1 from the brainstorm; idea #2 — an app-usage-flavored poll —
  // and the rest were explicitly NOT wanted, only #1 and #3 were).
  { pollQuestion: "This or that: books or movies?", pollOptions: ["Books", "Movies"] },
  { pollQuestion: "This or that: subtitles or dubbing?", pollOptions: ["Subtitles", "Dubbing"] },
  { pollQuestion: "This or that: Marvel or DC?", pollOptions: ["Marvel", "DC"] },
  { pollQuestion: "This or that: movie theater or home streaming?", pollOptions: ["Movie theater", "Home streaming"] },
  { pollQuestion: "This or that: sequels or reboots?", pollOptions: ["Sequels", "Reboots"] },
  { pollQuestion: "This or that: horror or comedy?", pollOptions: ["Horror", "Comedy"] },
  { pollQuestion: "This or that: a long 10+ season series or a tight limited series?", pollOptions: ["Long series", "Limited series"] },
  { pollQuestion: "This or that: watch alone or watch with friends?", pollOptions: ["Watch alone", "Watch with friends"] },
  { pollQuestion: "This or that: spoilers are fine or always spoiler-free?", pollOptions: ["Spoilers are fine", "Always spoiler-free"] },
  { pollQuestion: "This or that: book-to-movie adaptations or original screenplays?", pollOptions: ["Adaptations", "Original screenplays"] },
  { pollQuestion: "This or that: animated or live-action?", pollOptions: ["Animated", "Live-action"] },
  { pollQuestion: "This or that: classic black-and-white films or modern blockbusters?", pollOptions: ["Classic black-and-white", "Modern blockbusters"] },
  { pollQuestion: "This or that: slow-burn drama or fast-paced action?", pollOptions: ["Slow-burn drama", "Fast-paced action"] },
  { pollQuestion: "This or that: practical effects or CGI?", pollOptions: ["Practical effects", "CGI"] },
  { pollQuestion: "This or that: binge it all in one night or one episode a week?", pollOptions: ["Binge it all", "One episode a week"] },
  // Character/debate superlatives — approved idea #3, generalized beyond
  // just "best villain" into a family of similar character-based debate
  // polls (still 5 options each, same format as the "best X" polls above,
  // just about fictional characters/moments rather than whole titles).
  { pollQuestion: "Which movie villain is the greatest of all time?", pollOptions: ["Joker (The Dark Knight)", "Darth Vader", "Hannibal Lecter", "Thanos", "Anton Chigurh"] },
  { pollQuestion: "Which fictional mentor is the best?", pollOptions: ["Yoda", "Gandalf", "Dumbledore", "Mr. Miyagi", "Uncle Iroh"] },
  { pollQuestion: "Which anti-hero is the most iconic?", pollOptions: ["Deadpool", "Walter White", "Tony Soprano", "Jack Sparrow", "Rick Sanchez"] },
  { pollQuestion: "Which on-screen duo is the best?", pollOptions: ["Batman & Robin", "Sherlock & Watson", "Woody & Buzz", "Thelma & Louise", "Han & Chewbacca"] },
  { pollQuestion: "Which movie plot twist is the most iconic?", pollOptions: ["Fight Club", "The Sixth Sense", "The Usual Suspects", "Se7en", "Shutter Island"] },
  { pollQuestion: "Which fictional AI or robot is the best?", pollOptions: ["HAL 9000", "WALL-E", "T-800 (Terminator)", "Data (Star Trek)", "Ultron"] },
  { pollQuestion: "Which fictional couple is the most iconic?", pollOptions: ["Jack & Rose (Titanic)", "Noah & Allie (The Notebook)", "Ross & Rachel", "Mr. & Mrs. Smith", "Elizabeth & Darcy"] },
  { pollQuestion: "Which fictional leader is the greatest?", pollOptions: ["Aragorn", "Jon Snow", "Simba", "T'Challa", "Daenerys"] },
  { pollQuestion: "Which movie monster is the scariest?", pollOptions: ["Xenomorph (Alien)", "Pennywise", "The Thing", "Godzilla", "Freddy Krueger"] },
  { pollQuestion: "Which sidekick is the best?", pollOptions: ["Samwise Gamgee", "Donkey (Shrek)", "Chewbacca", "Robin", "Dr. Watson"] },
  { pollQuestion: "Which comic relief character is the funniest?", pollOptions: ["Olaf (Frozen)", "Donkey (Shrek)", "Deadpool", "The Genie (Aladdin)", "Baby Groot"] },
  { pollQuestion: "Which fictional detective is the sharpest?", pollOptions: ["Sherlock Holmes", "Hercule Poirot", "Columbo", "Benoit Blanc", "Kate Beckett"] },
];

// ── Announcements (starter set — grows over time as real news exists) ───
const ANNOUNCEMENTS = [
  "Welcome to the Cinephix family! This is the best place to share your love of movies and shows. 🎬",
  "Have you tried Sync yet to discover users whose taste matches yours? 🤝",
  "Want to land on the podiums? Keep rating and reviewing! 🏆",
  "We're always improving the app, with new features coming soon! 🚀",
  "Did you know you can import your history from Letterboxd or TV Time? 📥",
  "Our community keeps growing every day, so don't forget to share Cinephix with friends! 🎉",
  "Don't miss this week's trending titles in the Discover tab! 🔥",
  "Check out Groups to meet people who share your taste. 💬",
  "Your analysis report keeps getting more accurate every day. 📊",
  "Thanks for being part of Cinephix, happy watching! 🍿",
];

async function insertIfMissing(category, filter, doc) {
  const existing = await OfficialContent.findOne({ category, ...filter });
  if (existing) return false;
  await OfficialContent.create({ category, ...doc });
  return true;
}

let added = 0;
for (const text of TRIVIA) {
  if (await insertIfMissing("trivia_rich", { text }, { text })) added++;
}
for (const text of TIPS) {
  if (await insertIfMissing("tip", { text }, { text })) added++;
}
// Tip links were shipped, then explicitly reverted — strip any
// linkWord/linkHref left over on existing tip docs from that round rather
// than leaving stale, now-unused fields sitting in the DB.
const unsetRes = await OfficialContent.updateMany({ category: "tip" }, { $unset: { linkWord: "", linkHref: "" } });
for (const { pollQuestion, pollOptions } of POLLS) {
  if (await insertIfMissing("poll", { pollQuestion }, { pollQuestion, pollOptions })) added++;
}
for (const text of ANNOUNCEMENTS) {
  if (await insertIfMissing("announcement", { text }, { text })) added++;
}

console.log(
  `Inserted ${added} new official content items (trivia_rich: ${TRIVIA.length}, tip: ${TIPS.length}, poll: ${POLLS.length}, announcement: ${ANNOUNCEMENTS.length} total in pool). Cleared linkWord/linkHref on ${unsetRes.modifiedCount} tip(s).`
);

await mongoose.disconnect();
console.log("Done.");
