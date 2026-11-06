import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { $getRoot, createEditor } from 'lexical';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';

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

// Lexical's model text: one line per paragraph or line break, so collapsed line breaks show up as one long line.
const mountLexical = (id) => {
    const editor = createEditor({ namespace: id, nodes: [HeadingNode, QuoteNode], onError: (e) => console.error(e) });
    editor.setRootElement(document.getElementById(id));
    registerRichText(editor);
    const model = document.getElementById(`${id}-model`);
    editor.registerUpdateListener(({ editorState }) => {
        model.textContent = editorState.read(() => $getRoot().getTextContent());
    });
    return editor;
};

window.__lexical = {
    plan: mountLexical('lexical-plan'),
    record: mountLexical('lexical-record'),
};
