const TROY_OUNCE_TO_GRAMS = 31.1035;
const USD_TO_AED = 3.6725;
const PRICE_ENDPOINT = 'https://api.gold-api.com/price/XAU';

const form = document.getElementById('calc-form');
const gramsInput = document.getElementById('grams');
const karatSelect = document.getElementById('karat');
const submitBtn = document.getElementById('submit-btn');
const resultEl = document.getElementById('result');

const aedFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

function showResult({ totalAed, pricePerOz, karatLabel, grams }) {
  resultEl.className = 'result is-success';
  resultEl.innerHTML = `
    <div class="result__value">
      ${aedFmt.format(totalAed)}<span class="currency">AED</span>
    </div>
    <div class="result__meta">
      <span class="result__chip">$${usdFmt.format(pricePerOz)}/oz</span>
      <span class="result__chip">${karatLabel}</span>
      <span class="result__chip">${grams}g</span>
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

  submitBtn.disabled = true;
  showLoading();

  try {
    const pricePerOz = await fetchGoldPriceUsdPerOz();
    const aedPerGramPure = (pricePerOz / TROY_OUNCE_TO_GRAMS) * USD_TO_AED;
    const totalAed = aedPerGramPure * karatPurity * grams;

    showResult({
      totalAed,
      pricePerOz,
      karatLabel,
      grams: grams % 1 === 0 ? grams.toString() : grams.toFixed(2),
    });
  } catch (err) {
    showError('Could not fetch the live gold price. Try again in a moment.');
    console.error(err);
  } finally {
    submitBtn.disabled = false;
  }
});

// Clear result if the user edits inputs after a calculation
[gramsInput, karatSelect].forEach((el) => {
  el.addEventListener('input', () => {
    if (resultEl.classList.contains('is-success') || resultEl.classList.contains('is-error')) {
      resetResult();
    }
  });
});
