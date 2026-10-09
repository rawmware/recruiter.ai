import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/recruiter.js';
function response(){return {code:200,headers:{},status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;},json(v){this.body=v;return this;},send(v){this.body=v;return this;}};}
test('hosted configuration contains no secret and advertises real runner',async()=>{
  const res=response();await handler({method:'GET',query:{action:'config'},headers:{}},res);
  assert.equal(res.body.model,'gpt-5-nano');assert.equal(res.body.ownerRequired,true);assert.match(res.body.workflowUrl,/recruiter.ai\/actions/);assert(!JSON.stringify(res.body).includes('sk-'));
});
test('anonymous visitors cannot dispatch paid workflows',async()=>{
  const res=response();await handler({method:'POST',query:{action:'runs'},headers:{},body:{}},res);assert.equal(res.code,401);
});
test('cross-origin control requests are rejected before credentials are used',async()=>{
  const res=response();await handler({method:'POST',query:{action:'runs'},headers:{origin:'https://evil.test',host:'rawmware.com',authorization:'Bearer example'},body:{}},res);assert.equal(res.code,403);
});
test('arbitrary paths and unknown endpoints cannot read server files',async()=>{
  for(const query of [{action:'artifact',run:'../../.env',path:'../../.env'},{action:'state',id:'../../secrets'}]){const res=response();await handler({method:'GET',query,headers:{}},res);assert.equal(res.code,400);}
  const res=response();await handler({method:'GET',query:{action:'secrets'},headers:{}},res);assert.equal(res.code,404);
});
