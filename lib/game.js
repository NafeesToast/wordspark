import {Redis} from '@upstash/redis';
import crypto from 'node:crypto';
import words from './words.json';
const redis=Redis.fromEnv();
const KEY='wordspark:one-game';
const LOCK='wordspark:one-game:lock';
const id=()=>crypto.randomBytes(18).toString('hex');
const shuffle=(arr)=>{let a=[...arr];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const draw=g=>{if(!g.deck.length)g.deck=shuffle(words);return g.deck.pop()};
const match=(sentence,table)=>{const tokens=new Set((sentence.toLowerCase().match(/[a-z]+/g)||[]));return table.filter(w=>tokens.has(w.toLowerCase())||(tokens.has(w.toLowerCase()+'s')))};
const sanitize=s=>String(s||'').trim().slice(0,800);
export function view(g,token){if(!g)return {exists:false};const me=g.players.find(p=>p.token===token);return {exists:true,mode:g.mode,phase:g.phase,players:g.players.map(p=>({id:p.id,name:p.name,score:p.score,connected:Date.now()-p.seen<15000})),myId:me?.id||null,host:!!me&&me.id===g.host,hand:me?.hand||[],table:g.table,actor:g.actor,speaker:g.speaker,openingPlays:g.openingPlays,round:g.round,history:g.history.slice(-15),maxPlayers:g.maxPlayers,version:g.version,ended:g.phase==='ended',winner:g.phase==='ended'?g.players.filter(p=>p.score===Math.max(...g.players.map(x=>x.score))).map(p=>p.name):[]}}
export async function read(token){let g=await redis.get(KEY);return view(g,token)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function action(input){const token=sanitize(input.token).slice(0,100);const type=sanitize(input.type);if(!token||!type)throw Error('Missing identity or action');const lockId=id();let locked=false;
for(let n=0;n<35;n++){const ok=await redis.set(LOCK,lockId,{nx:true,px:5000});if(ok==='OK'){locked=true;break}await sleep(70)}
if(!locked)throw Error('Game is busy; please retry');
try{let g=await redis.get(KEY);let me=g?.players.find(p=>p.token===token);if(type==='create'){
 if(g&&g.phase!=='ended')throw Error('A game already exists. Join it instead.');
 const name=sanitize(input.name).slice(0,24);if(!name)throw Error('Enter a player name');
 const maxPlayers=Number(input.maxPlayers);if(!Number.isInteger(maxPlayers)||maxPlayers<2||maxPlayers>6)throw Error('Choose 2–6 players');
 const mode=input.mode;if(!['spoken','text'].includes(mode))throw Error('Choose a game mode');
 me={id:id(),token,name,score:0,hand:[],seen:Date.now()};g={mode,maxPlayers,phase:'lobby',players:[me],host:me.id,table:[],deck:[],actor:null,speaker:null,openingPlays:0,round:0,history:[],version:0};
 }else{
 if(!g)throw Error('No game yet. Create one!');
 if(type==='join'){
 if(g.phase!=='lobby'&&!me)throw Error('Game already started');
 if(!me){if(g.players.length>=g.maxPlayers)throw Error('Game is full');const name=sanitize(input.name).slice(0,24);if(!name)throw Error('Enter a player name');if(g.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw Error('That name is taken');me={id:id(),token,name,score:0,hand:[],seen:Date.now()};g.players.push(me)}
 }else{
 if(!me)throw Error('You are not in this game');me.seen=Date.now();
 if(type==='start'){if(me.id!==g.host)throw Error('Only the host can start');if(g.phase!=='lobby')throw Error('Already started');if(g.players.length<2)throw Error('At least two players required');g.deck=shuffle(words);for(const p of g.players)p.hand=Array.from({length:6},()=>draw(g));g.actor=g.players[0].id;g.phase='opening';}
 else if(type==='play'){
 if(!['opening','play'].includes(g.phase)||g.actor!==me.id)throw Error('Not your turn to play');const index=Number(input.index);if(!Number.isInteger(index)||index<0||index>=me.hand.length)throw Error('Invalid card');const [word]=me.hand.splice(index,1);me.hand.push(draw(g));g.table.push(word);if(g.table.length>10)g.table.shift();g.history.push({type:'card',player:me.name,word});const next=g.players[(g.players.findIndex(p=>p.id===me.id)+1)%g.players.length];g.speaker=next.id;g.actor=next.id;
 if(g.phase==='opening'){g.openingPlays++;if(g.openingPlays===g.players.length){g.phase='talk';g.speaker=g.players[0].id;g.actor=null;g.history.push({type:'notice',text:'Opening complete! Player 1 begins the conversation.'})}}
 else{g.phase='talk';g.actor=null}
 }
 else if(type==='speak'){
 if(g.phase!=='talk'||g.speaker!==me.id)throw Error('Not your turn to speak');const statement=sanitize(input.statement);if(!statement)throw Error('Enter your statement');const matched=match(statement,g.table);me.score+=matched.length;g.history.push({type:'statement',player:me.name,statement,matched,points:matched.length});g.phase='play';g.actor=me.id;g.speaker=null;g.round++;
 }
 else if(type==='restart'){if(me.id!==g.host)throw Error('Only the host can restart');if(g.players.length<2)throw Error('At least two players required');g.deck=shuffle(words);g.table=[];g.history=[{type:'notice',text:'New game! Everyone plays one card before conversation begins.'}];g.openingPlays=0;g.round=0;g.speaker=null;g.actor=g.players[0].id;g.phase='opening';for(const p of g.players){p.score=0;p.hand=Array.from({length:6},()=>draw(g))}}
 else if(type==='end'){if(me.id!==g.host)throw Error('Only the host can end the game');g.phase='ended'}
 else if(type==='reset'){if(me.id!==g.host)throw Error('Only the host can reset');g.phase='lobby';g.table=[];g.history=[];g.deck=[];g.openingPlays=0;g.round=0;g.actor=null;g.speaker=null;for(const p of g.players){p.score=0;p.hand=[]}}
 else throw Error('Unknown action');
 }
 }
 g.version++;await redis.set(KEY,g);return view(g,token)
 }finally{const script='if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end';await redis.eval(script,[LOCK],[lockId]).catch(()=>{})}
}
