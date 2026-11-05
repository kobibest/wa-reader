// "Built by" credit – Eitan | Organizational Digitization
export function byline(campaign, { compact = false, cta = 'לאתר ←', sub = 'נבנה על ידי' } = {}) {
  const a = document.createElement('a');
  a.className = 'byline' + (compact ? ' compact' : '');
  a.href = `https://digital.m-eitan.co.il/?utm_source=wa-reader&utm_medium=extension&utm_campaign=${encodeURIComponent(campaign)}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.innerHTML = '<img class="mark-light" src="eitan-mark.svg" alt=""><img class="mark-dark" src="eitan-mark-light.svg" alt="">' +
    '<span><small></small><b>איתן | דיגיטציה ארגונית</b></span><span class="cta"></span>';
  a.querySelector('small').textContent = sub;
  a.querySelector('.cta').textContent = cta;
  return a;
}
