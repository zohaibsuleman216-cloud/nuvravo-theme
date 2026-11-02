// Nuvravo product page behaviour: option pills -> variant, price/stock/URL/image updates,
// gallery slider with thumbnails, quantity stepper and the sticky buy bar.
// Add to cart itself is handled by nv-cart.js ([data-nv-product-form]).

const money = (cents) => {
  const format = window.Shopify?.currency?.active || 'USD';
  return new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency: format }).format(cents / 100);
};

for (const root of document.querySelectorAll('[data-nv-product]:not([data-ready])')) {
  root.dataset.ready = 'true';
  const variants = JSON.parse(root.querySelector('[data-nv-variants]')?.textContent || '[]');
  const form = root.querySelector('[data-nv-product-form]');
  const idInput = root.querySelector('[data-nv-variant-id]');
  const slides = root.querySelector('[data-nv-slides]');
  const thumbs = [...root.querySelectorAll('[data-nv-thumb]')];
  const sticky = root.querySelector('[data-nv-sticky]');

  // ---------- Gallery ----------
  const slideEls = slides ? [...slides.children] : [];
  const goTo = (index) => {
    const target = slideEls[Math.max(0, Math.min(index, slideEls.length - 1))];
    if (target && slides) slides.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
  };
  const currentIndex = () => (slides ? Math.round(slides.scrollLeft / Math.max(slides.clientWidth, 1)) : 0);
  root.querySelector('[data-nv-prev]')?.addEventListener('click', () => goTo(currentIndex() - 1));
  root.querySelector('[data-nv-next]')?.addEventListener('click', () => goTo(currentIndex() + 1));
  for (const thumb of thumbs) {
    thumb.addEventListener('click', () => {
      const index = slideEls.findIndex((s) => s.dataset.mediaId === thumb.dataset.nvThumb);
      goTo(index);
    });
  }
  if (slides && thumbs.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.dataset.mediaId;
          for (const t of thumbs) t.setAttribute('aria-current', String(t.dataset.nvThumb === id));
          thumbs.find((t) => t.dataset.nvThumb === id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      },
      { root: slides, threshold: 0.6 }
    );
    for (const s of slideEls) io.observe(s);
  }

  // ---------- Quantity ----------
  const qty = root.querySelector('input[name="quantity"]');
  for (const btn of root.querySelectorAll('[data-nv-qty]')) {
    btn.addEventListener('click', () => {
      if (!qty) return;
      qty.value = String(Math.max(1, (Number(qty.value) || 1) + Number(btn.dataset.nvQty)));
    });
  }

  // ---------- Variants ----------
  const optionInputs = [...root.querySelectorAll('[data-nv-option]')];
  const selectedOptions = () => {
    const values = [];
    for (const input of optionInputs) if (input.checked) values[Number(input.dataset.nvOption)] = input.value;
    return values;
  };
  const findVariant = (values) => variants.find((v) => v.options.every((o, i) => o === values[i]));

  const markAvailability = (values) => {
    for (const input of optionInputs) {
      const i = Number(input.dataset.nvOption);
      const probe = [...values];
      probe[i] = input.value;
      const match = findVariant(probe);
      input.closest('.nv-pdp__pill')?.classList.toggle('is-unavailable', !match || !match.available);
    }
  };

  const render = (variant) => {
    const addButtons = root.querySelectorAll('[data-nv-add]');
    const buy = root.querySelector('[data-nv-buy]');
    const stock = root.querySelector('[data-nv-stock]');
    const stockText = root.querySelector('[data-nv-stock-text]');
    const available = Boolean(variant?.available);

    for (const btn of addButtons) {
      btn.disabled = !available;
      const label = btn.querySelector('[data-nv-add-label]');
      if (label) label.textContent = !variant ? 'Unavailable' : available ? 'Add to cart' : 'Sold out';
    }
    if (buy) buy.hidden = !available;
    stock?.classList.toggle('is-out', !available);
    if (stockText) stockText.textContent = available ? 'In stock, ready to ship' : variant ? 'Currently sold out' : 'This combination is unavailable';
    if (!variant) return;

    if (idInput) idInput.value = String(variant.id);
    for (const el of root.querySelectorAll('[data-nv-now]')) el.textContent = money(variant.price);
    const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
    const was = root.querySelector('[data-nv-was]');
    const save = root.querySelector('[data-nv-save]');
    const flag = root.querySelector('[data-nv-flag]');
    if (was) { was.hidden = !onSale; was.textContent = onSale ? money(variant.compare_at_price) : ''; }
    if (save) { save.hidden = !onSale; save.textContent = onSale ? `You save ${money(variant.compare_at_price - variant.price)}` : ''; }
    if (flag) {
      flag.hidden = !onSale;
      if (onSale) flag.textContent = `Save ${Math.floor(((variant.compare_at_price - variant.price) * 100) / variant.compare_at_price)}%`;
    }
    variant.options.forEach((value, i) => {
      const out = root.querySelector(`[data-nv-option-value="${i}"]`);
      if (out) out.textContent = value;
    });

    const url = new URL(window.location.href);
    url.searchParams.set('variant', String(variant.id));
    window.history.replaceState({}, '', url);

    const mediaId = variant.featured_media?.id;
    if (mediaId) goTo(slideEls.findIndex((s) => s.dataset.mediaId === String(mediaId)));
  };

  for (const input of optionInputs) {
    input.addEventListener('change', () => {
      const values = selectedOptions();
      markAvailability(values);
      render(findVariant(values));
    });
  }
  if (optionInputs.length) markAvailability(selectedOptions());

  // ---------- Sticky buy bar ----------
  const mainButton = form?.querySelector('[data-nv-add]');
  if (sticky && mainButton && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      sticky.classList.toggle('is-visible', show);
      sticky.setAttribute('aria-hidden', String(!show));
      sticky.querySelector('[data-nv-add]')?.setAttribute('tabindex', show ? '0' : '-1');
    }).observe(mainButton);
  }
}
