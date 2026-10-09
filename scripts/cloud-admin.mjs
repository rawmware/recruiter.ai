// Operator helper. Reads existing Git authentication in memory; never prints credentials.
import { execFileSync } from 'node:child_process';
import sodium from 'libsodium-wrappers';
const raw=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'});
const fields=Object.fromEntries(raw.trim().split('\n').map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
process.env.GH_TOKEN=fields.password;
const {github,createPublisher}=await import('../server/publisher.mjs');
const command=process.argv[2];
if(command==='secret') {
  if(!process.env.OPENAI_API_KEY)throw new Error('Missing local OpenAI key');
  await sodium.ready;
  const publicKey=await github('/actions/secrets/public-key');
  const encrypted=sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(process.env.OPENAI_API_KEY),sodium.from_base64(publicKey.key,sodium.base64_variants.ORIGINAL)),sodium.base64_variants.ORIGINAL);
  await github('/actions/secrets/OPENAI_API_KEY',{method:'PUT',body:JSON.stringify({encrypted_value:encrypted,key_id:publicKey.key_id})});
  console.log('OPENAI_API_KEY saved as an encrypted recruiter.ai Actions secret.');
} else if(command==='publish') {
  const {getRun,latestRun}=await import('../server/store.mjs');
  const run=process.argv[3]?getRun(process.argv[3]):latestRun();
  if(!run)throw new Error('No run to publish');
  await createPublisher()(run);
} else if(command==='dispatch') {
  await github('/actions/workflows/mission.yml/dispatches',{method:'POST',body:JSON.stringify({ref:'main',inputs:{mission:process.env.MISSION_JSON||''}})});
  console.log('Cloud mission dispatched.');
} else if(command==='status') {
  const result=await github('/actions/workflows/mission.yml/runs?per_page=3');
  console.log(JSON.stringify(result.workflow_runs.map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,url:r.html_url})),null,2));
} else if(command==='jobs') {
  const result=await github(`/actions/runs/${process.argv[3]}/jobs`);
  console.log(JSON.stringify(result.jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion,steps:j.steps})),null,2));
} else if(command==='cancel') {
  await github(`/actions/runs/${process.argv[3]}/cancel`,{method:'POST'});console.log('Run cancellation requested.');
} else if(command==='logs') {
  const response=await fetch(`https://api.github.com/repos/rawmware/recruiter.ai/actions/jobs/${process.argv[3]}/logs`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`}});
  console.log((await response.text()).replace(/(?:sk-|gh[pousr]_)[A-Za-z0-9_-]+/g,'[redacted]').slice(-12000));
} else throw new Error('Use secret, publish, dispatch, status, jobs, logs, or cancel.');
