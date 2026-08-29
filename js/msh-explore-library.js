(() => {
  const form = document.querySelector('[data-explore-form]');
  const input = document.querySelector('[data-explore-question]');
  const submit = document.querySelector('[data-explore-submit]');
  const answer = document.querySelector('[data-explore-answer]');
  const main = document.querySelector('[data-answer-main]');
  const strength = document.querySelector('[data-answer-strength]');
  const count = document.querySelector('[data-answer-count]');
  const known = document.querySelector('[data-answer-known]');
  const unknown = document.querySelector('[data-answer-unknown]');
  const sources = document.querySelector('[data-answer-sources]');
  const sourceLabel = document.querySelector('[data-source-label]');

  document.querySelectorAll('[data-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      input.value = button.dataset.prompt || button.textContent.trim();
      input.focus();
    });
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    submit.disabled = true;
    submit.textContent = 'Looking through the research…';
    answer.classList.add('is-visible');
    main.textContent = 'I’m looking through relevant scholarly research before answering.';
    known.textContent = '';
    unknown.textContent = '';
    sources.innerHTML = '';

    try {
      const response = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Explore could not answer that right now.');

      main.textContent = data.plainLanguageAnswer || data.summary || 'I found research, but could not create a clear answer.';
      strength.textContent = `Evidence: ${formatLabel(data.evidenceStrength || 'unknown')}`;
      count.textContent = `${data.sourceCount || 0} scholarly source${data.sourceCount === 1 ? '' : 's'}`;
      known.textContent = data.whatWeKnow || 'The available research did not support a clear takeaway.';
      unknown.textContent = data.whatWeDontKnowYet || data.limitations || 'No major uncertainty was returned.';

      const sourceItems = Array.isArray(data.sources) ? data.sources : [];
      sourceLabel.textContent = `See the research (${sourceItems.length})`;
      sourceItems.forEach(source => {
        const item = document.createElement('div');
        item.className = 'source-item';
        const link = document.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.title || `PubMed ${source.pmid}`;
        const meta = document.createElement('small');
        meta.textContent = [source.journal, source.publicationDate, formatLabel(source.evidenceDesign)].filter(Boolean).join(' · ');
        item.append(link, meta);
        sources.append(item);
      });
    } catch (error) {
      main.textContent = error.message || 'I couldn’t complete the evidence search right now. Please try again.';
      strength.textContent = 'Evidence search unavailable';
      count.textContent = '';
      known.textContent = 'No answer was generated without completing the evidence search.';
      unknown.textContent = 'Try the question again in a moment.';
      sourceLabel.textContent = 'Research sources';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Ask Explore →';
      answer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  function formatLabel(value) {
    return String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
})();
