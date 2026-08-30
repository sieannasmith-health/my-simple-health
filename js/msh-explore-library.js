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
  let answering = false;

  document.querySelectorAll('[data-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      input.value = button.dataset.prompt || button.textContent.trim();
      input.focus();
    });
  });

  async function answerQuestion(question) {
    if (!question || answering) return;
    answering = true;
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
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ question })
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Explore is not connected to its evidence service on this deployment yet.');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Explore could not answer that right now.');

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
      main.textContent = error.message || 'Explore is temporarily unavailable.';
      strength.textContent = 'Evidence service unavailable';
      count.textContent = '';
      known.textContent = 'MSH will not generate a health answer when the evidence service has not completed successfully.';
      unknown.textContent = 'Your question has been kept. You can try the evidence search again without re-entering it.';
      sourceLabel.textContent = 'Research sources';
    } finally {
      answering = false;
      submit.disabled = false;
      submit.textContent = 'Ask Explore →';
      answer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  form?.addEventListener('submit', event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    answerQuestion(question);
  });

  const carriedQuestion = new URLSearchParams(window.location.search).get('q');
  if (carriedQuestion && input) {
    input.value = carriedQuestion.slice(0, 1000);
    requestAnimationFrame(() => answerQuestion(input.value.trim()));
  }

  function formatLabel(value) {
    return String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
})();