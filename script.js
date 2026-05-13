const TROY_OUNCE_TO_GRAMS = 31.1035;
const USD_TO_AED = 3.6725;
const VAT_RATE = 0.05;
const PRICE_ENDPOINT = 'https://api.gold-api.com/price/XAU';
const POLL_MS = 5000;

const KARATS = [
  { label: '24K', purity: 0.9999 },
  { label: '22K', purity: 0.9167 },
  { label: '21K', purity: 0.8750 },
  { label: '18K', purity: 0.7500 },
];

const form = document.getElementById('calc-form');
const gramsInput = document.getElementById('grams');
const karatSelect = document.getElementById('karat');
const vatCheckbox = document.getElementById('vat');
const submitBtn = document.getElementById('submit-btn');
const resultEl = document.getElementById('result');
const tickerEl = document.getElementById('ticker');
const trackEl = document.getElementById('ticker-track');

const aedFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

let latestPrice = null;
let latestPriceTs = null;
let pollHandle = null;

function aedPerGramPure(usdPerOz) {
  return (usdPerOz / TROY_OUNCE_TO_GRAMS) * USD_TO_AED;
}

function resetResult() {
  resultEl.className = 'result';
  resultEl.innerHTML = '';
}

function showLoading() {
  resultEl.className = 'result is-loading';
  resultEl.innerHTML = '<span class="result__loading">Fetching live price</span>';
}

function showError(message) {
  resultEl.className = 'result is-error';
  resultEl.innerHTML = `<div class="result__error">${message}</div>`;
}

function showResult({ totalAed, pricePerOz, karatLabel, grams, vatApplied }) {
  resultEl.className = 'result is-success';
  resultEl.innerHTML = `
    <div class="result__value">
      ${aedFmt.format(totalAed)}<span class="currency">AED</span>
    </div>
    <div class="result__meta">
      <span class="result__chip">$${usdFmt.format(pricePerOz)}/oz</span>
      <span class="result__chip">${karatLabel}</span>
      <span class="result__chip">${grams}g</span>
      ${vatApplied ? '<span class="result__chip">+5% VAT</span>' : ''}
    </div>
  `;
}

async function fetchGoldPriceUsdPerOz() {
  const res = await fetch(PRICE_ENDPOINT, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Price service returned ${res.status}`);
  }
  const data = await res.json();
  if (typeof data.price !== 'number') {
    throw new Error('Unexpected price response shape');
  }
  return data.price;
}

// Build the carousel track with TWO identical copies of all karats.
// Animating translateX(0 → -50%) then loops seamlessly.
function buildTicker() {
  const items = [];
  for (let copy = 0; copy < 2; copy++) {
    KARATS.forEach((k, idx) => {
      if (!(copy === 0 && idx === 0)) {
        items.push('<span class="ticker__bullet" aria-hidden="true">·</span>');
      }
      items.push(`
        <span class="ticker__item">
          <span class="ticker__item-karat">${k.label}</span>
          <span class="ticker__item-price" data-purity="${k.purity}">—</span>
          <span class="ticker__item-unit">AED/g</span>
        </span>
      `);
    });
  }
  trackEl.innerHTML = items.join('');
}

function renderTickerPrices(price, prev) {
  const baseAed = aedPerGramPure(price);
  const priceEls = trackEl.querySelectorAll('.ticker__item-price');
  priceEls.forEach((el) => {
    const purity = parseFloat(el.dataset.purity);
    el.textContent = aedFmt.format(baseAed * purity);
  });

  tickerEl.classList.remove('is-stale');

  // Flash only when the underlying USD/oz value actually changed
  if (prev !== null && prev !== price) {
    priceEls.forEach((el) => el.classList.add('is-updated'));
    setTimeout(() => {
      priceEls.forEach((el) => el.classList.remove('is-updated'));
    }, 600);
  }
}

async function refreshPrice() {
  try {
    const price = await fetchGoldPriceUsdPerOz();
    const prev = latestPrice;
    latestPrice = price;
    latestPriceTs = Date.now();
    renderTickerPrices(price, prev);
  } catch (err) {
    console.warn('Ticker refresh failed:', err);
    tickerEl.classList.add('is-stale');
  }
}

function startPolling() {
  if (pollHandle) return;
  pollHandle = setInterval(refreshPrice, POLL_MS);
}

function stopPolling() {
  if (!pollHandle) return;
  clearInterval(pollHandle);
  pollHandle = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshPrice();
    startPolling();
  } else {
    stopPolling();
  }
});

buildTicker();
refreshPrice();
startPolling();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const grams = parseFloat(gramsInput.value);
  if (!Number.isFinite(grams) || grams <= 0) {
    showError('Enter a weight greater than zero.');
    gramsInput.focus();
    return;
  }

  const karatPurity = parseFloat(karatSelect.value);
  const karatLabel = karatSelect.options[karatSelect.selectedIndex].text;
  const vatApplied = vatCheckbox.checked;

  let pricePerOz = latestPrice;

  if (pricePerOz == null) {
    submitBtn.disabled = true;
    showLoading();
    try {
      pricePerOz = await fetchGoldPriceUsdPerOz();
      latestPrice = pricePerOz;
      latestPriceTs = Date.now();
      renderTickerPrices(pricePerOz, null);
    } catch (err) {
      showError('Could not fetch the live gold price. Try again in a moment.');
      console.error(err);
      submitBtn.disabled = false;
      return;
    }
    submitBtn.disabled = false;
  }

  let totalAed = aedPerGramPure(pricePerOz) * karatPurity * grams;
  if (vatApplied) totalAed *= 1 + VAT_RATE;

  showResult({
    totalAed,
    pricePerOz,
    karatLabel,
    grams: grams % 1 === 0 ? grams.toString() : grams.toFixed(2),
    vatApplied,
  });
});

[gramsInput, karatSelect, vatCheckbox].forEach((el) => {
  const event = el === vatCheckbox ? 'change' : 'input';
  el.addEventListener(event, () => {
    if (resultEl.classList.contains('is-success') || resultEl.classList.contains('is-error')) {
      resetResult();
    }
  });
});
