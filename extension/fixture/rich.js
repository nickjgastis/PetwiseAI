import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const mount = (id) => {
    const quill = new Quill(`#${id}`, { theme: 'snow', modules: { toolbar: [['bold', 'italic'], [{ list: 'bullet' }]] } });
    quill.root.setAttribute('aria-labelledby', `${id}-label`);
    const model = document.getElementById(`${id}-model`);
    const sync = () => (model.textContent = quill.getText());
    quill.on('text-change', sync);
    sync();
    return quill;
};

window.__quills = {
    assessment: mount('quill-assessment'),
    record: mount('quill-record'),
};
