import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTitle, seniorityOf, workModeOf } from '../pipeline/lib/classify.mjs';

test('classifies target tracks', () => {
  assert.equal(classifyTitle('Senior Software Engineer, Payments'), 'software');
  assert.equal(classifyTitle('Machine Learning Engineer'), 'ml');
  assert.equal(classifyTitle('Applied AI Engineer, Agents'), 'ai');
  assert.equal(classifyTitle('Research Scientist, LLM Post-training'), 'ai');
  assert.equal(classifyTitle('Data Scientist'), 'ml');
});
test('rejects non-engineering and ambiguous roles', () => {
  assert.equal(classifyTitle('Account Executive'), null);
  assert.equal(classifyTitle('Technical Recruiter'), null);
  assert.equal(classifyTitle('Product Designer'), null);
  assert.equal(classifyTitle('Mechanical Engineer'), null);
  assert.equal(classifyTitle(''), null);
});
test('seniority ladder', () => {
  assert.equal(seniorityOf('Staff Engineer'), 'staff');
  assert.equal(seniorityOf('Sr. Backend Developer'), 'senior');
  assert.equal(seniorityOf('Software Engineer Intern'), 'intern');
  assert.equal(seniorityOf('Software Engineer'), 'mid');
});
test('work mode', () => {
  assert.equal(workModeOf('Remote - US'), 'remote');
  assert.equal(workModeOf('New York, NY'), 'onsite');
  assert.equal(workModeOf('San Francisco (Hybrid)'), 'hybrid');
});
