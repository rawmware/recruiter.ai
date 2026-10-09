import test from 'node:test';
import assert from 'node:assert/strict';
import { RunInput } from '../server/input.mjs';
import { validateEvidence, validateJobUrl } from '../server/research.mjs';
import { validateFiles, bundle } from '../server/validation.mjs';
test('research cannot fetch internal hosts, redirect credentials, or non-HTTPS URLs',()=>{
  for(const u of ['http://www.indeed.com','https://127.0.0.1','https://www.indeed.com.evil.test','https://user:password@www.indeed.com','https://www.indeed.com:444']) assert.throws(()=>validateJobUrl(u));
  assert.equal(validateJobUrl('https://www.indeed.com/viewjob?jk=123').hostname,'www.indeed.com');
});
test('mission limits prevent unbounded fanout and unsupported sources',()=>{
  const good={goal:'Build evidence from product engineering jobs',projectCount:2,sources:['greenhouse'],jobUrls:[]};
  assert.equal(RunInput.safeParse(good).success,true);
  assert.equal(RunInput.safeParse({...good,projectCount:99}).success,false);
  assert.equal(RunInput.safeParse({...good,sources:[],jobUrls:[]}).success,false);
  assert.equal(RunInput.safeParse({...good,jobUrls:['https://localhost/private']}).success,false);
});
test('evidence must exist in the cited source, not another job or generated paraphrase',()=>{
  const jobs=[{id:'job-1',description:'We value building accessible product interfaces for our customers.'}];
  assert.doesNotThrow(()=>validateEvidence([{evidence:[{jobId:'job-1',quote:'building accessible product interfaces'}]}],jobs));
  assert.throws(()=>validateEvidence([{evidence:[{jobId:'job-1',quote:'We prefer React and design systems.'}]}],jobs));
  assert.throws(()=>validateEvidence([{evidence:[{jobId:'job-2',quote:'building accessible product interfaces'}]}],jobs));
});
test('generated apps cannot write arbitrary filenames or load external script packages',()=>{
  const files=[{path:'index.html',content:'<!doctype html><html><body><h1>App</h1><script src="app.js"></script></body></html>'},{path:'styles.css',content:'body{color:black}'},{path:'app.js',content:'document.body.dataset.ready="yes";'}];
  assert.equal(validateFiles(files),true);
  assert.throws(()=>validateFiles([...files.slice(0,2),{path:'../../.env',content:'bad'}]));
  assert.throws(()=>validateFiles([{...files[0],content:files[0].content.replace('app.js','https://example.com/evil.js')},...files.slice(1)]));
  const html=bundle(files);assert.match(html,/Content-Security-Policy/);assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/src="app.js"/);
});
