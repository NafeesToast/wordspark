import {Redis} from '@upstash/redis';
import crypto from 'node:crypto';
import words from './words.json';
function getRedis(){
 const url=process.env.UPSTASH_REDIS_REST_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN;
 if(!url||!token)throw new Error('Redis not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel environment variables.');
 try{const u=new URL(url);if(u.protocol!=='https:')throw Error('HTTPS required');}
 catch{throw new Error('Invalid UPSTASH_REDIS_REST_URL: use the HTTPS REST endpoint from Upstash, not a redis:// connection string.');}
 return new Redis({url,token});
}
const redis=new Proxy({}, {get(_target,property){const client=getRedis();const value=client[property];return typeof value==='function'?value.bind(client):value}});
const KEY='wordspark:one-game';
export const AVATARS=["🦊", "🐼", "🐸", "🦄", "🐙", "🦋", "🐨", "🐧", "🐱", "🐻", "🐰", "🐢", "🐯", "🦁", "🐮", "🐷", "🐵", "🐔", "🐣", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦓", "🦒", "🦌", "🦬", "🐘", "🦏", "🦛", "🦘", "🦥", "🦦", "🦨", "🦡", "🦔", "🐿️", "🦫", "🐾", "🐶", "🐩", "🐕", "🦮", "🐈", "🐈\u200d⬛", "🦜", "🦚", "🦩", "🦢", "🦤", "🐦", "🐦\u200d⬛", "🦭", "🐬", "🐳", "🐋", "🦈", "🐟", "🐠", "🐡", "🦀", "🦞", "🦐", "🦑", "🪼", "🐚", "🐌", "🐛", "🐝", "🐞", "🦗", "🕷️", "🦂", "🐍", "🦎", "🐊", "🦖", "🦕", "🐲", "🐉", "🦧", "🦍", "🦣", "🐪", "🐫", "🦙", "🐐", "🐑", "🐏", "🐃", "🐂", "🐄", "🐖", "🐎", "🐇", "🦝", "🐁", "🐀", "🐹", "🐭", "🐻\u200d❄️", "🤖", "👽", "👻", "🧙", "🧚", "🧜", "🦸"];
const LOCK='wordspark:one-game:lock';
export const SPECIAL_TYPES=['Destroy','Skip','Swap','Deny','Double','Reverse','Encore','Bonus','Freeze','Remix'];
export const SPECIALS=SPECIAL_TYPES.flatMap(type=>Array.from({length:10},(_,n)=>`⚡ ${type} #${n+1}`));
const kind=w=>typeof w==='string'&&w.startsWith('⚡ ')?w.slice(2).split(' #')[0]:null;
const freshDeck=()=>shuffle([...words,...SPECIALS]);
const nextPlayer=(g,id,step=1)=>g.players[(g.players.findIndex(p=>p.id===id)+step+g.players.length*10)%g.players.length].id;
const eligibleTargets=g=>g.table.map((word,index)=>({word,index}));
const finishDraw=g=>{if(g.openingPlays===g.players.length&&g.round===0){g.phase='talk';g.speaker=g.players[0].id;g.actor=null;g.history.push({type:'notice',text:'Opening complete! Player 1 begins the conversation.'})}else if(g.round===0){g.phase='opening';g.actor=g.speaker;g.speaker=null}else if(g.specialPending){g.phase='reaction';g.actor=null}else{g.phase='talk';g.actor=null}};
function applySpecial(g){const e=g.specialPending;if(!e)return;const {type,player,target}=e;const owner=g.players.find(p=>p.id===player);const next=g.speaker;const table=g.table;
 if(type==='Destroy'&&table.length)table.splice(target,1);
 if(type==='Swap'&&table.length){const old=table[target];table[target]=draw(g);g.deck.push(old)}
 if(type==='Skip')g.speaker=nextPlayer(g,next);
 if(type==='Reverse'){g.direction=(g.direction||1)*-1;g.speaker=nextPlayer(g,player,g.direction)}
 if(type==='Double')g.doubleFor=g.speaker;
 if(type==='Encore')g.speaker=player;
 if(type==='Bonus')owner.score+=2;
 if(type==='Freeze')g.frozen=g.speaker;
 if(type==='Remix'){g.table=shuffle(g.table)}
 g.history.push({type:'notice',text:`⚡ ${owner.name} activated ${type}!${type==='Destroy'?' Removed '+(e.targetWord||'a word')+'.':''}`});g.specialPending=null;g.phase='talk';finishIfWon(g);}

const id=()=>crypto.randomBytes(18).toString('hex');
const shuffle=(arr)=>{let a=[...arr];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const draw=g=>{if(!g.deck.length)g.deck=freshDeck();return g.deck.pop()};
const match=(sentence,table)=>{const tokens=new Set((sentence.toLowerCase().match(/[a-z]+/g)||[]));return table.filter(w=>tokens.has(w.toLowerCase())||(tokens.has(w.toLowerCase()+'s')))};
const sanitize=s=>String(s||'').trim().slice(0,800);
// Transparent, deterministic heuristic ratings. No AI service or peer voting.
const playfulWords=new Set('funny silly hilarious giggle laugh laughing banana pickle unicorn dragon fart dancing wobbly ridiculous goofy surprise exploded rainbow spaghetti sneaky magical absurd'.split(' '));
const imageryWords=new Set('like imagine suddenly because although while until whisper sparkle mystery enormous tiny secret adventure flying invisible moon ocean castle robot wizard'.split(' '));
function autoRate(statement,matched,table){
 const tokens=(statement.toLowerCase().match(/[a-z]+/g)||[]);
 const unique=new Set(tokens);const n=tokens.length;
 const imagery=[...unique].filter(w=>imageryWords.has(w)).length;
 const playful=[...unique].filter(w=>playfulWords.has(w)).length;
 const creativity=Math.min(5,Math.max(1,1+Math.min(2,imagery)+Number(n>=12)+Number(/[!?]/.test(statement))));
 const funny=Math.min(5,Math.max(1,1+Math.min(3,playful)+Number(/[!?]/.test(statement))));
 const ratio=matched.length/Math.max(1,n);
 const efficiency=Math.min(5,Math.max(1,1+Math.min(2,Math.floor(matched.length/2))+Number(ratio>=.15)+Number(ratio>=.3)));
 const stars=Math.max(1,Math.min(5,Math.round((creativity+funny+efficiency)/3)));
 return {creativity,funny,efficiency,stars,method:'heuristic-v1'};
}
function finishIfWon(g){if(g.winCondition?.type==='points'&&g.players.some(p=>p.score>=g.winCondition.target)){
 g.phase='ended';g.actor=null;g.speaker=null;g.pending=null;g.specialPending=null;
 g.history.push({type:'notice',text:`🏆 Game over! First to ${g.winCondition.target} points reached.`});return true;
 }return false;}
export function view(g,token){if(!g)return {exists:false};const me=g.players.find(p=>p.token===token);return {exists:true,mode:g.mode,phase:g.phase,players:g.players.map(p=>({id:p.id,name:p.name,score:p.score,avatar:p.avatar||AVATARS[g.players.indexOf(p)%AVATARS.length],connected:Date.now()-p.seen<15000})),myId:me?.id||null,host:!!me&&me.id===g.host,hand:me?.hand||[],choices:g.phase==='draw'&&g.pending?.player===me?.id?g.pending.choices:[],specialPending:g.phase==='reaction'?{type:g.specialPending?.type,player:g.specialPending?.player,targetWord:g.specialPending?.targetWord,canDeny:g.speaker===me?.id&&me?.hand.some(w=>kind(w)==='Deny')}:null,direction:g.direction||1,allSpecialTypes:SPECIAL_TYPES,table:g.table,actor:g.actor,speaker:g.speaker,openingPlays:g.openingPlays,round:g.round,history:g.history.slice(-15),maxPlayers:g.maxPlayers,winCondition:g.winCondition||{type:'points',target:50},version:g.version,ended:g.phase==='ended',winner:g.phase==='ended'?g.players.filter(p=>p.score===Math.max(...g.players.map(x=>x.score))).map(p=>p.name):[]}}
export async function read(token){let g=await redis.get(KEY);return view(g,token)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function action(input){const token=sanitize(input.token).slice(0,100);const type=sanitize(input.type);if(!token||!type)throw Error('Missing identity or action');const lockId=id();let locked=false;
for(let n=0;n<35;n++){const ok=await redis.set(LOCK,lockId,{nx:true,px:5000});if(ok==='OK'){locked=true;break}await sleep(70)}
if(!locked)throw Error('Game is busy; please retry');
try{let g=await redis.get(KEY);let me=g?.players.find(p=>p.token===token);if(type==='create'){
 if(g&&g.phase!=='ended')throw Error('A game is already in setup or in progress. Join it instead.');
 // A finished game is unclaimed: any visitor can become the next host.
 const name=sanitize(input.name).slice(0,24);if(!name)throw Error('Enter a player name');
 const maxPlayers=Number(input.maxPlayers);if(!Number.isInteger(maxPlayers)||maxPlayers<2||maxPlayers>6)throw Error('Choose 2–6 players');
 const mode=input.mode;if(!['spoken','text'].includes(mode))throw Error('Choose a game mode');
 const winTarget=Number(input.winTarget??50);if(![25,50,75,100,150,200].includes(winTarget))throw Error('Choose a valid winning score');
 me={id:id(),token,name,score:0,avatar:AVATARS[0],hand:[],seen:Date.now()};g={mode,maxPlayers,winCondition:{type:'points',target:winTarget},phase:'lobby',players:[me],host:me.id,table:[],deck:[],actor:null,speaker:null,openingPlays:0,round:0,history:[],pending:null,specialPending:null,direction:1,doubleFor:null,frozen:null,version:0};
 }else{
 if(!g)throw Error('No game yet. Create one!');
 if(type==='join'){
 if(g.phase!=='lobby'&&!me)throw Error('Game already started');
 if(!me){if(g.players.length>=g.maxPlayers)throw Error('Game is full');const name=sanitize(input.name).slice(0,24);if(!name)throw Error('Enter a player name');if(g.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw Error('That name is taken');me={id:id(),token,name,score:0,avatar:AVATARS[g.players.length%AVATARS.length],hand:[],seen:Date.now()};g.players.push(me)}
 }else{
 if(!me)throw Error('You are not in this game');me.seen=Date.now();
 if(type==='avatar'){if(!AVATARS.includes(input.avatar))throw Error('Invalid avatar');me.avatar=input.avatar}
 else if(type==='rename'){const next=sanitize(input.name).slice(0,24).trim();if(!next)throw Error('Enter a player name');if(g.players.some(p=>p.id!==me.id&&p.name.toLowerCase()===next.toLowerCase()))throw Error('That name is taken');me.name=next;for(const h of g.history){if(h.playerId===me.id)h.player=next}}
 else if(type==='start'){if(me.id!==g.host)throw Error('Only the host can start');if(g.phase!=='lobby')throw Error('Already started');if(g.players.length<2)throw Error('At least two players required');g.deck=freshDeck();for(const p of g.players){p.hand=Array.from({length:6},()=>draw(g));if(p.hand.every(w=>kind(w)))p.hand[0]=words[crypto.randomInt(words.length)];if(p.hand.every(w=>kind(w))){const word=words[crypto.randomInt(words.length)];p.hand[0]=word}}g.actor=g.players[0].id;g.phase='opening';}
 else if(type==='play'){
 if(!['opening','play'].includes(g.phase)||g.actor!==me.id)throw Error('Not your turn to play');const index=Number(input.index);if(!Number.isInteger(index)||index<0||index>=me.hand.length)throw Error('Invalid card');const word=me.hand[index],special=kind(word);
 if(g.phase==='opening'&&special)throw Error('Opening round requires a normal word card');
 if(g.frozen===me.id&&special)throw Error('You are frozen! Play a normal word this turn.');
 if(special==='Deny')throw Error('Deny can only be played as a reaction to another special card');
 if(special&&['Destroy','Swap'].includes(special)&&!g.table.length)throw Error('No table cards to target');
 const target=Number(input.target);if(special&&['Destroy','Swap'].includes(special)&&(!Number.isInteger(target)||target<0||target>=g.table.length))throw Error('Choose a table card to target');
 me.hand.splice(index,1);const choices=Array.from({length:3},()=>draw(g));g.pending={player:me.id,choices};
 if(!special){g.table.push(word);if(g.table.length>10)g.table.shift();g.history.push({type:'card',player:me.name,word});}
 else {g.specialPending={type:special,player:me.id,target,targetWord:g.table[target]};g.history.push({type:'notice',text:`⚡ ${me.name} played ${special}! Waiting for a possible Deny.`})}
 const next=nextPlayer(g,me.id,g.direction||1);g.speaker=next;g.actor=null;
 if(g.phase==='opening')g.openingPlays++;g.phase='draw';
 if(g.frozen===me.id)g.frozen=null;
 }
 else if(type==='pick'){if(g.phase!=='draw'||g.pending?.player!==me.id)throw Error('Not your card pick');const index=Number(input.index);if(!Number.isInteger(index)||index<0||index>=g.pending.choices.length)throw Error('Invalid choice');me.hand.push(g.pending.choices[index]);g.deck.push(...g.pending.choices.filter((_,i)=>i!==index));g.deck=shuffle(g.deck);g.pending=null;finishDraw(g)}
 else if(type==='resolve'){if(g.phase!=='reaction'||!g.specialPending)throw Error('No special card to resolve');if(g.speaker!==me.id)throw Error('Only the next player may respond');if(input.deny){const i=me.hand.findIndex(w=>kind(w)==='Deny');if(i<0)throw Error('You do not have a Deny card');me.hand.splice(i,1);me.hand.push(draw(g));g.history.push({type:'notice',text:`🛡️ ${me.name} denied ${g.specialPending.type}!`});g.specialPending=null;g.phase='talk'}else applySpecial(g)}
 else if(type==='speak'){
 if(g.phase!=='talk'||g.speaker!==me.id)throw Error('Not your turn to speak');const statement=sanitize(input.statement);if(!statement)throw Error('Enter your statement');const matched=match(statement,g.table);const wordPoints=matched.length*(g.doubleFor===me.id?2:1);
 const rating=autoRate(statement,matched,g.table);const points=wordPoints+rating.stars;
 me.score+=points;if(g.doubleFor===me.id)g.doubleFor=null;
 g.history.push({type:'statement',id:id(),playerId:me.id,player:me.name,statement,matched,points,wordPoints,ratings:rating,ratingBonus:rating.stars});
 g.phase='play';g.actor=me.id;g.speaker=null;g.round++;finishIfWon(g);
 }
 else if(type==='configure'){
  if(me.id!==g.host)throw Error('Only the host can configure the game');
  if(g.phase!=='lobby')throw Error('Settings can only change before starting');
  const target=Number(input.winTarget), maximum=Number(input.maxPlayers);
  if(!['spoken','text'].includes(input.mode))throw Error('Choose a valid game mode');
  if(![25,50,75,100,150,200].includes(target))throw Error('Choose a valid winning score');
  if(!Number.isInteger(maximum)||maximum<2||maximum>6||maximum<g.players.length)throw Error('Player limit must fit everyone already joined (2–6)');
  g.mode=input.mode;g.maxPlayers=maximum;g.winCondition={type:'points',target};
 }
 else if(['restart','reset','end'].includes(type)){
  if(me.id!==g.host)throw Error('Only the host can change the game');
  // All devices return to the initial setup/lobby together. Keep player identities,
  // so nobody has to rejoin; reset retains settings, end restores defaults.
  if(type==='end') {g.mode='spoken';g.maxPlayers=2;g.winCondition={type:'points',target:50};g.players=[me];g.host=me.id;}
  g.phase='lobby';g.table=[];g.deck=[];g.history=[];g.pending=null;
  g.specialPending=null;g.direction=1;g.doubleFor=null;g.frozen=null;
  g.openingPlays=0;g.round=0;g.actor=null;g.speaker=null;
  for(const p of g.players){p.score=0;p.hand=[]}
 }
 else throw Error('Unknown action');
 }
 }
 g.version++;await redis.set(KEY,g);return view(g,token)
 }finally{const script='if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end';await redis.eval(script,[LOCK],[lockId]).catch(()=>{})}
}
