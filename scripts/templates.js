function programManuallyTemplate() {
  return `<div class="manually-program-container">
                <h3>Manually</h3>
                <div>
                  <input
                    type="number"
                    placeholder="0"
                    id="duration"
                    name="duration"
                    min="0"
                    max="1440"
                  />
                  <label for="duration">Duration (minutes)</label>
                </div>
                <p>"0 min" means continuous operation!</p>
              </div>`;
}

function programAutomaticTemplate() {
    return `<div class="automatically-program-container">
                <h3>Automatically</h3>
                <div>
                  <input
                    type="number"
                    placeholder="0"
                    id="trigger-turn-off"
                    name="trigger-turn-off"
                    min="0"
                    max="100"
                  />
                  <label for="trigger-turn-off">Trigger Turn OFF (%)</label>
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="0"
                    id="trigger-turn-on"
                    name="trigger-turn-on"
                    min="0"
                    max="100"
                  />
                  <label for="trigger-turn-on">Trigger Turn ON (%)</label>
                </div>
                <p>Both fields must be filled in!</p>
              </div>`;
}
