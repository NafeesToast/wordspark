import {NextResponse} from 'next/server';
import {read,action} from '../../../lib/game';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){try{return json(await read(request.nextUrl.searchParams.get('token')||''))}catch(e){return json({error:'Service unavailable'},503)}}
export async function POST(request){try{const body=await request.json();return json(await action(body))}catch(e){return json({error:e.message||'Request failed'},400)}}
