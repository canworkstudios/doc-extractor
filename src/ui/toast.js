/**
 * toast.js; lightweight toast notification
 */
import $ from 'jquery';

let _timer = null;

export function showToast(msg, type = 'info', durationMs = 2500) {
    const el = $('#toast');
    if (!el.length) return;
    
    el.text(msg);
    el.attr('class', 'toast visible' + (type !== 'info' ? ` toast--${type}` : ''));
    el.show();
    
    clearTimeout(_timer);
    _timer = setTimeout(() => {
        el.removeClass('visible');
        setTimeout(() => { el.hide(); }, 280);
    }, durationMs);
}
