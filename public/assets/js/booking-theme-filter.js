// input_20 Phase 5: Book Now form's event-type/theme cascade. Deliberately
// NOT shared with the admin forms' theme-filter.js (public/assets/js/
// theme-filter.js, from Phase 4) — that script auto-selects the first
// available theme when the event type changes, which is correct for the
// admin forms (a theme is required there) but wrong here: preferredTheme
// is optional, so nothing should be silently chosen on a visitor's behalf.
// This is UX only — the server independently re-validates both the event
// type and the theme/event-type pairing on submission regardless of what
// this script does or whether it runs at all.
(function () {
  var eventTypeSelect = document.getElementById('eventType');
  var themeSelect = document.getElementById('preferredTheme');
  if (!eventTypeSelect || !themeSelect) return;

  var themeOptions = Array.prototype.slice.call(themeSelect.options);

  function applyFilter() {
    var type = eventTypeSelect.value;
    themeOptions.forEach(function (opt) {
      if (!opt.value) return; // leave the blank/placeholder option alone
      var matches = opt.dataset.eventType === type;
      opt.hidden = !matches;
      opt.disabled = !matches;
    });
    // Always reset to blank on a type change, rather than carrying over or
    // auto-picking a theme for the visitor.
    themeSelect.value = '';
  }

  eventTypeSelect.addEventListener('change', applyFilter);
  applyFilter();
})();
