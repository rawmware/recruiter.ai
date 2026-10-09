// Deploy alongside the static dashboard. No model key or GitHub token is stored here.
import crypto from 'node:crypto';
const REPO = 'rawmware/recruiter.ai';
const WORKFLOW = `https://github.com/${REPO}/actions/workflows/mission.yml`;
const RAW = `https://raw.githubusercontent.com/${REPO}/live/`;
const cache = new Map();
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-downloads";
async function read(file) {
  const hit = cache.get(file); if (hit && Date.now()-hit.at<4000) return hit.value;
  const response = await fetch(`${RAW}${file}?t=${Math.floor(Date.now()/5000)}`, { cache:'no-store', signal:AbortSignal.timeout(12000) });
  if (response.status===404) return null;
  if (!response.ok) throw new Error(`Live evidence source returned HTTP ${response.status}`);
  const value = await response.text(); cache.set(file,{at:Date.now(),value});
  if (cache.size>100) cache.delete(cache.keys().next().value);
  return value;
}
function parse(text,fallback) { return text ? JSON.parse(text) : fallback; }
function isId(id) { return typeof id==='string' && /^[a-f0-9-]{36}$/.test(id); }
function validateInput(body) {
  const {goal,projectCount,sources,jobUrls}=body||{};
  if (typeof goal!=='string'||goal.trim().length<12||goal.length>1200||!Number.isInteger(projectCount)||projectCount<1||projectCount>3||!Array.isArray(sources)||sources.length>3||sources.some(s=>!['greenhouse','lever','remotive'].includes(s))||!Array.isArray(jobUrls)||jobUrls.length>5) return false;
  const hosts=['www.indeed.com','indeed.com','boards.greenhouse.io','job-boards.greenhouse.io','jobs.lever.co','jobs.ashbyhq.com','remotive.com'];
  return (sources.length||jobUrls.length) && jobUrls.every(u=>{try{const url=new URL(u);return u.length<2000&&url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&hosts.includes(url.hostname);}catch{return false;}});
}
async function gh(route, token, options={}) {
  const response=await fetch(`https://api.github.com/repos/${REPO}${route}`,{...options,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(`GitHub authorization or action failed (${response.status}). Use a token with repository Actions write access.`);
  return response.status===204?null:response.json();
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const action=req.query?.action;
  try {
    if(req.method==='GET') {
      if(action==='config') return res.json({model:'gpt-5-nano',configured:true,ownerRequired:true,hosted:true,maxProjects:3,workflowUrl:WORKFLOW});
      if(action==='runs') return res.json(parse(await read('runs.json'),[]));
      if(action==='state') {
        const id=req.query.id;
        if(id&&!isId(id)) return res.status(400).json({error:'Invalid run ID'});
        const state=parse(await read(id?`runs/${id}/state.json`:'state.json'),null);
        if(state?.status==='running' && Date.now()-Date.parse(state.updatedAt)>7*60*1000) {state.status='interrupted';state.error='The runner has not reported for over seven minutes. Check its GitHub Actions run.';}
        return res.json(state);
      }
      if(action==='artifact'||action==='preview') {
        const id=req.query.run;if(!isId(id))return res.status(400).json({error:'Invalid run ID'});
        const state=parse(await read(`runs/${id}/state.json`),null);
        const file=action==='preview'?`apps/${req.query.project}/preview.html`:req.query.path;
        if(!state?.artifacts.some(a=>a.path===file))return res.status(404).json({error:'Artifact not found'});
        const content=await read(`runs/${id}/${file}`);if(content===null)return res.status(404).json({error:'Artifact not published yet'});
        if(action==='preview') {res.setHeader('Content-Security-Policy',CSP);res.setHeader('Content-Type','text/html; charset=utf-8');}
        else res.setHeader('Content-Type','text/plain; charset=utf-8');
        return res.send(content);
      }
      return res.status(404).json({error:'Unknown action'});
    }
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    const origin=req.headers.origin;
    if(origin && new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Cross-origin controls are not allowed'});
    const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!token||token.length>500)return res.status(401).json({error:'Use owner controls or launch the mission on GitHub.'});
    const repository=await gh('',token);
    if(!repository.permissions?.push)return res.status(403).json({error:'Only repository collaborators can control missions.'});
    const inflight=await gh('/actions/workflows/mission.yml/runs?per_page=10',token);
    const active=inflight.workflow_runs.filter(r=>['queued','in_progress','waiting','pending','requested'].includes(r.status));
    if(action==='runs') {
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
      if(!validateInput(body))return res.status(400).json({error:'Invalid mission. Choose 1–3 apps, a goal, and supported job sources.'});
      if(active.length)return res.status(409).json({error:'A mission is already queued or running.'});
      await gh('/actions/workflows/mission.yml/dispatches',token,{method:'POST',body:JSON.stringify({ref:'main',inputs:{mission:JSON.stringify(body)}})});
      return res.status(202).json({queued:true,workflowUrl:WORKFLOW});
    }
    if(action==='stop') {
      if(!active.length)return res.status(404).json({error:'No active mission'});
      for(const r of active)await gh(`/actions/runs/${r.id}/cancel`,token,{method:'POST'});
      return res.status(202).json({stopping:true});
    }
    return res.status(404).json({error:'Unknown action'});
  } catch(e) { return res.status(502).json({error:String(e.message).replace(/(?:sk-|gh[pousr]_)[A-Za-z0-9_-]+/g,'[redacted]').slice(0,350)}); }
}
