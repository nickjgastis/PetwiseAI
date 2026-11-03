// Mock PIMS behaviour: a save button that only proves the field values are readable by the page.
const save = document.getElementById('save');
const note = document.getElementById('saved-note');

save?.addEventListener('click', () => {
    const values = {};
    document.querySelectorAll('textarea, input, [contenteditable="true"]').forEach((el) => {
        if (el.id) values[el.id] = el.isContentEditable ? el.innerText : el.value;
    });
    window.__lastSave = values;
    if (note) note.hidden = false;
});
