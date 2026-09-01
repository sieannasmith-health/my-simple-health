/* My Simple Health — human-readable medication outreach labels */
(function (root) {
  'use strict';

  const host = root.document && root.document.querySelector('[data-medication-continuity]');
  if (!host) return;

  const fieldCopy = Object.freeze({
    portal: Object.freeze({
      label: 'Patient portal / provider',
      placeholder: 'Portal name or provider (optional)',
      help: 'MSH will prepare the request for you to review and copy into the secure portal.'
    }),
    sms: Object.freeze({
      label: 'Phone number',
      placeholder: 'e.g. 317-555-1234',
      help: 'Where should MSH address the text after you approve it?'
    }),
    email: Object.freeze({
      label: 'Email address',
      placeholder: 'e.g. office@example.com',
      help: 'Where should MSH address the email after you approve it?'
    })
  });

  function updateContactField() {
    const form = host.querySelector('[data-med-form]');
    if (!form) return;

    const method = form.querySelector('select[name="contactMethod"]');
    const input = form.querySelector('input[name="contactValue"]');
    if (!method || !input) return;

    const label = input.closest('label');
    if (!label) return;

    const copy = fieldCopy[method.value] || fieldCopy.portal;
    let title = label.querySelector('[data-contact-field-label]');
    if (!title) {
      const textNode = Array.from(label.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      title = root.document.createElement('span');
      title.dataset.contactFieldLabel = 'true';
      if (textNode) label.insertBefore(title, textNode);
      else label.insertBefore(title, input);
      if (textNode) textNode.remove();
    }
    title.textContent = copy.label;

    input.placeholder = copy.placeholder;
    input.autocomplete = method.value === 'email' ? 'email' : method.value === 'sms' ? 'tel' : 'off';
    input.inputMode = method.value === 'email' ? 'email' : method.value === 'sms' ? 'tel' : 'text';
    input.setAttribute('aria-describedby', 'medication-contact-help');

    let help = form.querySelector('#medication-contact-help');
    if (!help) {
      help = root.document.createElement('small');
      help.id = 'medication-contact-help';
      help.className = 'msh-med-contact-help';
      label.appendChild(help);
    }
    help.textContent = copy.help;
  }

  host.addEventListener('change', event => {
    if (event.target && event.target.matches('select[name="contactMethod"]')) updateContactField();
  });

  new MutationObserver(updateContactField).observe(host, { childList: true, subtree: true });
  updateContactField();
})(typeof window !== 'undefined' ? window : globalThis);
