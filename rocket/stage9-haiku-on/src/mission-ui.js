// Mission game panels: propellant and score readout, the decision card and the result card.
// Renders the game's view and reports the player's choices through the handlers it is given.
// Text is set with textContent, so option labels are never parsed as markup.

const _setText = (el, value) => {
  if (el && el.textContent !== value) el.textContent = value;
};

const _setHidden = (el, hidden) => el.classList.toggle('hidden', hidden);

function _optionButton(option, index, onChoose) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn decision-option';
  button.disabled = !option.affordable;
  button.addEventListener('click', () => onChoose(option.id));

  const head = document.createElement('span');
  head.className = 'option-head';
  head.textContent = `${index + 1}  ${option.label}`;

  const cost = document.createElement('span');
  cost.className = 'option-cost';
  cost.textContent = option.cost ? `${option.cost} propellant` : 'no propellant';

  const detail = document.createElement('span');
  detail.className = 'option-detail';
  detail.textContent = option.risk ? `${option.detail} Risk: ${option.risk}.` : option.detail;

  button.append(head, cost, detail);
  return button;
}

function _row(label, value) {
  const row = document.createElement('div');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = String(value);
  row.append(dt, dd);
  return row;
}

export function createMissionUi({ onChoose, onRestart, onToggleAutopilot, onToggleMode }) {
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $('mission-hud'),
    fuelBar: $('fuel-bar'),
    fuelFill: $('fuel-fill'),
    fuelText: $('fuel-text'),
    score: $('mission-score'),
    mode: $('mode-btn'),
    autopilot: $('autopilot-btn'),
    decision: $('decision'),
    decisionStep: $('decision-step'),
    decisionTitle: $('decision-title'),
    decisionPrompt: $('decision-prompt'),
    decisionOptions: $('decision-options'),
    result: $('result'),
    resultTitle: $('result-title'),
    resultReason: $('result-reason'),
    resultBreakdown: $('result-breakdown'),
    restart: $('restart-btn'),
    restartNote: $('restart-note'),
  };
  let shownDecision = null; // id of the decision whose options are on screen
  let shownOutcome = null; // outcome object whose text is on screen

  ui.restart.addEventListener('click', onRestart);
  ui.mode.addEventListener('click', onToggleMode);
  ui.autopilot.addEventListener('click', onToggleAutopilot);

  function renderHud(view) {
    const pct = (100 * view.fuel) / view.budget;
    ui.fuelFill.style.width = `${Math.max(0, pct)}%`;
    ui.fuelFill.classList.toggle('low', pct < 25);
    ui.fuelBar.setAttribute('aria-valuenow', String(view.fuel));
    _setText(ui.fuelText, `${view.fuel} / ${view.budget}`);
    _setText(ui.score, String(view.score));
    _setText(ui.autopilot, `Autopilot: ${view.autopilot ? 'on' : 'off'}`);
    ui.autopilot.setAttribute('aria-pressed', String(view.autopilot));
    ui.mode.disabled = view.locked;
  }

  function renderDecision(pending) {
    _setHidden(ui.decision, !pending);
    if (!pending) {
      shownDecision = null;
      return;
    }
    if (shownDecision === pending.id) return;
    shownDecision = pending.id;
    _setText(ui.decisionStep, `Decision ${pending.step} of ${pending.total}`);
    _setText(ui.decisionTitle, pending.title);
    _setText(ui.decisionPrompt, pending.prompt);
    ui.decisionOptions.replaceChildren(
      ...pending.options.map((o, i) => _optionButton(o, i, onChoose)),
    );
  }

  function renderResult(view) {
    const outcome = view.outcome;
    _setHidden(ui.result, !outcome);
    if (outcome && outcome !== shownOutcome) {
      shownOutcome = outcome;
      ui.result.classList.toggle('success', outcome.success);
      ui.result.classList.toggle('failure', !outcome.success);
      _setText(ui.resultTitle, outcome.title);
      _setText(ui.resultReason, outcome.reason);
      const { decisions, landing, fuel } = outcome.breakdown;
      ui.resultBreakdown.replaceChildren(
        _row('Decisions', decisions),
        _row('Landing accuracy', landing),
        _row('Propellant left', fuel),
        _row('Total', outcome.total),
      );
      _setText(ui.restart, outcome.success ? 'Fly again' : 'Retry mission');
    }
    const note = view.restartIn === null || !outcome
      ? ''
      : `Autopilot flies again in ${Math.ceil(view.restartIn)} s`;
    _setText(ui.restartNote, note);
  }

  return {
    // Shows or hides the mission panels when the player switches between mission and free flight.
    setMode(missionOn) {
      _setHidden(ui.hud, !missionOn);
      _setHidden(ui.autopilot, !missionOn);
      _setText(ui.mode, missionOn ? 'Mode: Mission' : 'Mode: Free flight');
      ui.mode.setAttribute('aria-pressed', String(missionOn));
      if (!missionOn) {
        _setHidden(ui.decision, true);
        _setHidden(ui.result, true);
      }
    },
    render(view) {
      renderHud(view);
      renderDecision(view.pending);
      renderResult(view);
    },
  };
}
