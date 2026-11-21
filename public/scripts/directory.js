(() => {
  const root = document.querySelector('[data-tool-list]');
  const input = document.querySelector('#tool-search');
  const dataNode = document.querySelector('#directory-data');
  if (!root || !input || !dataNode) return;

  const tools = JSON.parse(dataNode.textContent || '[]');
  const rows = [...root.querySelectorAll('[data-tool]')];
  const count = document.querySelector('[data-result-count]');
  const empty = document.querySelector('[data-empty-state]');
  const emptyDescription = document.querySelector('[data-empty-description]');
  const activeFilters = document.querySelector('[data-active-filters]');
  const panel = document.querySelector('#filter-panel');
  const trigger = document.querySelector('.filter-trigger');
  const filterCount = document.querySelector('[data-filter-count]');
  const state = { query: '', category: 'All tools', platforms: new Set() };

  const normalize = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const getHaystack = (tool) => normalize([
    tool.name,
    tool.description,
    tool.category,
    ...(tool.aliases || []),
    ...(tool.platforms || []),
  ].join(' '));

  const setCategory = (category) => {
    state.category = category;
    document.querySelectorAll('[data-category], [data-filter-category]').forEach((button) => {
      const active = (button.dataset.category || button.dataset.filterCategory) === category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    render();
  };

  const clearAll = () => {
    state.query = '';
    state.category = 'All tools';
    state.platforms.clear();
    input.value = '';
    document.querySelectorAll('[data-platform]').forEach((box) => { box.checked = false; });
    setCategory('All tools');
    input.focus({ preventScroll: true });
  };

  const removeFilter = (type, value) => {
    if (type === 'query') {
      state.query = '';
      input.value = '';
    }
    if (type === 'category') setCategory('All tools');
    if (type === 'platform') {
      state.platforms.delete(value);
      const box = [...document.querySelectorAll('[data-platform]')].find((item) => item.value === value);
      if (box) box.checked = false;
    }
    render();
  };

  const makeFilterButton = (label, type, value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'active-filter';
    button.innerHTML = `<span>${label}</span><span aria-hidden="true">×</span>`;
    button.setAttribute('aria-label', `Remove filter: ${label}`);
    button.addEventListener('click', () => removeFilter(type, value));
    return button;
  };

  function render() {
    const query = normalize(state.query);
    const tokens = query.split(/\s+/).filter(Boolean);
    let visible = 0;

    tools.forEach((tool, index) => {
      const matchesQuery = !tokens.length || tokens.every((token) => getHaystack(tool).includes(token));
      const matchesCategory = state.category === 'All tools' || tool.category === state.category;
      const matchesPlatforms = [...state.platforms].every((platform) => tool.platforms.includes(platform));
      const show = matchesQuery && matchesCategory && matchesPlatforms;
      rows[index].hidden = !show;
      if (show) visible += 1;
    });

    count.textContent = `${visible} ${visible === 1 ? 'tool' : 'tools'}`;
    empty.hidden = visible !== 0;
    root.hidden = visible === 0;

    const filters = [];
    if (state.query.trim()) filters.push({ label: `Search: “${state.query.trim()}”`, type: 'query', value: state.query });
    if (state.category !== 'All tools') filters.push({ label: state.category, type: 'category', value: state.category });
    state.platforms.forEach((platform) => filters.push({ label: platform, type: 'platform', value: platform }));

    activeFilters.replaceChildren(...filters.map((filter) => makeFilterButton(filter.label, filter.type, filter.value)));
    activeFilters.hidden = filters.length === 0;
    filterCount.textContent = String(filters.length - (state.query.trim() ? 1 : 0));
    filterCount.hidden = filters.length - (state.query.trim() ? 1 : 0) === 0;

    if (visible === 0) {
      const labels = filters.map((filter) => filter.label).join(', ');
      emptyDescription.textContent = labels
        ? `Active filters: ${labels}. Remove one or start again.`
        : 'Try a broader search.';
    }
  }

  input.addEventListener('input', () => {
    state.query = input.value;
    render();
  });

  input.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    document.querySelector('#directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => setCategory(button.dataset.category));
  });
  document.querySelectorAll('[data-filter-category]').forEach((button) => {
    button.addEventListener('click', () => setCategory(button.dataset.filterCategory));
  });
  document.querySelectorAll('[data-platform]').forEach((box) => {
    box.addEventListener('change', () => {
      if (box.checked) state.platforms.add(box.value);
      else state.platforms.delete(box.value);
      render();
    });
  });
  document.querySelectorAll('[data-clear-filters]').forEach((button) => button.addEventListener('click', clearAll));

  const closePanel = () => {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };
  trigger.addEventListener('click', () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    trigger.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) panel.querySelector('button')?.focus();
  });
  document.querySelector('[data-close-filters]')?.addEventListener('click', closePanel);

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isEditing = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || target?.isContentEditable;

    if (event.key === '/' && !isEditing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      input.focus();
    }
    if (event.key === 'Escape' && !panel.hidden) {
      closePanel();
      trigger.focus();
    }
  });

  render();
})();
