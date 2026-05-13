const TROY_OUNCE_TO_GRAMS = 31.1035;
const USD_TO_AED = 3.6725;
const VAT_RATE = 0.05;
const PRICE_ENDPOINT = 'https://api.gold-api.com/price/XAU';
const POLL_MS = 5000;

const form = document.getElementById('calc-form');
const gramsInput = document.getElementById('grams');
const karatSelect = document.getElementById('karat');
const vatCheckbox = document.getElementById('vat');
const submitBtn = document.getElementById('submit-btn');
const resultEl = document.getElementById('result');
const tickerPriceEl = document.getElementById('ticker-price');

const aedFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Cached latest spot price (USD/oz) — shared by the ticker and Calculate
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

function renderTicker(price, prev) {
  const aed = aedPerGramPure(price);
  tickerPriceEl.textContent = aedFmt.format(aed);
  tickerPriceEl.classList.remove('is-stale');

  if (prev !== null && prev !== price) {
    tickerPriceEl.classList.add('is-updated');
    setTimeout(() => tickerPriceEl.classList.remove('is-updated'), 600);
  }
}

async function refreshPrice() {
  try {
    const price = await fetchGoldPriceUsdPerOz();
    const prev = latestPrice;
    latestPrice = price;
    latestPriceTs = Date.now();
    renderTicker(price, prev);
  } catch (err) {
    console.warn('Ticker refresh failed:', err);
    tickerPriceEl.classList.add('is-stale');
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

// Pause polling while the tab is hidden; resume + refresh on return
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshPrice();
    startPolling();
  } else {
    stopPolling();
  }
});

// Kick off the ticker
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

  // Fallback: ticker hasn't successfully fetched yet — do an on-demand fetch
  if (pricePerOz == null) {
    submitBtn.disabled = true;
    showLoading();
    try {
      pricePerOz = await fetchGoldPriceUsdPerOz();
      latestPrice = pricePerOz;
      latestPriceTs = Date.now();
      renderTicker(pricePerOz, null);
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

// Clear result if the user edits inputs after a calculation
[gramsInput, karatSelect, vatCheckbox].forEach((el) => {
  const event = el === vatCheckbox ? 'change' : 'input';
  el.addEventListener(event, () => {
    if (resultEl.classList.contains('is-success') || resultEl.classList.contains('is-error')) {
      resetResult();
    }
  });
});
