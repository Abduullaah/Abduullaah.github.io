/* =====================================================================
   questions.js — the bank.
   Every question has a `fact`: the kicker the screen shows on reveal.
   That line is the whole point. A question you get wrong should still
   be worth hearing.
   ===================================================================== */

const BANK = {

/* ---------------------------------------------------------------
   SNAP JUDGEMENT — four options, one right, 20 seconds.
   Rule for picking these: the answer has to be surprising even to
   the team that gets it right.
   --------------------------------------------------------------- */
snap: [
  { q:"What was the very first item ever sold on eBay?",
    options:["A broken laser pointer","A signed baseball","A 1987 Toyota","A bag of Beanie Babies"], answer:0,
    fact:"It went for $14.83. The founder emailed the buyer to check he understood it was broken. He replied that he collected broken laser pointers." },

  { q:"Where is a shrimp's heart?",
    options:["In its tail","In its head","It has three, spread out","It doesn't have one"], answer:1,
    fact:"Right behind the eyes. Which means every shrimp you've ever eaten led with its heart." },

  { q:"Which animal has fingerprints so close to ours they've been confused at crime scenes?",
    options:["Chimpanzee","Koala","Gorilla","Raccoon"], answer:1,
    fact:"Koala prints are nearly indistinguishable from human ones under a microscope — and koalas aren't even closely related to us." },

  { q:"What colour is a polar bear's skin?",
    options:["Pink","White","Black","Grey"], answer:2,
    fact:"Jet black, to soak up heat. And the fur isn't white either — it's transparent and hollow." },

  { q:"Which of these countries has no permanent rivers at all?",
    options:["Kenya","Chile","Saudi Arabia","Nepal"], answer:2,
    fact:"Not one. Saudi Arabia runs on desalinated seawater and fossil groundwater." },

  { q:"What does 'Wi-Fi' actually stand for?",
    options:["Wireless Fidelity","Wireless Frequency","Wide Field","Nothing at all"], answer:3,
    fact:"Nothing. A branding agency invented it because it sounded like Hi-Fi. 'Wireless Fidelity' was bolted on afterwards and means nothing." },

  { q:"What is the most stolen food in the world?",
    options:["Chocolate","Cheese","Meat","Alcohol"], answer:1,
    fact:"Around 4% of all cheese made goes missing. There is an actual black market for stolen Parmesan." },

  { q:"Which planet has the shortest day?",
    options:["Mercury","Mars","Jupiter","Venus"], answer:2,
    fact:"Jupiter spins once every 10 hours — the biggest planet is also the fastest. Venus is the opposite: one Venus day is longer than its whole year." },

  { q:"Nintendo was founded in 1889. Making what?",
    options:["Playing cards","Vacuum cleaners","Taxis","Instant rice"], answer:0,
    fact:"Hand-painted hanafuda cards. Before games, Nintendo also tried taxis, instant rice and a chain of love hotels." },

  { q:"Which animal cannot stick its tongue out?",
    options:["Crocodile","Giraffe","Hippo","Elephant"], answer:0,
    fact:"A crocodile's tongue is fused to the roof of its mouth. It physically cannot." },

  { q:"How long did the shortest war in recorded history last?",
    options:["Under 45 minutes","About 6 hours","Two days","Nine days"], answer:0,
    fact:"38 minutes. Britain vs Zanzibar, 1896. The Sultan's palace was shelled before most people had finished breakfast." },

  { q:"What is the dot over a lowercase 'i' called?",
    options:["A tittle","A pip","A serif","A cedilla"], answer:0,
    fact:"A tittle. It's where 'to a T' comes from — originally 'to a tittle', meaning precise down to the smallest mark." },

  { q:"Who has more bones — a newborn baby or a grown adult?",
    options:["The adult","The baby","Exactly the same","Depends on height"], answer:1,
    fact:"A baby starts with about 300. Bones fuse together as you grow, so you finish life with far fewer than you started with." },

  { q:"What is the deadliest animal to humans?",
    options:["Snake","Mosquito","Dog","Hippo"], answer:1,
    fact:"Mosquitoes kill hundreds of thousands a year. Second place is humans. Sharks are so far down the list they're beaten by falling coconuts." },

  { q:"Which was invented first?",
    options:["The telephone","The fax machine","The lightbulb","The radio"], answer:1,
    fact:"The fax was patented in 1843 — 33 years before the telephone. A working fax existed before anyone could call to say it was coming." },

  { q:"Which letter appears in no US state name?",
    options:["Q","Z","J","X"], answer:0,
    fact:"Q is the only one. Z is in Arizona, J in New Jersey, X in Texas." },

  { q:"How many hearts does an octopus have?",
    options:["One","Two","Three","Eight"], answer:2,
    fact:"Three — two for the gills, one for the body. The body one stops when it swims, which is why octopuses prefer to crawl." },

  { q:"Which fruit carries its seeds on the outside?",
    options:["Kiwi","Strawberry","Fig","Pomegranate"], answer:1,
    fact:"Those little specks are the actual fruits. The red part is swollen stem — which is why a strawberry isn't technically a berry." },

  { q:"What is a group of flamingos called?",
    options:["A blush","A flamboyance","A stand","A pageant"], answer:1,
    fact:"A flamboyance. Which is the single most accurate collective noun in the English language." },

  { q:"What was Google originally called?",
    options:["BackRub","Searchly","PageIt","GoTo"], answer:0,
    fact:"BackRub, because it analysed backlinks. They changed it. Wisely." },

  { q:"Which mammal cannot jump?",
    options:["Elephant","Rhino","Hippo","Sloth"], answer:0,
    fact:"An elephant always keeps at least one foot down. Too heavy for all four to leave the ground at once." },

  { q:"What does the 'M' in M&M's stand for?",
    options:["Melts and Milk","Mars and Murrie","Milk and More","Nothing"], answer:1,
    fact:"Forrest Mars and Bruce Murrie — two surnames. Murrie's family sold their 20% stake in 1949 and have presumably thought about it every day since." },

  { q:"What is the most common surname on Earth?",
    options:["Smith","Garcia","Wang","Kim"], answer:2,
    fact:"Around 100 million people. There are more Wangs than there are Canadians and Australians combined." },

  { q:"Which animals sleep holding hands so they don't drift apart?",
    options:["Penguins","Sea otters","Dolphins","Seals"], answer:1,
    fact:"Sea otters raft together and hold paws. Pups get wrapped in kelp so they stay put while mum dives." },

  { q:"Which country invented the fortune cookie?",
    options:["China","Japan","The United States","Taiwan"], answer:2,
    fact:"California, by Japanese immigrants. When they were introduced to China in the 1990s they were sold as 'genuine American fortune cookies'." },

  { q:"What does 'SOS' stand for?",
    options:["Save Our Ship","Save Our Souls","Send Out Support","Nothing"], answer:3,
    fact:"Nothing. It was picked because dot-dot-dot dash-dash-dash dot-dot-dot is the easiest thing to hammer out in a panic." },

  { q:"What is the loudest animal on Earth?",
    options:["Blue whale","Sperm whale","Howler monkey","Lion"], answer:1,
    fact:"Sperm whale clicks hit 230 decibels. A jet engine is about 150. Up close, it's loud enough to vibrate a human body apart." },

  { q:"What was the first video uploaded to YouTube?",
    options:["A cat on a piano","'Me at the zoo'","A skateboard fail","A wedding dance"], answer:1,
    fact:"18 seconds of co-founder Jawed Karim standing in front of elephants saying they have really long trunks. April 2005." },

  { q:"Which animal produces cube-shaped poop?",
    options:["Wombat","Armadillo","Porcupine","Badger"], answer:0,
    fact:"Wombats stack it on rocks to mark territory. Cubes don't roll away. The intestine has stretchy and stiff patches that mould it." },

  { q:"Which is the only sea on Earth with no coastline?",
    options:["The Sargasso Sea","The Coral Sea","The Dead Sea","The Baltic Sea"], answer:0,
    fact:"The Sargasso Sea sits in the middle of the Atlantic, bounded entirely by ocean currents instead of land." },

  { q:"What is the hottest planet in the solar system?",
    options:["Mercury","Venus","Mars","Jupiter"], answer:1,
    fact:"Venus, at 465°C — hotter than Mercury despite being further out. Its atmosphere traps heat so well it melts lead at the surface." },

  { q:"What colour is a sunset on Mars?",
    options:["Red","Green","Blue","Purple"], answer:2,
    fact:"Blue. Martian dust scatters light the opposite way to ours, so their days are butterscotch and their sunsets are blue." },

  { q:"Which of these is the only number whose letters are in alphabetical order?",
    options:["Forty","Eight","Ninety","Thirty"], answer:0,
    fact:"F-O-R-T-Y. And 'one' is the only number whose letters are in reverse alphabetical order." },

  { q:"What is a group of crows called?",
    options:["A murder","A cackle","A shadow","A gloom"], answer:0,
    fact:"A murder. Crows also hold funerals — they gather around a dead crow to work out what killed it." },

  { q:"Which is bigger — Russia, or the surface of Pluto?",
    options:["Russia","Pluto","Identical","Pluto, by double"], answer:0,
    fact:"Russia is 17.1 million km². Pluto's entire surface is 16.6 million. You could wrap Russia around Pluto and have some left over." },

  { q:"How many bones does a shark have?",
    options:["Zero","Around 60","Around 200","Over 400"], answer:0,
    fact:"None. Sharks are built from cartilage — lighter than bone, which is part of why they've outlasted almost everything." },

  { q:"What did Alexander Graham Bell want people to say when answering the phone?",
    options:["Hello","Ahoy","Speak","Well?"], answer:1,
    fact:"'Ahoy.' Edison pushed 'hello' and won. Bell used 'ahoy' for the rest of his life out of spite." },

  { q:"Roughly how many ways can you shuffle a standard deck of 52 cards?",
    options:["About a billion","More than atoms on Earth","About a trillion","Exactly 52 factorial, which is small"], answer:1,
    fact:"8 followed by 67 zeroes. Properly shuffle a deck and you're almost certainly holding an order no human has ever held." },

  { q:"How many muscles does a cat use to control each ear?",
    options:["6","12","32","4"], answer:2,
    fact:"32 per ear, and they rotate 180°. You have six per ear and can barely wiggle them." },

  { q:"Which country eats the most chocolate per person?",
    options:["Belgium","Switzerland","Germany","The UK"], answer:1,
    fact:"Switzerland, by a distance — around 10kg a head per year." },

  { q:"How long did the record holder for staying awake last?",
    options:["3 days","6 days","11 days","20 days"], answer:2,
    fact:"11 days, by a 17-year-old for a school science fair in 1964. Guinness stopped tracking it because it's dangerous." },

  { q:"What is the fear of long words called?",
    options:["Verbophobia","Hippopotomonstrosesquippedaliophobia","Longiphobia","Lexiphobia"], answer:1,
    fact:"36 letters. Somebody did that on purpose and they should be proud." },

  { q:"How many noses does a slug have?",
    options:["One","Two","Four","None"], answer:2,
    fact:"Four. Two tentacles for smell, two for light. And if you cut one off, it grows back." },

  { q:"What did the 'Q' in Q-tips originally stand for?",
    options:["Quick","Quality","Quilt","Queen"], answer:1,
    fact:"Quality. They were originally called Baby Gays, which aged interestingly." },

  { q:"How much taller does the Eiffel Tower get in summer?",
    options:["It doesn't","About 15cm","About 2 metres","About 1mm"], answer:1,
    fact:"Iron expands in heat. It grows roughly 15cm and leans slightly away from the sun." },

  { q:"Which of these is the only continent that's also a single country?",
    options:["Antarctica","Australia","Greenland","Africa"], answer:1,
    fact:"Australia. Antarctica is governed by treaty and Greenland is an island, not a continent." },

  { q:"Which animal has three eyelids?",
    options:["Camel","Owl","Frog","Crocodile"], answer:0,
    fact:"The third is transparent and sweeps side to side, so a camel can see through a sandstorm with its eyes effectively shut." }
],

/* ---------------------------------------------------------------
   ODD ONE OUT — three belong, one doesn't.
   The good ones have a reason you'd argue about at the table.
   --------------------------------------------------------------- */
odd: [
  { items:["Venus","Mars","Pluto","Jupiter"], answer:2,
    because:"Pluto isn't a planet", fact:"Demoted in 2006 for failing to 'clear its neighbourhood'. There are now five official dwarf planets." },

  { items:["Tomato","Cucumber","Avocado","Lettuce"], answer:3,
    because:"Lettuce is the only one that isn't a fruit", fact:"If it grows from a flower and holds seeds, it's a fruit. Lettuce is just a leaf." },

  { items:["Dolphin","Shark","Whale","Seal"], answer:1,
    because:"The shark is the only fish", fact:"The rest are mammals — they breathe air and feed their young milk." },

  { items:["Rome","Athens","Cairo","Sydney"], answer:3,
    because:"Sydney isn't a capital city", fact:"Canberra was built from scratch as a compromise because Sydney and Melbourne wouldn't stop arguing about it." },

  { items:["Lion","Tiger","Cheetah","Leopard"], answer:2,
    because:"The cheetah is the only one that can't roar", fact:"It purrs, chirps and meows instead. It's built like a greyhound, not a big cat." },

  { items:["Nintendo","Sega","Atari","Netflix"], answer:3,
    because:"Netflix never made a games console", fact:"Sega quit hardware in 2001 after the Dreamcast and now just makes games — including for Nintendo." },

  { items:["Spider","Scorpion","Tick","Beetle"], answer:3,
    because:"The beetle is the only insect", fact:"Insects have six legs and three body parts. The other three are arachnids with eight legs." },

  { items:["Batman","Iron Man","Green Arrow","Spider-Man"], answer:3,
    because:"Spider-Man is the only one with actual superpowers", fact:"The other three are just extremely rich or extremely good at archery. Mostly rich." },

  { items:["Peanut","Cashew","Almond","Walnut"], answer:0,
    because:"A peanut isn't a nut — it's a legume", fact:"It grows underground and is closer to a pea than an almond. Almost nothing sold as a nut is a nut." },

  { items:["Everest","K2","Annapurna","Kilimanjaro"], answer:3,
    because:"Kilimanjaro is the only one outside Asia", fact:"It's a dormant volcano in Tanzania, and the only one of the four you can walk up without ropes." },

  { items:["Coffee","Tea","Cola","Orange juice"], answer:3,
    because:"Orange juice is the only one with no caffeine", fact:"Gram for gram, dry tea leaves have more caffeine than coffee beans. Brewed, coffee wins because you use far more of it." },

  { items:["The Beatles","Queen","Nirvana","Oasis"], answer:2,
    because:"Nirvana is the only one that isn't British", fact:"Seattle. The other three are Liverpool, London and Manchester." },

  { items:["Titanic","Avatar","Aliens","Jaws"], answer:3,
    because:"Jaws is the only one not directed by James Cameron", fact:"Spielberg was 27 and the shark barely worked, which is exactly why the film is frightening." },

  { items:["Whale","Bat","Penguin","Platypus"], answer:2,
    because:"The penguin is the only bird", fact:"The platypus is a mammal that lays eggs, has no stomach, and detects prey using electricity." },

  { items:["Egypt","Turkey","Russia","Brazil"], answer:3,
    because:"Brazil is the only one not spread over two continents", fact:"Istanbul is the only city on Earth sitting in Europe and Asia at the same time." },

  { items:["Piano","Guitar","Violin","Trumpet"], answer:3,
    because:"The trumpet is the only one with no strings", fact:"A grand piano holds around 230 strings under roughly 20 tonnes of combined tension." },

  { items:["Diamond","Graphite","Charcoal","Quartz"], answer:3,
    because:"Quartz is the only one that isn't pure carbon", fact:"Diamond and pencil lead are the same element. The only difference is how the atoms are stacked." },

  { items:["Instagram","WhatsApp","TikTok","Facebook"], answer:2,
    because:"TikTok is the only one not owned by Meta", fact:"Instagram cost $1bn in 2012 with 13 employees and no revenue. It's one of the best deals ever made." },

  { items:["Strawberry","Raspberry","Blackberry","Blueberry"], answer:3,
    because:"The blueberry is the only actual berry", fact:"A berry comes from one flower with one ovary. Bananas qualify. Strawberries don't." },

  { items:["Sahara","Gobi","Antarctica","Amazon"], answer:3,
    because:"The Amazon is the only one that isn't a desert", fact:"A desert is defined by rainfall, not heat. Antarctica is the largest desert on Earth." },

  { items:["January","March","July","November"], answer:3,
    because:"November is the only one with 30 days", fact:"The months are uneven because Roman emperors kept stealing days for the months named after them." },

  { items:["Saturn","Jupiter","Neptune","Mars"], answer:3,
    because:"Mars is the only rocky one", fact:"Saturn is less dense than water. Find an ocean big enough and it would float." },

  { items:["Chess","Checkers","Go","Poker"], answer:3,
    because:"Poker is the only one with hidden information and luck", fact:"In the other three, both players can see everything. A perfect player would never lose." },

  { items:["Michael Jordan","Michael Phelps","Michael Jackson","Michael Schumacher"], answer:2,
    because:"Michael Jackson is the only one who isn't an athlete", fact:"Phelps has more Olympic golds than most countries have ever won." },

  { items:["Vatican City","Monaco","San Marino","Malta"], answer:3,
    because:"Malta is the only island — the other three each border just one country", fact:"Vatican City borders Italy, San Marino borders Italy, Monaco borders France. You can walk across the Vatican in about 20 minutes." },

  { items:["Emu","Ostrich","Penguin","Falcon"], answer:3,
    because:"The falcon is the only one that can fly", fact:"A peregrine falcon in a dive hits 390 km/h, making it the fastest animal on the planet." },

  { items:["Milk","Cheese","Butter","Egg"], answer:3,
    because:"An egg isn't dairy", fact:"Eggs get shelved next to dairy purely out of habit. They have nothing to do with each other." },

  { items:["Hawaii","Alaska","Texas","Florida"], answer:0,
    because:"Hawaii is the only state not on the North American mainland", fact:"Alaska is on the mainland — just with Canada in the way." },

  { items:["The Sun","Sirius","Betelgeuse","Venus"], answer:3,
    because:"Venus is the only one that isn't a star", fact:"Betelgeuse is so big that if you dropped it where our Sun is, it would swallow Mars." },

  { items:["Green","Red","Blue","Yellow"], answer:3,
    because:"Yellow isn't a primary colour of light", fact:"Screens make yellow by firing red and green at you and letting your eyes do the rest." }
],

/* ---------------------------------------------------------------
   EMOJI DECODE
   --------------------------------------------------------------- */
emoji: [
  { emoji:"🚢 🧊 💔", answer:"Titanic", cat:"Film", fact:"The 1997 film made more money than the ship cost, adjusted, about 30 times over." },
  { emoji:"🦁 👑", answer:"The Lion King", cat:"Film", fact:"The cast were taken to meet a real lion so they'd know what they were drawing." },
  { emoji:"❄️ 👸 ⛄️", answer:"Frozen", cat:"Film", fact:"Elsa was written as the villain until someone wrote 'Let It Go' and they had to rewrite the whole film." },
  { emoji:"🍫 🏭 🎫", answer:"Charlie and the Chocolate Factory", cat:"Film", fact:"Roald Dahl based it on his school days, when Cadbury sent test chocolate to pupils for reviews." },
  { emoji:"🦖 🏞️ 🧬", answer:"Jurassic Park", cat:"Film", fact:"The T-rex roar is a baby elephant, an alligator and a tiger stacked on top of each other." },
  { emoji:"🏠 🎈 🎈", answer:"Up", cat:"Film", fact:"It would take roughly 10 million balloons to actually lift a house. Pixar used 20,622." },
  { emoji:"🐀 👨‍🍳 🇫🇷", answer:"Ratatouille", cat:"Film", fact:"The animators kept real rats in the office for a year to study how they move." },
  { emoji:"🤖 ❤️ 🌱", answer:"WALL-E", cat:"Film", fact:"The first 39 minutes have almost no dialogue. Pixar fought the studio to keep it that way." },
  { emoji:"🦇 🃏 🏙️", answer:"The Dark Knight", cat:"Film", fact:"Heath Ledger locked himself in a hotel room for a month to build the Joker's voice and laugh." },
  { emoji:"👽 🚲 🌕", answer:"E.T.", cat:"Film", fact:"Spielberg shot it in chronological order, which nobody does, so the child actors' goodbyes would be real." },
  { emoji:"🌪️ 👠 🧙‍♀️", answer:"The Wizard of Oz", cat:"Film", fact:"The shoes were silver in the book. They were made red purely to show off Technicolor." },
  { emoji:"🔴💊 🔵💊", answer:"The Matrix", cat:"Film", fact:"The green tint in the code is Japanese sushi recipes scanned from a cookbook." },
  { emoji:"🥊 🇺🇸 🪜", answer:"Rocky", cat:"Film", fact:"Stallone wrote it in three days and refused to sell the script unless he could star. He was broke and had sold his dog." },
  { emoji:"🚗 ⚡️ 🕰️", answer:"Back to the Future", cat:"Film", fact:"The car was originally a fridge. They changed it so children wouldn't climb into fridges." },
  { emoji:"🧙‍♂️ 💍 🌋", answer:"The Lord of the Rings", cat:"Film", fact:"All three films were shot at once over 438 days. The cast got matching tattoos." },
  { emoji:"🕶️ 👽 🔫", answer:"Men in Black", cat:"Film", fact:"The two-headed alien language on the screens is real gibberish the prop team invented and stuck to." },
  { emoji:"🦈 🌊 🩸", answer:"Jaws", cat:"Film", fact:"The mechanical shark kept breaking, so Spielberg hid it. That accident is why the film works." },
  { emoji:"🧠 😢 😡 😨", answer:"Inside Out", cat:"Film", fact:"Pixar consulted real psychologists, who told them to cut two emotions because the film got too crowded." },
  { emoji:"🤠 🚀 🧸", answer:"Toy Story", cat:"Film", fact:"A team member accidentally ran a delete command that wiped 90% of the film. One person had a backup at home." },
  { emoji:"👻 🚫 🏢", answer:"Ghostbusters", cat:"Film", fact:"The Stay Puft Marshmallow Man suit caught fire twice during filming." },
  { emoji:"🏴‍☠️ 💀 ⚓️", answer:"Pirates of the Caribbean", cat:"Film", fact:"The studio nearly fired Johnny Depp mid-shoot because nobody could tell if his character was drunk." },
  { emoji:"🐼 🥋 🍜", answer:"Kung Fu Panda", cat:"Film", fact:"It was such a hit in China that the government held meetings asking why they hadn't made it themselves." },
  { emoji:"🐟 🔍 🌊", answer:"Finding Nemo", cat:"Film", fact:"It caused a clownfish buying spree, which is the exact opposite of the film's message." },
  { emoji:"🎩 🐇 ⏰", answer:"Alice in Wonderland", cat:"Film", fact:"Lewis Carroll made the whole thing up on a boat trip to entertain a bored ten-year-old." },
  { emoji:"🍝 🐶 🎻", answer:"Lady and the Tramp", cat:"Film", fact:"Walt Disney wanted the spaghetti scene cut. He thought two dogs sharing a noodle looked ridiculous." },
  { emoji:"🎈 🤡 🚸", answer:"It", cat:"Film", fact:"Stephen King wrote the clown because he asked himself what scares children most — and clowns beat everything." },
  { emoji:"🦍 🏢 ✈️", answer:"King Kong", cat:"Film", fact:"The 1933 original used a model 46cm tall. It took 22 hours of work per minute of film." },
  { emoji:"🌧️ 🐱 🐶", answer:"Raining cats and dogs", cat:"Saying", fact:"Nobody knows where it came from. The best guess is Old English 'catadupe', meaning waterfall." },
  { emoji:"🍰 🧩", answer:"A piece of cake", cat:"Saying", fact:"From 1870s cakewalk contests in the American South, where the prize was literally a cake." },
  { emoji:"🐘 🛋️ 🤫", answer:"The elephant in the room", cat:"Saying", fact:"Traced to a Russian fable about a man who visits a museum, notes every tiny insect, and misses the elephant." },
  { emoji:"🐦 🌅 🪱", answer:"The early bird catches the worm", cat:"Saying", fact:"Printed in an English proverb collection in 1605 and unchanged since." },
  { emoji:"🥔 🛋️ 📺", answer:"Couch potato", cat:"Saying", fact:"Coined in 1973 as a pun — TV was slang for 'boob tube', and a potato is a tuber." },
  { emoji:"🐈 👜 ➡️", answer:"Let the cat out of the bag", cat:"Saying", fact:"Market cheats sold cats in sacks as piglets. Open the bag and the scam's out." },
  { emoji:"⏰ 🪰", answer:"Time flies", cat:"Saying", fact:"A direct translation of Virgil's Latin: tempus fugit. Two thousand years old." },
  { emoji:"🌈 🏆 🪙", answer:"A pot of gold at the end of the rainbow", cat:"Saying", fact:"Physically impossible — a rainbow is an angle, not a place, so it moves as you do." },
  { emoji:"🧊 🍰 ⬆️", answer:"The icing on the cake", cat:"Saying", fact:"Older version: 'the gilt on the gingerbread'. Real gold leaf on biscuits was a medieval flex." },
  { emoji:"🐟 🐟 🌊", answer:"Plenty of fish in the sea", cat:"Saying", fact:"First recorded in 1573, which means people have been getting dumped and hearing this for 450 years." },
  { emoji:"👶 🦈", answer:"Baby Shark", cat:"Song", fact:"The first video to pass 10 billion views. It started as a summer camp chant." },
  { emoji:"💃 👑 1️⃣7️⃣", answer:"Dancing Queen", cat:"Song", fact:"ABBA's only US number one. The band cried the first time they heard the finished mix." },
  { emoji:"🚀 🧑‍🚀 🎹", answer:"Rocket Man", cat:"Song", fact:"Written in about 20 minutes at a kitchen table, based on a short story." },
  { emoji:"☂️ 🌧️ 💎", answer:"Umbrella", cat:"Song", fact:"Turned down by two other artists before Rihanna took it. It sat on a shelf for months." },
  { emoji:"👁️ 🐅", answer:"Eye of the Tiger", cat:"Song", fact:"Written because Stallone couldn't get the rights to the song he actually wanted for Rocky III." },
  { emoji:"⭐️ ⭐️ 🔭", answer:"Twinkle Twinkle Little Star", cat:"Song", fact:"Same tune as the alphabet song and Baa Baa Black Sheep. It's a French melody from 1761." }
],

/* ---------------------------------------------------------------
   CLOSEST WINS — numeric. No knowledge required, just nerve.
   --------------------------------------------------------------- */
closest: [
  { q:"How many bones are in an adult human body?", value:206, unit:"bones",
    fact:"Over a quarter of them are in your hands and feet." },
  { q:"How many keys on a standard piano?", value:88, unit:"keys",
    fact:"52 white, 36 black. Anything beyond that range starts sounding like noise to the human ear." },
  { q:"How many times does the average person blink in a day?", value:20000, unit:"blinks",
    fact:"About 15–20 a minute. You blink less when reading a screen, which is why your eyes hurt." },
  { q:"How many countries are in Africa?", value:54, unit:"countries",
    fact:"More than a quarter of every country on Earth." },
  { q:"What percentage of Earth's surface is water?", value:71, unit:"%",
    fact:"And we've mapped less of the ocean floor than we have the surface of Mars." },
  { q:"How many minutes does sunlight take to reach Earth?", value:8, unit:"minutes",
    fact:"8 minutes 20 seconds. If the Sun vanished right now, you'd have eight minutes of not knowing." },
  { q:"How tall is the Burj Khalifa, in metres?", value:828, unit:"metres",
    fact:"So tall that people on the ground floor can break their fast about three minutes before people at the top." },
  { q:"How many time zones does Russia have?", value:11, unit:"time zones",
    fact:"When it's Monday morning in Kaliningrad, it's already Monday evening in Kamchatka." },
  { q:"Roughly how many islands does Indonesia have?", value:17000, unit:"islands",
    fact:"Around 17,500, and roughly 6,000 of them have people living on them." },
  { q:"How tall is the Eiffel Tower, in metres?", value:330, unit:"metres",
    fact:"Melt down all its iron and you'd have a puddle only about 6cm deep across its own base. It's mostly air." },
  { q:"How long is the Great Wall of China, in kilometres?", value:21196, unit:"km",
    fact:"21,196km across all its branches — roughly half the distance around the planet." },
  { q:"How many muscles are in an elephant's trunk?", value:40000, unit:"muscles",
    fact:"About 40,000. Your entire body has roughly 600." },
  { q:"How many taste buds does the average person have?", value:10000, unit:"taste buds",
    fact:"They're replaced every couple of weeks, and you lose them as you age — which is why children hate everything." },
  { q:"How many litres of blood does your heart pump in a day?", value:7500, unit:"litres",
    fact:"Enough to fill about 40 bathtubs, every single day, without asking." },
  { q:"How many times does the average heart beat in a day?", value:100000, unit:"beats",
    fact:"About 2.5 billion over a lifetime. Almost every mammal gets roughly the same total, just spread over different lifespans." },
  { q:"Roughly how many languages are spoken in the world today?", value:7000, unit:"languages",
    fact:"Around 7,000 — and one dies roughly every two weeks." },
  { q:"What is the men's 100m world record, in seconds?", value:9.58, unit:"seconds",
    fact:"Usain Bolt, 2009. His top speed was 44.7 km/h, which is over the speed limit in most city centres." },
  { q:"How deep is the Mariana Trench, in metres?", value:10935, unit:"metres",
    fact:"Drop Everest in and its peak would still be more than 2km underwater." },
  { q:"How many seconds are there in a day?", value:86400, unit:"seconds",
    fact:"86,400. Which is also, unhelpfully, the number of times people have used this in a motivational post." },
  { q:"How many bones are in a giraffe's neck?", value:7, unit:"bones",
    fact:"Seven — exactly the same as yours. They're just each about 25cm long." },
  { q:"How many Oscars did Titanic win?", value:11, unit:"Oscars",
    fact:"Eleven, a record it shares with Ben-Hur and Return of the King. It won nothing for acting." },
  { q:"How far is it around the Earth at the equator, in kilometres?", value:40075, unit:"km",
    fact:"The metre was originally defined so this number would come out neat. It nearly did." },
  { q:"How many people could fit in the Colosseum at its peak?", value:50000, unit:"people",
    fact:"It could be emptied in about 15 minutes through 80 exits. Modern stadiums still copy the design." },
  { q:"How many calories are in a Big Mac?", value:550, unit:"calories",
    fact:"550. The fries add another 320, and you already knew that." },
  { q:"How many days does Mars take to orbit the Sun?", value:687, unit:"days",
    fact:"687. If you moved there, you'd age half as fast on paper and twice as fast in spirit." },
  { q:"How many degrees is the Earth tilted on its axis?", value:23.5, unit:"degrees",
    fact:"23.5°, and that tilt is the only reason seasons exist. Straighten it and every day everywhere is the same." },
  { q:"How many strings does a concert harp have?", value:47, unit:"strings",
    fact:"47 strings and 7 foot pedals, each with three positions. It's the hardest instrument in the orchestra." },
  { q:"How old was the oldest person ever verified?", value:122, unit:"years",
    fact:"Jeanne Calment, 122. She met Vincent van Gogh as a girl and called him 'dirty and disagreeable'." },
  { q:"How many hearts does an earthworm have?", value:5, unit:"hearts",
    fact:"Five, and they're closer to pumping loops than hearts. No lungs either — it breathes through its skin." },
  { q:"How many possible first moves does White have in chess?", value:20, unit:"moves",
    fact:"20. After four moves each, there are over 288 billion possible positions." },
  { q:"Roughly how many bricks are in the Empire State Building?", value:10000000, unit:"bricks",
    fact:"About 10 million. It went up in 410 days during the Great Depression, ahead of schedule and under budget." },
  { q:"How many people live in the Tokyo metro area, in millions?", value:37, unit:"million",
    fact:"37 million — more people than in all of Canada, packed into one commuter belt." },
  { q:"How many years did the Hundred Years' War last?", value:116, unit:"years",
    fact:"116, and it wasn't one war — it was a series of them with long breaks, later bundled under one name." },
  { q:"Roughly how many dimples are on a golf ball?", value:336, unit:"dimples",
    fact:"The dimples cut drag by half. A smooth golf ball travels about half as far." },
  { q:"How many teeth does an adult human have?", value:32, unit:"teeth",
    fact:"32 including wisdom teeth, which about a third of people are simply born without." },
  { q:"How many hairs are on an average human head?", value:100000, unit:"hairs",
    fact:"About 100,000, and you shed roughly 100 a day without noticing." }
],

/* ---------------------------------------------------------------
   SPOT THE LIE — two true, one false. The false one is always
   the most believable of the three.
   --------------------------------------------------------------- */
lie: [
  { statements:["Sharks existed before trees did","Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid","T-rex and Stegosaurus lived side by side"], lie:2,
    fact:"T-rex and Stegosaurus are separated by about 80 million years. T-rex is closer in time to you than to Stegosaurus." },

  { statements:["Honey never spoils","Bananas are slightly radioactive","Carrots were originally blue"], lie:2,
    fact:"They were purple, white and yellow. Orange carrots were bred in the Netherlands in the 1600s and took over." },

  { statements:["The inventor of the Frisbee was made into Frisbees after he died","The inventor of the Pringles can is buried in one","The inventor of the vacuum cleaner was buried inside one of his machines"], lie:2,
    fact:"The first two are true. Ed Headrick's ashes went into commemorative discs, and Fredric Baur's family stopped at Pringles on the way to the funeral." },

  { statements:["A day on Venus is longer than a year on Venus","There's enough gold in Earth's core to coat the whole planet knee-deep","The Moon is slowly moving closer to Earth"], lie:2,
    fact:"It's moving away, about 3.8cm a year. Eventually total solar eclipses will stop happening entirely." },

  { statements:["A snail can sleep for up to three years","Starfish have no brain and no blood","Flamingos are born pink"], lie:2,
    fact:"They hatch grey. The pink comes from pigments in the shrimp and algae they eat — a flamingo on the wrong diet fades to white." },

  { statements:["Scotland's national animal is the unicorn","Norway has knighted a penguin","France's national animal is the dragon"], lie:2,
    fact:"It's a rooster. And Sir Nils Olav is a real king penguin in Edinburgh Zoo who has been promoted repeatedly by the Norwegian King's Guard." },

  { statements:["Humans share about 60% of their DNA with bananas","There are more stars in the universe than grains of sand on Earth","Humans have more chromosomes than any other animal"], lie:2,
    fact:"We have 46. A potato has 48. A goldfish has 100. Chromosome count says nothing about complexity." },

  { statements:["The Eiffel Tower was only ever meant to be temporary","The Statue of Liberty worked as a functioning lighthouse","The Leaning Tower of Pisa was designed to lean"], lie:2,
    fact:"It started tilting five years into construction because the soil underneath is soft. They kept building anyway, with curved upper floors to compensate." },

  { statements:["Cows have best friends and get stressed when separated","Rats laugh when you tickle them","Goldfish have a three-second memory"], lie:2,
    fact:"Goldfish remember for months and can be trained to push levers for food at set times of day." },

  { statements:["Napoleon was an average height for his time","Vikings never wore horned helmets","Einstein failed maths at school"], lie:2,
    fact:"He mastered calculus at 15. The myth started from a misread grading scale where 6 was the top mark, not the bottom." },

  { statements:["Oxford University is older than the Aztec Empire","The fax machine was invented before the American Civil War","The first email was sent before the first Moon landing"], lie:2,
    fact:"Email came in 1971, two years after the Moon landing. But the fax really was patented in 1843." },

  { statements:["Sliced bread was banned in America in 1943","Australia once lost a war against emus","Canada once banned the colour blue in hockey"], lie:2,
    fact:"The Emu War is real. The army deployed machine guns, the emus scattered, and the army withdrew. The emus were officially declared the winners." },

  { statements:["A Norwegian town uses giant mirrors to bounce sunlight into the town square","Japan has a train station with no exits","Germany has a city where cars are banned on Wednesdays"], lie:2,
    fact:"Rjukan sits in shadow for six months, so they built mountaintop mirrors. Seiryū Miharashi station exists only so you can get off and look at a river." },

  { statements:["Peanuts are not nuts","Strawberries are not berries","Pineapples grow on trees"], lie:2,
    fact:"A pineapple grows from a low spiky plant on the ground and takes about two years to produce one fruit." },

  { statements:["A group of pugs is called a grumble","A group of ferrets is called a business","A group of owls is called a wisdom"], lie:2,
    fact:"It's a parliament of owls — which C.S. Lewis popularised in Narnia." },

  { statements:["You can't hum while holding your nose closed","Most people can't lick their own elbow","It's impossible to sneeze with your eyes open"], lie:2,
    fact:"It's difficult, not impossible, and your eyes will not pop out. People have done it on camera." },

  { statements:["Japanese has a word for buying books and never reading them","German has a word for the weight you gain from comfort eating","French has a word for the specific sadness of a Sunday evening"], lie:2,
    fact:"Tsundoku is the pile of unread books. Kummerspeck is the German one, and it translates literally as 'grief bacon'." },

  { statements:["Venus spins backwards compared to every other planet","It rains diamonds on Neptune","Saturn's rings are made of solid rock"], lie:2,
    fact:"They're billions of chunks of ice and dust, most smaller than a house, and only about 10 metres thick in places." },

  { statements:["Mosquitoes kill more people than any other animal","Vending machines kill more people than sharks","Cows kill more people than snakes"], lie:2,
    fact:"Snakes kill well over 100,000 people a year. Cows manage a few dozen." },

  { statements:["Tug of war used to be an Olympic sport","Solo synchronised swimming used to be an Olympic event","Chess is currently an Olympic sport"], lie:2,
    fact:"Solo synchronised swimming ran for three Games. Yes, synchronising with nobody. It was judged against the music." },

  { statements:["The groove between your nose and your top lip is called the philtrum","The gap between your eyebrows is called the glabella","The plastic tip of a shoelace is called a grommet"], lie:2,
    fact:"It's an aglet. Without it the lace frays in days and won't thread." },

  { statements:["Bubble wrap was invented as wallpaper","Play-Doh was invented as a wallpaper cleaner","Post-it notes were invented as a failed sunscreen"], lie:2,
    fact:"They came from a failed super-strong adhesive. It was weak and reusable — useless, until someone wanted a bookmark that stayed put." },

  { statements:["Bees can recognise individual human faces","Crows hold grudges and remember faces for years","Dogs can only see in black and white"], lie:2,
    fact:"Dogs see blues and yellows. They just can't tell red from green — which is why a red ball on grass baffles them." },

  { statements:["There is a lake in Tanzania alkaline enough to turn animals that fall in to stone","It occasionally snows in the Sahara","The Dead Sea is the deepest sea on Earth"], lie:2,
    fact:"It isn't a sea and it isn't deep — it's a landlocked lake, and it's the lowest exposed land on Earth." },

  { statements:["Lamborghini started out making tractors","Samsung started out trading groceries and dried fish","Nokia started out as an airline"], lie:2,
    fact:"Nokia was a paper mill, then rubber boots, then cables, then phones. It's been reinventing itself since 1865." }
],

/* ---------------------------------------------------------------
   REALLY?! — true or false, fast.
   --------------------------------------------------------------- */
really: [
  { s:"A blue whale's tongue weighs about as much as an elephant.", t:true, fact:"Around 2.7 tonnes. Its heart is roughly the size of a small car." },
  { s:"Bananas grow on trees.", t:false, fact:"The banana plant is a giant herb. That 'trunk' is tightly rolled leaves." },
  { s:"The United States has more public libraries than McDonald's.", t:true, fact:"Roughly 17,000 library outlets against about 13,500 McDonald's." },
  { s:"Lightning never strikes the same place twice.", t:false, fact:"The Empire State Building takes about 25 hits a year. Lightning prefers the same tall places every time." },
  { s:"Chameleons change colour to blend into their background.", t:false, fact:"They change with mood, temperature and to signal other chameleons. Camouflage is a side effect." },
  { s:"The Great Wall of China is visible from space with the naked eye.", t:false, fact:"It's long but only a few metres wide. Astronauts have said motorways are easier to spot." },
  { s:"Bulls charge because they're enraged by the colour red.", t:false, fact:"Bulls are red-green colourblind. They're reacting to the cape's movement." },
  { s:"An ostrich's eye is bigger than its brain.", t:true, fact:"Each eye is about 5cm across — the largest of any land animal." },
  { s:"Camels store water in their humps.", t:false, fact:"It's fat. Storing it in one lump keeps the rest of the body free to shed heat." },
  { s:"Sound travels faster through water than through air.", t:true, fact:"About four times faster. Whales can talk to each other across entire ocean basins." },
  { s:"Glass is a slow-moving liquid, which is why old windows are thicker at the bottom.", t:false, fact:"Glass is a solid. Old panes are uneven because medieval glassmakers couldn't roll them flat." },
  { s:"Your fingernails keep growing after you die.", t:false, fact:"Skin dries and retracts, exposing more nail. Nothing is growing." },
  { s:"Cracking your knuckles gives you arthritis.", t:false, fact:"One doctor cracked the knuckles on only one hand for 60 years to test it. No difference. He won an Ig Nobel Prize." },
  { s:"The Sun is actually white, not yellow.", t:true, fact:"It looks yellow because our atmosphere scatters the blue out. From space it's plain white." },
  { s:"Vikings drank from the skulls of their enemies.", t:false, fact:"A 17th-century mistranslation. The original text meant drinking from curved horns." },
  { s:"Astronauts get taller in space.", t:true, fact:"Up to 5cm as the spine decompresses. They shrink back within days of landing." },
  { s:"Goldfish can recognise their owner's face.", t:true, fact:"Trained fish will pick their owner out of a lineup of photographs." },
  { s:"There is no gravity in space.", t:false, fact:"Gravity is what keeps the Space Station in orbit. Astronauts float because they're falling around the Earth, constantly, and missing." },
  { s:"Gentoo penguins propose by presenting a pebble.", t:true, fact:"They search for the smoothest pebble they can find and place it at the female's feet." },
  { s:"Sloths can hold their breath longer than dolphins.", t:true, fact:"40 minutes against about 10. They slow their heart rate down to a third." },
  { s:"A jellyfish is about 95% water.", t:true, fact:"No brain, no heart, no bones. Leave one on the beach and it essentially evaporates." },
  { s:"The Mona Lisa has no eyebrows.", t:true, fact:"Scans suggest she had them and they were removed during a past cleaning." },
  { s:"Mount Everest is the tallest mountain on Earth measured from base to peak.", t:false, fact:"Mauna Kea is over 10,000m from its base — it's just that most of it is underwater." },
  { s:"Carrots improve your night vision.", t:false, fact:"British wartime propaganda, invented to hide the fact they'd developed radar." },
  { s:"We only use 10% of our brains.", t:false, fact:"Scans show activity across essentially all of it. There is no dormant 90% waiting to be unlocked." },
  { s:"Swallowed chewing gum takes seven years to digest.", t:false, fact:"It passes through in days, undigested, like sweetcorn." },
  { s:"The Canary Islands are named after dogs, not birds.", t:true, fact:"From the Latin for dog. The birds were named after the islands, not the other way round." },
  { s:"Europeans once believed tomatoes were poisonous.", t:true, fact:"Rich people ate off pewter plates, the acid leached lead out, and the tomato got the blame for 200 years." },
  { s:"A pineapple takes about two years to grow.", t:true, fact:"One plant, two years, one pineapple. Which is why they were once a status symbol you could rent for a party." },
  { s:"Alaska is both the westernmost and the easternmost US state.", t:true, fact:"The Aleutian Islands cross the 180th meridian, so part of Alaska sits in the eastern hemisphere." },
  { s:"Peanut butter can be turned into a diamond.", t:true, fact:"It's carbon. Squeeze it hard enough and you get a tiny, slightly disappointing diamond. It's been done." },
  { s:"Coca-Cola was originally green.", t:false, fact:"It's always been caramel-coloured. The myth comes from the green bottles." },
  { s:"Your heart stops when you sneeze.", t:false, fact:"The rhythm changes slightly from the pressure. It does not stop." },
  { s:"A single day on Mercury lasts longer than a year on Mercury.", t:true, fact:"One sunrise-to-sunrise day is 176 Earth days. A year is 88." },
  { s:"There are more possible chess games than atoms in the observable universe.", t:true, fact:"Roughly 10 to the power of 120, against about 10 to the power of 80 atoms. It isn't close." },
  { s:"Pluto hasn't completed a single orbit since we discovered it.", t:true, fact:"Found in 1930, one lap takes 248 years. It finishes in 2178." },
  { s:"Scotland has over 400 words for snow.", t:true, fact:"A university study counted 421, including 'feefle' for snow swirling round a corner." },
  { s:"Humans have walked on Mars.", t:false, fact:"Only robots so far. The trip is about seven months each way and nobody has a plan for the way back yet." },
  { s:"There are more trees on Earth than stars in the Milky Way.", t:true, fact:"Around 3 trillion trees against a few hundred billion stars. It isn't close." },
  { s:"A bolt of lightning is about five times hotter than the surface of the Sun.", t:true, fact:"Roughly 30,000°C against the Sun's 5,500°C. It just doesn't last long enough to feel like it." },
  { s:"The word sushi means raw fish.", t:false, fact:"It means sour rice. The vinegared rice is the dish — the fish is a topping." },
  { s:"Bats are blind.", t:false, fact:"All bats can see, and some see better than we do. Echolocation is an extra sense, not a replacement." }
],

/* ---------------------------------------------------------------
   THE CONNECTION — four clues, revealed one at a time.
   Stop early, score more.
   --------------------------------------------------------------- */
connect: [
  { clues:["Mercury","Gemini","Apollo","Artemis"], answer:"NASA space programmes",
    fact:"Artemis is the current one — and in myth, Artemis is Apollo's twin sister." },
  { clues:["Ruby","Python","Swift","Java"], answer:"Programming languages",
    fact:"Python is named after Monty Python, not the snake. The official tutorials are full of spam and eggs." },
  { clues:["Milky Way","Mars","Snickers","Twix"], answer:"Chocolate bars",
    fact:"All four are made by Mars, a company so private it has never issued public shares." },
  { clues:["Turkey","Chile","China","Greece"], answer:"Countries that are also everyday words",
    fact:"Turkey the bird is named after the country, via a trade route mix-up. The bird is American." },
  { clues:["Hulk","Shrek","Kermit","The Grinch"], answer:"They're all green",
    fact:"The Hulk was meant to be grey. The printers couldn't hold a consistent grey, so they switched him to green." },
  { clues:["Sahara","Gobi","Atacama","Mojave"], answer:"Deserts",
    fact:"Parts of the Atacama have had no recorded rainfall. NASA tests Mars rovers there." },
  { clues:["Twitter","Tesla","SpaceX","Neuralink"], answer:"Companies run by Elon Musk",
    fact:"He also founded a tunnelling company, largely because he was annoyed by traffic." },
  { clues:["Blue","Killer","Sperm","Humpback"], answer:"Types of whale",
    fact:"The killer whale is actually the largest dolphin. It isn't a whale at all." },
  { clues:["Braille","Morse","Binary","Semaphore"], answer:"Ways of sending a message without speaking",
    fact:"Braille was invented by a 15-year-old, adapting a military code designed for reading orders in the dark." },
  { clues:["Piano","Laptop","Typewriter","Cash register"], answer:"Things with keys",
    fact:"The QWERTY layout was designed to stop typewriter arms jamming, and we've never got rid of it." },
  { clues:["Zeus","Jupiter","Odin","Ra"], answer:"Chief gods of their pantheons",
    fact:"Zeus and Jupiter are the same god with two passports — Rome imported most of the Greek line-up." },
  { clues:["Bass","Sole","Perch","Pike"], answer:"Fish that are also other words",
    fact:"A pike the weapon and a pike the fish are both named for being long and pointed." },
  { clues:["Wimbledon","Roland-Garros","Flushing Meadows","Melbourne Park"], answer:"The four tennis Grand Slams",
    fact:"Only Roland-Garros is played on clay, which is why winning all four in one year almost never happens." },
  { clues:["Rat","Ox","Dragon","Rooster"], answer:"Chinese zodiac animals",
    fact:"The dragon is the only mythical one, and dragon years still see a measurable birth-rate spike." },
  { clues:["Ford","Lincoln","Washington","Jackson"], answer:"US Presidents",
    fact:"They're also all on money or on cars, which is roughly how American fame works." },
  { clues:["Neil","Louis","Lance","Stretch"], answer:"Famous Armstrongs",
    fact:"Louis Armstrong was so influential that jazz musicians simply call the style before him 'before Louis'." },
  { clues:["Ginger","Scary","Baby","Posh"], answer:"The Spice Girls",
    fact:"A magazine made the nicknames up. The band had no say and the names stuck for life." },
  { clues:["Anglerfish","Firefly","Jellyfish","Glow-worm"], answer:"They make their own light",
    fact:"Most bioluminescent life is in the deep ocean, which makes glowing the most common form of communication on Earth." },
  { clues:["Louvre","Prado","Uffizi","Hermitage"], answer:"Famous art museums",
    fact:"The Hermitage employs cats. They've been on the payroll since the 1700s to deal with mice." },
  { clues:["Cheetah","Peregrine falcon","Sailfish","Pronghorn"], answer:"The fastest animals in their element",
    fact:"The pronghorn can hold 55 km/h for miles. It evolved to outrun a predator that went extinct 10,000 years ago." },
  { clues:["Iceland","Japan","Indonesia","Hawaii"], answer:"Volcanic islands",
    fact:"Iceland sits on the crack between two continental plates and grows about 2cm wider every year." },
  { clues:["Blue","Yellow","Black","Green"], answer:"Colours of the Olympic rings",
    fact:"Those five plus red on white were chosen because every national flag at the time contained at least one of them." },
  { clues:["Sherlock Holmes","James Bond","Paddington","Mary Poppins"], answer:"Fictional characters based in London",
    fact:"221B Baker Street didn't exist when Conan Doyle invented it. When the road was extended, a bank had to hire someone to answer Holmes's mail." },
  { clues:["Amazon","Nile","Jordan","Mississippi"], answer:"Rivers",
    fact:"The Amazon is so powerful that fresh water is still detectable 160km out into the Atlantic." },
  { clues:["Gates","Jobs","Zuckerberg","Ellison"], answer:"Tech founders who dropped out of university",
    fact:"Survivorship bias in one slide. For each of these there are thousands you've never heard of." }
],

/* ---------------------------------------------------------------
   FINAL WAGER — one question, everything on the line.
   --------------------------------------------------------------- */
wager: [
  { q:"Which country has the most islands in the world?",
    options:["Indonesia","Sweden","Canada","The Philippines"], answer:1,
    fact:"Sweden, with around 267,000. Most are bare rock and fewer than 1,000 have anyone living on them." },
  { q:"Which country has the longest coastline on Earth?",
    options:["Russia","Australia","Canada","Indonesia"], answer:2,
    fact:"Canada, at over 200,000km — more than the next six countries combined, thanks to the Arctic islands." },
  { q:"Which country has the most pyramids?",
    options:["Egypt","Mexico","Sudan","Peru"], answer:2,
    fact:"Sudan has roughly twice as many as Egypt. They're steeper, smaller, and almost deserted." },
  { q:"Which is the only US state whose name can be typed using one row of a keyboard?",
    options:["Alaska","Ohio","Texas","Iowa"], answer:0,
    fact:"A-L-A-S-K-A all sit on the home row." },
  { q:"Which planet rotates on its side?",
    options:["Neptune","Saturn","Uranus","Venus"], answer:2,
    fact:"Tipped 98°, probably by an ancient collision. Each pole gets 42 years of continuous sunlight, then 42 years of dark." },
  { q:"Which country drinks the most coffee per person?",
    options:["Italy","Finland","Brazil","Turkey"], answer:1,
    fact:"Finland, at around 12kg a head per year. Finnish workplaces have legally recognised coffee breaks." },
  { q:"What is the deepest lake in the world?",
    options:["Lake Superior","Lake Tanganyika","Lake Baikal","The Caspian Sea"], answer:2,
    fact:"Baikal is 1,642m deep and holds a fifth of all the unfrozen fresh water on the planet." },
  { q:"Which element has the chemical symbol W?",
    options:["Tungsten","Tin","Titanium","Uranium"], answer:0,
    fact:"From 'wolfram'. It has the highest melting point of any metal, which is why it was used in lightbulb filaments." },
  { q:"Which is the only bird that can fly backwards?",
    options:["Kingfisher","Hummingbird","Swift","Hawk"], answer:1,
    fact:"It figure-eights its wings up to 80 times a second, so it can hover, reverse and fly upside down." },
  { q:"Which country was the first to give women the vote nationally?",
    options:["Finland","Norway","New Zealand","Australia"], answer:2,
    fact:"New Zealand, 1893 — 27 years before the United States." },
  { q:"Which is the only continent with no active volcanoes?",
    options:["Australia","Europe","Antarctica","South America"], answer:0,
    fact:"Mainland Australia has none. Antarctica has Mount Erebus, which has held a lava lake for decades." },
  { q:"Which animal produces milk that's pink?",
    options:["Hippopotamus","Flamingo","Manatee","Walrus"], answer:0,
    fact:"A hippo's skin secretes a red oily substance that acts as sunscreen, and it tints the milk pink." },
  { q:"How many countries does the equator pass through?",
    options:["7","10","13","19"], answer:2,
    fact:"13. Stand on it in Ecuador and you'll be told water spins the other way. That isn't true either." },
  { q:"What is the second smallest country in the world by area?",
    options:["Monaco","San Marino","Nauru","Liechtenstein"], answer:0,
    fact:"Monaco is about 2km², and roughly a fifth of it was reclaimed from the sea." },
  { q:"Which of these animals lives the longest?",
    options:["Giant tortoise","Greenland shark","Bowhead whale","Koi carp"], answer:1,
    fact:"Greenland sharks are estimated to live 400 years. They don't reproduce until they're about 150." },
  { q:"Which is the most spoken language in the world, counting second-language speakers?",
    options:["Mandarin","English","Spanish","Hindi"], answer:1,
    fact:"English wins on total speakers because of how many people learn it second. Mandarin wins on native speakers." }
]

};
