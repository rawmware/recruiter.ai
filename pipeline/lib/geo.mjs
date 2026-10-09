// Coarse location bucketing: enough to show where demand sits without pretending to geocode.
const METROS = [
  ['San Francisco Bay Area', /san francisco|sf bay|bay area|palo alto|mountain view|menlo park|sunnyvale|san jose|south san francisco|redwood city|oakland|berkeley|san mateo|cupertino/i],
  ['New York', /new york|nyc|brooklyn/i],
  ['Seattle', /seattle|bellevue|redmond/i],
  ['Austin', /austin/i],
  ['Boston', /boston|cambridge, ma/i],
  ['Los Angeles', /los angeles|santa monica|el segundo|irvine/i],
  ['Denver / Boulder', /denver|boulder/i],
  ['Chicago', /chicago/i],
  ['London', /london/i],
  ['Toronto', /toronto|vancouver|canada/i],
  ['Berlin / Europe', /berlin|munich|paris|amsterdam|dublin|zurich|stockholm|europe|emea|spain|poland|portugal/i],
  ['India', /india|bangalore|bengaluru|hyderabad|mumbai/i],
  ['Asia-Pacific', /singapore|tokyo|sydney|australia|seoul|apac|japan/i],
];

export function metroOf(location = '') {
  if (/^remote\b/i.test(location.trim()) && !/,/.test(location)) return 'Remote (anywhere)';
  for (const [name, re] of METROS) if (re.test(location)) return name;
  if (/remote/i.test(location)) return 'Remote (anywhere)';
  if (/united states|\busa?\b|, [A-Z]{2}\b/.test(location)) return 'Other US';
  return location ? 'Other' : 'Unspecified';
}
