const FALLBACK_FUNCTION_URL = 'https://rlpjttgcylgzgbkhfjie.supabase.co/functions/v1/public-quote-form';
const AGE_BANDS = [
  { id: '0_18', title: '0-18' },
  { id: '19_23', title: '19-23' },
  { id: '24_28', title: '24-28' },
  { id: '29_33', title: '29-33' },
  { id: '34_38', title: '34-38' },
  { id: '39_43', title: '39-43' },
  { id: '44_48', title: '44-48' },
  { id: '49_53', title: '49-53' },
  { id: '54_58', title: '54-58' },
  { id: '59_plus', title: '59+' },
];

const config = window.HC_QUOTE_FORM_CONFIG || {};
const functionUrl = String(config.functionUrl || FALLBACK_FUNCTION_URL).replace(/\/+$/, '');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorText = document.getElementById('errorText');
const formState = document.getElementById('formState');
const successState = document.getElementById('successState');
const form = document.getElementById('quoteForm');
const fieldList = document.getElementById('fieldList');
const notice = document.getElementById('formNotice');
const submitButton = document.getElementById('submitButton');
let loadedForm = null;
let shortCode = '';

function text(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function setVisible(target) {
  [loadingState, errorState, formState, successState].forEach((element) => {
    element.hidden = element !== target;
  });
}

function setError(message) {
  errorText.textContent = text(message, 'Nao foi possivel abrir este formulario.');
  setVisible(errorState);
}

function readCode() {
  const params = new URLSearchParams(window.location.search);
  const direct = text(params.get('code'), text(params.get('ref')));
  if (direct) return direct;

  const hash = text(window.location.hash).replace(/^#\/?/, '');
  if (hash) return hash.split('/').filter(Boolean).pop() || '';

  const parts = window.location.pathname.split('/').filter(Boolean);
  const cotacaoIndex = parts.lastIndexOf('cotacao');
  return cotacaoIndex >= 0 ? text(parts[cotacaoIndex + 1]) : '';
}

function fieldOptions(field) {
  if (Array.isArray(field.options) && field.options.length) return field.options;
  return field.type === 'age_bands' || field.id === 'faixas_etarias' ? AGE_BANDS : [];
}

function createLabel(field) {
  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = text(field.label, 'Campo');
  if (field.required) {
    const required = document.createElement('b');
    required.textContent = '*';
    label.append(required);
  }
  return label;
}

function addHelper(wrapper, field) {
  if (!text(field.helperText)) return;
  const helper = document.createElement('p');
  helper.className = 'helper';
  helper.textContent = field.helperText;
  wrapper.append(helper);
}

function createBasicControl(field) {
  const type = text(field.type, 'text');
  let control;

  if (type === 'textarea') {
    control = document.createElement('textarea');
    control.rows = 4;
  } else if (type === 'select') {
    control = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Selecione';
    control.append(blank);
    fieldOptions(field).forEach((option) => {
      const node = document.createElement('option');
      node.value = text(option.id);
      node.textContent = text(option.title, option.id);
      control.append(node);
    });
  } else {
    control = document.createElement('input');
    control.type = type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text';
    if (control.type === 'number') control.min = '0';
  }

  control.id = text(field.id);
  control.name = text(field.id);
  control.required = Boolean(field.required);
  if (text(field.placeholder)) control.placeholder = field.placeholder;
  return control;
}

function refreshAgeBandOutput(group, counts) {
  const output = group.querySelector('[data-age-output]');
  const total = group.querySelector('[data-age-total]');
  const parts = [];
  let people = 0;

  group.querySelectorAll('[data-age-band]').forEach((row) => {
    const id = row.getAttribute('data-age-band');
    const title = row.getAttribute('data-age-title');
    const value = counts[id] || 0;
    people += value;
    row.querySelector('[data-age-count]').textContent = String(value);
    row.querySelector('[data-age-action="decrement"]').disabled = value <= 0;
    if (value > 0) {
      parts.push(`${value} ${value === 1 ? 'pessoa' : 'pessoas'} ${title}`);
    }
  });

  output.value = parts.join(', ');
  total.textContent = people > 0
    ? `${people} ${people === 1 ? 'pessoa adicionada' : 'pessoas adicionadas'}`
    : 'Nenhuma pessoa adicionada';
}

function createAgeBandsControl(field) {
  const group = document.createElement('div');
  group.className = 'age-bands';
  const output = document.createElement('input');
  output.type = 'hidden';
  output.id = text(field.id);
  output.name = text(field.id);
  output.required = Boolean(field.required);
  output.setAttribute('data-age-output', '');
  const grid = document.createElement('div');
  grid.className = 'age-grid';
  const counts = {};

  fieldOptions(field).forEach((option) => {
    const row = document.createElement('div');
    row.className = 'age-band';
    row.setAttribute('data-age-band', text(option.id));
    row.setAttribute('data-age-title', text(option.title, option.id));
    const label = document.createElement('span');
    label.className = 'age-name';
    label.textContent = `${text(option.title, option.id)} anos`;
    const actions = document.createElement('span');
    actions.className = 'age-actions';
    const decrement = document.createElement('button');
    decrement.type = 'button';
    decrement.textContent = '-';
    decrement.setAttribute('data-age-action', 'decrement');
    decrement.setAttribute('aria-label', `Diminuir faixa ${text(option.title, option.id)}`);
    const count = document.createElement('strong');
    count.textContent = '0';
    count.setAttribute('data-age-count', '');
    const increment = document.createElement('button');
    increment.type = 'button';
    increment.textContent = '+';
    increment.setAttribute('data-age-action', 'increment');
    increment.setAttribute('aria-label', `Adicionar faixa ${text(option.title, option.id)}`);
    actions.append(decrement, count, increment);
    row.append(label, actions);
    counts[text(option.id)] = 0;
    row.querySelectorAll('[data-age-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const direction = button.getAttribute('data-age-action') === 'increment' ? 1 : -1;
        counts[text(option.id)] = Math.max(0, (counts[text(option.id)] || 0) + direction);
        refreshAgeBandOutput(group, counts);
      });
    });
    grid.append(row);
  });

  const total = document.createElement('div');
  total.className = 'age-total';
  total.setAttribute('data-age-total', '');
  group.append(output, grid, total);
  refreshAgeBandOutput(group, counts);
  return group;
}

