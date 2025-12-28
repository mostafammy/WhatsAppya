function openMedia(src, type) {
    const modal = document.getElementById('mediaModal');
    const content = document.getElementById('modalContent');

    if (type === 'image') {
        content.innerHTML = '<img src="' + src + '" onclick="event.stopPropagation()">';
    } else if (type === 'video') {
        content.innerHTML = '<video src="' + src + '" controls autoplay onclick="event.stopPropagation()"></video>';
    }

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('mediaModal');
    const content = document.getElementById('modalContent');
    modal.style.display = 'none';
    content.innerHTML = '';
    document.body.style.overflow = 'auto';
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});
