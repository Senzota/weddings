// input_20 Phase 4: shared between event-form.ejs (Create) and
// edit-event.ejs (Edit) — previously two nearly-identical inline copies of
// this exact logic. Filters the theme <select> to only the themes for the
// currently chosen event type, keeps the selected theme valid across a
// type change, and swaps the "Couple names"/"Celebrant"/etc. label text by
// reading each event-type <option>'s own data-title-label attribute
// (input_20 Phase 1) rather than a hardcoded ternary.
//
// Both forms give #coupleNamesLabel a plain, text-only target element (on
// the Create form this is a <span> wrapping just the label text, inside a
// <label> that still wraps the <input> for accessibility; on the Edit form
// it's the <label> itself, separate from its <input>) — either way, a
// direct textContent assignment is correct and requires no per-page
// branching here.
(function () {
  var eventTypeSelect = document.getElementById('eventType');
  var themeSelect = document.getElementById('theme');
  var coupleNamesLabel = document.getElementById('coupleNamesLabel');
  var themeOptions = Array.prototype.slice.call(themeSelect.options);

  function applyFilter() {
    var type = eventTypeSelect.value;
    var firstVisible = null;
    var currentStillVisible = false;
    themeOptions.forEach(function (opt) {
      var matches = opt.dataset.eventType === type;
      opt.hidden = !matches;
      opt.disabled = !matches;
      if (matches && !firstVisible) firstVisible = opt;
      if (matches && opt.value === themeSelect.value) currentStillVisible = true;
    });
    if (!currentStillVisible && firstVisible) themeSelect.value = firstVisible.value;
    var selectedOption = eventTypeSelect.options[eventTypeSelect.selectedIndex];
    coupleNamesLabel.textContent = selectedOption.dataset.titleLabel;
  }

  eventTypeSelect.addEventListener('change', applyFilter);
  applyFilter();
})();
