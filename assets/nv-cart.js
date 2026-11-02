// Nuvravo cart helper: AJAX add-to-cart for [data-nv-card-form] and the Nuvravo product form,
// dispatching the theme's CartLinesUpdateEvent so the cart drawer and cart count update.
// "Buy now" buttons (name="return_to") keep the native submit and go straight to checkout.
import { CartLinesUpdateEvent } from '@shopify/events';

const sectionIds = () =>
  [...document.querySelectorAll('cart-items-component')]
    .map((el) => el instanceof HTMLElement && el.dataset.sectionId)
    .filter(Boolean);

/**
 * Adds a variant to the cart and notifies the theme.
 * @param {HTMLElement} source - Element the event is dispatched from
 * @param {string} variantId
 * @param {number} quantity
 */
export async function nvAddToCart(source, variantId, quantity) {
  const deferred = CartLinesUpdateEvent.createPromise();
  source.dispatchEvent(
    new CartLinesUpdateEvent({
      action: 'add',
      context: 'product',
      lines: [{ merchandiseId: String(variantId), quantity }],
      promise: deferred.promise,
    })
  );

  try {
    const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity }], sections: sectionIds().join(',') }),
    });
    const result = await response.json();
    const cart = await (await fetch(`${window.Shopify?.routes?.root || '/'}cart.js`)).json();
    const didError = Boolean(result.status);
    deferred.resolve({
      cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
      detail: { items: cart.items, sections: result.sections, didError, source: 'nv-cart', itemCount: quantity },
    });
    if (didError) throw new Error(result.description || result.message || 'Could not add to cart');
    return cart;
  } catch (error) {
    deferred.reject(error);
    throw error;
  }
}

/** Updates a card's price when its option dropdown changes. */
document.addEventListener('change', (event) => {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement) || !select.matches('[data-nv-variant-select]')) return;
  const card = select.closest('[data-nv-card]');
  const option = select.selectedOptions[0];
  if (!card || !option) return;
  const now = card.querySelector('[data-nv-now]');
  const was = card.querySelector('[data-nv-was]');
  if (now) now.textContent = option.dataset.price || '';
  if (was) {
    was.textContent = option.dataset.was || '';
    was.hidden = !option.dataset.was;
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches('[data-nv-card-form], [data-nv-product-form]')) return;
  // "Buy now" submits natively with return_to=/checkout.
  if (event.submitter?.getAttribute('name') === 'return_to') return;

  event.preventDefault();
  const button = event.submitter instanceof HTMLButtonElement ? event.submitter : form.querySelector('[data-nv-add]');
  const label = button?.querySelector('[data-nv-add-label]');
  const original = label?.textContent;
  const data = new FormData(form);
  const quantity = Math.max(1, Number(data.get('quantity')) || 1);

  button?.setAttribute('aria-busy', 'true');
  button?.classList.add('is-loading');
  try {
    await nvAddToCart(form, String(data.get('id')), quantity);
    if (label) label.textContent = 'Added ✓';
    button?.classList.add('is-added');
  } catch (error) {
    if (label) label.textContent = 'Unavailable';
    console.warn('[nv-cart]', error);
  } finally {
    button?.removeAttribute('aria-busy');
    button?.classList.remove('is-loading');
    setTimeout(() => {
      if (label && original) label.textContent = original;
      button?.classList.remove('is-added');
    }, 2200);
  }
});
