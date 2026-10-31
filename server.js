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
  teleporting: 'instant,poof,beam', 'mind control': 'puppet,brain,command', 'x-ray vision': 'bones,Superman,see-through', shapeshifting: 'morph,change,form', healing: 'cure,recover,mend',
};
const GENERIC = {
  'Animals': 'wild,zoo,fur,nature,creature,habitat', 'Food': 'tasty,eat,hungry,delicious,dinner,meal', 'Places': 'visit,building,people,city,public,tourist',
  'Jobs': 'career,work,uniform,training,skilled,paid', 'At the Beach': 'sand,summer,sun,ocean,holiday,coast', 'Sports': 'team,match,compete,score,athlete,trophy',
  'In the Kitchen': 'cooking,counter,metal,handy,useful,clean', 'Space': 'universe,distant,cosmic,dark,huge,science', 'Fairy Tales': 'story,magic,once,legend,fantasy,enchanted',
  'Superpowers': 'hero,mutant,comic,special,gift,amazing',
};
const FILLER_SHORT = 'big,old,cool,fun,nice,rare,true,odd'.split(',');
const FILLER_LONG = 'interesting,mysterious,familiar,popular,fantastic,incredible,remarkable,wonderful'.split(',');
const BOT_NAMES = ['Mira', 'Jules', 'Sol', 'Kit', 'Nova', 'Remy', 'Juno', 'Pax'];
const rand = (a, b) => a + Math.random() * (b - a);
const AWAY_MS = 45000, AWAY_LOBBY_MS = 15000;

const rooms = new Map();
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.end('ok'); return; }
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
    players: [...room.players.values()].map(q => ({ id: q.id, name: q.name, color: q.color, score: q.score, bot: !!q.bot, away: !!q.away })),
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
  room.totalRounds = Math.min(room.players.size, 6);
  room.roundNo = 0;
  nextRound(room);
}

function nextRound(room) {
  clearTimeout(room.timer);
  if (room.players.size < MIN_PLAYERS) return endGame(room);
  room.roundNo++;
  if (room.roundNo > room.totalRounds) return endGame(room);
  let moleId = room.queue[(room.roundNo - 1) % room.queue.length];
  if (!room.players.has(moleId)) moleId = shuffle([...room.players.keys()])[0];
  room.moleId = moleId;
  const cats = Object.keys(BANK);
  room.category = cats[Math.floor(Math.random() * cats.length)];
  const words = BANK[room.category];
  room.word = words[Math.floor(Math.random() * words.length)];
  room.options = shuffle([room.word, ...shuffle(words.filter(w => w !== room.word)).slice(0, 5)]);
  room.order = shuffle([...room.players.keys()]);
  room.turn = 0; room.clues = []; room.votes = new Map(); room.stakes = new Set(); room.ready = new Set(); room.result = null; room.botDone = new Set();
  room.mod = room.roundNo === 1 ? MODS[0] : MODS[Math.floor(Math.random() * MODS.length)];
  room.opName = `Operation ${OP_A[Math.floor(Math.random() * OP_A.length)]} ${OP_B[Math.floor(Math.random() * OP_B.length)]}`;
  room.caseNo = 1000 + Math.floor(Math.random() * 9000);
  room.phase = 'clue';
  arm(room, CLUE_MS, () => submitClue(room, null, '—'));
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
  arm(room, CLUE_MS, () => submitClue(room, null, '—'));
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
  room.votes.forEach((target, voter) => {
    if (!gain.hasOwnProperty(voter)) return;
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
              category: '', word: '', options: [], order: [], turn: 0, clues: [], votes: new Map(), stakes: new Set(), mod: MODS[0], opName: '', caseNo: 0, ready: new Set(), result: null, timer: null, deadline: 0, botDone: new Set() };
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

server.listen(PORT, () => console.log(`Mole Hunt on http://localhost:${PORT}`));
