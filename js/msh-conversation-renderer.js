/* My Simple Health — safe conversational response renderer */
(function (root) {
  'use strict';

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')
      .replace(/\\([\\`*_[\]{}()#+\-.!>,?:;])/g, '$1')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function inlineSegments(value) {
    const text = String(value || '');
    const pattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`)/g;
    const result = [];
    let index = 0;
    let match;
    while ((match = pattern.exec(text))) {
      if (match.index > index) result.push({ type:'text', text:text.slice(index, match.index) });
      const token = match[0];
      if (token.startsWith('`')) result.push({ type:'code', text:token.slice(1, -1) });
      else result.push({ type:'strong', text:token.slice(2, -2) });
      index = pattern.lastIndex;
    }
    if (index < text.length) result.push({ type:'text', text:text.slice(index) });
    return result;
  }

  function blocks(value) {
    const normalized = normalizeText(value);
    if (!normalized) return [];
    return normalized.split(/\n{2,}/).map(block => {
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      const isList = lines.length > 0 && lines.every(line => /^[-*]\s+/.test(line));
      if (isList) {
        return { type:'list', items:lines.map(line => line.replace(/^[-*]\s+/, '')) };
      }
      const prose = lines.map(line => line.replace(/^#{1,6}\s+/, '')).join(' ');
      return { type:'paragraph', text:prose };
    }).filter(block => block.type === 'list' ? block.items.length : block.text);
  }

  function appendInline(documentRef, parent, value) {
    inlineSegments(value).forEach(segment => {
      if (segment.type === 'text') parent.appendChild(documentRef.createTextNode(segment.text));
      else {
        const element = documentRef.createElement(segment.type === 'code' ? 'code' : 'strong');
        element.textContent = segment.text;
        parent.appendChild(element);
      }
    });
  }

  function render(element, value) {
    if (!element) return;
    const documentRef = element.ownerDocument || root.document;
    while (element.firstChild) element.removeChild(element.firstChild);
    element.classList.add('hello-prose');
    blocks(value).forEach(block => {
      if (block.type === 'list') {
        const list = documentRef.createElement('ul');
        block.items.forEach(item => {
          const listItem = documentRef.createElement('li');
          appendInline(documentRef, listItem, item);
          list.appendChild(listItem);
        });
        element.appendChild(list);
      } else {
        const paragraph = documentRef.createElement('p');
        appendInline(documentRef, paragraph, block.text);
        element.appendChild(paragraph);
      }
    });
  }

  root.MSHConversationRenderer = Object.freeze({ normalizeText, inlineSegments, blocks, render });
})(typeof window !== 'undefined' ? window : globalThis);
