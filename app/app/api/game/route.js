import {NextResponse} from 'next/server';
import {read,action} from '../../../lib/game';
import crypto from 'node:crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
function failure(error,operation,requestId){
 // Full stack goes to Vercel function logs; never log auth tokens or request bodies.
 console.error(`[WORDSPARK][${requestId}] ${operation} failed`,error);
 const message=error instanceof Error?error.message:String(error);
 const configOrProvider=/redis|upstash|pipeline|fetch failed|connection|timeout|endpoint|authorization|unauthorized|token|invalid url/i.test(message);
 return json({error:configOrProvider?'Game server storage error. Check Vercel function logs and Upstash REST credentials.':message,requestId},configOrProvider?503:400);
}
export async function GET(request){const requestId=crypto.randomUUID().slice(0,8);try{return json(await read(request.nextUrl.searchParams.get('token')||''))}catch(e){return failure(e,'GET /api/game',requestId)}}
export async function POST(request){const requestId=crypto.randomUUID().slice(0,8);try{const body=await request.json();return json(await action(body))}catch(e){return failure(e,'POST /api/game',requestId)}}