function renderField(field) {
  const wrapper = document.createElement(field.type === 'age_bands' || field.id === 'faixas_etarias' ? 'div' : 'label');
  wrapper.className = 'field';
  wrapper.append(createLabel(field));
  wrapper.append(field.type === 'age_bands' || field.id === 'faixas_etarias'
    ? createAgeBandsControl(field)
    : createBasicControl(field));
  addHelper(wrapper, field);
  fieldList.append(wrapper);
}

function renderForm(payload) {
  loadedForm = payload.form;
  document.getElementById('contactGreeting').textContent = payload.context?.contactName
    ? `Oi, ${payload.context.contactName}`
    : 'Formulario rapido';
  document.getElementById('formTitle').textContent = text(loadedForm.name, 'Formulario de cotacao HC Saude');
  document.getElementById('formDescription').textContent = text(
    loadedForm.description,
    'Responda os dados abaixo para a equipe preparar sua cotacao.',
  );
  document.getElementById('successTitle').textContent = text(loadedForm.settings?.successTitle, 'Formulario recebido');
  document.getElementById('successMessage').textContent = text(
    loadedForm.settings?.successMessage,
    'Obrigado. Ja recebemos seus dados para preparar a cotacao.',
  );
  submitButton.textContent = text(loadedForm.settings?.submitButtonText, 'Enviar dados');
  fieldList.replaceChildren();
  (loadedForm.fields || []).forEach(renderField);
  setVisible(formState);
}

async function readPayload(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || 'Nao foi possivel carregar este formulario.');
  }
  return payload.data;
}

async function loadForm() {
  shortCode = readCode();
  if (!shortCode) {
    setError('Este link nao trouxe o codigo do formulario.');
    return;
  }

  try {
    const response = await fetch(`${functionUrl}?code=${encodeURIComponent(shortCode)}`, {
      headers: { Accept: 'application/json' },
    });
    renderForm(await readPayload(response));
  } catch (error) {
    setError(error instanceof Error ? error.message : '');
  }
}

function setNotice(message) {
  notice.textContent = text(message, 'Nao foi possivel enviar. Tente novamente.');
  notice.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  notice.hidden = true;
  submitButton.disabled = true;
  const idleLabel = text(loadedForm?.settings?.submitButtonText, 'Enviar dados');
  submitButton.textContent = 'Enviando...';
  const answers = {};
  new FormData(form).forEach((value, key) => {
    answers[key] = text(value);
  });

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: shortCode, answers }),
    });
    await readPayload(response);
    setVisible(successState);
  } catch (error) {
    setNotice(error instanceof Error ? error.message : '');
    submitButton.disabled = false;
    submitButton.textContent = idleLabel;
  }
});

loadForm();
