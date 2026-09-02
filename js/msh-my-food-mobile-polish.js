/* My Simple Health — mobile polish for My Food */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-food]');
  if (!root) return;

  function polish() {
    const groceryPanel = [...root.querySelectorAll('.msh-food-panel')]
      .find(panel => panel.querySelector('h2')?.textContent.trim() === 'Grocery List');

    if (groceryPanel) {
      groceryPanel.querySelector('[data-view="home"]')?.remove();
      const addItemButton = groceryPanel.querySelector('[data-add-grocery]');
      if (addItemButton && addItemButton.textContent.trim() !== 'Add item') {
        addItemButton.textContent = 'Add item';
      }
    }

    root.querySelectorAll('[data-add-grocery]').forEach(button => {
      const strong = button.querySelector('strong');
      if (strong && strong.textContent.trim() === 'Add grocery') {
        strong.textContent = 'Add item';
      }
    });

    const dialog = root.querySelector('[data-food-dialog]');
    if (dialog && !dialog.hidden) {
      dialog.querySelectorAll('h2').forEach(heading => {
        if (heading.textContent.trim() === 'Add grocery') heading.textContent = 'Add item';
      });
    }
  }

  const observer = new MutationObserver(polish);
  observer.observe(root, { childList: true, subtree: true });
  polish();
})();
