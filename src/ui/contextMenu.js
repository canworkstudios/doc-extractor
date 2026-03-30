/**
 * contextMenu.js
 * Right-click context menu handler using jQuery.
 */

import $ from 'jquery';

let targetElement = null;

export function initContextMenu() {
    $(document).on('contextmenu', '.prose-area', function(e) {
        e.preventDefault();
        targetElement = e.target;
        
        const menu = $('#ctx-menu');
        menu.css({
            top: e.clientY + 'px',
            left: e.clientX + 'px'
        }).show();
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('#ctx-menu').length) {
            $('#ctx-menu').hide();
        }
    });

    $('#ctx-img-url').on('click', function() {
        $('#ctx-menu').hide();
        const url = prompt('Image URL:');
        if (url && targetElement) {
            const img = $('<img>').attr('src', url).css('max-width', '100%');
            $(targetElement).append(img);
        }
    });

    $('#ctx-img-file').on('click', function() {
        $('#ctx-menu').hide();
        $('#ctx-file-input').trigger('click');
    });

    $('#ctx-file-input').on('change', function(e) {
        const file = e.target.files[0];
        if (!file || !targetElement) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = $('<img>').attr('src', e.target.result).css('max-width', '100%');
            $(targetElement).append(img);
        };
        reader.readAsDataURL(file);
        this.value = ''; // Reset
    });
}
