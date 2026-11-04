// Editor iframes that never navigate (about:blank), the way many rich-text editors build them.

const blankDom = document.createElement('iframe');
blankDom.id = 'frame-blank-dom';
blankDom.title = 'about:blank editor (DOM)';
document.getElementById('blank-dom-slot').appendChild(blankDom);
{
    const doc = blankDom.contentDocument;
    doc.body.style.cssText = 'margin:0;padding:10px;font:14px Georgia,serif';
    const label = doc.createElement('label');
    label.htmlFor = 'blank-plan';
    label.textContent = 'Plan';
    label.style.cssText = 'display:block;font-weight:bold';
    const area = doc.createElement('textarea');
    area.id = 'blank-plan';
    area.style.cssText = 'width:100%;height:120px;box-sizing:border-box';
    doc.body.append(label, area);
}

const blankWrite = document.createElement('iframe');
blankWrite.id = 'frame-blank-write';
blankWrite.title = 'about:blank editor (document.write)';
document.getElementById('blank-write-slot').appendChild(blankWrite);
{
    const doc = blankWrite.contentDocument;
    doc.open();
    doc.write(`<!doctype html><body style="margin:0;padding:10px;font:14px Georgia,serif">
<span id="blank-assessment-label" style="display:block;font-weight:bold">Assessment</span>
<div id="blank-assessment" contenteditable="true" aria-labelledby="blank-assessment-label"
     style="min-height:120px;border:1px solid #9aa5b1;padding:6px;white-space:pre-wrap"></div>
</body>`);
    doc.close();
}
